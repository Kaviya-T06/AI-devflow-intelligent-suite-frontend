/**
 * PresenceContext — provides live user presence, availability status,
 * team presence map, and WebSocket synchronization to the entire application.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type {
  AvailabilityStatus,
  PresenceData,
  PresenceUpdatePayload,
} from "../types";
import {
  fetchMyPresence,
  fetchTeamPresence,
  updateMyPresence,
  sendHeartbeat,
  presenceWS,
  STATUS_CONFIG,
} from "../services/presenceService";
import { useAuth } from "./AuthContext";

export interface PresenceContextValue {
  myPresence: PresenceData | null;
  teamPresence: Record<string, PresenceData>;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  isReconnecting: boolean;
  updateStatus: (payload: PresenceUpdatePayload) => Promise<void>;
  clearStatus: () => Promise<void>;
  getUserPresence: (userId?: string | null) => PresenceData | null;
  refreshPresence: () => Promise<void>;
}

const PresenceContext = createContext<PresenceContextValue | undefined>(undefined);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { profile, token, isAuthenticated } = useAuth();
  const [myPresence, setMyPresence] = useState<PresenceData | null>(null);
  const [teamPresence, setTeamPresence] = useState<Record<string, PresenceData>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);

  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef<boolean>(true);

  // Load my presence and team presence from REST
  const refreshPresence = useCallback(async () => {
    if (!profile?.id || !token) return;
    try {
      const [mine, team] = await Promise.allSettled([
        fetchMyPresence(token),
        fetchTeamPresence(undefined, token),
      ]);

      if (!isMounted.current) return;

      if (mine.status === "fulfilled") {
        setMyPresence(mine.value);
        setError(null);
      }

      if (team.status === "fulfilled") {
        const map: Record<string, PresenceData> = {};
        for (const u of team.value.users) {
          map[u.user_id] = u;
        }
        setTeamPresence(map);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "Failed to load presence");
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [profile?.id, token]);

  // Handle live incoming messages from WebSocket
  const handleWsMessage = useCallback(
    (msg: { type: string; data: unknown }) => {
      if (!isMounted.current) return;
      const { type, data } = msg;

      if (
        type === "INITIAL_PRESENCE" ||
        type === "STATUS_UPDATED" ||
        type === "HEARTBEAT_ACK"
      ) {
        const presData = data as PresenceData;
        if (presData.user_id === profile?.id) {
          setMyPresence(presData);
          setError(null);
          setIsConnected(true);
          setIsReconnecting(false);
        }
        setTeamPresence((prev) => ({
          ...prev,
          [presData.user_id]: presData,
        }));
      } else if (type === "PRESENCE_UPDATE") {
        const presData = data as PresenceData;
        if (presData.user_id === profile?.id) {
          setMyPresence(presData);
        }
        setTeamPresence((prev) => ({
          ...prev,
          [presData.user_id]: presData,
        }));
      }
    },
    [profile?.id]
  );

  useEffect(() => {
    isMounted.current = true;
    if (!isAuthenticated || !profile?.id || !token) {
      setLoading(false);
      setMyPresence(null);
      setTeamPresence({});
      presenceWS.disconnect();
      return;
    }

    // Initial load
    refreshPresence();

    // Connect WebSocket
    presenceWS.connect(profile.id);
    presenceWS.addHandler(handleWsMessage);

    // Periodic connection health check
    connCheckTimerRef.current = setInterval(() => {
      if (!isMounted.current) return;
      const connected = presenceWS.isConnected();
      setIsConnected(connected);
      setIsReconnecting(!connected);
    }, 3000);

    // REST Heartbeat fallback every 30 seconds
    heartbeatTimerRef.current = setInterval(async () => {
      if (!isMounted.current || !token) return;
      try {
        await sendHeartbeat(token);
      } catch {
        // Silently ignore fallback heartbeat error
      }
    }, 30000);

    return () => {
      isMounted.current = false;
      presenceWS.removeHandler(handleWsMessage);
      if (connCheckTimerRef.current) clearInterval(connCheckTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [isAuthenticated, profile?.id, token, refreshPresence, handleWsMessage]);

  const updateStatus = useCallback(
    async (payload: PresenceUpdatePayload) => {
      if (!token) return;
      try {
        // Optimistic UI update for immediate responsiveness
        if (myPresence && payload.availability_status) {
          setMyPresence((prev) =>
            prev
              ? {
                  ...prev,
                  availability_status: payload.availability_status as AvailabilityStatus,
                  status_message:
                    payload.status_message !== undefined
                      ? payload.status_message
                      : prev.status_message,
                  status_expires_at: payload.clear_expiry
                    ? null
                    : payload.status_expires_at !== undefined
                    ? payload.status_expires_at
                    : prev.status_expires_at,
                  effective_status: payload.availability_status as AvailabilityStatus,
                }
              : prev
          );
        }
        const updated = await updateMyPresence(payload, token);
        if (isMounted.current) {
          setMyPresence(updated);
          setTeamPresence((prev) => ({
            ...prev,
            [updated.user_id]: updated,
          }));
        }
        // Broadcast via WebSocket
        presenceWS.updateStatus(payload);
      } catch (err) {
        if (isMounted.current) {
          setError(err instanceof Error ? err.message : "Failed to update status");
        }
        await refreshPresence();
      }
    },
    [token, myPresence, refreshPresence]
  );

  const clearStatus = useCallback(async () => {
    await updateStatus({
      availability_status: "available",
      clear_expiry: true,
      status_message: "",
    });
  }, [updateStatus]);

  const getUserPresence = useCallback(
    (userId?: string | null): PresenceData | null => {
      if (!userId) return null;
      if (userId === profile?.id && myPresence) return myPresence;
      return teamPresence[userId] || null;
    },
    [profile?.id, myPresence, teamPresence]
  );

  const value: PresenceContextValue = {
    myPresence,
    teamPresence,
    loading,
    error,
    isConnected,
    isReconnecting,
    updateStatus,
    clearStatus,
    getUserPresence,
    refreshPresence,
  };

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

const defaultPresenceValue: PresenceContextValue = {
  myPresence: null,
  teamPresence: {},
  loading: false,
  error: null,
  isConnected: false,
  isReconnecting: false,
  updateStatus: async () => {},
  clearStatus: async () => {},
  getUserPresence: () => null,
  refreshPresence: async () => {},
};

export function usePresence(): PresenceContextValue {
  const context = useContext(PresenceContext);
  return context || defaultPresenceValue;
}

export { STATUS_CONFIG };

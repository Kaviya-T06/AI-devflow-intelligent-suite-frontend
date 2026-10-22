/**
 * Presence Service — interacts with backend presence API endpoints.
 * Manages status updates, heartbeats, team presence, and WebSocket connection.
 */
import type {
  AvailabilityStatus,
  HeartbeatResponse,
  PresenceData,
  PresenceUpdatePayload,
  TeamPresenceResponse,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function getToken(): string {
  return localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const authToken = token || getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(options.headers ?? {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(errorBody.detail || `HTTP ${response.status}`);
  }

  if (response.status === 204) return null as unknown as T;
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// REST API calls
// ---------------------------------------------------------------------------

export async function fetchMyPresence(token?: string): Promise<PresenceData> {
  return request<PresenceData>("/api/v1/presence/me", {}, token);
}

export async function updateMyPresence(
  payload: PresenceUpdatePayload,
  token?: string
): Promise<PresenceData> {
  return request<PresenceData>("/api/v1/presence/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export async function sendHeartbeat(token?: string): Promise<HeartbeatResponse> {
  return request<HeartbeatResponse>("/api/v1/presence/heartbeat", {
    method: "POST",
  }, token);
}

export async function fetchTeamPresence(
  params?: {
    role?: string;
    availability?: string;
    search?: string;
  },
  token?: string
): Promise<TeamPresenceResponse> {
  const qs = new URLSearchParams();
  if (params?.role && params.role !== "all") qs.set("role", params.role);
  if (params?.availability && params.availability !== "all") qs.set("availability", params.availability);
  if (params?.search) qs.set("search", params.search);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return request<TeamPresenceResponse>(`/api/v1/presence/team${query}`, {}, token);
}

export async function fetchUserPresence(userId: string, token?: string): Promise<PresenceData> {
  return request<PresenceData>(`/api/v1/presence/users/${userId}`, {}, token);
}

// ---------------------------------------------------------------------------
// Status metadata
// ---------------------------------------------------------------------------

export const STATUS_CONFIG: Record<
  AvailabilityStatus,
  { label: string; color: string; dotClass: string; bgClass: string; borderClass: string }
> = {
  available: {
    label: "Available",
    color: "#22c55e",
    dotClass: "bg-green-500",
    bgClass: "bg-green-500/15",
    borderClass: "border-green-500/30",
  },
  busy: {
    label: "Busy",
    color: "#eab308",
    dotClass: "bg-yellow-500",
    bgClass: "bg-yellow-500/15",
    borderClass: "border-yellow-500/30",
  },
  do_not_disturb: {
    label: "Do Not Disturb",
    color: "#a855f7",
    dotClass: "bg-purple-500",
    bgClass: "bg-purple-500/15",
    borderClass: "border-purple-500/30",
  },
  away: {
    label: "Away",
    color: "#94a3b8",
    dotClass: "bg-slate-400",
    bgClass: "bg-slate-400/15",
    borderClass: "border-slate-400/30",
  },
  offline: {
    label: "Offline",
    color: "#64748b",
    dotClass: "bg-slate-600",
    bgClass: "bg-slate-600/15",
    borderClass: "border-slate-600/30",
  },
};

export function getEffectiveStatus(presence: PresenceData | null): AvailabilityStatus {
  if (!presence) return "offline";
  return (presence.effective_status ?? "offline") as AvailabilityStatus;
}

export function formatLastSeen(lastSeenAt: string): string {
  if (!lastSeenAt) return "Unknown";
  const dt = new Date(lastSeenAt);
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ---------------------------------------------------------------------------
// WebSocket manager (singleton per page session)
// ---------------------------------------------------------------------------

type WsMessageHandler = (msg: { type: string; data: unknown }) => void;

class PresenceWebSocketManager {
  private ws: WebSocket | null = null;
  private handlers: Set<WsMessageHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  connect(_userId?: string): void {
    this.closed = false;
    this._openSocket();
  }

  private _openSocket(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    const token = getToken();
    if (!token) return;

    const wsUrl = API_BASE_URL.replace(/^http/, "ws");
    this.ws = new WebSocket(`${wsUrl}/api/v1/presence/ws?token=${token}`);

    this.ws.onopen = () => {
      this._clearReconnect();
      this._startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        this.handlers.forEach((h) => h(msg));
      } catch {
        // ignore bad frames
      }
    };

    this.ws.onclose = (ev) => {
      this._stopHeartbeat();
      if (!this.closed && ev.code !== 1008) {
        // Reconnect with back-off (5s)
        this._scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private _scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closed) this._openSocket();
    }, 5000);
  }

  private _clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _startHeartbeat(): void {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "HEARTBEAT" });
    }, 30000); // every 30 seconds
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  send(msg: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  updateStatus(payload: PresenceUpdatePayload): void {
    this.send({ type: "UPDATE_STATUS", data: payload });
  }

  addHandler(fn: WsMessageHandler): void {
    this.handlers.add(fn);
  }

  removeHandler(fn: WsMessageHandler): void {
    this.handlers.delete(fn);
  }

  disconnect(): void {
    this.closed = true;
    this._clearReconnect();
    this._stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const presenceWS = new PresenceWebSocketManager();

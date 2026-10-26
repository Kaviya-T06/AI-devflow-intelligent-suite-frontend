/**
 * AuthContext — provides authentication state, active profile, and actions to the entire app.
 *
 * Reads session from localStorage (JWT issued by FastAPI /auth/login).
 * All auth and user profile state is backed by the FastAPI backend (`public.users`).
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  getCurrentSession,
  clearToken,
  type AuthUser,
} from "../services/authService";
import { fetchProfile, normalizeRole } from "../services/profileService";
import type { Profile } from "../types";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AuthContextValue {
  user: AuthUser | null;
  profile: Profile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => void;
  /** Call after login to refresh context from localStorage */
  refreshAuth: () => void;
  /** Refresh the user profile from the backend API */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialSession = getCurrentSession();
  const [user, setUser] = useState<AuthUser | null>(() => initialSession?.user ?? null);
  const [token, setToken] = useState<string | null>(() => initialSession?.token ?? null);
  const [profile, setProfile] = useState<Profile | null>(() => {
    if (!initialSession?.user) return null;
    return {
      id: initialSession.user.id,
      full_name: initialSession.user.name,
      email: initialSession.user.email,
      role: normalizeRole(initialSession.user.role),
      avatar_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const syncProfile = useCallback(async (authUser: AuthUser | null) => {
    if (!authUser) {
      setProfile(null);
      return;
    }

    // Default optimistic profile from authUser
    const optimistic: Profile = {
      id: authUser.id,
      full_name: authUser.name,
      email: authUser.email,
      role: normalizeRole(authUser.role),
      avatar_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setProfile((prev) => (prev ? { ...prev, role: normalizeRole(authUser.role) } : optimistic));

    // Fetch freshest profile from backend
    try {
      const serverProfile = await fetchProfile(authUser.id);
      if (serverProfile) {
        setProfile(serverProfile);
      } else if (!localStorage.getItem("access_token")) {
        setUser(null);
        setToken(null);
        setProfile(null);
      }
    } catch {
      // Keep optimistic profile if backend is temporarily unreachable
    }
  }, []);

  const loadSession = useCallback(() => {
    const session = getCurrentSession();
    if (session) {
      setUser(session.user);
      setToken(session.token);
      const optimistic: Profile = {
        id: session.user.id,
        full_name: session.user.name,
        email: session.user.email,
        role: normalizeRole(session.user.role),
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setProfile((prev) => (prev && prev.id === session.user.id ? prev : optimistic));
      syncProfile(session.user);
    } else {
      setUser(null);
      setToken(null);
      setProfile(null);
    }
    setIsLoading(false);
  }, [syncProfile]);

  // Bootstrap from localStorage on mount
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
    setToken(null);
    setProfile(null);
  }, []);

  const refreshAuth = useCallback(() => {
    loadSession();
  }, [loadSession]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await syncProfile(user);
    }
  }, [user, syncProfile]);

  const value: AuthContextValue = {
    user,
    profile,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    signOut,
    refreshAuth,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

/**
 * AuthContext — provides authentication state and actions to the entire app.
 *
 * Reads session from localStorage (JWT issued by FastAPI /auth/login).
 * No Supabase Auth dependency — all auth goes through FastAPI.
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

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => void;
  /** Call after login to refresh context from localStorage */
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = useCallback(() => {
    const session = getCurrentSession();
    if (session) {
      setUser(session.user);
      setToken(session.token);
    } else {
      setUser(null);
      setToken(null);
    }
    setIsLoading(false);
  }, []);

  // Bootstrap from localStorage on mount
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
    setToken(null);
  }, []);

  const refreshAuth = useCallback(() => {
    loadSession();
  }, [loadSession]);

  const value: AuthContextValue = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    signOut,
    refreshAuth,
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

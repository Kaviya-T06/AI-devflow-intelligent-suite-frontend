/**
 * Authentication service — calls FastAPI /api/v1/auth endpoints.
 * Registration and login go through the FastAPI backend (not Supabase Auth directly).
 * The JWT returned by FastAPI is stored in localStorage for subsequent API calls.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const AUTH_BASE = `${API_BASE}/api/v1/auth`;

export type UserRole = "ADMIN" | "DEVELOPER" | "MANAGER";

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface LoginResult {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

// ---------------------------------------------------------------------------
// Role mapping: frontend roles → FastAPI RoleEnum values
// ---------------------------------------------------------------------------

const ROLE_LABEL_MAP: Record<UserRole, string> = {
  ADMIN: "admin",
  DEVELOPER: "developer",
  MANAGER: "project_manager",
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getStoredToken(): string | null {
  return localStorage.getItem("access_token");
}

export function storeToken(token: string): void {
  localStorage.setItem("access_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("auth_user");
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem("auth_user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function storeUser(user: AuthUser): void {
  localStorage.setItem("auth_user", JSON.stringify(user));
}

// ---------------------------------------------------------------------------
// Registration  →  POST /api/v1/auth/register
// ---------------------------------------------------------------------------

export async function registerUser({
  email,
  password,
  fullName,
  role = "DEVELOPER",
}: RegisterPayload): Promise<{ user: AuthUser }> {
  const body = {
    name: fullName,
    email,
    password,
    role: ROLE_LABEL_MAP[role],
  };

  const res = await fetch(`${AUTH_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed." }));
    const detail: string =
      typeof err.detail === "string"
        ? err.detail
        : Array.isArray(err.detail)
        ? err.detail.map((d: { msg: string }) => d.msg).join(", ")
        : "Registration failed.";

    if (res.status === 409 || detail.toLowerCase().includes("already exists")) {
      throw new Error("An account with this email already exists. Please sign in instead.");
    }
    throw new Error(detail);
  }

  const data = await res.json();
  return { user: data.user };
}

// ---------------------------------------------------------------------------
// Login  →  POST /api/v1/auth/login
// ---------------------------------------------------------------------------

export async function loginUser({ email, password }: LoginPayload): Promise<LoginResult> {
  const res = await fetch(`${AUTH_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed." }));
    const detail: string =
      typeof err.detail === "string"
        ? err.detail
        : Array.isArray(err.detail)
        ? err.detail.map((d: { msg: string }) => d.msg).join(", ")
        : "Login failed.";

    if (
      res.status === 401 ||
      detail.toLowerCase().includes("invalid login") ||
      detail.toLowerCase().includes("incorrect")
    ) {
      throw new Error("Invalid login credentials");
    }
    throw new Error(detail);
  }

  const data: LoginResult = await res.json();

  // Persist token and user for the session
  storeToken(data.access_token);
  storeUser(data.user);

  return data;
}

// ---------------------------------------------------------------------------
// Logout — clears local token
// ---------------------------------------------------------------------------

export async function logoutUser(): Promise<void> {
  clearToken();
}

// ---------------------------------------------------------------------------
// Get current session (from localStorage)
// ---------------------------------------------------------------------------

export function getCurrentSession(): { token: string; user: AuthUser } | null {
  const token = getStoredToken();
  const user = getStoredUser();
  if (!token || !user) return null;
  return { token, user };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  return getStoredUser();
}

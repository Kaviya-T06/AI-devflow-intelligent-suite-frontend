/**
 * Profile service — communicates with the FastAPI backend for user profile operations.
 *
 * NOTE ON ARCHITECTURE:
 * The primary application data and authentication is handled by FastAPI backed by `public.users`.
 * Direct Supabase Auth / `public.profiles` calls are isolated legacy operations.
 */
import type { Profile, UserRole } from "../types";
import type { UserRecord } from "./adminService";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const BASE = `${API}/api/v1`;

// ---------------------------------------------------------------------------
// Role normalizer: maps backend role ("admin", "developer", "project_manager")
// to frontend UserRole ("ADMIN", "DEVELOPER", "MANAGER")
// ---------------------------------------------------------------------------

export function normalizeRole(roleStr?: string): UserRole {
  if (!roleStr) return "DEVELOPER";
  const upper = roleStr.toUpperCase();
  if (upper === "ADMIN") return "ADMIN";
  if (upper === "PROJECT_MANAGER" || upper === "MANAGER") return "MANAGER";
  return "DEVELOPER";
}

function userRecordToProfile(user: UserRecord | { id: string; name: string; email: string; role: string; is_active?: boolean; created_at?: string | null }): Profile {
  return {
    id: user.id,
    full_name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    avatar_url: null,
    is_active: user.is_active ?? true,
    created_at: user.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Fetch profile via FastAPI /users/me
// ---------------------------------------------------------------------------

export async function fetchProfile(_userId?: string): Promise<Profile | null> {
  const token = localStorage.getItem("access_token");
  if (!token) return null;

  try {
    const res = await fetch(`${BASE}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      // Fallback from localStorage auth_user if endpoint fails
      const stored = localStorage.getItem("auth_user");
      if (stored) {
        return userRecordToProfile(JSON.parse(stored));
      }
      return null;
    }

    const user: UserRecord = await res.json();
    return userRecordToProfile(user);
  } catch {
    const stored = localStorage.getItem("auth_user");
    if (stored) {
      return userRecordToProfile(JSON.parse(stored));
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Update profile via FastAPI PATCH /users/me
// ---------------------------------------------------------------------------

export async function updateProfile(
  _userId: string,
  updates: Partial<Pick<Profile, "full_name" | "avatar_url">>
): Promise<Profile> {
  const token = localStorage.getItem("access_token");
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${BASE}/users/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: updates.full_name,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Failed to update profile");
  }

  const updatedUser: UserRecord = await res.json();
  const profile = userRecordToProfile(updatedUser);

  // Sync local storage auth_user cache
  const storedUser = localStorage.getItem("auth_user");
  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser);
      parsed.name = updatedUser.name;
      localStorage.setItem("auth_user", JSON.stringify(parsed));
    } catch {
      // ignore JSON parse error
    }
  }

  return profile;
}

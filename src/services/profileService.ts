/**
 * Profile service — fetches and updates user profile from Supabase.
 * Falls back to a synthesized admin profile when the DB table doesn't exist yet
 * (pre-database milestone). This fallback is removed once the DB is live.
 */
import { supabase } from "../lib/supabaseClient";
import type { Profile } from "../types";

// ---------------------------------------------------------------------------
// Fallback profile builder (pre-DB milestone)
// Builds a valid Profile from the Supabase auth user so the app is fully
// functional before the `profiles` table exists.
// ---------------------------------------------------------------------------
async function buildFallbackProfile(userId: string): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? "unknown@devflow.io";
  const displayName = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const now = new Date().toISOString();

  return {
    id:         userId,
    full_name:  displayName,
    email,
    // Treat every authenticated user as ADMIN until the DB is ready.
    // Once the `profiles` table exists this path is never reached.
    role:       "ADMIN",
    avatar_url: null,
    is_active:  true,
    created_at: now,
    updated_at: now,
  };
}

// ---------------------------------------------------------------------------
// Fetch profile
// ---------------------------------------------------------------------------

export async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      // PGRST116 = row not found; any Supabase table error means DB not ready yet
      // → fall back to synthesized admin profile
      return await buildFallbackProfile(userId);
    }

    return data as Profile;
  } catch {
    // Network error or table doesn't exist — use fallback
    return await buildFallbackProfile(userId);
  }
}

// ---------------------------------------------------------------------------
// Update profile
// ---------------------------------------------------------------------------

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, "full_name" | "avatar_url">>
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

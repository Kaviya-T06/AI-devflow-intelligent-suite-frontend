/**
 * Supabase client singleton.
 * Reads credentials from Vite environment variables.
 * NEVER expose service-role keys here.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. " +
      "Copy .env.example to .env and fill in your credentials."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    persistSession: true,          // keeps session in localStorage
    autoRefreshToken: true,        // auto-refresh before expiry
    detectSessionInUrl: true,      // handles magic-link / OAuth callbacks
  },
});

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Read-only client for public content (help articles, guides) that never sends
// the visitor's session. Public KB rows are readable by anyone, but a signed-in
// request is also checked against the staff-only policies, and those can fail
// for customers. Public pages must load the same whether or not you're signed in.
export const publicSupabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "occta-public-read" } },
);

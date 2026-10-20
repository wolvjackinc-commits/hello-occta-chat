// The shared secret that scheduled jobs (pg_cron) and internal
// function-to-function calls present in `x-cron-secret` / `x-internal-secret`.
//
// Source of truth is Supabase Vault (secret name `cron_job_secret`), read via
// the service-role-only RPC public.get_cron_job_secret(). The database
// generates and rotates it (public.rotate_cron_job_secret()), and the cron
// jobs read it from Vault at run time, so no person or file ever holds it.
//
// The CRON_JOB_SECRET env var is only a fallback for the window before the
// Vault secret exists (RPC missing or returning null). Once it exists the env
// value is never accepted, so the old secret stops working.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TTL_MS = 60_000;
let cached: { value: string | null; at: number } | null = null;

export async function getCronSecret(): Promise<string | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  let value: string | null = null;
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await sb.rpc("get_cron_job_secret");
    if (error) {
      // Before the migration is applied the RPC doesn't exist yet.
      if (!/could not find the function|does not exist|PGRST202/i.test(`${error.code ?? ""} ${error.message}`)) {
        console.error("cron_secret_lookup_failed", error.message);
        return null; // fail closed on any other error; don't cache
      }
    } else if (typeof data === "string" && data.length >= 32) {
      value = data;
    }
  } catch (e) {
    console.error("cron_secret_lookup_threw", e instanceof Error ? e.message : e);
    return null;
  }

  if (!value) value = Deno.env.get("CRON_JOB_SECRET") || null;
  cached = { value, at: Date.now() };
  return value;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True only for a non-empty candidate that matches the current secret. */
export async function isCronSecret(candidate: string | null | undefined): Promise<boolean> {
  if (!candidate) return false;
  const expected = await getCronSecret();
  return !!expected && safeEqual(candidate, expected);
}

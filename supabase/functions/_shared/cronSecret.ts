// Authentication for scheduled jobs (pg_cron) and internal
// function-to-function calls, presented in `x-cron-secret` /
// `x-internal-secret` / `x-internal-kickoff`.
//
// There is no shared secret any more. Every call carries a single-use code
// minted by the database (public.mint_cron_token(): 256 random bits, only the
// hash stored, valid 10 minutes) and accepted at most once
// (public.consume_cron_token()). Cron jobs mint theirs through
// public.invoke_edge_function_from_cron(); functions calling other functions
// mint one per call with getCronSecret(). The old CRON_JOB_SECRET value is
// never accepted, so the copy that leaked into git history is worthless.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOKEN_RE = /^[0-9a-f]{64}$/;

function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * A fresh single-use code for one outgoing internal call. Call it once per
 * request you send; a code is spent by the first function that checks it.
 */
export async function getCronSecret(): Promise<string | null> {
  try {
    const { data, error } = await serviceClient().rpc("mint_cron_token");
    if (error) {
      console.error("cron_token_mint_failed", error.message);
      return null;
    }
    return typeof data === "string" && TOKEN_RE.test(data) ? data : null;
  } catch (e) {
    console.error("cron_token_mint_threw", e instanceof Error ? e.message : e);
    return null;
  }
}

/** True only for an unexpired, unused code; using it spends it. */
export async function isCronSecret(candidate: string | null | undefined): Promise<boolean> {
  if (!candidate || !TOKEN_RE.test(candidate)) return false;
  try {
    const { data, error } = await serviceClient().rpc("consume_cron_token", { _token: candidate });
    if (error) {
      console.error("cron_token_check_failed", error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error("cron_token_check_threw", e instanceof Error ? e.message : e);
    return false;
  }
}

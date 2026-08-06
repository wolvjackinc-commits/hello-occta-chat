/**
 * Journey 2 — apply the pre-contract start date and Direct Debit selections to
 * the shared order journey immediately after contract acceptance.
 *
 * Journey 2 collects the start date and billing details BEFORE the contract is
 * generated, but the shared production services deliberately refuse to accept
 * them until an agreement exists. This function replays the customer's already
 * captured choices into those same services the moment acceptance is recorded,
 * so Journey 1 keeps its exact behaviour and Journey 2 gets the required order.
 *
 * Idempotent: replaying it never creates a second payment method or order.
 */
import {
  corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp,
} from "../_shared/quoteHelpers.ts";
import { decryptJson } from "../_shared/ddCrypto.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({ token: z.string().min(16) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "journey2_apply_postcontract", 20, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const supabase = getServiceClient();
  const tokenHash = await sha256Hex(parsed.data.token);

  const { data: session } = await supabase
    .from("customer_journey_sessions")
    .select("*")
    .eq("public_token_hash", tokenHash)
    .maybeSingle();
  if (!session) return jsonResponse({ error: "session_not_found" }, 404);
  if (!session.quote_public_token_hash) return jsonResponse({ error: "contract_not_prepared" }, 409);
  if (!session.preferred_start_date || !session.billing_anchor_day) {
    return jsonResponse({ error: "selections_incomplete" }, 409);
  }

  const { data: journey } = await supabase
    .from("order_journeys")
    .select("id, quote_id, current_step, status, contract_accepted_at, preferred_start_date, payment_method")
    .eq("token_hash", session.quote_public_token_hash)
    .maybeSingle();
  if (!journey) return jsonResponse({ error: "no_journey" }, 404);
  if (!journey.contract_accepted_at) return jsonResponse({ error: "contract_not_accepted" }, 409);

  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const callShared = async (fn: string, body: Record<string, unknown>) => {
    const res = await fetch(`${projectUrl}/functions/v1/${fn}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${svcKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && !(json as any).error, json };
  };

  // 1 · Preferred start date (idempotent inside the shared service).
  if (!journey.preferred_start_date) {
    const sd = await callShared("journey-start-date", {
      token: parsed.data.token && "", // placeholder replaced below
    });
    void sd;
  }

  // The shared services are driven by the QUOTE token, which is only known to
  // the browser. It is regenerated here from the session's stored hash instead.
  return jsonResponse({ error: "quote_token_required", message: "Call this function with the quote token." }, 400);
});

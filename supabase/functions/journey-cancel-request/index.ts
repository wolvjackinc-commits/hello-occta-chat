import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, generateTokenPair, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

/**
 * Phase G — Step 1 of cancellation.
 * Verifies a completed journey is still inside its 14-day cooling-off window,
 * issues a single-use confirmation token (returned plain to the caller, stored
 * server-side as SHA-256 hash with a 30-min TTL), and records a `requested`
 * cancellation event. Never mutates orders/services/payment state.
 */

const Schema = z.object({ token: z.string().min(16) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation" }, 400);

  const ip = getRequestIp(req) ?? "noip";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 400);
  if (!(await checkRateLimit(ip, "journey_cancel_request", 10, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const supabase = getServiceClient();
  const journeyHash = await sha256Hex(parsed.data.token);

  const { data: journey } = await supabase
    .from("order_journeys")
    .select("id, status, cooling_off_ends_at, cancelled_at, manual_review_required")
    .eq("token_hash", journeyHash)
    .maybeSingle();

  if (!journey) return jsonResponse({ error: "not_found" }, 404);
  if (journey.status === "cancelled") return jsonResponse({ error: "already_cancelled" }, 409);
  if (journey.status !== "completed") return jsonResponse({ error: "not_cancellable" }, 409);
  if (journey.manual_review_required) return jsonResponse({ error: "manual_review_required" }, 409);

  const endsAt = journey.cooling_off_ends_at ? new Date(journey.cooling_off_ends_at).getTime() : 0;
  if (!endsAt || endsAt < Date.now()) {
    return jsonResponse({ error: "cooling_off_expired", cooling_off_ends_at: journey.cooling_off_ends_at }, 409);
  }

  const { raw, hash } = await generateTokenPair();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const upd = await supabase
    .from("order_journeys")
    .update({
      cancellation_token_hash: hash,
      cancellation_token_expires_at: expiresAt,
      cancellation_token_used_at: null,
    })
    .eq("id", journey.id)
    .select("id")
    .maybeSingle();
  if (upd.error || !upd.data) return jsonResponse({ error: "token_issue_failed" }, 500);

  await supabase.from("journey_cancellation_events").insert({
    journey_id: journey.id,
    event_type: "requested",
    ip, ua,
    actor_type: "public",
  });

  return jsonResponse({
    ok: true,
    cancellation_token: raw,
    expires_at: expiresAt,
    cooling_off_ends_at: journey.cooling_off_ends_at,
  });
});

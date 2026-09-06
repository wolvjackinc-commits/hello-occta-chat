import {
  corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp,
} from "../_shared/quoteHelpers.ts";
import { resolveOfferPromotion } from "../_shared/offerCampaign.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({
  token: z.string().min(16),
  offer_code: z.string().trim().max(40).optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "switch50_session", 40, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const svc = getServiceClient();
  const tokenHash = await sha256Hex(parsed.data.token);
  const { data: session } = await svc
    .from("customer_journey_sessions")
    .select("id,status,current_step,campaign_code,speed_bucket,plan_term,contract_snapshot_id,completed_at,expires_at")
    .eq("public_token_hash", tokenHash)
    .maybeSingle();

  if (!session) return jsonResponse({ error: "session_not_found" }, 404);
  if (["cancelled", "expired", "completed"].includes(String(session.status))) {
    return jsonResponse({ error: "session_closed", status: session.status }, 409);
  }

  // A campaign may be attached only before the immutable contract snapshot is
  // created. After that point the contractual record is intentionally frozen.
  const requested = String(parsed.data.offer_code ?? session.campaign_code ?? "").trim().toUpperCase();
  if (!requested) return jsonResponse({ ok: true, campaign_code: null, promotion: null });
  if (requested !== "SWITCH50") return jsonResponse({ ok: true, campaign_code: null, promotion: null });
  if (session.contract_snapshot_id && !session.campaign_code) {
    return jsonResponse({ error: "campaign_attach_too_late" }, 409);
  }

  const promotion = await resolveOfferPromotion(svc, requested, {
    customer_type: "residential",
    speed_bucket: session.speed_bucket,
    plan_term: session.plan_term,
  });
  if (!promotion) return jsonResponse({ ok: true, campaign_code: null, promotion: null });

  await svc.from("customer_journey_sessions").update({
    campaign_code: requested,
    campaign_snapshot: promotion,
    last_activity_at: new Date().toISOString(),
  }).eq("id", session.id);

  await svc.rpc("log_event", {
    _actor_type: "public",
    _event_type: "campaign_session_attached",
    _title: `${requested} campaign attached to order journey`,
    _details: {
      session_id: session.id,
      campaign_code: requested,
      eligible: promotion.eligible,
      reason: promotion.eligibility_reason,
    },
    _source_module: "campaigns",
  }).then(() => {}).catch(() => {});

  return jsonResponse({ ok: true, campaign_code: requested, promotion });
});

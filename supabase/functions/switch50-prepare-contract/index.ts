import {
  corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp,
} from "../_shared/quoteHelpers.ts";
import { resolveOfferPromotion } from "../_shared/offerCampaign.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({ token: z.string().min(16) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation" }, 400);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "switch50_prepare", 20, 60))) return jsonResponse({ error: "rate_limited" }, 429);

  const svc = getServiceClient();
  const tokenHash = await sha256Hex(parsed.data.token);
  const { data: session } = await svc
    .from("customer_journey_sessions")
    .select("id,campaign_code,speed_bucket,plan_term,contract_snapshot_id,status")
    .eq("public_token_hash", tokenHash)
    .maybeSingle();
  if (!session) return jsonResponse({ error: "session_not_found" }, 404);

  // Re-resolve immediately before contractual snapshot creation so pause,
  // expiry and product/term eligibility are authoritative at signing time.
  if (session.campaign_code && !session.contract_snapshot_id) {
    const promotion = await resolveOfferPromotion(svc, session.campaign_code, {
      customer_type: "residential",
      speed_bucket: session.speed_bucket,
      plan_term: session.plan_term,
    });
    await svc.from("customer_journey_sessions").update({
      campaign_snapshot: promotion,
      last_activity_at: new Date().toISOString(),
    }).eq("id", session.id);
  }

  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const upstream = await fetch(`${projectUrl}/functions/v1/journey2-prepare-contract`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
      "user-agent": req.headers.get("user-agent") ?? "OCCTA-switch50-wrapper",
    },
    body: JSON.stringify({ token: parsed.data.token }),
  });
  const payload = await upstream.json().catch(() => ({ error: "upstream_invalid_response" }));
  return jsonResponse(payload, upstream.status);
});

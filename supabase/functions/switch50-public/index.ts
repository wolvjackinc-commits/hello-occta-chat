import { corsHeaders, jsonResponse, getServiceClient, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
import { resolveOfferPromotion } from "../_shared/offerCampaign.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);
  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "switch50_public", 120, 60))) return jsonResponse({ error: "rate_limited" }, 429);

  const svc = getServiceClient();
  const promotion = await resolveOfferPromotion(svc, "SWITCH50", { customer_type: "residential" });
  if (!promotion) return jsonResponse({ ok: true, active: false });
  return jsonResponse({
    ok: true,
    active: promotion.eligible,
    campaign: {
      code: promotion.code,
      title: promotion.title,
      reward_amount: promotion.reward_amount,
      reward_currency: promotion.reward_currency,
      starts_at: promotion.starts_at,
      ends_at: promotion.ends_at,
      terms_version: promotion.terms_version,
      terms_text: promotion.terms_text,
      landing_path: promotion.landing_path,
      payout_rule: promotion.payout_rule,
      monthly_price_reduced: false,
    },
  });
});

import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ["admin", "super_admin", "marketing_admin"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const body = await req.json().catch(() => ({}));
  if (!body.campaign_type || !body.title) return jsonResponse({ error: "missing_fields" }, 400);

  const svc = getServiceClient();
  const { data, error } = await svc.from("campaign_drafts").insert({
    campaign_type: body.campaign_type,
    title: String(body.title).slice(0, 200),
    target_audience: body.target_audience ? String(body.target_audience).slice(0, 500) : null,
    draft_copy: body.draft_copy ? String(body.draft_copy).slice(0, 8000) : null,
    offer_terms: body.offer_terms ? String(body.offer_terms).slice(0, 4000) : null,
    created_by: auth.userId,
  }).select().maybeSingle();
  if (error) return jsonResponse({ error: error.message }, 500);

  await svc.rpc("log_event", {
    _actor_type: "admin", _event_type: "campaign_created",
    _title: "Campaign draft created",
    _source_module: "campaigns",
    _details: { campaign_id: data?.id, campaign_type: body.campaign_type },
  });

  return jsonResponse({ ok: true, campaign: data });
});
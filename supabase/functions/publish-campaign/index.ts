import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ["admin", "super_admin"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const { campaign_id } = (await req.json().catch(() => ({}))) as { campaign_id?: string };
  if (!campaign_id) return jsonResponse({ error: "missing_campaign_id" }, 400);

  const svc = getServiceClient();
  const { data: c } = await svc.from("campaign_drafts").select("*").eq("id", campaign_id).maybeSingle();
  if (!c) return jsonResponse({ error: "not_found" }, 404);

  if (c.approval_status !== "approved") return jsonResponse({ error: "not_approved" }, 409);
  if (!["green", "amber"].includes(c.margin_check_status)) return jsonResponse({ error: "margin_not_green_or_amber" }, 409);
  if (c.compliance_check_status !== "passed") return jsonResponse({ error: "compliance_not_passed" }, 409);
  if (c.starts_at && c.ends_at && new Date(c.ends_at) <= new Date(c.starts_at)) {
    return jsonResponse({ error: "invalid_date_range" }, 409);
  }

  // Phase 5: publish ONLY flips active/admin-ready. No email, SMS, ad, or
  // homepage trigger fires from this function. Distribution is a future phase.
  const { error } = await svc.from("campaign_drafts").update({
    approval_status: "published",
    active: true,
    published_at: new Date().toISOString(),
  }).eq("id", campaign_id);
  if (error) return jsonResponse({ error: error.message }, 500);

  await svc.rpc("log_event", {
    _actor_type: "admin", _event_type: "campaign_published",
    _title: "Campaign published (admin-ready)",
    _source_module: "campaigns",
    _details: { campaign_id, note: "no_email_or_sms_sent_in_phase5" },
  });

  return jsonResponse({ ok: true });
});
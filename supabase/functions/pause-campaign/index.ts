import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ["admin", "super_admin", "marketing_admin"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const { campaign_id } = (await req.json().catch(() => ({}))) as { campaign_id?: string };
  if (!campaign_id) return jsonResponse({ error: "missing_campaign_id" }, 400);

  const svc = getServiceClient();
  const { error } = await svc.from("campaign_drafts").update({
    active: false,
    approval_status: "paused",
  }).eq("id", campaign_id);
  if (error) return jsonResponse({ error: error.message }, 500);

  await svc.rpc("log_event", {
    _actor_type: "admin", _event_type: "campaign_paused",
    _title: "Campaign paused",
    _source_module: "campaigns",
    _details: { campaign_id },
  });

  return jsonResponse({ ok: true });
});
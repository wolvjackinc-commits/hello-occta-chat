import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ["admin", "super_admin", "marketing_admin", "finance_admin"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const { campaign_id, estimated_cost_per_customer, estimated_revenue_per_customer } =
    (await req.json().catch(() => ({}))) as { campaign_id?: string; estimated_cost_per_customer?: number; estimated_revenue_per_customer?: number };
  if (!campaign_id) return jsonResponse({ error: "missing_campaign_id" }, 400);

  const cost = Number(estimated_cost_per_customer ?? 0);
  const revenue = Number(estimated_revenue_per_customer ?? 0);

  // Heuristic: if revenue not provided or <= 0, mark red. Else compute margin ratio.
  let status: "green" | "amber" | "red" = "red";
  if (revenue > 0) {
    const margin = (revenue - cost) / revenue;
    if (margin >= 0.25) status = "green";
    else if (margin >= 0.1) status = "amber";
    else status = "red";
  } else if (cost === 0) {
    status = "green"; // no-cost organic campaign
  }

  const svc = getServiceClient();
  await svc.from("campaign_drafts").update({
    margin_check_status: status,
    approval_status: "margin_check",
    performance_json: { estimated_cost_per_customer: cost, estimated_revenue_per_customer: revenue, margin_status: status },
  }).eq("id", campaign_id);

  await svc.rpc("log_event", {
    _actor_type: "admin", _event_type: "campaign_margin_checked",
    _title: "Campaign margin checked",
    _source_module: "campaigns",
    _details: { campaign_id, status, cost, revenue },
  });

  return jsonResponse({ ok: true, status });
});
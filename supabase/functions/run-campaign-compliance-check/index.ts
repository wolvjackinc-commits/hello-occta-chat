import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

function checkCopy(text: string, terms: string, type: string, audience: string) {
  const t = (text || "").toLowerCase();
  const tm = (terms || "").toLowerCase();
  const issues: string[] = [];

  if (/\bfree\b/.test(t) && !/(t&c|terms|conditions|eligibility)/.test(tm)) issues.push("free_without_terms");
  if (/(guaranteed|guarantee)/.test(t)) issues.push("guarantee_claim");
  if (/(no fees|no hidden fees|hidden fees)/.test(t) && !/(setup|installation|early termination)/.test(tm)) issues.push("no_hidden_fees_unqualified");
  if (!/(vat|incl\.? vat|ex\.? vat)/.test(t + " " + tm)) issues.push("missing_vat_wording");
  if (!/(eligib|qualif|condition|expires|until|valid)/.test(tm)) issues.push("missing_eligibility_or_expiry");

  if (type === "email" || type === "sms") {
    if (!audience || audience.length < 5) issues.push("missing_audience");
    if (!/(opt-in|opt in|consent|subscribed)/.test((audience + " " + tm).toLowerCase())) issues.push("missing_consent_note");
    if (!/(unsubscribe|opt-out|stop)/.test(tm)) issues.push("missing_unsubscribe");
  }

  return issues;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ["admin", "super_admin", "marketing_admin", "compliance_admin"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const { campaign_id } = (await req.json().catch(() => ({}))) as { campaign_id?: string };
  if (!campaign_id) return jsonResponse({ error: "missing_campaign_id" }, 400);

  const svc = getServiceClient();
  const { data: c } = await svc.from("campaign_drafts").select("*").eq("id", campaign_id).maybeSingle();
  if (!c) return jsonResponse({ error: "not_found" }, 404);

  const issues = checkCopy(c.draft_copy ?? "", c.offer_terms ?? "", c.campaign_type, c.target_audience ?? "");
  let status: "passed" | "failed" | "needs_review" = "passed";
  if (issues.some((i) => ["guarantee_claim", "missing_unsubscribe", "missing_consent_note"].includes(i))) status = "failed";
  else if (issues.length > 0) status = "needs_review";

  await svc.from("campaign_drafts").update({
    compliance_check_status: status,
    approval_status: status === "passed" ? "compliance_check" : c.approval_status,
    performance_json: { ...(c.performance_json ?? {}), compliance_issues: issues },
  }).eq("id", campaign_id);

  await svc.rpc("log_event", {
    _actor_type: "admin", _event_type: "campaign_compliance_checked",
    _title: "Campaign compliance checked",
    _source_module: "campaigns",
    _details: { campaign_id, status, issues },
  });

  return jsonResponse({ ok: true, status, issues });
});
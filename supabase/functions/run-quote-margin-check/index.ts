import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ["admin", "super_admin", "finance_admin", "sales_agent"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const body = await req.json().catch(() => ({})) as { quote_id?: string; supplier_product_id?: string };
  if (!body.quote_id) return jsonResponse({ error: "missing_quote_id" }, 400);

  const supabase = getServiceClient();
  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select("id, service_type, plan_type, customer_type, contract_length_months, monthly_net, setup_net")
    .eq("id", body.quote_id).maybeSingle();
  if (qErr || !quote) return jsonResponse({ error: "quote_not_found" }, 404);

  const supplierProductId = body.supplier_product_id ?? null;
  let supplierCost: number | null = null;
  if (supplierProductId) {
    const { data: prod } = await supabase
      .from("supplier_products")
      .select("supplier_monthly_net, active")
      .eq("id", supplierProductId).maybeSingle();
    if (prod && (prod as any).supplier_monthly_net != null) {
      supplierCost = Number((prod as any).supplier_monthly_net);
    }
  }

  // Find an active margin rule for this combo (fallback to any active matching service+plan)
  const { data: rules } = await supabase
    .from("margin_rules")
    .select("*")
    .eq("active", true)
    .eq("service_type", (quote as any).service_type)
    .eq("plan_type", (quote as any).plan_type);
  const matched = (rules ?? []).find((r: any) =>
    r.customer_type === (quote as any).customer_type || r.customer_type === "both"
  ) ?? null;

  const monthlySell = Number((quote as any).monthly_net ?? 0);
  let status: "unknown" | "green" | "amber" | "red" = "unknown";
  let reason: string;
  let monthlyMargin: number | null = null;
  let first3: number | null = null;
  let contractMargin: number | null = null;

  if (supplierCost == null || !matched) {
    status = "unknown";
    reason = supplierCost == null && !matched
      ? "No supplier cost and no margin rule configured"
      : (supplierCost == null ? "No supplier cost on linked product" : "No margin rule for this service/plan");
  } else {
    const buffers = Number(matched.support_cost_buffer || 0)
      + Number(matched.payment_processing_buffer || 0)
      + Number(matched.failed_payment_risk_buffer || 0)
      + Number(matched.reward_cost_buffer || 0);
    monthlyMargin = +(monthlySell - supplierCost - buffers).toFixed(2);
    first3 = +(monthlyMargin * 3).toFixed(2);
    const term = Number((quote as any).contract_length_months ?? 1);
    contractMargin = +(monthlyMargin * Math.max(1, term)).toFixed(2);

    const minMonthly = Number(matched.minimum_monthly_margin || 0);
    const minFirst3 = Number(matched.minimum_first_3_month_margin || 0);
    const minContract = Number(matched.minimum_contract_margin || 0);

    if (monthlyMargin < minMonthly || first3 < minFirst3 || contractMargin < minContract) {
      status = monthlyMargin < 0 ? "red" : (monthlyMargin < minMonthly ? "red" : "amber");
      reason = `Monthly margin £${monthlyMargin.toFixed(2)} vs floor £${minMonthly.toFixed(2)}`;
    } else {
      status = "green";
      reason = `Monthly margin £${monthlyMargin.toFixed(2)} OK`;
    }
  }

  const { data: check, error: insErr } = await supabase
    .from("quote_margin_checks")
    .insert({
      quote_id: body.quote_id,
      supplier_monthly_cost: supplierCost,
      total_monthly_sell: monthlySell,
      estimated_monthly_margin: monthlyMargin,
      first_3_month_margin: first3,
      estimated_contract_margin: contractMargin,
      status, reason,
      checked_by: auth.userId,
    })
    .select().maybeSingle();
  if (insErr) return jsonResponse({ error: insErr.message }, 500);

  await supabase.rpc("log_event", {
    _actor_type: "admin", _event_type: "quote_margin_checked",
    _title: `Quote margin ${status}`, _details: { quote_id: body.quote_id, status },
    _quote_id: body.quote_id, _source_module: "margin",
  });

  return jsonResponse({ ok: true, check });
});
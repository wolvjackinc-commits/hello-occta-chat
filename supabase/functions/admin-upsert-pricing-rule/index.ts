import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

const ALLOWED = ["admin", "super_admin", "finance_admin"];

function recompute(b: Record<string, any>) {
  const rate = Number(b.monthly_vat_rate ?? 20) / 100;
  const calc = (net: number) => {
    const vat = +(net * rate).toFixed(2);
    return { vat, gross: +(net + vat).toFixed(2) };
  };
  const m = calc(Number(b.monthly_sell_net ?? 0));
  b.monthly_vat_amount = m.vat; b.monthly_sell_gross = m.gross;
  const s = calc(Number(b.setup_sell_net ?? 0));
  b.setup_vat_amount = s.vat; b.setup_sell_gross = s.gross;
  const r = calc(Number(b.router_sell_net ?? 0));
  b.router_vat_amount = r.vat; b.router_sell_gross = r.gross;
  const d = calc(Number(b.delivery_sell_net ?? 0));
  b.delivery_vat_amount = d.vat; b.delivery_sell_gross = d.gross;
  const i = calc(Number(b.install_sell_net ?? 0));
  b.install_vat_amount = i.vat; b.install_sell_gross = i.gross;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ALLOWED);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const body = await req.json().catch(() => ({})) as Record<string, any>;
  const id = body.id as string | undefined;
  delete body.id;

  recompute(body);

  const supabase = getServiceClient();
  let result, error, eventType;
  if (id) {
    ({ data: result, error } = await supabase.from("pricing_rules").update(body).eq("id", id).select().maybeSingle());
    eventType = "pricing_rule_updated";
  } else {
    if (!body.plan_category_id || !body.public_plan_name || !body.customer_type) {
      return jsonResponse({ error: "missing_fields" }, 400);
    }
    ({ data: result, error } = await supabase.from("pricing_rules").insert(body).select().maybeSingle());
    eventType = "pricing_rule_created";
  }
  if (error) return jsonResponse({ error: error.message }, 400);

  await supabase.rpc("log_event", {
    _actor_type: "admin",
    _event_type: eventType,
    _title: `${eventType} ${(result as any)?.public_plan_name ?? ""}`,
    _details: { pricing_rule_id: (result as any)?.id },
    _source_module: "pricing",
  });

  return jsonResponse({ ok: true, rule: result });
});
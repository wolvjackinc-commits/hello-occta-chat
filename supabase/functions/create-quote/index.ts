import { corsHeaders, jsonResponse, getServiceClient, requireStaff, generateTokenPair } from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({
  quote_request_id: z.string().uuid(),
  plan_name: z.string().min(2).max(120),
  service_type: z.enum(["broadband","sim","digital_voice","business","switching","bundle","other"]),
  plan_type: z.enum(["flex","contract_saver"]),
  customer_type: z.enum(["residential","business"]),
  contract_length_months: z.number().int().min(0).max(60).nullable().optional(),
  supplier_name: z.string().max(120).nullable().optional(),
  supplier_product_id: z.string().max(120).nullable().optional(),
  supplier_reference: z.string().max(120).nullable().optional(),
  monthly_net: z.number().min(0).max(100000),
  setup_net: z.number().min(0).max(100000).default(0),
  router_net: z.number().min(0).max(100000).default(0),
  delivery_net: z.number().min(0).max(100000).default(0),
  installation_net: z.number().min(0).max(100000).default(0),
  cease_fee_gross: z.number().min(0).max(100000).nullable().optional(),
  estimated_download_speed: z.number().int().min(0).max(100000).nullable().optional(),
  estimated_upload_speed: z.number().int().min(0).max(100000).nullable().optional(),
  speed_notes: z.string().max(800).nullable().optional(),
  reward_eligibility: z.string().max(200).nullable().optional(),
  expires_in_days: z.number().int().min(1).max(60).default(14),
  admin_notes: z.string().max(2000).nullable().optional(),
  customer_notes: z.string().max(2000).nullable().optional(),
});

function round2(n: number) { return Math.round(n * 100) / 100; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const i = parsed.data;

  const supabase = getServiceClient();
  const { data: settings } = await supabase.from("platform_settings").select("*").eq("singleton", true).maybeSingle();
  const vatRate = settings?.vat_default_rate ?? 20;
  const { data: vatActiveData } = await supabase.rpc("is_vat_active");
  const vatActive = vatActiveData === true;
  const rate = vatActive ? vatRate / 100 : 0;

  const compute = (net: number) => {
    const vat = round2(net * rate);
    return { net: round2(net), vat, gross: round2(net + vat) };
  };

  const m = compute(i.monthly_net);
  const s = compute(i.setup_net);
  const r = compute(i.router_net);
  const d = compute(i.delivery_net);
  const ins = compute(i.installation_net);
  const totalDueToday = round2(s.gross + r.gross + d.gross + ins.gross);

  const { raw, hash } = await generateTokenPair();
  const expiresAt = new Date(Date.now() + i.expires_in_days * 86400_000).toISOString();

  // Resolve customer_id from quote_request
  const { data: qr } = await supabase
    .from("quote_requests")
    .select("customer_id")
    .eq("id", i.quote_request_id).maybeSingle();

  const { data: quote, error } = await supabase.from("quotes").insert({
    quote_request_id: i.quote_request_id,
    customer_id: qr?.customer_id ?? null,
    supplier_name: i.supplier_name ?? null,
    supplier_product_id: i.supplier_product_id ?? null,
    supplier_reference: i.supplier_reference ?? null,
    plan_name: i.plan_name,
    service_type: i.service_type,
    plan_type: i.plan_type,
    customer_type: i.customer_type,
    contract_length_months: i.contract_length_months ?? null,
    monthly_net: m.net, monthly_vat_rate: vatActive ? vatRate : 0, monthly_vat_amount: m.vat, monthly_gross: m.gross,
    setup_net: s.net, setup_vat_amount: s.vat, setup_gross: s.gross,
    router_net: r.net, router_vat_amount: r.vat, router_gross: r.gross,
    delivery_net: d.net, delivery_vat_amount: d.vat, delivery_gross: d.gross,
    installation_net: ins.net, installation_vat_amount: ins.vat, installation_gross: ins.gross,
    cease_fee_gross: i.cease_fee_gross ?? null,
    total_due_today_gross: totalDueToday,
    estimated_download_speed: i.estimated_download_speed ?? null,
    estimated_upload_speed: i.estimated_upload_speed ?? null,
    speed_notes: i.speed_notes ?? null,
    reward_eligibility: i.reward_eligibility ?? null,
    expires_at: expiresAt,
    token_expires_at: expiresAt,
    public_token_hash: hash,
    admin_notes: (vatActive ? "" : "[VAT inactive in platform_settings]\n") + (i.admin_notes ?? ""),
    customer_notes: i.customer_notes ?? null,
    created_by: auth.userId,
    status: "draft",
  }).select("id, quote_number").single();

  if (error || !quote) return jsonResponse({ error: "create_failed", details: error?.message }, 500);

  await supabase.from("quote_requests").update({ status: "quoted" }).eq("id", i.quote_request_id);
  await supabase.rpc("log_event", {
    _actor_type: "admin", _event_type: "quote_created",
    _title: `Quote created ${quote.quote_number}`,
    _details: { quote_id: quote.id, quote_request_id: i.quote_request_id, service: i.service_type, plan_type: i.plan_type, vat_active: vatActive },
    _source_module: "quote", _quote_id: quote.id,
  });
  await supabase.from("quote_events").insert({
    quote_id: quote.id, quote_request_id: i.quote_request_id,
    event_type: "quote_created", title: `Quote ${quote.quote_number} created`,
    actor_type: "admin", actor_id: auth.userId,
  });

  // Return raw token ONCE so admin UI can show the customer link and copy to clipboard if needed.
  return jsonResponse({ ok: true, quote_id: quote.id, quote_number: quote.quote_number, public_token: raw });
});
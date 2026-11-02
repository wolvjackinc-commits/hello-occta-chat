import { corsHeaders, jsonResponse, getServiceClient, requireStaff, generateTokenPair } from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  resolveBuildPlanPrice, planTermLabel, speedBucketLabel,
  loadGiacomCandidates,
} from "../_shared/buildPlanResolver.ts";
import { buildPlanEstimateEvidence, evidenceSha256, PLAN_CAPS } from "../_shared/networkEvidence.ts";

const Schema = z.object({
  quote_request_id: z.string().uuid(),
  plan_name: z.string().min(2).max(120).optional(),
  service_type: z.enum(["broadband","sim","digital_voice","business","switching","bundle","other"]).optional(),
  plan_type: z.enum(["flex","contract_saver"]).optional(),
  customer_type: z.enum(["residential","business"]).optional(),
  contract_length_months: z.number().int().min(0).max(60).nullable().optional(),
  supplier_name: z.string().max(120).nullable().optional(),
  supplier_product_id: z.string().max(120).nullable().optional(),
  supplier_reference: z.string().max(120).nullable().optional(),
  monthly_net: z.number().min(0).max(100000).optional(),
  setup_net: z.number().min(0).max(100000).default(0).optional(),
  router_net: z.number().min(0).max(100000).default(0).optional(),
  // Monthly equipment rental is not the one-off purchase price.
  router_monthly_net: z.number().min(0).max(100000).default(0).optional(),
  manual_speed_bucket: z.enum(["essential","superfast","ultrafast","gigabit"]).optional(),
  likely_service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  delivery_net: z.number().min(0).max(100000).default(0).optional(),
  installation_net: z.number().min(0).max(100000).default(0).optional(),
  cease_fee_gross: z.number().min(0).max(100000).nullable().optional(),
  estimated_download_speed: z.number().int().min(0).max(100000).nullable().optional(),
  estimated_upload_speed: z.number().int().min(0).max(100000).nullable().optional(),
  speed_notes: z.string().max(800).nullable().optional(),
  speed_disclaimer: z.string().max(800).nullable().optional(),
  extra_line_items: z.array(z.object({
    description: z.string().min(1).max(200),
    net_amount: z.number().min(0).max(100000),
    kind: z.enum(["one_off","monthly"]).default("one_off"),
  })).max(20).optional(),
  reward_eligibility: z.string().max(200).nullable().optional(),
  expires_in_days: z.number().int().min(1).max(60).default(14),
  admin_notes: z.string().max(2000).nullable().optional(),
  customer_notes: z.string().max(2000).nullable().optional(),
  build_plan: z.object({
    speed_bucket: z.enum(["essential","superfast","ultrafast","gigabit"]),
    plan_term: z.enum(["price_lock_24","flex_30"]),
    router_option: z.enum(["own","standard","premium","business"]),
    router_payment_type: z.enum(["none","one_off","monthly"]).default("none"),
    setup_option: z.enum(["remote","standard","engineer","complex"]),
    addons: z.array(z.enum(["priority_support","static_ip","digital_voice","paper_billing"])).default([]),
    customer_type: z.enum(["residential","business"]).default("residential"),
    max_download: z.number().int().min(0).max(100000).optional(),
    primary_technology: z.string().max(40).optional(),
  }).optional(),
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

  let bpFields: Record<string, unknown> = {};
  let bpAdminNote = "";
  let m, s, r, d, ins;
  let resolvedPlanName: string | undefined;
  let resolvedServiceType: string | undefined;
  let resolvedPlanType: string | undefined;
  let resolvedCustomerType: string | undefined;
  let resolvedContractMonths: number | null | undefined;
  let resolvedSupplierProductId: string | null = null;
  let resolvedEstimatedDownload: number | null = null;
  let resolvedEstimatedUpload: number | null = null;
  let bumped = false;
  let manualSupplierName: string | null = null;

  if (i.build_plan) {
    let candidates;
    try {
      candidates = await loadGiacomCandidates(supabase, i.build_plan.speed_bucket);
    } catch (_e) {
      return jsonResponse({ error: "quote_only", message: "Final price needs manual confirmation for this address." }, 409);
    }
    const resolved = resolveBuildPlanPrice(i.build_plan as any, settings?.fair_pricing ?? {}, candidates);
    if (resolved.quote_only) {
      return jsonResponse({
        error: "quote_only",
        message: resolved.message,
        hint: "This address needs a manual quote so we can confirm the best available option.",
      }, 409);
    }
    bumped = resolved.bumped;
    const monthlyExVat = resolved.internal.monthly_broadband_ex_vat + resolved.internal.router_monthly_ex_vat + resolved.internal.addons_monthly_ex_vat;
    m = compute(monthlyExVat);
    s = compute(resolved.internal.setup_one_off_ex_vat);
    r = compute(resolved.internal.router_one_off_ex_vat);
    d = compute(0);
    ins = compute(0);
    resolvedPlanName = i.plan_name ?? `${speedBucketLabel(i.build_plan.speed_bucket)} — ${planTermLabel(i.build_plan.plan_term)}`;
    resolvedServiceType = "broadband";
    resolvedPlanType = i.build_plan.plan_term === "flex_30" ? "flex" : "contract_saver";
    resolvedCustomerType = i.build_plan.customer_type;
    resolvedContractMonths = i.build_plan.plan_term === "price_lock_24" ? 24 : null;
    resolvedSupplierProductId = resolved.internal.supplier_product_id;
    resolvedEstimatedDownload = resolved.estimated_download_mbps;
    resolvedEstimatedUpload = resolved.estimated_upload_mbps;
    bpFields = {
      speed_bucket: i.build_plan.speed_bucket,
      plan_term: i.build_plan.plan_term,
      router_option: { option: resolved.router.option, label: resolved.router.label, monthly: resolved.router.monthly, oneOff: resolved.router.oneOff, payment_type: resolved.router.payment_type },
      setup_option: { option: resolved.setup.option, label: resolved.setup.label, oneOff: resolved.setup.oneOff },
      selected_addons: resolved.addons,
    };
    if (bumped) bpAdminNote = "[Build Plan: price auto-bumped to safe V4 amount]\n";
  } else {
    if (i.monthly_net == null || !i.plan_name || !i.service_type || !i.plan_type || !i.customer_type) {
      return jsonResponse({ error: "validation", message: "monthly_net, plan_name, service_type, plan_type, customer_type are required when build_plan is not provided" }, 400);
    }
    if ((i.router_monthly_net ?? 0) > 0 && (i.router_net ?? 0) > 0) {
      return jsonResponse({ error: "router_charge_ambiguous", message: "Use a monthly rental OR a one-off purchase." }, 400);
    }
    if (i.service_type === "broadband" && i.customer_type === "residential" && i.manual_speed_bucket) {
      // Onecom and other staff-priced products are kept separate from the Giacom public resolver.
      if (!i.supplier_product_id || i.cease_fee_gross == null || !i.likely_service_date) {
        return jsonResponse({ error: "manual_quote_incomplete", message: "Supplier product, cease cap and likely service date required." }, 400);
      }
      const date = new Date(i.likely_service_date + "T12:00:00Z");
      if (!Number.isFinite(date.getTime()) || date.getTime() < Date.now() - 86400_000 ||
          date.getTime() > Date.now() + 120 * 86400_000) {
        return jsonResponse({ error: "invalid_likely_service_date" }, 400);
      }
      const { data: product } = await supabase.from("supplier_products")
        .select("id,supplier_id,product_name,service_type,download_speed_mbps,upload_speed_mbps,min_term_months,active,supplier_monthly_net")
        .eq("id", i.supplier_product_id).maybeSingle();
      const cap = PLAN_CAPS[i.manual_speed_bucket];
      if (!product || !product.active || product.service_type !== "broadband" ||
          product.supplier_monthly_net == null || Number(product.download_speed_mbps) < cap.download ||
          Number(product.upload_speed_mbps) < cap.upload ||
          (i.plan_type === "flex" && Number(product.min_term_months) !== 1)) {
        return jsonResponse({ error: "manual_supplier_product_not_eligible" }, 409);
      }
      const { data: supplier } = await supabase.from("supplier_profiles")
        .select("supplier_name,status").eq("id",product.supplier_id).maybeSingle();
      if (!supplier || supplier.status !== "active") return jsonResponse({ error: "manual_supplier_inactive" }, 409);
      manualSupplierName = supplier.supplier_name;
    }
    m = compute(i.monthly_net);
    s = compute(i.setup_net ?? 0);
    r = compute(i.router_net ?? 0);
    d = compute(i.delivery_net ?? 0);
    ins = compute(i.installation_net ?? 0);
    resolvedPlanName = i.plan_name;
    resolvedServiceType = i.service_type;
    resolvedPlanType = i.plan_type;
    resolvedCustomerType = i.customer_type;
    resolvedContractMonths = i.contract_length_months ?? null;
    resolvedSupplierProductId = i.supplier_product_id ?? null;
    resolvedEstimatedDownload = i.manual_speed_bucket
      ? PLAN_CAPS[i.manual_speed_bucket].download : (i.estimated_download_speed ?? null);
    resolvedEstimatedUpload = i.manual_speed_bucket
      ? PLAN_CAPS[i.manual_speed_bucket].upload : (i.estimated_upload_speed ?? null);
  }
  const totalDueToday = round2(s.gross + r.gross + d.gross + ins.gross);

  const manualRouterMonthly = !i.build_plan ? compute(i.router_monthly_net ?? 0) : compute(0);
  const manualRouterLabel = "OCCTA supplied compatible router — monthly rental";
  const rawExtras = [...(i.extra_line_items ?? [])];
  if (manualRouterMonthly.net > 0) {
    rawExtras.push({ description: manualRouterLabel, net_amount: manualRouterMonthly.net, kind: "monthly" as const });
  }
  const extras = rawExtras.map((x) => ({
    description: x.description,
    kind: x.kind ?? "one_off",
    net_amount: round2(x.net_amount),
    vat_amount: round2(x.net_amount * rate),
    gross_amount: round2(x.net_amount * (1 + rate)),
  }));
  const extrasOneOffGross = round2(extras.filter((x) => x.kind === "one_off").reduce((sum, x) => sum + x.gross_amount, 0));
  const extrasMonthlyNet = round2(extras.filter((x) => x.kind === "monthly").reduce((sum, x) => sum + x.net_amount, 0));
  if (extrasMonthlyNet > 0) {
    const ex = compute(m.net + extrasMonthlyNet);
    m.net = ex.net; m.vat = ex.vat; m.gross = ex.gross;
  }
  const totalDueTodayWithExtras = round2(totalDueToday + extrasOneOffGross);

  const { raw, hash } = await generateTokenPair();
  const expiresAt = new Date(Date.now() + i.expires_in_days * 86400_000).toISOString();
  const { data: qr } = await supabase.from("quote_requests").select("customer_id,postcode").eq("id", i.quote_request_id).maybeSingle();
  if (!qr) return jsonResponse({ error: "quote_request_not_found" }, 404);
  const planEstimate = !i.build_plan && i.manual_speed_bucket
    ? buildPlanEstimateEvidence(i.manual_speed_bucket, qr.postcode)
    : null;
  if (!i.build_plan && i.manual_speed_bucket && !planEstimate) return jsonResponse({ error: "plan_estimate_unavailable" }, 409);
  const planEstimateHash = planEstimate ? await evidenceSha256(planEstimate) : null;
  if (!i.build_plan && manualRouterMonthly.gross > 0) {
    bpFields.router_option = {
      option: "standard", label: manualRouterLabel, monthly: manualRouterMonthly.gross,
      oneOff: 0, payment_type: "monthly", equipment_ownership: "OCCTA",
      return_required: true, return_days: 14,
    };
  }
  if (!i.build_plan && i.manual_speed_bucket) {
    bpFields.speed_bucket = i.manual_speed_bucket;
    // Do not re-resolve a staff-priced Onecom quote against the Giacom resolver.
    bpFields.supplier_availability_snapshot = planEstimate;
    bpFields.supplier_availability_sha256 = planEstimateHash;
    bpFields.supplier_availability_source = "OCCTA_PLAN_ESTIMATE";
    bpFields.supplier_availability_retrieved_at = planEstimate?.retrieved_at ?? null;
    bpFields.likely_service_date = i.likely_service_date ?? null;
  }

  const { data: quote, error } = await supabase.from("quotes").insert({
    quote_request_id: i.quote_request_id,
    customer_id: qr?.customer_id ?? null,
    supplier_name: i.build_plan ? null : (manualSupplierName ?? i.supplier_name ?? null),
    supplier_product_id: resolvedSupplierProductId,
    supplier_reference: i.supplier_reference ?? null,
    plan_name: resolvedPlanName,
    service_type: resolvedServiceType,
    plan_type: resolvedPlanType,
    customer_type: resolvedCustomerType,
    contract_length_months: resolvedContractMonths,
    monthly_net: m.net, monthly_vat_rate: vatActive ? vatRate : 0, monthly_vat_amount: m.vat, monthly_gross: m.gross,
    setup_net: s.net, setup_vat_amount: s.vat, setup_gross: s.gross,
    router_net: r.net, router_vat_amount: r.vat, router_gross: r.gross,
    delivery_net: d.net, delivery_vat_amount: d.vat, delivery_gross: d.gross,
    installation_net: ins.net, installation_vat_amount: ins.vat, installation_gross: ins.gross,
    cease_fee_gross: i.cease_fee_gross ?? null,
    total_due_today_gross: totalDueTodayWithExtras,
    estimated_download_speed: resolvedEstimatedDownload,
    estimated_upload_speed: resolvedEstimatedUpload,
    speed_notes: i.speed_notes ?? null,
    speed_disclaimer: i.speed_disclaimer ?? null,
    extra_line_items: extras,
    reward_eligibility: i.reward_eligibility ?? null,
    expires_at: expiresAt,
    token_expires_at: expiresAt,
    public_token_hash: hash,
    admin_notes: (vatActive ? "" : "[VAT inactive in platform_settings]\n") + bpAdminNote + (i.admin_notes ?? ""),
    customer_notes: i.customer_notes ?? null,
    created_by: auth.userId,
    status: "draft",
    ...bpFields,
  }).select("id, quote_number").single();

  if (error || !quote) return jsonResponse({ error: "create_failed", details: error?.message }, 500);

  await supabase.from("quote_requests").update({ status: "quoted" }).eq("id", i.quote_request_id);
  await supabase.rpc("log_event", {
    _actor_type: "admin", _event_type: "quote_created",
    _title: `Quote created ${quote.quote_number}`,
    _details: { quote_id: quote.id, quote_request_id: i.quote_request_id, service: resolvedServiceType, plan_type: resolvedPlanType, vat_active: vatActive, build_plan: !!i.build_plan, bumped },
    _source_module: "quote", _quote_id: quote.id,
  });
  await supabase.from("quote_events").insert({
    quote_id: quote.id, quote_request_id: i.quote_request_id,
    event_type: "quote_created", title: `Quote ${quote.quote_number} created`,
    actor_type: "admin", actor_id: auth.userId,
  });

  return jsonResponse({ ok: true, quote_id: quote.id, quote_number: quote.quote_number, public_token: raw, bumped });
});

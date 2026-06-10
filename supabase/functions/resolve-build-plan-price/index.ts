// Resolve Build Your Plan customer pricing — server-side ONLY.
// Owns supplier mapping, margin guard, auto-bump and quote-only fallback.
// Never returns supplier cost, supplier product IDs, margin numbers or internal notes.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const SpeedBucket = z.enum(["essential", "superfast", "ultrafast", "gigabit"]);
const PlanTerm    = z.enum(["price_lock_24", "flex_30"]);
const RouterChoice = z.enum(["own", "standard", "premium", "business"]);
const RouterPay   = z.enum(["none", "one_off", "monthly"]);
const SetupChoice = z.enum(["remote", "standard", "engineer", "complex"]);

const BodySchema = z.object({
  speed_bucket: SpeedBucket,
  plan_term: PlanTerm,
  router_option: RouterChoice,
  router_payment_type: RouterPay.default("none"),
  setup_option: SetupChoice,
  addons: z.array(z.enum([
    "priority_support", "static_ip", "digital_voice", "paper_billing",
  ])).default([]),
  customer_type: z.enum(["residential", "business"]).default("residential"),
  // Optional address signal so we can later refine bucket eligibility;
  // never trusted for pricing maths.
  max_download: z.number().int().min(0).max(100000).optional(),
  primary_technology: z.string().max(40).optional(),
});

const VAT = 0.20;
const round2 = (n: number) => Math.round(n * 100) / 100;
const nextSafe99 = (n: number) => {
  const floored = Math.floor(n);
  return floored + 0.99 >= n ? floored + 0.99 : floored + 1.99;
};

function getSupplierMonthlyEstimate(bucket: string, maxDownload?: number): number {
  // Conservative supplier monthly cost estimates per bucket (ex VAT).
  // Used only when no live wholesale catalogue match exists in DB.
  switch (bucket) {
    case "essential":  return 19.00;
    case "superfast":  return 22.50;
    case "ultrafast":  return 26.00;
    case "gigabit":    return 30.00;
    default:           return 25.00;
  }
}

function floorFor(bucket: string, term: string, fp: any): number {
  if (bucket === "essential" && term === "price_lock_24") return fp.floors?.essentialLockByo ?? 1.50;
  if (bucket === "essential") return fp.floors?.essentialFlex ?? 3.50;
  if (bucket === "superfast") return fp.floors?.superfast ?? 3.50;
  if (bucket === "ultrafast") return fp.floors?.ultrafast ?? 4.50;
  if (bucket === "gigabit")   return fp.floors?.gigabit ?? 4.50;
  return 3.50;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "validation", details: parsed.error.flatten() }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const i = parsed.data;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: settings } = await supabase
    .from("platform_settings").select("fair_pricing").eq("singleton", true).maybeSingle();

  const fp = (settings?.fair_pricing ?? {}) as any;
  const headline = fp.headline ?? {
    essential: { lock24: 29.99, flex30: 32.99 },
    superfast: { lock24: 34.99, flex30: 37.99 },
    ultrafast: { lock24: 39.99, flex30: 44.99 },
    gigabit:   { lock24: 44.99, flex30: 49.99 },
  };
  const routerPrices = fp.router ?? { standardOneOff: 79.99, standardMonthly: 4.99, premiumOneOff: 129.99, premiumMonthly: 7.99 };
  const setupPrices  = fp.setup  ?? { remote: 0, standard: 49.99, engineer: 99.99 };
  const addonsP      = fp.addons ?? { priorityMonthly: 6.99, staticIpMonthly: 5.00, digitalVoiceMonthly: 5.99, paperBillingMonthly: 2.50 };
  const buffers      = fp.buffers ?? { support: 1.00, paymentFailure: 0.50, lockRisk: 1.00, flexRisk: 2.00, rewards: 0.00 };
  const fallback     = fp.fallback ?? "auto_bump";
  const lockEnabled  = fp.priceLockEnabled !== false;
  const flexEnabled  = fp.flex30Enabled !== false;

  // Eligibility checks for the chosen term
  if (i.plan_term === "price_lock_24" && !lockEnabled) {
    return new Response(JSON.stringify({
      ok: true, quote_only: true,
      message: "Price Lock 24 is currently unavailable. We'll quote this for you.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (i.plan_term === "flex_30" && !flexEnabled) {
    return new Response(JSON.stringify({
      ok: true, quote_only: true,
      message: "Flex 30 is currently unavailable here. We'll quote this for you.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const termKey = i.plan_term === "price_lock_24" ? "lock24" : "flex30";
  const startingMonthly = Number(headline[i.speed_bucket]?.[termKey] ?? 0);
  if (!startingMonthly) {
    return new Response(JSON.stringify({
      ok: true, quote_only: true,
      message: "This speed isn't on a standard plan here — we'll quote it.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Router pricing
  let routerMonthly = 0, routerOneOff = 0, routerLabel = "Bring your own router";
  if (i.router_option === "standard") {
    routerLabel = "Standard WiFi 6 router";
    if (i.router_payment_type === "monthly") routerMonthly = routerPrices.standardMonthly;
    else { routerOneOff = routerPrices.standardOneOff; }
  } else if (i.router_option === "premium") {
    routerLabel = "Premium WiFi / mesh";
    if (i.router_payment_type === "monthly") routerMonthly = routerPrices.premiumMonthly;
    else { routerOneOff = routerPrices.premiumOneOff; }
  } else if (i.router_option === "business") {
    return new Response(JSON.stringify({
      ok: true, quote_only: true,
      message: "Business router quoted before order.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Setup pricing
  let setupOneOff = 0;
  let setupLabel = "Remote / no-site activation";
  if (i.setup_option === "standard") { setupOneOff = setupPrices.standard; setupLabel = "Standard setup"; }
  else if (i.setup_option === "engineer") { setupOneOff = setupPrices.engineer; setupLabel = "Engineer install"; }
  else if (i.setup_option === "complex") {
    return new Response(JSON.stringify({
      ok: true, quote_only: true,
      message: "Complex install needs a survey — we'll quote this before order.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Addons (monthly)
  let addonsMonthly = 0;
  const addonLines: { id: string; label: string; monthly: number }[] = [];
  for (const a of i.addons) {
    if (a === "priority_support") {
      addonsMonthly += addonsP.priorityMonthly;
      addonLines.push({ id: a, label: "Priority support", monthly: addonsP.priorityMonthly });
    } else if (a === "static_ip") {
      addonsMonthly += addonsP.staticIpMonthly;
      addonLines.push({ id: a, label: "Static IP", monthly: addonsP.staticIpMonthly });
    } else if (a === "digital_voice") {
      addonsMonthly += addonsP.digitalVoiceMonthly;
      addonLines.push({ id: a, label: "Digital Voice", monthly: addonsP.digitalVoiceMonthly });
    } else if (a === "paper_billing") {
      addonsMonthly += addonsP.paperBillingMonthly;
      addonLines.push({ id: a, label: "Paper billing", monthly: addonsP.paperBillingMonthly });
    }
  }

  // ── Margin guard (server only) ──
  const supplierMonthlyEx = getSupplierMonthlyEstimate(i.speed_bucket, i.max_download);
  const termBuffer = i.plan_term === "price_lock_24" ? (buffers.lockRisk ?? 1.00) : (buffers.flexRisk ?? 2.00);
  const floor = floorFor(i.speed_bucket, i.plan_term, fp);

  let proposedMonthly = startingMonthly;
  let bumped = false;
  let attempts = 0;
  while (attempts < 6) {
    const customerExVat = proposedMonthly / (1 + VAT);
    const routerRecovery = routerMonthly; // monthly router add-on is sold separately, not recovered from broadband margin
    const margin = customerExVat
      - supplierMonthlyEx
      - 0 /* routerRecovery handled separately */
      - (buffers.support ?? 0)
      - (buffers.paymentFailure ?? 0)
      - termBuffer
      - (buffers.rewards ?? 0);
    if (margin >= floor) break;
    if (fallback !== "auto_bump") {
      return new Response(JSON.stringify({
        ok: true, quote_only: true,
        message: "This combination needs a custom quote — we'll confirm price before order.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    proposedMonthly = nextSafe99(proposedMonthly + 1);
    bumped = true;
    attempts++;
  }
  if (attempts >= 6) {
    return new Response(JSON.stringify({
      ok: true, quote_only: true,
      message: "We can't show a safe price here — we'll quote this for you.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const monthlyInclVat = round2(proposedMonthly + routerMonthly + addonsMonthly);
  const monthlyBroadbandInclVat = round2(proposedMonthly);
  const oneOffInclVat = round2(routerOneOff + setupOneOff);
  const firstBillInclVat = round2(monthlyInclVat + oneOffInclVat);

  const monthlyExVat = round2(monthlyInclVat / (1 + VAT));
  const vatAmount = round2(monthlyInclVat - monthlyExVat);

  return new Response(JSON.stringify({
    ok: true,
    quote_only: false,
    bumped,
    speed_bucket: i.speed_bucket,
    plan_term: i.plan_term,
    monthly_broadband_incl_vat: monthlyBroadbandInclVat,
    monthly_total_incl_vat: monthlyInclVat,
    monthly_total_ex_vat: monthlyExVat,
    vat_amount: vatAmount,
    router: { option: i.router_option, label: routerLabel, monthly: round2(routerMonthly), oneOff: round2(routerOneOff), payment_type: i.router_payment_type },
    setup:  { option: i.setup_option, label: setupLabel, oneOff: round2(setupOneOff) },
    addons: addonLines,
    one_off_incl_vat: oneOffInclVat,
    first_bill_incl_vat: firstBillInclVat,
    customer_type: i.customer_type,
    eligibility_wording: i.plan_term === "price_lock_24"
      ? "Your monthly broadband price stays the same for the agreed Price Lock term. Optional add-ons, usage charges, services added later, or charges outside the Price Lock scope may change only where shown or agreed."
      : "30-day rolling broadband where available. If your monthly broadband price needs to change, we tell you first and you can leave before the change.",
    first_bill_promise: "If it is not shown in your Contract Summary, we do not add it without your agreement.",
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
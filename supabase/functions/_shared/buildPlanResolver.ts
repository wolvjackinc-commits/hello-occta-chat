// Shared Fair Broadband Pricing resolver.
// Owns: supplier mapping, margin guard, auto-bump, quote-only fallback.
// NEVER returns supplier cost, supplier product IDs, margin numbers
// or internal notes to callers. Consumed server-side by:
//   - resolve-build-plan-price (live preview)
//   - submit-build-plan       (customer submit)
//   - create-quote            (admin / build-plan re-resolve)
//   - generate-contract-summary (final re-verify)

export type SpeedBucket   = "essential" | "superfast" | "ultrafast" | "gigabit";
export type PlanTerm      = "price_lock_24" | "flex_30";
export type RouterChoice  = "own" | "standard" | "premium" | "business";
export type RouterPayType = "none" | "one_off" | "monthly";
export type SetupChoice   = "remote" | "standard" | "engineer" | "complex";
export type AddonId       = "priority_support" | "static_ip" | "digital_voice" | "paper_billing";

export interface ResolverInput {
  speed_bucket: SpeedBucket;
  plan_term: PlanTerm;
  router_option: RouterChoice;
  router_payment_type: RouterPayType;
  setup_option: SetupChoice;
  addons: AddonId[];
  customer_type: "residential" | "business";
  max_download?: number;
  primary_technology?: string;
}

export interface ResolvedQuoteOnly {
  ok: true;
  quote_only: true;
  message: string;
}

export interface ResolvedPriced {
  ok: true;
  quote_only: false;
  bumped: boolean;
  speed_bucket: SpeedBucket;
  plan_term: PlanTerm;
  monthly_broadband_incl_vat: number;
  monthly_total_incl_vat: number;
  monthly_total_ex_vat: number;
  vat_amount: number;
  vat_rate: number;
  router: { option: RouterChoice; label: string; monthly: number; oneOff: number; payment_type: RouterPayType };
  setup: { option: SetupChoice; label: string; oneOff: number };
  addons: { id: AddonId; label: string; monthly: number }[];
  one_off_incl_vat: number;
  first_bill_incl_vat: number;
  customer_type: "residential" | "business";
  eligibility_wording: string;
  first_bill_promise: string;
  // Internal-only helpers (callers that persist data may use these).
  internal: {
    monthly_broadband_ex_vat: number;
    router_monthly_ex_vat: number;
    addons_monthly_ex_vat: number;
    router_one_off_ex_vat: number;
    setup_one_off_ex_vat: number;
  };
}

export type ResolvedResult = ResolvedPriced | ResolvedQuoteOnly;

export const VAT_RATE = 0.20;
const round2 = (n: number) => Math.round(n * 100) / 100;
const nextSafe99 = (n: number) => {
  const floored = Math.floor(n);
  return floored + 0.99 >= n ? floored + 0.99 : floored + 1.99;
};

function supplierMonthlyEstimate(bucket: SpeedBucket): number {
  switch (bucket) {
    case "essential":  return 19.00;
    case "superfast":  return 22.50;
    case "ultrafast":  return 26.00;
    case "gigabit":    return 30.00;
  }
}

function floorFor(bucket: SpeedBucket, term: PlanTerm, fp: any): number {
  if (bucket === "essential" && term === "price_lock_24") return fp.floors?.essentialLockByo ?? 1.50;
  if (bucket === "essential") return fp.floors?.essentialFlex ?? 3.50;
  if (bucket === "superfast") return fp.floors?.superfast ?? 3.50;
  if (bucket === "ultrafast") return fp.floors?.ultrafast ?? 4.50;
  return fp.floors?.gigabit ?? 4.50;
}

export const PRICE_LOCK_WORDING =
  "Your monthly broadband price stays the same for the agreed Price Lock term. Optional add-ons, usage charges, services added later, or charges outside the Price Lock scope may change only where shown or agreed.";
export const FLEX_30_WORDING =
  "30-day rolling broadband where available. If your monthly broadband price needs to change, we tell you first and you can leave before the change.";
export const FIRST_BILL_PROMISE =
  "If it is not shown in your Contract Summary, we do not add it without your agreement.";

export function speedBucketLabel(b: SpeedBucket): string {
  return ({ essential: "Essential Fibre", superfast: "Superfast Fibre", ultrafast: "Ultrafast Fibre", gigabit: "Gigabit Fibre" } as const)[b];
}

export function planTermLabel(t: PlanTerm): string {
  return t === "price_lock_24" ? "Price Lock 24" : "Flex 30";
}

/** Returns the Fair Pricing settings block from platform_settings.fair_pricing. */
export function readFairPricing(fp: any) {
  return {
    headline: fp?.headline ?? {
      essential: { lock24: 29.99, flex30: 32.99 },
      superfast: { lock24: 34.99, flex30: 37.99 },
      ultrafast: { lock24: 39.99, flex30: 44.99 },
      gigabit:   { lock24: 44.99, flex30: 49.99 },
    },
    router: fp?.router ?? { standardOneOff: 79.99, standardMonthly: 4.99, premiumOneOff: 129.99, premiumMonthly: 7.99 },
    setup:  fp?.setup  ?? { remote: 0, standard: 49.99, engineer: 99.99 },
    addons: fp?.addons ?? { priorityMonthly: 6.99, staticIpMonthly: 5.00, digitalVoiceMonthly: 5.99, paperBillingMonthly: 2.50 },
    buffers: fp?.buffers ?? { support: 1.00, paymentFailure: 0.50, lockRisk: 1.00, flexRisk: 2.00, rewards: 0.00 },
    floors: fp?.floors ?? {},
    fallback: fp?.fallback ?? "auto_bump",
    priceLockEnabled: fp?.priceLockEnabled !== false,
    flex30Enabled:    fp?.flex30Enabled    !== false,
    raw: fp ?? {},
  };
}

/** Address eligibility check. Bucket -> requires speeds present in availability. */
export function bucketEligibleForAddress(bucket: SpeedBucket, maxDownload?: number, primaryTech?: string): boolean {
  if (maxDownload == null) return true;
  if (bucket === "essential") return maxDownload >= 30; // FTTC 40/10+ or any FTTP
  if (bucket === "superfast") return maxDownload >= 100; // 150/220/330
  if (bucket === "ultrafast") return maxDownload >= 400; // 500+
  if (bucket === "gigabit")   return maxDownload >= 900;
  return false;
}

/** Pure resolver. */
export function resolveBuildPlanPrice(i: ResolverInput, fpRaw: any): ResolvedResult {
  const fp = readFairPricing(fpRaw);

  // Term toggles
  if (i.plan_term === "price_lock_24" && !fp.priceLockEnabled) {
    return { ok: true, quote_only: true, message: "Price Lock 24 is currently unavailable. We'll quote this for you." };
  }
  if (i.plan_term === "flex_30" && !fp.flex30Enabled) {
    return { ok: true, quote_only: true, message: "Flex 30 is currently unavailable here. We'll quote this for you." };
  }

  // Address eligibility
  if (!bucketEligibleForAddress(i.speed_bucket, i.max_download, i.primary_technology)) {
    return { ok: true, quote_only: true, message: "This speed isn't confirmed available at your address — we'll quote it." };
  }

  // Quote-only short-circuits
  if (i.router_option === "business") {
    return { ok: true, quote_only: true, message: "Business router quoted before order." };
  }
  if (i.setup_option === "complex") {
    return { ok: true, quote_only: true, message: "Complex install needs a survey — we'll quote this before order." };
  }

  const termKey = i.plan_term === "price_lock_24" ? "lock24" : "flex30";
  const startingMonthly = Number((fp.headline as any)[i.speed_bucket]?.[termKey] ?? 0);
  if (!startingMonthly) {
    return { ok: true, quote_only: true, message: "This speed isn't on a standard plan here — we'll quote it." };
  }

  // Router
  let routerMonthly = 0, routerOneOff = 0, routerLabel = "Bring your own router";
  if (i.router_option === "standard") {
    routerLabel = "Standard WiFi 6 router";
    if (i.router_payment_type === "monthly") routerMonthly = fp.router.standardMonthly;
    else routerOneOff = fp.router.standardOneOff;
  } else if (i.router_option === "premium") {
    routerLabel = "Premium WiFi / mesh";
    if (i.router_payment_type === "monthly") routerMonthly = fp.router.premiumMonthly;
    else routerOneOff = fp.router.premiumOneOff;
  }

  // Setup
  let setupOneOff = 0, setupLabel = "Remote / no-site activation";
  if (i.setup_option === "standard") { setupOneOff = fp.setup.standard; setupLabel = "Standard setup"; }
  else if (i.setup_option === "engineer") { setupOneOff = fp.setup.engineer; setupLabel = "Engineer install"; }

  // Addons
  let addonsMonthly = 0;
  const addonLines: { id: AddonId; label: string; monthly: number }[] = [];
  for (const a of i.addons) {
    if (a === "priority_support") { addonsMonthly += fp.addons.priorityMonthly; addonLines.push({ id: a, label: "Priority support", monthly: fp.addons.priorityMonthly }); }
    else if (a === "static_ip") { addonsMonthly += fp.addons.staticIpMonthly; addonLines.push({ id: a, label: "Static IP", monthly: fp.addons.staticIpMonthly }); }
    else if (a === "digital_voice") { addonsMonthly += fp.addons.digitalVoiceMonthly; addonLines.push({ id: a, label: "Digital Voice", monthly: fp.addons.digitalVoiceMonthly }); }
    else if (a === "paper_billing") { addonsMonthly += fp.addons.paperBillingMonthly; addonLines.push({ id: a, label: "Paper billing", monthly: fp.addons.paperBillingMonthly }); }
  }

  // Margin guard with auto-bump
  const supplierMonthlyEx = supplierMonthlyEstimate(i.speed_bucket);
  const termBuffer = i.plan_term === "price_lock_24" ? (fp.buffers.lockRisk ?? 1.00) : (fp.buffers.flexRisk ?? 2.00);
  const floor = floorFor(i.speed_bucket, i.plan_term, fp);

  let proposedMonthly = startingMonthly;
  let bumped = false;
  let attempts = 0;
  while (attempts < 6) {
    const customerExVat = proposedMonthly / (1 + VAT_RATE);
    const margin = customerExVat
      - supplierMonthlyEx
      - (fp.buffers.support ?? 0)
      - (fp.buffers.paymentFailure ?? 0)
      - termBuffer
      - (fp.buffers.rewards ?? 0);
    if (margin >= floor) break;
    if (fp.fallback !== "auto_bump") {
      return { ok: true, quote_only: true, message: "This combination needs a custom quote — we'll confirm price before order." };
    }
    proposedMonthly = nextSafe99(proposedMonthly + 1);
    bumped = true;
    attempts++;
  }
  if (attempts >= 6) {
    return { ok: true, quote_only: true, message: "We can't show a safe price here — we'll quote this for you." };
  }

  const monthlyInclVat          = round2(proposedMonthly + routerMonthly + addonsMonthly);
  const monthlyBroadbandInclVat = round2(proposedMonthly);
  const oneOffInclVat           = round2(routerOneOff + setupOneOff);
  const firstBillInclVat        = round2(monthlyInclVat + oneOffInclVat);
  const monthlyExVat            = round2(monthlyInclVat / (1 + VAT_RATE));
  const vatAmount               = round2(monthlyInclVat - monthlyExVat);

  return {
    ok: true,
    quote_only: false,
    bumped,
    speed_bucket: i.speed_bucket,
    plan_term: i.plan_term,
    monthly_broadband_incl_vat: monthlyBroadbandInclVat,
    monthly_total_incl_vat: monthlyInclVat,
    monthly_total_ex_vat: monthlyExVat,
    vat_amount: vatAmount,
    vat_rate: VAT_RATE,
    router: { option: i.router_option, label: routerLabel, monthly: round2(routerMonthly), oneOff: round2(routerOneOff), payment_type: i.router_payment_type },
    setup:  { option: i.setup_option,  label: setupLabel,  oneOff: round2(setupOneOff) },
    addons: addonLines,
    one_off_incl_vat: oneOffInclVat,
    first_bill_incl_vat: firstBillInclVat,
    customer_type: i.customer_type,
    eligibility_wording: i.plan_term === "price_lock_24" ? PRICE_LOCK_WORDING : FLEX_30_WORDING,
    first_bill_promise: FIRST_BILL_PROMISE,
    internal: {
      monthly_broadband_ex_vat: round2(proposedMonthly / (1 + VAT_RATE)),
      router_monthly_ex_vat:    round2(routerMonthly / (1 + VAT_RATE)),
      addons_monthly_ex_vat:    round2(addonsMonthly / (1 + VAT_RATE)),
      router_one_off_ex_vat:    round2(routerOneOff / (1 + VAT_RATE)),
      setup_one_off_ex_vat:     round2(setupOneOff / (1 + VAT_RATE)),
    },
  };
}
// Shared Fair Broadband Pricing resolver.
// Phase 3D: DB-driven supplier selection (Giacom Broadband Ratecard).
// Owns: supplier mapping, margin guard, auto-bump, quote-only fallback,
// ETF/disconnect risk detection, router-required + unknown-setup flags.
// NEVER returns supplier cost, supplier product IDs, margin numbers,
// supplier names or internal notes to customers. Callers MUST run
// `stripInternal` on any object before sending it to a non-admin browser.
// Consumed server-side by:
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

export interface SupplierProductCandidate {
  id: string;
  product_name: string;
  network: string | null;
  technology: string | null;
  download_speed_mbps: number | null;
  upload_speed_mbps: number | null;
  min_term_months: number | null;
  supplier_monthly_net: number | null;
  care_level_uplift_net: number | null;
  connection_fee_net: number | null;
  router_required: boolean | null;
  router_compatible: string | null;
  etf_applies: boolean | null;
  disconnect_fee_in_12m_net: number | null;
  disconnect_fee_after_12m_net: number | null;
  bucket_hint: SpeedBucket | null;
  quote_only: boolean | null;
  active?: boolean | null;
  service_type?: string | null;
  tags?: string[] | null;
}

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

export interface ResolvedQuoteOnly { ok: true; quote_only: true; message: string; }
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
  /** Internal-only — callers MUST strip before returning to the browser. */
  internal: {
    monthly_broadband_ex_vat: number;
    router_monthly_ex_vat: number;
    addons_monthly_ex_vat: number;
    router_one_off_ex_vat: number;
    setup_one_off_ex_vat: number;
    supplier_product_id: string | null;
    supplier_monthly_ex: number | null;
    etf_risk: boolean;
    setup_unknown: boolean;
    router_required: boolean;
  };
}
export type ResolvedResult = ResolvedPriced | ResolvedQuoteOnly;

/** Deployment parity marker. Bumped per hotfix. */
export const RESOLVER_VERSION = "phase_3d_hotfix";

/** Strict term eligibility — no fallback to other terms. */
function isTermAllowed(c: SupplierProductCandidate, term: PlanTerm): boolean {
  const m = c.min_term_months;
  if (m == null) return false;
  if (term === "flex_30") return m === 1;
  if (term === "price_lock_24") {
    if (m === 24) return true;
    if (m === 36 && Array.isArray(c.tags) && c.tags.includes("allow_price_lock_24_from_36m")) return true;
    return false;
  }
  return false;
}

export const VAT_RATE = 0.20;
const round2 = (n: number) => Math.round(n * 100) / 100;
const nextSafe99 = (n: number) => {
  const floored = Math.floor(n);
  return floored + 0.99 >= n ? floored + 0.99 : floored + 1.99;
};

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
export const ETF_DISCONNECT_WORDING =
  "Cease, disconnection or early termination charges may apply depending on your selected service and when it ends. Any known charges are shown before you order.";
export const SETUP_CONFIRMED_BEFORE_ORDER =
  "Final setup price confirmed before order.";

export function speedBucketLabel(b: SpeedBucket): string {
  return ({ essential: "Essential Fibre", superfast: "Superfast Fibre", ultrafast: "Ultrafast Fibre", gigabit: "Gigabit Fibre" } as const)[b];
}
export function planTermLabel(t: PlanTerm): string {
  return t === "price_lock_24" ? "Price Lock 24" : "Flex 30";
}

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

export function bucketEligibleForAddress(bucket: SpeedBucket, maxDownload?: number, _primaryTech?: string): boolean {
  if (maxDownload == null) return true;
  if (bucket === "essential") return maxDownload >= 30;
  if (bucket === "superfast") return maxDownload >= 100;
  if (bucket === "ultrafast") return maxDownload >= 400;
  if (bucket === "gigabit")   return maxDownload >= 900;
  return false;
}

/**
 * Pure resolver. Callers MUST pass the candidate Giacom broadband rows already
 * filtered to active=true and quote_only=false. When no row matches the
 * bucket, the resolver returns quote_only — no literal customer-facing
 * fallback price.
 */
export function resolveBuildPlanPrice(
  i: ResolverInput,
  fpRaw: any,
  candidates: SupplierProductCandidate[] = [],
): ResolvedResult {
  const fp = readFairPricing(fpRaw);

  if (i.plan_term === "price_lock_24" && !fp.priceLockEnabled) {
    return { ok: true, quote_only: true, message: "Price Lock 24 is currently unavailable. We'll quote this for you." };
  }
  if (i.plan_term === "flex_30" && !fp.flex30Enabled) {
    return { ok: true, quote_only: true, message: "Flex 30 is currently unavailable here. We'll quote this for you." };
  }
  if (!bucketEligibleForAddress(i.speed_bucket, i.max_download, i.primary_technology)) {
    return { ok: true, quote_only: true, message: "This speed isn't confirmed available at your address — we'll quote it." };
  }
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

  // Strict eligibility — every gate must pass or we return quote_only.
  const eligible = candidates.filter((c) => {
    if (c.active === false) return false;
    if (c.quote_only === true) return false;
    if (c.bucket_hint !== i.speed_bucket) return false;
    if (c.supplier_monthly_net == null) return false;
    if (c.service_type != null && c.service_type !== "broadband") return false;
    if (!isTermAllowed(c, i.plan_term)) return false;
    if (i.max_download != null && c.download_speed_mbps != null) {
      if (c.download_speed_mbps > i.max_download + 5) return false;
    }
    return true;
  });

  if (eligible.length === 0) {
    return {
      ok: true, quote_only: true,
      message: "This speed isn't confirmed at your address yet — we'll quote it before you order.",
    };
  }

  // All survivors have an allowed term — rank by lowest cost then lowest ETF risk.
  const ranked = [...eligible].sort((a, b) => {
    const ca = (a.supplier_monthly_net ?? 0) + (a.care_level_uplift_net ?? 0);
    const cb = (b.supplier_monthly_net ?? 0) + (b.care_level_uplift_net ?? 0);
    if (ca !== cb) return ca - cb;
    return (a.etf_applies ? 1 : 0) - (b.etf_applies ? 1 : 0);
  });

  const chosen = ranked[0];
  const supplierMonthlyEx = (chosen.supplier_monthly_net ?? 0) + (chosen.care_level_uplift_net ?? 0);

  if (chosen.router_required && i.router_option === "own") {
    return {
      ok: true, quote_only: true,
      message: "This service needs our supplied router — we'll confirm options before order.",
    };
  }

  // Router (customer-facing — fair pricing)
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

  // Setup (customer-facing — supplier connection fee tracked internally)
  let setupOneOff = 0, setupLabel = "Remote / no-site activation";
  if (i.setup_option === "standard") { setupOneOff = fp.setup.standard; setupLabel = "Standard setup"; }
  else if (i.setup_option === "engineer") { setupOneOff = fp.setup.engineer; setupLabel = "Engineer install"; }
  const setupUnknown =
    chosen.connection_fee_net == null &&
    i.setup_option !== "remote" &&
    i.setup_option !== "complex";

  // Addons
  let addonsMonthly = 0;
  const addonLines: { id: AddonId; label: string; monthly: number }[] = [];
  for (const a of i.addons) {
    if (a === "priority_support") { addonsMonthly += fp.addons.priorityMonthly; addonLines.push({ id: a, label: "Priority support", monthly: fp.addons.priorityMonthly }); }
    else if (a === "static_ip")    { addonsMonthly += fp.addons.staticIpMonthly; addonLines.push({ id: a, label: "Static IP", monthly: fp.addons.staticIpMonthly }); }
    else if (a === "digital_voice"){ addonsMonthly += fp.addons.digitalVoiceMonthly; addonLines.push({ id: a, label: "Digital Voice", monthly: fp.addons.digitalVoiceMonthly }); }
    else if (a === "paper_billing"){ addonsMonthly += fp.addons.paperBillingMonthly; addonLines.push({ id: a, label: "Paper billing", monthly: fp.addons.paperBillingMonthly }); }
  }

  // Margin guard with auto-bump
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
      supplier_product_id:      chosen.id,
      supplier_monthly_ex:      round2(supplierMonthlyEx),
      etf_risk:                 !!(chosen.etf_applies || (chosen.disconnect_fee_in_12m_net ?? 0) > 0),
      setup_unknown:            setupUnknown,
      router_required:          !!chosen.router_required,
    },
  };
}

/**
 * Public-safe response sanitiser. ALWAYS run on any object before
 * returning to a non-admin browser caller. Removes the `internal` block
 * and strips any stray supplier/margin/ratecard fields.
 */
export function stripInternal<T extends Record<string, any>>(obj: T): Record<string, any> {
  const safe: Record<string, any> = { ...obj };
  delete safe.internal;
  for (const key of Object.keys(safe)) {
    const k = key.toLowerCase();
    if (k.startsWith("supplier_") || k.includes("margin") || k.includes("ratecard") || k === "supplier_cost") {
      delete safe[key];
    }
  }
  return safe;
}

/** Load the Giacom broadband candidate set from supplier_products via service client. */
export async function loadGiacomCandidates(supabase: any, bucket: SpeedBucket): Promise<SupplierProductCandidate[]> {
  const { data: profile, error: profErr } = await supabase
    .from("supplier_profiles")
    .select("id")
    .eq("supplier_name", "Giacom")
    .maybeSingle();
  if (profErr) throw new Error("supplier_profile_load_failed");
  if (!profile) return [];
  const { data, error } = await supabase
    .from("supplier_products")
    .select("id, product_name, network, technology, download_speed_mbps, upload_speed_mbps, min_term_months, supplier_monthly_net, care_level_uplift_net, connection_fee_net, router_required, router_compatible, etf_applies, disconnect_fee_in_12m_net, disconnect_fee_after_12m_net, bucket_hint, quote_only, active, service_type, tags")
    .eq("supplier_id", profile.id)
    .eq("active", true)
    .eq("quote_only", false)
    .eq("bucket_hint", bucket)
    .eq("service_type", "broadband");
  if (error) throw new Error("supplier_products_load_failed");
  return (data ?? []) as SupplierProductCandidate[];
}

/** Safe quote-only result for loader failures. Never returns priced fallback. */
export const LOADER_FAILURE_QUOTE_ONLY: ResolvedQuoteOnly = {
  ok: true,
  quote_only: true,
  message: "Final price needs manual confirmation for this address.",
};
// Shared Fair Broadband Pricing resolver.
// Giacom V4: exact product economics, strict term/speed matching, fail-closed
// connection/router costs and margin protection. Supplier economics are never
// returned to a customer browser; callers must use stripInternal().

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
  supplier_router_net: number | null;
  care_level_uplift_net: number | null;
  connection_fee_net: number | null;
  migration_fee_net?: number | null;
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
  estimated_download_mbps: number;
  estimated_upload_mbps: number;
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
  internal: {
    monthly_broadband_ex_vat: number;
    router_monthly_ex_vat: number;
    addons_monthly_ex_vat: number;
    router_one_off_ex_vat: number;
    setup_one_off_ex_vat: number;
    supplier_product_id: string | null;
    supplier_monthly_ex: number | null;
    supplier_connection_ex: number;
    supplier_router_ex: number;
    disconnect_fee_in_12m_ex: number;
    disconnect_fee_after_12m_ex: number;
    disconnect_fee_in_12m_incl_vat: number;
    disconnect_fee_after_12m_incl_vat: number;
    selected_download_mbps: number;
    selected_upload_mbps: number;
    selected_technology: string | null;
    etf_risk: boolean;
    setup_unknown: boolean;
    router_required: boolean;
  };
}
export type ResolvedResult = ResolvedPriced | ResolvedQuoteOnly;

export const RESOLVER_VERSION = "giacom_v4_2026_08_10";
export const VAT_RATE = 0.20;

const BUCKET_TARGET: Record<SpeedBucket, number> = {
  essential: 80,
  superfast: 330,
  ultrafast: 550,
  gigabit: 1000,
};

const round2 = (n: number) => Math.round(Number(n) * 100) / 100;
const nextSafe99 = (n: number) => {
  const floored = Math.floor(n);
  return floored + 0.99 >= n ? floored + 0.99 : floored + 1.99;
};

function isTermAllowed(c: SupplierProductCandidate, term: PlanTerm): boolean {
  const m = c.min_term_months;
  if (m == null) return false;
  if (term === "flex_30") return m === 1;
  if (term === "price_lock_24") {
    if (m === 24) return true;
    return m === 36 && Array.isArray(c.tags) && c.tags.includes("allow_price_lock_24_from_36m");
  }
  return false;
}

function normaliseTechnology(v?: string | null): "FTTP" | "SOGEA" | null {
  const s = String(v ?? "").toLowerCase();
  if (!s) return null;
  if (s.includes("fttp") || s.includes("full fibre") || s.includes("full-fibre")) return "FTTP";
  if (s.includes("sogea") || s.includes("fttc")) return "SOGEA";
  return null;
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
export const ETF_DISCONNECT_WORDING =
  "Any early-termination and network cease or migration-away charges that can apply are set out in your Contract Summary before you accept.";
export const SETUP_CONFIRMED_BEFORE_ORDER =
  "Final setup and activation charges are confirmed before order.";

export function speedBucketLabel(b: SpeedBucket): string {
  return ({ essential: "Essential Fibre", superfast: "Superfast Fibre", ultrafast: "Ultrafast Fibre", gigabit: "Gigabit Fibre" } as const)[b];
}
export function planTermLabel(t: PlanTerm): string {
  return t === "price_lock_24" ? "Price Lock 24" : "Flex 30";
}

export function readFairPricing(fp: any) {
  return {
    headline: fp?.headline ?? {
      essential: { lock24: 34.99, flex30: 37.99 },
      superfast: { lock24: 43.99, flex30: 45.99 },
      ultrafast: { lock24: 51.99, flex30: 52.99 },
      gigabit:   { lock24: 57.99, flex30: 58.99 },
    },
    router: fp?.router ?? { standardOneOff: 94.99, standardMonthly: 4.99, premiumOneOff: 129.99, premiumMonthly: 7.99 },
    setup:  fp?.setup ?? { remote: 0, standard: 49.99, engineer: 134.99 },
    addons: fp?.addons ?? { priorityMonthly: 6.99, staticIpMonthly: 5.00, digitalVoiceMonthly: 5.99, paperBillingMonthly: 2.50 },
    buffers: fp?.buffers ?? { support: 1.00, paymentFailure: 0.50, lockRisk: 1.00, flexRisk: 2.00, rewards: 0.00 },
    floors: fp?.floors ?? {},
    fallback: fp?.fallback ?? "auto_bump",
    priceLockEnabled: fp?.priceLockEnabled !== false,
    flex30Enabled: fp?.flex30Enabled !== false,
    raw: fp ?? {},
  };
}

export function bucketEligibleForAddress(bucket: SpeedBucket, maxDownload?: number, _primaryTech?: string): boolean {
  if (maxDownload == null) return true;
  if (bucket === "essential") return maxDownload >= 30;
  if (bucket === "superfast") return maxDownload >= 100;
  if (bucket === "ultrafast") return maxDownload >= 400;
  return maxDownload >= 900;
}

export function resolveBuildPlanPrice(
  i: ResolverInput,
  fpRaw: any,
  candidates: SupplierProductCandidate[] = [],
): ResolvedResult {
  const fp = readFairPricing(fpRaw);
  if (i.plan_term === "price_lock_24" && !fp.priceLockEnabled) return { ok: true, quote_only: true, message: "Price Lock 24 is currently unavailable. We'll quote this for you." };
  if (i.plan_term === "flex_30" && !fp.flex30Enabled) return { ok: true, quote_only: true, message: "Flex 30 is currently unavailable here. We'll quote this for you." };
  if (!bucketEligibleForAddress(i.speed_bucket, i.max_download, i.primary_technology)) return { ok: true, quote_only: true, message: "This speed isn't confirmed available at your address — we'll quote it." };
  if (i.router_option === "business") return { ok: true, quote_only: true, message: "Business router quoted before order." };
  if (i.router_option === "premium") return { ok: true, quote_only: true, message: "Premium WiFi is quoted before order so we can match the equipment to your line." };
  if (i.setup_option === "complex") return { ok: true, quote_only: true, message: "Complex install needs a survey — we'll quote this before order." };
  if (i.plan_term === "flex_30" && i.router_option === "standard" && i.router_payment_type === "monthly") {
    return { ok: true, quote_only: true, message: "On Flex 30, choose your own router or the one-off router option so there is no long equipment commitment." };
  }

  const termKey = i.plan_term === "price_lock_24" ? "lock24" : "flex30";
  const startingMonthly = Number((fp.headline as any)[i.speed_bucket]?.[termKey] ?? 0);
  if (!startingMonthly) return { ok: true, quote_only: true, message: "This speed isn't on a standard plan here — we'll quote it." };

  const primaryTech = normaliseTechnology(i.primary_technology);
  const speedCap = Math.min(BUCKET_TARGET[i.speed_bucket], i.max_download ?? BUCKET_TARGET[i.speed_bucket]);

  const eligible = candidates.filter((c) => {
    if (c.active === false || c.quote_only === true) return false;
    if (c.bucket_hint !== i.speed_bucket || c.service_type !== "broadband") return false;
    if (c.supplier_monthly_net == null || c.connection_fee_net == null) return false;
    if (c.disconnect_fee_in_12m_net == null || c.disconnect_fee_after_12m_net == null) return false;
    if (!isTermAllowed(c, i.plan_term)) return false;
    if (i.customer_type === "residential" && /business/i.test(c.product_name)) return false;
    if (primaryTech && normaliseTechnology(c.technology) && normaliseTechnology(c.technology) !== primaryTech) return false;
    if (c.download_speed_mbps == null || c.download_speed_mbps > speedCap + 5) return false;
    if (i.router_option === "own" && c.router_required) return false;
    if (i.router_option === "standard" && c.supplier_router_net == null) return false;
    return true;
  });

  if (!eligible.length) return { ok: true, quote_only: true, message: "This exact service isn't confirmed safely at your address yet — we'll quote it before you order." };

  // Pick the fastest product the address/tier permits; only then use cost as a tie-breaker.
  // This prevents a 330-Mbps customer tier being margin-tested against a cheaper 115-Mbps row.
  const ranked = [...eligible].sort((a, b) => {
    const speedDiff = (b.download_speed_mbps ?? 0) - (a.download_speed_mbps ?? 0);
    if (speedDiff) return speedDiff;
    const ca = (a.supplier_monthly_net ?? 0) + (a.care_level_uplift_net ?? 0);
    const cb = (b.supplier_monthly_net ?? 0) + (b.care_level_uplift_net ?? 0);
    if (ca !== cb) return ca - cb;
    return (a.etf_applies ? 1 : 0) - (b.etf_applies ? 1 : 0);
  });
  const chosen = ranked[0];
  const supplierMonthlyEx = Number(chosen.supplier_monthly_net ?? 0) + Number(chosen.care_level_uplift_net ?? 0);
  const supplierConnectionEx = Number(chosen.connection_fee_net ?? 0);
  const supplierRouterEx = Number(chosen.supplier_router_net ?? 0);

  let routerMonthly = 0, routerOneOff = 0, routerLabel = "Bring your own router";
  if (i.router_option === "standard") {
    routerLabel = "Standard WiFi 6 router";
    if (i.router_payment_type === "monthly") {
      const recoveryFloor = round2(((supplierRouterEx + 6) * (1 + VAT_RATE)) / 24);
      routerMonthly = Math.max(Number(fp.router.standardMonthly), recoveryFloor);
    } else {
      const routerFloor = nextSafe99(supplierRouterEx * (1 + VAT_RATE) + 2);
      routerOneOff = Math.max(Number(fp.router.standardOneOff), routerFloor);
    }
  }

  const connectionGross = round2(supplierConnectionEx * (1 + VAT_RATE));
  const connectionFloor = connectionGross > 0 ? nextSafe99(connectionGross + 2) : 0;
  let setupOneOff = connectionFloor;
  let setupLabel = connectionFloor > 0 ? "Network activation / remote setup" : "Remote / no-site activation";
  if (i.setup_option === "standard") {
    setupOneOff = Math.max(Number(fp.setup.standard), connectionFloor);
    setupLabel = "Standard setup / connection";
  } else if (i.setup_option === "engineer") {
    setupOneOff = Math.max(Number(fp.setup.engineer), connectionFloor);
    setupLabel = "Engineer installation";
  }

  let addonsMonthly = 0;
  const addonLines: { id: AddonId; label: string; monthly: number }[] = [];
  for (const a of i.addons) {
    if (a === "priority_support") { addonsMonthly += Number(fp.addons.priorityMonthly); addonLines.push({ id: a, label: "Priority support", monthly: Number(fp.addons.priorityMonthly) }); }
    else if (a === "static_ip") { addonsMonthly += Number(fp.addons.staticIpMonthly); addonLines.push({ id: a, label: "Static IP", monthly: Number(fp.addons.staticIpMonthly) }); }
    else if (a === "digital_voice") { addonsMonthly += Number(fp.addons.digitalVoiceMonthly); addonLines.push({ id: a, label: "Digital Voice", monthly: Number(fp.addons.digitalVoiceMonthly) }); }
    else if (a === "paper_billing") { addonsMonthly += Number(fp.addons.paperBillingMonthly); addonLines.push({ id: a, label: "Paper billing", monthly: Number(fp.addons.paperBillingMonthly) }); }
  }

  const termBuffer = i.plan_term === "price_lock_24" ? Number(fp.buffers.lockRisk ?? 1) : Number(fp.buffers.flexRisk ?? 2);
  const floor = floorFor(i.speed_bucket, i.plan_term, fp);
  let proposedMonthly = startingMonthly;
  let bumped = false;
  let attempts = 0;
  while (attempts < 12) {
    const customerExVat = proposedMonthly / (1 + VAT_RATE);
    const margin = customerExVat - supplierMonthlyEx - Number(fp.buffers.support ?? 0) - Number(fp.buffers.paymentFailure ?? 0) - termBuffer - Number(fp.buffers.rewards ?? 0);
    if (margin >= floor) break;
    if (fp.fallback !== "auto_bump") return { ok: true, quote_only: true, message: "This combination needs a custom quote — we'll confirm price before order." };
    proposedMonthly = nextSafe99(proposedMonthly + 1);
    bumped = true;
    attempts += 1;
  }
  if (attempts >= 12) return { ok: true, quote_only: true, message: "We can't show a safe price here — we'll quote this for you." };

  const monthlyBroadbandInclVat = round2(proposedMonthly);
  const monthlyInclVat = round2(proposedMonthly + routerMonthly + addonsMonthly);
  const oneOffInclVat = round2(routerOneOff + setupOneOff);
  const firstBillInclVat = round2(monthlyInclVat + oneOffInclVat);
  const monthlyExVat = round2(monthlyInclVat / (1 + VAT_RATE));
  const vatAmount = round2(monthlyInclVat - monthlyExVat);
  const selectedDown = Number(chosen.download_speed_mbps ?? 0);
  const selectedUp = Number(chosen.upload_speed_mbps ?? 0);
  const disconnectInEx = Number(chosen.disconnect_fee_in_12m_net ?? 0);
  const disconnectAfterEx = Number(chosen.disconnect_fee_after_12m_net ?? 0);

  return {
    ok: true,
    quote_only: false,
    bumped,
    speed_bucket: i.speed_bucket,
    plan_term: i.plan_term,
    estimated_download_mbps: selectedDown,
    estimated_upload_mbps: selectedUp,
    monthly_broadband_incl_vat: monthlyBroadbandInclVat,
    monthly_total_incl_vat: monthlyInclVat,
    monthly_total_ex_vat: monthlyExVat,
    vat_amount: vatAmount,
    vat_rate: VAT_RATE,
    router: { option: i.router_option, label: routerLabel, monthly: round2(routerMonthly), oneOff: round2(routerOneOff), payment_type: i.router_payment_type },
    setup: { option: i.setup_option, label: setupLabel, oneOff: round2(setupOneOff) },
    addons: addonLines,
    one_off_incl_vat: oneOffInclVat,
    first_bill_incl_vat: firstBillInclVat,
    customer_type: i.customer_type,
    eligibility_wording: i.plan_term === "price_lock_24" ? PRICE_LOCK_WORDING : FLEX_30_WORDING,
    first_bill_promise: FIRST_BILL_PROMISE,
    internal: {
      monthly_broadband_ex_vat: round2(proposedMonthly / (1 + VAT_RATE)),
      router_monthly_ex_vat: round2(routerMonthly / (1 + VAT_RATE)),
      addons_monthly_ex_vat: round2(addonsMonthly / (1 + VAT_RATE)),
      router_one_off_ex_vat: round2(routerOneOff / (1 + VAT_RATE)),
      setup_one_off_ex_vat: round2(setupOneOff / (1 + VAT_RATE)),
      supplier_product_id: chosen.id,
      supplier_monthly_ex: round2(supplierMonthlyEx),
      supplier_connection_ex: round2(supplierConnectionEx),
      supplier_router_ex: round2(supplierRouterEx),
      disconnect_fee_in_12m_ex: round2(disconnectInEx),
      disconnect_fee_after_12m_ex: round2(disconnectAfterEx),
      disconnect_fee_in_12m_incl_vat: round2(disconnectInEx * (1 + VAT_RATE)),
      disconnect_fee_after_12m_incl_vat: round2(disconnectAfterEx * (1 + VAT_RATE)),
      selected_download_mbps: selectedDown,
      selected_upload_mbps: selectedUp,
      selected_technology: chosen.technology ?? null,
      etf_risk: !!chosen.etf_applies,
      setup_unknown: false,
      router_required: !!chosen.router_required,
    },
  };
}

export function stripInternal<T extends Record<string, any>>(obj: T): Record<string, any> {
  const safe: Record<string, any> = { ...obj };
  delete safe.internal;
  for (const key of Object.keys(safe)) {
    const k = key.toLowerCase();
    if (k.startsWith("supplier_") || k.includes("margin") || k.includes("ratecard") || k === "supplier_cost") delete safe[key];
  }
  return safe;
}

export async function loadGiacomCandidates(supabase: any, bucket: SpeedBucket): Promise<SupplierProductCandidate[]> {
  const { data: profile, error: profErr } = await supabase
    .from("supplier_profiles").select("id").ilike("supplier_name", "%Giacom%")
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (profErr) throw new Error("supplier_profile_load_failed");
  if (!profile) return [];
  const { data, error } = await supabase
    .from("supplier_products")
    .select("id, product_name, network, technology, download_speed_mbps, upload_speed_mbps, min_term_months, supplier_monthly_net, supplier_router_net, care_level_uplift_net, connection_fee_net, migration_fee_net, router_required, router_compatible, etf_applies, disconnect_fee_in_12m_net, disconnect_fee_after_12m_net, bucket_hint, quote_only, active, service_type, tags")
    .eq("supplier_id", profile.id).eq("active", true).eq("quote_only", false)
    .eq("bucket_hint", bucket).eq("service_type", "broadband");
  if (error) throw new Error("supplier_products_load_failed");
  return (data ?? []) as SupplierProductCandidate[];
}

export const LOADER_FAILURE_QUOTE_ONLY: ResolvedQuoteOnly = {
  ok: true,
  quote_only: true,
  message: "Final price needs manual confirmation for this address.",
};

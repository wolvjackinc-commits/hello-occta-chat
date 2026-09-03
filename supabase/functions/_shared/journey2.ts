/**
 * Customer Journey 2.0 — shared server helpers.
 *
 * Journey 2 is the immediate ordering flow. It owns its own session state but
 * deliberately reuses the existing authoritative services for pricing
 * (buildPlanResolver), contract documents, Direct Debit capture and canonical
 * order creation. Nothing commercial is duplicated or hard-coded here.
 */
import { sha256Hex } from "./quoteHelpers.ts";
import {
  resolveBuildPlanPrice, loadGiacomCandidates, RESOLVER_VERSION,
  speedBucketLabel, planTermLabel, PUBLIC_SPEED_BUCKETS,
  type SpeedBucket, type PlanTerm, type RouterChoice, type RouterPayType,
  type SetupChoice, type AddonId, type ResolvedPriced,
} from "./buildPlanResolver.ts";

// Journey 2 follows the same public-band governance as the rest of the site:
// exactly Essential, Superfast and Ultrafast. `gigabit` remains an internal
// supplier bucket and must never render as a fourth public card.
export const SPEED_BUCKETS: SpeedBucket[] = [...PUBLIC_SPEED_BUCKETS];
export const PLAN_TERMS: PlanTerm[] = ["price_lock_24", "flex_30"];
export const ROUTER_CHOICES: { option: RouterChoice; payment_type: RouterPayType }[] = [
  { option: "own", payment_type: "none" },
  { option: "standard", payment_type: "one_off" },
  { option: "standard", payment_type: "monthly" },
  { option: "premium", payment_type: "one_off" },
  { option: "premium", payment_type: "monthly" },
];
export const ADDON_IDS: AddonId[] = ["priority_support", "static_ip", "digital_voice", "paper_billing"];
/** Journey 2 only sells setup options with an exact, known price. */
export const JOURNEY2_SETUP: SetupChoice = "remote";

/**
 * Estimated line speeds shown against each speed bucket. These are estimates
 * for the wholesale product, not guarantees — the exact wording is carried into
 * the Contract Summary and Contract Information.
 */
export const SPEED_ESTIMATES: Record<SpeedBucket, { download: number; upload: number }> = {
  essential: { download: 80, upload: 20 },
  superfast: { download: 330, upload: 50 },
  ultrafast: { download: 550, upload: 75 },
  gigabit: { download: 1000, upload: 115 },
};
export function speedEstimate(b: SpeedBucket) {
  return SPEED_ESTIMATES[b] ?? { download: 0, upload: 0 };
}

export const JOURNEY2_STEPS = [
  "address", "plan", "router", "extras", "details",
  "start_date", "billing", "contract", "review", "complete",
] as const;
export type Journey2Step = typeof JOURNEY2_STEPS[number];

export const JOURNEY_SETTINGS_COLS = `
  singleton, fair_pricing, two_document_contract_flow_enabled, vat_default_rate,
  customer_journey_v1_enabled, customer_journey_v2_enabled, customer_journey_default,
  customer_journey_v2_kill_switch, customer_journey_v2_test_mode,
  customer_journey_v2_rollout_percentage, customer_journey_v2_abandoned_resume_enabled,
  customer_journey_v2_resume_delay_minutes, customer_journey_v2_session_expiry_days,
  customer_journey_v2_assumed_availability, customer_journey_v2_last_preflight_at,
  customer_journey_v2_last_preflight_result
`;

export type JourneySettings = {
  fair_pricing: unknown;
  two_document_contract_flow_enabled: boolean;
  vat_default_rate: number;
  customer_journey_v1_enabled: boolean;
  customer_journey_v2_enabled: boolean;
  customer_journey_default: "v1" | "v2";
  customer_journey_v2_kill_switch: boolean;
  customer_journey_v2_test_mode: boolean;
  customer_journey_v2_rollout_percentage: number;
  customer_journey_v2_abandoned_resume_enabled: boolean;
  customer_journey_v2_resume_delay_minutes: number;
  customer_journey_v2_session_expiry_days: number;
  customer_journey_v2_assumed_availability: boolean;
  customer_journey_v2_last_preflight_at: string | null;
  customer_journey_v2_last_preflight_result: { ok?: boolean; failures?: string[] } | null;
};

export async function loadJourneySettings(supabase: any): Promise<JourneySettings> {
  const { data } = await supabase
    .from("platform_settings")
    .select(JOURNEY_SETTINGS_COLS)
    .eq("singleton", true)
    .maybeSingle();
  return (data ?? {}) as JourneySettings;
}

export function preflightPassed(s: JourneySettings): boolean {
  return !!s.customer_journey_v2_last_preflight_result?.ok;
}

/** Deterministic 0-99 bucket from an anonymous session identifier hash. */
export function rolloutBucket(anonHash: string): number {
  const slice = anonHash.slice(0, 8);
  const n = parseInt(slice, 16);
  return Number.isFinite(n) ? n % 100 : 0;
}

export type JourneyAssignment = {
  version: "v1" | "v2" | null;
  reason: string;
};

/**
 * Deterministic journey router for NEW sessions only. An existing session
 * always keeps the version stored against it.
 *
 * `adminTest` may only be set after the caller has been validated
 * server-side as an admin/super_admin (or the internal service role). A
 * server-validated test start is allowed to reach Journey 2 while the public
 * kill switch is ON, because it runs entirely against the isolated
 * `journey2_test_*` tables. Anonymous and customer starts always resolve to
 * Journey 1 while the kill switch is ON.
 */
export function assignJourneyVersion(
  s: JourneySettings,
  anonHash: string,
  opts: { adminTest?: boolean } = {},
): JourneyAssignment {
  const v2Ready = s.customer_journey_v2_enabled && !s.customer_journey_v2_kill_switch && preflightPassed(s);
  if (opts.adminTest) return { version: "v2", reason: "verified_admin_isolated_test" };
  if (s.customer_journey_v2_kill_switch) {
    return s.customer_journey_v1_enabled
      ? { version: "v1", reason: "v2_kill_switch" }
      : { version: null, reason: "both_unavailable" };
  }
  if (!v2Ready) {
    return s.customer_journey_v1_enabled
      ? { version: "v1", reason: s.customer_journey_v2_enabled ? "v2_preflight_not_passed" : "v2_disabled" }
      : { version: null, reason: "both_unavailable" };
  }
  if (!s.customer_journey_v1_enabled) return { version: "v2", reason: "v1_disabled" };

  const pct = Math.max(0, Math.min(100, Number(s.customer_journey_v2_rollout_percentage ?? 0)));
  const inRollout = rolloutBucket(anonHash) < pct;
  if (s.customer_journey_default === "v2") {
    return { version: "v2", reason: "default_v2" };
  }
  return inRollout
    ? { version: "v2", reason: "rollout" }
    : { version: "v1", reason: "default_v1" };
}

// ── Catalogue ────────────────────────────────────────────────────────────────

export type CatalogueTerm = { monthly_incl_vat: number; monthly_ex_vat: number; vat_amount: number };
export type CataloguePlan = {
  speed_bucket: SpeedBucket;
  label: string;
  /** Estimated download speed in Mbps. Estimate, never a guarantee. */
  estimated_download_mbps: number;
  /** Estimated upload speed in Mbps. Estimate, never a guarantee. */
  estimated_upload_mbps: number;
  terms: Partial<Record<PlanTerm, CatalogueTerm>>;
};
export type CatalogueRouter = {
  key: string;
  option: RouterChoice;
  payment_type: RouterPayType;
  label: string;
  monthly: number;
  one_off: number;
};
export type CatalogueExtra = { id: AddonId; label: string; monthly: number };
export type Catalogue = {
  pricing_version: string;
  customer_type: "residential" | "business";
  setup: { option: SetupChoice; label: string; one_off: number } | null;
  plans: CataloguePlan[];
  routers: CatalogueRouter[];
  extras: CatalogueExtra[];
};

function baseInput(
  bucket: SpeedBucket,
  term: PlanTerm,
  customer_type: "residential" | "business",
) {
  return {
    speed_bucket: bucket,
    plan_term: term,
    router_option: "own" as RouterChoice,
    router_payment_type: "none" as RouterPayType,
    setup_option: JOURNEY2_SETUP,
    addons: [] as AddonId[],
    customer_type,
    // Journey 2 assumes availability for every published speed. No address
    // speed cap is applied, so no "subject to confirmation" pricing appears.
  };
}

export async function resolveJourney2Price(
  supabase: any,
  settings: JourneySettings,
  sel: {
    speed_bucket: SpeedBucket;
    plan_term: PlanTerm;
    router_option: RouterChoice;
    router_payment_type: RouterPayType;
    addons: AddonId[];
    customer_type: "residential" | "business";
  },
): Promise<ResolvedPriced | null> {
  let candidates;
  try {
    candidates = await loadGiacomCandidates(supabase, sel.speed_bucket);
  } catch {
    return null;
  }
  if (!candidates) return null;
  const r = resolveBuildPlanPrice(
    {
      speed_bucket: sel.speed_bucket,
      plan_term: sel.plan_term,
      router_option: sel.router_option,
      router_payment_type: sel.router_payment_type,
      setup_option: JOURNEY2_SETUP,
      addons: sel.addons,
      customer_type: sel.customer_type,
    },
    (settings as any).fair_pricing ?? {},
    candidates,
  );
  if (r.quote_only) return null;
  if (r.internal.setup_unknown) return null; // never sell an unknown setup price
  return r;
}

/**
 * Builds the Journey 2 catalogue from the authoritative resolver. Anything
 * that cannot be priced exactly is omitted, so Journey 2 never shows a
 * "from" price or an unconfirmed charge. A resolver auto-bump is still an
 * exact customer price, so it must be published instead of hiding a whole
 * public speed band.
 */
export async function buildCatalogue(
  supabase: any,
  settings: JourneySettings,
  customer_type: "residential" | "business" = "residential",
): Promise<Catalogue> {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const plans: CataloguePlan[] = [];
  let anchor: ResolvedPriced | null = null;

  for (const bucket of SPEED_BUCKETS) {
    const terms: Partial<Record<PlanTerm, CatalogueTerm>> = {};
    let candidates;
    try {
      candidates = await loadGiacomCandidates(supabase, bucket);
    } catch {
      candidates = null;
    }
    if (!candidates) continue;

    for (const term of PLAN_TERMS) {
      const r = resolveBuildPlanPrice(
        baseInput(bucket, term, customer_type),
        (settings as any).fair_pricing ?? {},
        candidates,
      );
      if (r.quote_only) continue;
      if (r.internal.setup_unknown) continue;
      terms[term] = {
        monthly_incl_vat: r.monthly_total_incl_vat,
        monthly_ex_vat: r.monthly_total_ex_vat,
        vat_amount: r.vat_amount,
      };
      if (!anchor) anchor = r;
    }
    if (Object.keys(terms).length > 0) {
      const est = speedEstimate(bucket);
      plans.push({
        speed_bucket: bucket,
        label: speedBucketLabel(bucket),
        estimated_download_mbps: est.download,
        estimated_upload_mbps: est.upload,
        terms,
      });
    }
  }

  // Router and extra prices come from a single resolved reference so the
  // amounts shown are exactly the amounts charged.
  const routers: CatalogueRouter[] = [];
  const extras: CatalogueExtra[] = [];
  let setup: Catalogue["setup"] = null;

  if (anchor) {
    setup = { option: anchor.setup.option, label: anchor.setup.label, one_off: anchor.setup.oneOff };
    const refBucket = anchor.speed_bucket;
    const refTerm = anchor.plan_term;
    let candidates;
    try {
      candidates = await loadGiacomCandidates(supabase, refBucket);
    } catch {
      candidates = null;
    }
    if (candidates) {
      for (const rc of ROUTER_CHOICES) {
        const r = resolveBuildPlanPrice(
          { ...baseInput(refBucket, refTerm, customer_type), router_option: rc.option, router_payment_type: rc.payment_type },
          (settings as any).fair_pricing ?? {},
          candidates,
        );
        if (r.quote_only) continue;
        if (rc.option !== "own" && r.router.monthly === 0 && r.router.oneOff === 0) continue; // no exact price
        const key = `${rc.option}_${rc.payment_type}`;
        if (routers.some((x) => x.key === key)) continue;
        routers.push({
          key,
          option: r.router.option,
          payment_type: r.router.payment_type,
          label: r.router.label,
          monthly: round2(r.router.monthly),
          one_off: round2(r.router.oneOff),
        });
      }

      for (const id of ADDON_IDS) {
        const r = resolveBuildPlanPrice(
          { ...baseInput(refBucket, refTerm, customer_type), addons: [id] },
          (settings as any).fair_pricing ?? {},
          candidates,
        );
        if (r.quote_only) continue;
        const found = r.addons.find((a) => a.id === id);
        if (!found || !(found.monthly > 0)) continue;
        extras.push({ id, label: found.label, monthly: round2(found.monthly) });
      }
    }
  }

  return {
    pricing_version: RESOLVER_VERSION,
    customer_type,
    setup,
    plans,
    routers,
    extras,
  };
}

export function planNameFor(bucket: SpeedBucket, term: PlanTerm) {
  return `${speedBucketLabel(bucket)} — ${planTermLabel(term)}`;
}

export async function hashAnon(anonId: string) {
  return await sha256Hex(`j2:${anonId}`);
}
import { describe, expect, it } from "vitest";
import {
  resolveBuildPlanPrice,
  type ResolvedPriced,
  type SupplierProductCandidate,
} from "../../../../supabase/functions/_shared/buildPlanResolver";
import { FAIR_PRICING_DEFAULTS } from "../fairPricing";

// Governed public headline prices only. Wholesale/rate-card economics live in the
// candidate rows below and must never move these numbers.
const fp = {
  ...FAIR_PRICING_DEFAULTS,
  buffers: { support: 1, paymentFailure: 0.5, lockRisk: 1, flexRisk: 2, rewards: 0 },
  floors: { essentialLockByo: 1.5, essentialFlex: 3.5, superfast: 3.5, ultrafast: 4.5, gigabit: 4.5 },
  fallback: "auto_bump",
};

const candidate = (o: Partial<SupplierProductCandidate> = {}): SupplierProductCandidate => ({
  id: crypto.randomUUID(),
  product_name: "Giacom FTTP 330/50",
  network: "CityFibre",
  technology: "FTTP",
  download_speed_mbps: 330,
  upload_speed_mbps: 50,
  min_term_months: 1,
  supplier_monthly_net: 26,
  supplier_router_net: 72,
  care_level_uplift_net: 0,
  connection_fee_net: 0,
  migration_fee_net: 0,
  router_required: false,
  router_compatible: "yes",
  etf_applies: true,
  disconnect_fee_in_12m_net: 75,
  disconnect_fee_after_12m_net: 25,
  bucket_hint: "superfast",
  quote_only: false,
  active: true,
  service_type: "broadband",
  tags: [],
  ...o,
});

const base = {
  router_option: "own" as const,
  router_payment_type: "none" as const,
  setup_option: "remote" as const,
  addons: [],
  customer_type: "residential" as const,
  max_download: 1000,
  primary_technology: "FTTP",
};

const priced = (r: ReturnType<typeof resolveBuildPlanPrice>): ResolvedPriced => {
  expect(r.quote_only).toBe(false);
  if (r.quote_only) throw new Error("expected priced result");
  return r as ResolvedPriced;
};

describe("public headline bands survive supplier economics", () => {
  it("keeps 330 Mbps Superfast at 39.99 PL24 / 44.99 Flex", () => {
    const pl = priced(resolveBuildPlanPrice({ ...base, speed_bucket: "superfast", plan_term: "price_lock_24" }, fp, [candidate()]));
    const flex = priced(resolveBuildPlanPrice({ ...base, speed_bucket: "superfast", plan_term: "flex_30" }, fp, [candidate()]));
    expect(pl.monthly_broadband_incl_vat).toBe(39.99);
    expect(pl.bumped).toBe(false);
    expect(flex.monthly_broadband_incl_vat).toBe(44.99);
    expect(flex.bumped).toBe(false);
  });

  it("keeps 1000 Mbps Ultrafast at 49.99 PL24 / 52.99 Flex with no fourth band", () => {
    const giga = candidate({ product_name: "Giacom FTTP 1000/115", download_speed_mbps: 1000, upload_speed_mbps: 115, supplier_monthly_net: 33, bucket_hint: "ultrafast" });
    const pl = priced(resolveBuildPlanPrice({ ...base, speed_bucket: "ultrafast", plan_term: "price_lock_24" }, fp, [giga]));
    const flex = priced(resolveBuildPlanPrice({ ...base, speed_bucket: "ultrafast", plan_term: "flex_30" }, fp, [giga]));
    expect(pl.monthly_broadband_incl_vat).toBe(49.99);
    expect(flex.monthly_broadband_incl_vat).toBe(52.99);
    expect(pl.plan_label ?? "").not.toMatch(/gigabit/i);
  });

  it("keeps Essential at 34.99 PL24 / 37.99 Flex", () => {
    const ess = candidate({ product_name: "Giacom SOGEA 80/20", download_speed_mbps: 80, upload_speed_mbps: 20, technology: "SOGEA", supplier_monthly_net: 19, bucket_hint: "essential" });
    const input = { ...base, primary_technology: "SOGEA", max_download: 80 };
    expect(priced(resolveBuildPlanPrice({ ...input, speed_bucket: "essential", plan_term: "price_lock_24" }, fp, [ess])).monthly_broadband_incl_vat).toBe(34.99);
    expect(priced(resolveBuildPlanPrice({ ...input, speed_bucket: "essential", plan_term: "flex_30" }, fp, [ess])).monthly_broadband_incl_vat).toBe(37.99);
  });

  it("auto-bumps only the individual quote when an exact product is too expensive", () => {
    const pricey = candidate({ supplier_monthly_net: 40 });
    const r = priced(resolveBuildPlanPrice({ ...base, speed_bucket: "superfast", plan_term: "price_lock_24" }, fp, [pricey]));
    expect(r.bumped).toBe(true);
    expect(r.monthly_broadband_incl_vat).toBeGreaterThan(39.99);
    // Headline configuration itself is untouched by the bump.
    expect(fp.headline.superfast).toEqual({ lock24: 39.99, flex30: 44.99 });
  });

  it("routes to manual quote instead of bumping when auto-bump is disabled", () => {
    const r = resolveBuildPlanPrice(
      { ...base, speed_bucket: "superfast", plan_term: "price_lock_24" },
      { ...fp, fallback: "quote_only" },
      [candidate({ supplier_monthly_net: 40 })],
    );
    expect(r.quote_only).toBe(true);
  });

  it("preserves the £4.99 standard router monthly retail value", () => {
    expect(FAIR_PRICING_DEFAULTS.router.standardMonthly).toBe(4.99);
  });
});

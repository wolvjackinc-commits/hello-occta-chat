import { describe, expect, it } from "vitest";
import {
  resolveBuildPlanPrice,
  stripInternal,
  type SupplierProductCandidate,
} from "../../../../supabase/functions/_shared/buildPlanResolver";

const fp = {
  headline: {
    essential: { lock24: 34.99, flex30: 37.99 },
    superfast: { lock24: 43.99, flex30: 45.99 },
    ultrafast: { lock24: 51.99, flex30: 52.99 },
    gigabit: { lock24: 57.99, flex30: 58.99 },
  },
  router: { standardOneOff: 94.99, standardMonthly: 4.99, premiumOneOff: 129.99, premiumMonthly: 7.99 },
  setup: { remote: 0, standard: 49.99, engineer: 134.99 },
  addons: { priorityMonthly: 6.99, staticIpMonthly: 5, digitalVoiceMonthly: 5.99, paperBillingMonthly: 2.5 },
  buffers: { support: 1, paymentFailure: 0.5, lockRisk: 1, flexRisk: 2, rewards: 0 },
  floors: { essentialLockByo: 1.5, essentialFlex: 3.5, superfast: 3.5, ultrafast: 4.5, gigabit: 4.5 },
  fallback: "auto_bump",
};

const candidate = (overrides: Partial<SupplierProductCandidate> = {}): SupplierProductCandidate => ({
  id: crypto.randomUUID(),
  product_name: "Vodafone FTTP 330/50",
  network: "Vodafone",
  technology: "FTTP",
  download_speed_mbps: 330,
  upload_speed_mbps: 50,
  min_term_months: 1,
  supplier_monthly_net: 31,
  supplier_router_net: 72,
  care_level_uplift_net: 0,
  connection_fee_net: 69,
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
  ...overrides,
});

const baseInput = {
  speed_bucket: "superfast" as const,
  plan_term: "flex_30" as const,
  router_option: "own" as const,
  router_payment_type: "none" as const,
  setup_option: "remote" as const,
  addons: [],
  customer_type: "residential" as const,
  max_download: 1000,
  primary_technology: "FTTP",
};

describe("Giacom V4 contract pricing guard", () => {
  it("fails closed when a supplier connection fee is unknown", () => {
    const r = resolveBuildPlanPrice(baseInput, fp, [candidate({ connection_fee_net: null })]);
    expect(r.quote_only).toBe(true);
  });

  it("fails closed when a supplier cease/migration fee is unknown", () => {
    const r = resolveBuildPlanPrice(baseInput, fp, [candidate({ disconnect_fee_in_12m_net: null })]);
    expect(r.quote_only).toBe(true);
  });

  it("uses the fastest eligible product in the selected tier, not the cheapest slower row", () => {
    const slow = candidate({ id: "slow", product_name: "Vodafone FTTP 115/20", download_speed_mbps: 115, upload_speed_mbps: 20, supplier_monthly_net: 24.5 });
    const fast = candidate({ id: "fast", product_name: "Sky FTTP 330/50", network: "Sky", supplier_router_net: null, supplier_monthly_net: 31, disconnect_fee_in_12m_net: 95, disconnect_fee_after_12m_net: 50 });
    const r = resolveBuildPlanPrice(baseInput, fp, [slow, fast]);
    expect(r.quote_only).toBe(false);
    if (r.quote_only) return;
    expect(r.internal.supplier_product_id).toBe("fast");
    expect(r.estimated_download_mbps).toBe(330);
    expect(r.monthly_broadband_incl_vat).toBeGreaterThanOrEqual(45.99);
  });

  it("recovers the V4 standard new-connection cost instead of treating remote setup as free", () => {
    const r = resolveBuildPlanPrice(baseInput, fp, [candidate()]);
    expect(r.quote_only).toBe(false);
    if (r.quote_only) return;
    expect(r.setup.oneOff).toBeGreaterThanOrEqual(84.99);
  });

  it("does not allow monthly router recovery on a 30-day rolling service", () => {
    const r = resolveBuildPlanPrice({ ...baseInput, router_option: "standard", router_payment_type: "monthly" }, fp, [candidate()]);
    expect(r.quote_only).toBe(true);
  });

  it("prices a one-off standard router above the V4 £72 ex-VAT supplier cost", () => {
    const r = resolveBuildPlanPrice({ ...baseInput, router_option: "standard", router_payment_type: "one_off" }, fp, [candidate()]);
    expect(r.quote_only).toBe(false);
    if (r.quote_only) return;
    expect(r.router.oneOff).toBeGreaterThanOrEqual(94.99);
  });

  it("requires a genuine 24-month supplier product for Price Lock 24", () => {
    const r = resolveBuildPlanPrice({ ...baseInput, plan_term: "price_lock_24" }, fp, [candidate({ min_term_months: 1 })]);
    expect(r.quote_only).toBe(true);
  });

  it("never leaks supplier economics through the public result", () => {
    const r = resolveBuildPlanPrice(baseInput, fp, [candidate()]);
    expect(r.quote_only).toBe(false);
    if (r.quote_only) return;
    const safe = stripInternal(r as unknown as Record<string, unknown>);
    expect(safe.internal).toBeUndefined();
    expect(JSON.stringify(safe)).not.toContain("supplier_monthly");
    expect(JSON.stringify(safe)).not.toContain("disconnect_fee");
  });
});

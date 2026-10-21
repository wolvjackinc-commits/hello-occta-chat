import { describe, expect, it } from "vitest";
import {
  resolveBuildPlanPrice,
  type SupplierProductCandidate,
  type ResolvedPriced,
} from "../../../../supabase/functions/_shared/buildPlanResolver";
import { buildContractMonthlyLines } from "../../../../supabase/functions/_shared/contractMonthlyLines";

// Same Fair Pricing settings and candidate as giacom-v4-contract-pricing.unit.test.ts.
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

const candidate: SupplierProductCandidate = {
  id: "c1",
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
};

// What create-quote / submit-build-plan / Journey 2 store on the quote, and
// generate-contract-summary copies onto the Contract Summary:
//   monthly_price_incl_vat = quote.monthly_gross = resolved.monthly_total_incl_vat
//   selected_addons        = resolved.addons
function acceptedContract(addons: Array<"priority_support" | "static_ip" | "digital_voice" | "paper_billing">) {
  const r = resolveBuildPlanPrice({
    speed_bucket: "superfast",
    plan_term: "flex_30",
    router_option: "own",
    router_payment_type: "none",
    setup_option: "remote",
    addons,
    customer_type: "residential",
    max_download: 1000,
    primary_technology: "FTTP",
  }, fp, [candidate]) as ResolvedPriced;
  expect(r.quote_only).toBe(false);
  return {
    monthly_price_incl_vat: r.monthly_total_incl_vat,
    broadband_incl_vat: r.monthly_broadband_incl_vat,
    selected_addons: r.addons,
  };
}

const minor = (pounds: number) => Math.round(pounds * 100);
const sum = (lines: { amount_minor: number }[]) => lines.reduce((s, l) => s + l.amount_minor, 0);

describe("monthly add-ons on invoices", () => {
  it("the contracted monthly price already includes the add-ons", () => {
    const cs = acceptedContract(["priority_support", "static_ip", "digital_voice", "paper_billing"]);
    expect(cs.broadband_incl_vat).toBe(45.99);
    expect(cs.monthly_price_incl_vat).toBe(45.99 + 6.99 + 5 + 5.99 + 2.5);
  });

  it("recurring invoice charges exactly the contracted monthly price", () => {
    const cs = acceptedContract(["priority_support", "static_ip", "digital_voice", "paper_billing"]);
    const { lines } = buildContractMonthlyLines({
      serviceDescription: "Superfast — monthly service",
      contractMonthlyMinor: minor(cs.monthly_price_incl_vat),
      addons: cs.selected_addons,
      periodLabel: "1 Nov 2026 to 30 Nov 2026",
      vatMode: "inclusive",
      vatRate: 20,
    });
    expect(sum(lines)).toBe(minor(cs.monthly_price_incl_vat)); // 6647, not 6647 + 2048
    // Add-ons stay itemised, carved out of the contracted price.
    expect(lines.map((l) => [l.description, l.amount_minor])).toEqual([
      ["Superfast — monthly service", 4599],
      ["Priority support", 699],
      ["Static IP", 500],
      ["Digital Voice", 599],
      ["Paper billing", 250],
    ]);
  });

  it("first pro-rata invoice charges the pro-rata of the contracted monthly price", () => {
    const cs = acceptedContract(["priority_support", "static_ip"]);
    const prorate = (m: number) => Math.round((m * 10) / 30);
    const { lines, addons } = buildContractMonthlyLines({
      serviceDescription: "Superfast — pro-rata service",
      contractMonthlyMinor: minor(cs.monthly_price_incl_vat),
      addons: cs.selected_addons,
      periodLabel: "10 of 30 days",
      vatMode: "inclusive",
      vatRate: 20,
      prorate,
    });
    expect(sum(lines)).toBe(prorate(minor(cs.monthly_price_incl_vat)));
    expect(addons.map((a) => a.amount_minor)).toEqual([prorate(699), prorate(500)]);
  });

  it("business (ex-VAT) invoice charges exactly the contracted ex-VAT price", () => {
    const cs = acceptedContract(["static_ip"]);
    const contractExVatMinor = minor(Math.round((cs.monthly_price_incl_vat / 1.2) * 100) / 100);
    const { lines } = buildContractMonthlyLines({
      serviceDescription: "Superfast — monthly service",
      contractMonthlyMinor: contractExVatMinor,
      addons: cs.selected_addons,
      periodLabel: "Nov 2026",
      vatMode: "exclusive",
      vatRate: 20,
    });
    expect(sum(lines)).toBe(contractExVatMinor);
    // Add-on prices are stored incl. VAT, so the ex-VAT line is £5 / 1.2.
    expect(lines.find((l) => l.description === "Static IP")?.amount_minor).toBe(417);
  });

  it("no add-ons: a single line at the contracted price", () => {
    const cs = acceptedContract([]);
    const { lines } = buildContractMonthlyLines({
      serviceDescription: "Superfast — monthly service",
      contractMonthlyMinor: minor(cs.monthly_price_incl_vat),
      addons: cs.selected_addons,
      periodLabel: "Nov 2026",
      vatMode: "inclusive",
      vatRate: 20,
    });
    expect(lines).toHaveLength(1);
    expect(sum(lines)).toBe(4599);
  });

  it("never bills more than the contract when add-ons do not fit inside it", () => {
    const { lines } = buildContractMonthlyLines({
      serviceDescription: "Legacy — monthly service",
      contractMonthlyMinor: 500,
      addons: [{ id: "static_ip", label: "Static IP", monthly: 5 }, { id: "paper_billing", label: "Paper billing", monthly: 2.5 }],
      periodLabel: "Nov 2026",
      vatMode: "inclusive",
      vatRate: 20,
    });
    expect(sum(lines)).toBe(500);
  });
});

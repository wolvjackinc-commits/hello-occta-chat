import { describe, expect, it } from "vitest";
import { summariseContract, snapshotFromViewRow } from "../ContractSnapshot";

describe("summariseContract", () => {
  it("shows a monthly router and no one-time fee (Suzanne Dematas, OCC69236107)", () => {
    const s = summariseContract({
      plan_name: "Essential Fibre — Price Lock 24",
      minimum_term_months: 24,
      monthly_price_incl_vat: "39.98",
      router_option: { label: "Standard WiFi 6 router", option: "standard", monthly: 4.99, one_off: 0, payment_type: "monthly" },
      setup_option: { label: "Remote / no-site activation", oneOff: 0, option: "remote" },
      setup_charge: "0.00",
      installation_charge: "0.00",
      one_off_charges: [],
      selected_addons: [],
    });
    expect(s.router).toEqual({ wanted: true, text: "Router: Standard WiFi 6 router — £4.99/mo" });
    expect(s.oneOffTotal).toBe(0);
    expect(s.monthly).toBe(39.98);
    expect(s.term).toBe("24-month minimum");
  });

  it("treats bring-your-own as no router", () => {
    const s = summariseContract({ router_option: { label: "Bring your own router", option: "own", payment_type: "none" } });
    expect(s.router?.wanted).toBe(false);
  });

  it("does not double count setup already in the signed one-off list", () => {
    const s = summariseContract({
      setup_charge: 84.99,
      setup_option: { label: "Network activation / remote setup", oneOff: 84.99 },
      one_off_charges: [{ amount: 84.99, label: "Network activation / remote setup" }],
    });
    expect(s.oneOffs).toHaveLength(1);
    expect(s.oneOffTotal).toBeCloseTo(84.99);
  });

  it("builds one-offs from charges when no list was snapshotted", () => {
    const s = summariseContract({
      setup_charge: "84.99",
      installation_charge: "0",
      router_option: { label: "Standard WiFi 6 router", payment_type: "one_off", one_off: 59 },
    });
    expect(s.oneOffs.map((c) => c.label)).toEqual(["Setup / activation", "Router (one-off)"]);
    expect(s.oneOffTotal).toBeCloseTo(143.99);
    expect(s.router?.text).toBe("Router: Standard WiFi 6 router — £59.00 one-off");
  });

  it("lists add-ons and digital voice once", () => {
    const s = summariseContract({
      selected_addons: [{ id: "digital_voice", label: "Digital Voice", monthly: 5.99 }, { id: "static_ip", label: "Static IP", monthly: 5 }],
      digital_voice: { selected: true },
    });
    expect(s.addons).toEqual(["Digital Voice (£5.99/mo)", "Static IP (£5.00/mo)"]);
  });

  it("returns null for customers with no contract", () => {
    expect(snapshotFromViewRow({ cs_id: null, cs_plan_name: null })).toBeNull();
  });
});

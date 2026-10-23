import { describe, expect, it } from "vitest";
import { getCustomerTrafficLight, type CustomerAccountSignals } from "./customerTrafficLight";

const base: CustomerAccountSignals = {
  sourceReady: true,
  hasSubmittedOrder: false,
  hasService: false,
  serviceStatuses: [],
  orderStatuses: [],
  invoices: [],
};
const now = new Date("2026-10-23T11:00:00Z");
const light = (patch: Partial<CustomerAccountSignals>) =>
  getCustomerTrafficLight({ ...base, ...patch }, now);

describe("OCCTA Customers operational indicator", () => {
  it("never claims live until a service is marked active", () => {
    expect(light({ hasSubmittedOrder: true, orderStatuses: ["active"] }).colour).toBe("yellow");
    expect(light({ serviceStatuses: ["active"], hasService: true }).colour).toBe("green");
  });
  it("flags submitted orders awaiting provisioning", () => {
    expect(light({ hasSubmittedOrder: true, serviceStatuses: ["pending"] }).colour).toBe("yellow");
  });
  it("flags missing final order submission", () => {
    expect(light({ contractStatus: "accepted" }).label).toBe("Order not submitted");
  });
  it("flags unpaid invoices due today, even with an active service", () => {
    expect(light({
      serviceStatuses: ["active"],
      invoices: [{ status: "sent", total: 42.99, due_date: "2026-10-23" }],
    }).label).toBe("Payment due");
  });
  it("does not flag draft, paid, void or future invoices as due", () => {
    const invoices = [
      { status: "draft", total: 50, due_date: "2026-10-01" },
      { status: "paid", total: 50, due_date: "2026-10-01" },
      { status: "void", total: 50, due_date: "2026-10-01" },
      { status: "sent", total: 50, due_date: "2026-11-01" },
    ];
    expect(light({ serviceStatuses: ["active"], invoices }).colour).toBe("green");
  });
  it("flags suspended service even if another service remains active", () => {
    expect(light({ serviceStatuses: ["active", "suspended"] }).label).toBe("Service restricted");
  });
  it("does not classify a closed account as an unsubmitted order", () => {
    expect(light({ orderStatuses: ["cancelled"], hasSubmittedOrder: true }).colour).toBe("grey");
  });
  it("does not guess when backend data is unavailable", () => {
    expect(light({ sourceReady: false, serviceStatuses: ["active"] }).colour).toBe("grey");
  });
});

import { describe, expect, it } from "vitest";
import { resolveNextCollectionDisplay, type AccessPaySchedule } from "./nextCollectionFallback";

const schedule: AccessPaySchedule = {
  occtaRef: "OCC10000001",
  nextDdOn: "2026-11-01",
  nextDdAmount: 30,
};

describe("AccessPay next collection fallback", () => {
  it("keeps a billing date and does not label it as AccessPay", () => {
    expect(resolveNextCollectionDisplay({
      mandateStatus: "active",
      billingDate: "2026-11-15",
      contractAmount: 10,
      accountNumber: "OCC10000001",
      schedules: [schedule],
    })).toEqual({
      date: "2026-11-15",
      amount: 10,
      perAccessPay: false,
      accessPayAmountNote: null,
    });
  });

  it("uses the matching AccessPay date and the contract amount when billing has no date", () => {
    expect(resolveNextCollectionDisplay({
      mandateStatus: "active",
      billingDate: null,
      contractAmount: 10,
      accountNumber: "occ10000001",
      schedules: [schedule],
    })).toEqual({
      date: "2026-11-01",
      amount: 10,
      perAccessPay: true,
      accessPayAmountNote: 30,
    });
  });

  it("omits the AccessPay amount note when the amounts match", () => {
    expect(resolveNextCollectionDisplay({
      mandateStatus: "active",
      billingDate: null,
      contractAmount: 10,
      accountNumber: "OCC10000001",
      schedules: [{ ...schedule, nextDdAmount: 10 }],
    })?.accessPayAmountNote).toBeNull();
  });

  it("shows nothing for a cancelled mandate or a different account", () => {
    expect(resolveNextCollectionDisplay({
      mandateStatus: "cancelled",
      billingDate: null,
      contractAmount: 10,
      accountNumber: "OCC10000001",
      schedules: [schedule],
    })).toBeNull();

    expect(resolveNextCollectionDisplay({
      mandateStatus: "active",
      billingDate: null,
      contractAmount: 10,
      accountNumber: "OCC10000002",
      schedules: [schedule],
    })).toBeNull();
  });
});

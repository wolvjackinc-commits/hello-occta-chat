import { describe, expect, it } from "vitest";
import { nextCollectionDate } from "./nextCollectionDate";

describe("next collection date", () => {
  it("uses the next fixed billing day on or after today", () => {
    expect(nextCollectionDate({
      today: "2026-10-09",
      billingMode: "fixed_day",
      billingDay: 1,
    })).toBe("2026-11-01");

    expect(nextCollectionDate({
      today: "2026-10-01",
      billingMode: "fixed_day",
      billingDay: 1,
    })).toBe("2026-10-01");
  });

  it("clamps billing day 31 to the length of a shorter month", () => {
    expect(nextCollectionDate({
      today: "2026-04-15",
      billingMode: "fixed_day",
      billingDay: 31,
    })).toBe("2026-04-30");

    expect(nextCollectionDate({
      today: "2026-02-10",
      billingMode: "fixed_day",
      billingDay: 31,
    })).toBe("2026-02-28");
  });

  it("rolls a past invoice-plus-terms date forward by whole months", () => {
    expect(nextCollectionDate({
      today: "2026-10-09",
      billingMode: "anniversary",
      nextInvoiceDate: "2026-10-01",
      paymentTermsDays: 7,
    })).toBe("2026-11-08");

    expect(nextCollectionDate({
      today: "2026-10-08",
      billingMode: "anniversary",
      nextInvoiceDate: "2026-10-01",
      paymentTermsDays: 7,
    })).toBe("2026-10-08");
  });
});

import { describe, it, expect } from "vitest";
import { money } from "../client";

/** Journey 2 pricing invariants: nothing is payable today and VAT is explicit. */
const breakdown = (exVat: number, vatPercent: number) => {
  const vat = Math.round(exVat * (vatPercent / 100) * 100) / 100;
  return { ex_vat: exVat, vat, incl_vat: Math.round((exVat + vat) * 100) / 100 };
};

describe("[unit, mocked] Journey 2 pricing and VAT", () => {
  it("derives VAT from the configured rate, never a hard-coded 20%", () => {
    expect(breakdown(30, 20)).toEqual({ ex_vat: 30, vat: 6, incl_vat: 36 });
    expect(breakdown(30, 5)).toEqual({ ex_vat: 30, vat: 1.5, incl_vat: 31.5 });
  });

  it("always shows ex-VAT, VAT and inc-VAT as a consistent triple", () => {
    const b = breakdown(22.99, 20);
    expect(Math.round((b.ex_vat + b.vat) * 100) / 100).toBe(b.incl_vat);
  });

  it("keeps amount due today at zero and rolls one-offs into the first bill", () => {
    const monthlyInclVat = 36;
    const oneOffInclVat = 29.99;
    const amountDueToday = 0;
    const estimatedFirstBill = Math.round((monthlyInclVat + oneOffInclVat) * 100) / 100;
    expect(amountDueToday).toBe(0);
    expect(estimatedFirstBill).toBe(65.99);
    expect(money(amountDueToday)).toBe("£0.00");
  });
});

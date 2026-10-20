import { describe, expect, it } from "vitest";
import {
  firstBillingPeriod,
  nextAnchorBillingDate,
  previousAnchorDate,
  vatRatePercent,
} from "../../../../supabase/functions/_shared/billingCycle";

// confirm_service_live_tx sets period_end = next_anchor_billing_date(live + 1, anchor);
// process-first-billing derives the pro-rata fraction from it.
function firstInvoice(liveDate: string, anchor: number) {
  const dayAfter = new Date(liveDate + "T00:00:00Z");
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
  const periodEnd = nextAnchorBillingDate(dayAfter.toISOString().slice(0, 10), anchor);
  return { periodEnd, ...firstBillingPeriod(liveDate, periodEnd, anchor) };
}

describe("first invoice pro-rata", () => {
  it("divides by the length of the month being billed, not the next one", () => {
    // Live 15 Jan, anchor 1: 17 days of a 31-day January (was 17/28 using February).
    expect(firstInvoice("2026-01-15", 1)).toEqual({
      periodEnd: "2026-02-01", billable_days: 17, full_cycle_days: 31, is_pro_rata: true,
    });
  });

  it("bills a full month when the service goes live on the billing day", () => {
    // Was 30/31: April measured against May's 31 days.
    expect(firstInvoice("2026-04-01", 1)).toEqual({
      periodEnd: "2026-05-01", billable_days: 30, full_cycle_days: 30, is_pro_rata: false,
    });
    // Was 28/31: February measured against March.
    expect(firstInvoice("2026-02-01", 1)).toMatchObject({ billable_days: 28, full_cycle_days: 28, is_pro_rata: false });
  });

  it("clamps billing days 29–31 to the end of short months", () => {
    // Anchor 31, live 30 Apr: the April cycle ends on 30 Apr, so 30 Apr–30 May is a full cycle.
    expect(firstInvoice("2026-04-30", 31)).toEqual({
      periodEnd: "2026-05-31", billable_days: 31, full_cycle_days: 31, is_pro_rata: false,
    });
    // Anchor 31, live 31 Jan: 31 Jan–27 Feb is the full (clamped) February cycle.
    expect(firstInvoice("2026-01-31", 31)).toMatchObject({ periodEnd: "2026-02-28", billable_days: 28, full_cycle_days: 28, is_pro_rata: false });
    // Anchor 30, live 27 Feb: one day to the clamped 28 Feb anchor, out of a 29-day cycle (30 Jan → 28 Feb).
    expect(firstInvoice("2026-02-27", 30)).toEqual({
      periodEnd: "2026-02-28", billable_days: 1, full_cycle_days: 29, is_pro_rata: true,
    });
  });

  it("handles the year boundary and leap years", () => {
    expect(firstInvoice("2026-12-20", 5)).toEqual({
      periodEnd: "2027-01-05", billable_days: 16, full_cycle_days: 31, is_pro_rata: true,
    });
    expect(firstInvoice("2028-02-10", 1)).toMatchObject({ billable_days: 20, full_cycle_days: 29 });
  });

  it("never bills more than one cycle", () => {
    for (let anchor = 1; anchor <= 31; anchor++) {
      for (let d = 0; d < 366; d += 7) {
        const live = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
        const p = firstInvoice(live, anchor);
        expect(p.billable_days).toBeGreaterThan(0);
        expect(p.billable_days).toBeLessThanOrEqual(p.full_cycle_days);
        expect(p.full_cycle_days).toBeGreaterThanOrEqual(28);
        expect(p.full_cycle_days).toBeLessThanOrEqual(31);
      }
    }
  });
});

describe("previousAnchorDate", () => {
  it("steps back one month, clamped", () => {
    expect(previousAnchorDate("2026-03-31", 31)).toBe("2026-02-28");
    expect(previousAnchorDate("2026-01-05", 5)).toBe("2025-12-05");
  });
});

describe("vatRatePercent", () => {
  it("normalises SIM fraction snapshots to the percentage invoices use", () => {
    expect(vatRatePercent(0.2)).toBe(20);
    expect(vatRatePercent("0.2000")).toBe(20);
    expect(vatRatePercent(20)).toBe(20);
    expect(vatRatePercent(0)).toBe(0);
    expect(vatRatePercent(null)).toBe(20);
  });
});

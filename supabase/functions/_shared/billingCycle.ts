// Billing-cycle date maths. Pure (no jsPDF import) so it can be unit tested.

const DAY_MS = 86_400_000;

function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / DAY_MS,
  );
}

/**
 * Roll `_from` forward to the next occurrence of `_anchor_day`, clamped
 * to the last valid day of the target month (mirrors the SQL helper).
 * Handles billing days 29/30/31 in short months.
 */
export function nextAnchorBillingDate(fromIso: string, anchorDay: number): string {
  const from = new Date(fromIso + "T00:00:00Z");
  const day = Math.min(Math.max(anchorDay || 1, 1), 31);

  let cy = from.getUTCFullYear();
  let cm = from.getUTCMonth();
  let candidate = new Date(Date.UTC(cy, cm, Math.min(day, lastDayOfMonth(cy, cm))));
  if (candidate < from) {
    cm += 1;
    if (cm > 11) { cm = 0; cy += 1; }
    candidate = new Date(Date.UTC(cy, cm, Math.min(day, lastDayOfMonth(cy, cm))));
  }
  return candidate.toISOString().slice(0, 10);
}

/** The anchor date one month before `anchorIso` (clamped to month end). */
export function previousAnchorDate(anchorIso: string, anchorDay: number): string {
  const a = new Date(anchorIso + "T00:00:00Z");
  const day = Math.min(Math.max(anchorDay || 1, 1), 31);
  let y = a.getUTCFullYear();
  let m = a.getUTCMonth() - 1;
  if (m < 0) { m = 11; y -= 1; }
  return new Date(Date.UTC(y, m, Math.min(day, lastDayOfMonth(y, m)))).toISOString().slice(0, 10);
}

export interface FirstPeriod {
  billable_days: number;
  full_cycle_days: number;
  is_pro_rata: boolean;
}

/**
 * First-invoice period from the live date up to (exclusive) the first anchor.
 *
 * The pro-rata denominator is the length of the billing cycle the live date
 * falls in (previous anchor → first anchor), not the cycle after it. Going
 * live on the anchor day is a full month, never a fraction of one.
 */
export function firstBillingPeriod(
  periodStartIso: string,
  periodEndExclusiveIso: string,
  anchorDay: number,
): FirstPeriod {
  const cycleStart = previousAnchorDate(periodEndExclusiveIso, anchorDay);
  const full_cycle_days = daysBetween(cycleStart, periodEndExclusiveIso);
  const billable_days = Math.min(daysBetween(periodStartIso, periodEndExclusiveIso), full_cycle_days);
  return { billable_days, full_cycle_days, is_pro_rata: billable_days < full_cycle_days };
}

/**
 * VAT rate as a percentage. SIM snapshots store a fraction (0.20) while
 * invoices.vat_rate is a percentage (20) everywhere else and is rendered as
 * "VAT (x%)" and used to re-itemise PDFs.
 */
export function vatRatePercent(rate: unknown): number {
  const r = Number(rate ?? 0.2);
  if (!Number.isFinite(r)) return 20;
  return r > 0 && r <= 1 ? Math.round(r * 10000) / 100 : r;
}

/**
 * Next Direct Debit collection date.
 *
 * fixed_day with a billing day is collected on that day of the month. The
 * shown date is the next occurrence on or after today. Days 29–31 clamp to
 * the length of the month being considered.
 *
 * Every other mode keeps next_invoice_date plus payment_terms_days. A result
 * earlier than today moves forward by whole months until it is today or later.
 */
export function nextCollectionDate(input: {
  today: string;
  billingMode?: string | null;
  billingDay?: number | null;
  nextInvoiceDate?: string | null;
  paymentTermsDays?: number | null;
}): string | null {
  const today = calendarDate(input.today);
  if (!today) return null;

  const billingDay = wholeBillingDay(input.billingDay);
  if (input.billingMode === "fixed_day" && billingDay != null) {
    const thisMonth = iso(today.year, today.month, Math.min(billingDay, daysInMonth(today.year, today.month)));
    if (thisMonth >= today.iso) return thisMonth;
    const next = shiftMonth(today.year, today.month, 1);
    return iso(next.year, next.month, Math.min(billingDay, daysInMonth(next.year, next.month)));
  }

  const invoice = calendarDate(input.nextInvoiceDate);
  if (!invoice) return null;
  const terms = input.paymentTermsDays ?? 14;
  if (!Number.isFinite(terms)) return null;
  let cursor = addDays(invoice, terms);
  for (let step = 0; cursor.iso < today.iso && step < 240; step += 1) {
    const shifted = shiftMonth(cursor.year, cursor.month, 1);
    cursor = {
      ...shifted,
      day: Math.min(cursor.day, daysInMonth(shifted.year, shifted.month)),
      iso: iso(shifted.year, shifted.month, Math.min(cursor.day, daysInMonth(shifted.year, shifted.month))),
    };
  }
  return cursor.iso < today.iso ? null : cursor.iso;
}

function wholeBillingDay(value: number | null | undefined): number | null {
  if (value == null || !Number.isInteger(value) || value < 1 || value > 31) return null;
  return value;
}

type CalendarDate = { iso: string; year: number; month: number; day: number };

function calendarDate(value: string | null | undefined): CalendarDate | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { iso: iso(year, month, day), year, month, day };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftMonth(year: number, month: number, months: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + months;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  return { iso: iso(year, month, day), year, month, day };
}

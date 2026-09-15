import { format, isValid, parseISO } from "date-fns";

/** UK date formatting for customer account data. Never renders "Invalid Date". */
export function formatUkDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = String(value);
  const d = raw.includes("T") ? parseISO(raw) : new Date(raw);
  return isValid(d) ? format(d, "dd MMM yyyy") : null;
}

/** UK currency formatting. Never renders NaN. */
export function formatGbp(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `£${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

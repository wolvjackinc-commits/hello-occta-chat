/**
 * Checkout recovery desk helpers (Journey Control).
 * Outcomes must match the CHECK constraint in
 * supabase/migrations/20261104190000_checkout_recovery_desk.sql.
 */

export const RECOVERY_OUTCOMES = [
  { value: "no_answer", label: "No answer" },
  { value: "voicemail", label: "Left voicemail" },
  { value: "callback_requested", label: "Call back later" },
  { value: "will_complete_online", label: "Will finish online" },
  { value: "phone_order_started", label: "Phone order started" },
  { value: "not_interested", label: "Not interested" },
  { value: "wrong_number", label: "Wrong number" },
  { value: "do_not_contact", label: "Do not contact" },
  { value: "opt_out_withdrawn", label: "Contact allowed again" },
] as const;

export type RecoveryOutcome = (typeof RECOVERY_OUTCOMES)[number]["value"];

export function outcomeLabel(value: string | null | undefined): string {
  if (!value) return "Not contacted";
  return RECOVERY_OUTCOMES.find((o) => o.value === value)?.label ?? value.replace(/_/g, " ");
}

/**
 * A dialable tel: href for a UK number typed by a customer, or null when it
 * isn't plausibly a phone number. Display always uses the original text.
 */
export function telHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  const plain = digits.replace(/^\+/, "");
  if (plain.length < 10 || plain.length > 15 || /\+/.test(plain)) return null;
  if (digits.startsWith("+")) return `tel:${digits}`;
  if (plain.startsWith("44")) return `tel:+${plain}`;
  if (plain.startsWith("0")) return `tel:+44${plain.slice(1)}`;
  return null;
}

/** Converts a <input type="datetime-local"> value (Europe/London wall time on staff PCs) to ISO. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export type RecoveryRow = {
  opted_out_at: string | null;
  last_outcome: string | null;
  callback_at: string | null;
  existing_customer: boolean;
};

export type QueueView = "todo" | "callbacks" | "contacted" | "all";

/** Rows staff should still work: not opted out, not already a customer, not a dead end. */
export function isWorkable(row: RecoveryRow): boolean {
  if (row.opted_out_at || row.existing_customer) return false;
  return !["not_interested", "wrong_number", "do_not_contact", "phone_order_started"].includes(row.last_outcome ?? "");
}

export function isCallbackDue(row: RecoveryRow, now: number = Date.now()): boolean {
  if (row.last_outcome !== "callback_requested" || !row.callback_at) return false;
  const t = new Date(row.callback_at).getTime();
  return !Number.isNaN(t) && t <= now;
}

export function inView(row: RecoveryRow, view: QueueView, now: number = Date.now()): boolean {
  if (view === "all") return true;
  if (view === "callbacks") return row.last_outcome === "callback_requested" && !row.opted_out_at;
  if (view === "contacted") return !!row.last_outcome;
  // todo: workable and either never contacted or a callback that is now due
  if (!isWorkable(row)) return false;
  if (row.last_outcome === "callback_requested") return isCallbackDue(row, now);
  return true;
}

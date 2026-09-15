/**
 * Canonical customer-facing status rules shared by the desktop dashboard,
 * the app dashboard and the billing/support tabs so every visible count agrees.
 */

/** Statuses that mean an invoice needs no further payment. */
export const SETTLED_INVOICE_STATUSES = new Set([
  "paid",
  "cancelled",
  "void",
  "written_off",
]);

/** Outstanding = anything that is not settled/cancelled (issued, unpaid, partially_paid, draft, sent, overdue...). */
export function isOutstandingInvoice(status: string | null | undefined): boolean {
  return !SETTLED_INVOICE_STATUSES.has(String(status ?? "").toLowerCase());
}

/** Ticket statuses that represent unresolved work for the customer. */
export const ACTIVE_TICKET_STATUSES = new Set([
  "open",
  "in_progress",
  "waiting_customer",
  "waiting_occta",
]);

export function isActiveTicket(status: string | null | undefined): boolean {
  return ACTIVE_TICKET_STATUSES.has(String(status ?? "").toLowerCase());
}

type InvoiceLike = {
  id?: string | null;
  status?: string | null;
  total?: number | string | null;
  due_date?: string | null;
};

export type OutstandingSummary = {
  invoices: InvoiceLike[];
  count: number;
  total: number;
  nextDueDate: string | null;
  nextDueInvoiceId: string | null;
};

const isValidDate = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const t = new Date(value).getTime();
  return Number.isFinite(t);
};

/**
 * Derive the outstanding count/total/next-due-date from any invoice list.
 * Invalid or missing amounts count as 0; invalid dates are never surfaced.
 */
export function summarizeOutstandingInvoices<T extends InvoiceLike>(
  rows: readonly T[] | null | undefined,
): OutstandingSummary & { invoices: T[] } {
  const outstanding = (rows ?? []).filter((r) => isOutstandingInvoice(r?.status));

  const total = outstanding.reduce((sum, r) => {
    const n = Number(r?.total);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const dated = outstanding
    .filter((r) => isValidDate(r?.due_date))
    .sort((a, b) => new Date(a.due_date as string).getTime() - new Date(b.due_date as string).getTime());

  const next = dated[0] ?? null;

  return {
    invoices: outstanding as T[],
    count: outstanding.length,
    total,
    nextDueDate: next ? (next.due_date as string) : null,
    nextDueInvoiceId: next?.id ? String(next.id) : null,
  };
}

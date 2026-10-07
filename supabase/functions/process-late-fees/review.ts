export const REVIEW_AFTER_DAYS = 7;

type Inv = { id: string; invoice_number: string | null; user_id: string | null; total: number | null; due_date: string | null; status: string | null };

export function isReviewableOverdue(inv: Inv, now: Date): boolean {
  if (!inv.due_date) return false;
  const due = Date.parse(inv.due_date);
  if (!Number.isFinite(due)) return false;
  const total = Number(inv.total);
  if (!Number.isFinite(total) || total <= 0) return false;
  return (now.getTime() - due) / 86400_000 >= REVIEW_AFTER_DAYS;
}

export function buildOverdueReviewTask(inv: Inv, now: Date) {
  const days = Math.floor((now.getTime() - Date.parse(inv.due_date!)) / 86400_000);
  return {
    title: `Overdue invoice review — ${inv.invoice_number ?? inv.id}`,
    description: `Invoice ${inv.invoice_number ?? inv.id} (£${Number(inv.total).toFixed(2)}) is ${days} days past due. Review only: confirm an overdue notice was sent and a reasonable opportunity to pay was given before any lawful admin charge is considered. No fee, suspension or escalation has been applied automatically.`,
    status: "open",
    priority: days >= 30 ? "high" : "normal",
    related_customer_id: inv.user_id,
  };
}

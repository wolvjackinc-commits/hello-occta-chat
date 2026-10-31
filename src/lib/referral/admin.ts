// Admin helpers for the refer-a-friend scheme. Every write goes through a
// SECURITY DEFINER database function that checks the admin's role, requires a
// written reason, is idempotent per request id and writes the audit trail.
import { supabase } from "@/integrations/supabase/client";
import { toCsv } from "@/lib/outreach/csv";

const rpc = supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export type AdminReward = {
  id: string; ref: string; role: "referrer" | "friend" | "goodwill"; status: string; reason: string | null;
  amount: number; basis: "gross" | "net"; hold: boolean; needs_review: boolean; review_reasons: string[];
  version: number; balance_minor: number;
};
export type AdminReferralRow = {
  referral_id: string | null; ref: string; created_at: string; method: string; has_click?: boolean;
  terms_version?: string; friend_type?: string; order_number?: string | null;
  referrer: { id: string; account: string | null; name: string | null };
  friend?: { id: string | null; account: string | null; name: string | null };
  rewards: AdminReward[];
};
export type AdminOverview = {
  enabled: boolean;
  settings: { terms_version: string; goodwill_monthly_budget: number };
  counts: Record<string, number>; awaiting_admin: number; needs_review: number; liability_minor: number;
  goodwill_used_this_month: number;
  open_disputes: Array<{ id: string; ref: string; customer_id: string; referral_id: string | null; kind: string; details: string; created_at: string }>;
  last_recon: { id: number; issues: number; findings: unknown[]; created_at: string } | null;
  binding_errors: Array<{ id: number; order_id: string | null; error: string; created_at: string }>;
  outbox: Record<string, number>;
};
export type MonthlyReport = {
  month: string;
  minor: Record<"booked" | "applied" | "unapplied" | "expired" | "reversed" | "clawed_back", number>;
  liability_minor_at_month_end: number;
  customers_acquired: number;
  cost_per_acquired_customer_minor: number | null;
  goodwill_booked_minor: number;
  awaiting_review_now: number;
  open_disputes_now: number;
};

export type RewardAction = "approve" | "reject" | "reinstate" | "reverse" | "claw_back" | "hold" | "release" | "clear_review";

/** Which actions make sense for a reward right now (the database re-checks). */
export function allowedActions(r: Pick<AdminReward, "status" | "hold" | "needs_review">): RewardAction[] {
  const out: RewardAction[] = [];
  if (r.status === "approved_awaiting_admin" && !r.hold) out.push("approve");
  if (["tracked", "pending", "qualifying", "approved_awaiting_admin"].includes(r.status)) out.push("reject");
  if (r.status === "rejected") out.push("reinstate");
  if (["booked", "partly_applied", "applied"].includes(r.status)) out.push("reverse", "claw_back");
  if (!["rejected", "reversed", "clawed_back", "expired"].includes(r.status)) out.push(r.hold ? "release" : "hold");
  if (r.needs_review) out.push("clear_review");
  return out;
}

export const ACTION_LABEL: Record<RewardAction, string> = {
  approve: "Approve & book credit",
  reject: "Reject",
  reinstate: "Reinstate (re-check)",
  reverse: "Reverse (remove unused credit)",
  claw_back: "Claw back (remove unused credit)",
  hold: "Put on hold",
  release: "Release hold",
  clear_review: "Clear review flags",
};

export const ADMIN_ERROR: Record<string, string> = {
  forbidden: "Only finance admins can do this.",
  reason_required: "Write a reason of at least 10 characters.",
  stale_reward: "Someone else changed this reward. Reload and try again.",
  not_awaiting_approval: "This reward isn't waiting for approval.",
  no_longer_qualifies: "It no longer qualifies after a fresh check. See its reason.",
  on_hold: "Release the hold first.",
  invalid_transition: "That action isn't allowed from the current status.",
  idempotency_conflict: "That request was already used for a different action.",
  outside_manual_window: "The order is older than the manual attach window (7 days).",
  already_attributed: "This order already has a referral.",
  code_not_found: "No customer referral code with that value.",
  order_not_found: "Order not found.",
  monthly_goodwill_budget_exceeded: "This month's goodwill budget would be exceeded.",
  amount_out_of_range: "Goodwill must be between £0.01 and £100.",
  dispute_not_open: "That dispute is already closed.",
  invalid_kind: "Choose a valid event type.",
};
export const adminErrorText = (code: string | undefined) => (code && ADMIN_ERROR[code]) || code || "Something went wrong.";

type Result = { ok?: boolean; error?: string } & Record<string, unknown>;

export const referralAdmin = {
  overview: () => call<AdminOverview>("referral_admin_overview"),
  list: (filter: "all" | "review" | "active" | "credit" | "closed") => call<AdminReferralRow[]>("referral_admin_list", { p_filter: filter }),
  detail: (id: string) => call<Record<string, unknown>>("referral_admin_detail", { p_referral: id }),
  act: (rewardId: string, action: RewardAction, version: number, reason: string, notify: boolean) =>
    call<Result>("referral_admin_action", {
      p_request_id: crypto.randomUUID(), p_action: action, p_reward_id: rewardId,
      p_expected_version: version, p_reason: reason, p_notify: notify,
    }),
  manualAttach: (orderId: string, code: string, reason: string) =>
    call<Result>("referral_admin_manual_attach", { p_request_id: crypto.randomUUID(), p_order: orderId, p_code: code, p_reason: reason }),
  goodwill: (customerId: string, amount: number, reason: string, disputeId?: string | null) =>
    call<Result>("referral_admin_goodwill", { p_request_id: crypto.randomUUID(), p_customer: customerId, p_amount: amount, p_reason: reason, p_dispute: disputeId ?? null }),
  dispute: (action: "open" | "upheld" | "rejected" | "goodwill", args: { dispute?: string; customer?: string; referral?: string | null; kind?: string; text: string }) =>
    call<Result>("referral_admin_dispute", {
      p_action: action, p_dispute: args.dispute ?? null, p_customer: args.customer ?? null,
      p_referral: args.referral ?? null, p_kind: args.kind ?? null, p_text: args.text,
    }),
  recordStanding: (customerId: string, kind: string, occurredAt: string | null, note: string) =>
    call<Result>("referral_admin_record_standing", { p_customer: customerId, p_kind: kind, p_occurred_at: occurredAt, p_note: note }),
  monthly: (month: string) => call<MonthlyReport>("referral_monthly_report", { p_month: month }),
  dryRun: () => call<Record<string, unknown>>("referral_dry_run"),
};

export const pounds = (minor: number | null | undefined) => minor == null ? "—" : `£${(minor / 100).toFixed(2)}`;

/** Monthly finance report as CSV, one row per measure, in pounds. */
export function monthlyReportCsv(r: MonthlyReport): string {
  const p = (m: number | null | undefined) => (m == null ? "" : (m / 100).toFixed(2));
  const rows: string[][] = [
    ["month", "measure", "value_gbp_or_count"],
    [r.month, "credit_booked", p(r.minor.booked)],
    [r.month, "credit_applied_to_invoices", p(r.minor.applied)],
    [r.month, "credit_returned_from_cancelled_invoices", p(r.minor.unapplied)],
    [r.month, "credit_expired", p(r.minor.expired)],
    [r.month, "credit_reversed", p(r.minor.reversed)],
    [r.month, "credit_clawed_back", p(r.minor.clawed_back)],
    [r.month, "outstanding_credit_liability_at_month_end", p(r.liability_minor_at_month_end)],
    [r.month, "customers_acquired_with_booked_reward", String(r.customers_acquired)],
    [r.month, "cost_per_acquired_customer", p(r.cost_per_acquired_customer_minor)],
    [r.month, "goodwill_booked", p(r.goodwill_booked_minor)],
    [r.month, "rewards_awaiting_review_now", String(r.awaiting_review_now)],
    [r.month, "open_disputes_now", String(r.open_disputes_now)],
  ];
  return toCsv(rows);
}

const COMPLAINTS_LINE =
  "If you're not happy with this answer, you can take it further under our Customer Complaints Code: https://www.occta.co.uk/legal/complaints-code. " +
  "OCCTA follows an Alternative Dispute Resolution (ADR) scheme. Eligible unresolved complaints may normally be referred to ADR free of charge after six weeks, or earlier if deadlock is reached; see the Customer Complaints Code for the referral process.";

/** Written reply for a dispute outcome. Always carries the complaints and ADR route. */
export function disputeReply(outcome: "upheld" | "rejected" | "goodwill", ref: string, reason: string, termsVersion?: string | null): string {
  const r = reason.trim();
  const terms = `Refer-a-friend terms${termsVersion ? ` version ${termsVersion}` : ""}: https://www.occta.co.uk/legal/refer-a-friend-terms`;
  const opening = {
    upheld: `Thanks for getting in touch about your referral (ref ${ref}). We've looked at the evidence we hold and agree with you.`,
    rejected: `Thanks for getting in touch about your referral (ref ${ref}). We've looked at the evidence we hold, and we're not able to change the decision.`,
    goodwill: `Thanks for getting in touch about your referral (ref ${ref}). We've looked at the evidence we hold. The referral doesn't meet the scheme rules, but we've added goodwill bill credit to your account.`,
  }[outcome];
  return [`Hello,`, opening, `What we found: ${r}`, terms, COMPLAINTS_LINE, `Kind regards,\nThe OCCTA team`].join("\n\n");
}

/** Plain admin wording for review flags. */
export const REVIEW_LABEL: Record<string, string> = {
  manual_attribution: "Code added by an admin",
  no_click_evidence: "Link order with no recorded click",
  paid_ad_click: "Arrived from a paid ad",
  shared_bank_account: "Same bank account as referrer",
  open_fraud_flag: "Open fraud flag",
  burst_of_referrals: "3+ referrals in 7 days",
  paid_invoice_without_receipt: "Invoice marked paid with no receipt",
};
export const reviewLabel = (r: string) => REVIEW_LABEL[r] ?? (r.startsWith("clawback_due:") ? `Clawback due: ${r.slice(13).replace(/_/g, " ")}` : r.replace(/_/g, " "));

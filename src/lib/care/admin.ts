// Staff-side helpers for OCCTA Care. Every write is a care_admin_* database
// function that checks the role, validates input and writes care_events.
import { careCall } from "@/lib/care/api";

export type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const careAdmin = {
  overview: () => careCall<Json>("care_admin_overview"),
  list: (filter: string, search: string | null) => careCall<Json[]>("care_admin_list", { p_filter: filter, p_search: search }),
  member: (id: string) => careCall<Json>("care_admin_member", { p_sub: id }),
  mandates: () => careCall<Json[]>("care_admin_mandate_queue"),
  collections: (status: string) => careCall<Json[]>("care_admin_collections", { p_status: status }),
  disputes: () => careCall<Json[]>("care_admin_disputes"),
  letters: (status: string) => careCall<Json[]>("care_admin_letters", { p_status: status }),
  refunds: () => careCall<Json[]>("care_admin_refunds"),
  report: (month: string) => careCall<Json>("care_admin_report", { p_month: month }),
  review: (sub: string, decision: "approve" | "decline", note: string) => careCall<Json>("care_admin_review", { p_sub: sub, p_decision: decision, p_note: note }),
  mandateAction: (mandate: string, action: string, providerRef?: string | null, reason?: string | null) =>
    careCall<Json>("care_admin_mandate_action", { p_mandate: mandate, p_action: action, p_provider_ref: providerRef ?? null, p_reason: reason ?? null, p_effective: null }),
  bankCancelled: (mandate: string, code: string, received: string) => careCall<Json>("care_admin_record_bank_cancellation", { p_mandate: mandate, p_reason_code: code, p_received: received }),
  createRun: (ids: string[]) => careCall<Json>("care_admin_create_run", { p_collection_ids: ids }),
  runAction: (run: string, action: "submitted" | "void" | "csv", sha?: string | null, reason?: string | null) => careCall<Json>("care_admin_run_action", { p_run: run, p_action: action, p_csv_sha: sha ?? null, p_reason: reason ?? null }),
  recordResult: (col: string, outcome: "paid" | "unpaid", bankReceived: string | null, code: string | null, note: string | null) =>
    careCall<Json>("care_admin_record_result", { p_collection: col, p_outcome: outcome, p_bank_received: bankReceived, p_reason_code: code, p_note: note }),
  indemnity: (col: string, code: string, amountMinor: number | null, received: string) => careCall<Json>("care_admin_record_indemnity", { p_collection: col, p_reason_code: code, p_amount_minor: amountMinor, p_received: received }),
  decideDispute: (id: string, decision: string, note: string, cancelCare: boolean, writeOnce: boolean) =>
    careCall<Json>("care_admin_dispute_decide", { p_dispute: id, p_decision: decision, p_note: note, p_cancel_care: cancelCare, p_write_once: writeOnce }),
  ddiRequest: (sub: string, received: string, note: string) => careCall<Json>("care_admin_record_ddi_request", { p_sub: sub, p_received: received, p_note: note }),
  cancel: (sub: string, channel: string, reason: string) => careCall<Json>("care_admin_cancel", { p_sub: sub, p_channel: channel, p_reason: reason }),
  pause: (sub: string, note: string) => careCall<Json>("care_admin_pause", { p_sub: sub, p_note: note }),
  pulledItemCollected: (col: string, note: string) => careCall<Json>("care_admin_pulled_item_collected", { p_collection: col, p_note: note }),
  usage: (sub: string, kind: string, notes: string) => careCall<Json>("care_admin_record_usage", { p_sub: sub, p_kind: kind, p_notes: notes, p_occurred: new Date().toISOString() }),
  welcomeCall: (sub: string, outcome: string, note: string) => careCall<Json>("care_admin_welcome_call", { p_sub: sub, p_outcome: outcome, p_note: note }),
  refundAction: (id: string, action: "paid" | "cancel", paidOn?: string | null, ref?: string | null, reason?: string | null) =>
    careCall<Json>("care_admin_refund_action", { p_refund: id, p_action: action, p_paid_on: paidOn ?? null, p_reference: ref ?? null, p_reason: reason ?? null }),
  goodwillRefund: (sub: string, col: string | null, amountMinor: number, reason: string) => careCall<Json>("care_admin_goodwill_refund", { p_sub: sub, p_collection: col, p_amount_minor: amountMinor, p_reason: reason }),
  raiseComplaint: (sub: string, summary: string, desired: string, channel: string) => careCall<Json>("care_admin_raise_complaint", { p_sub: sub, p_summary: summary, p_desired: desired, p_channel: channel }),
  supportNeeds: (customer: string, needs: string[], block: boolean, note: string, source: string) =>
    careCall<Json>("care_admin_update_support_needs", { p_customer: customer, p_needs: needs, p_sales_block: block, p_note: note, p_consent_source: source, p_carer_name: null, p_carer_contact: null }),
  lettersPosted: (ids: string[], postedOn: string) => careCall<Json>("care_admin_letters_posted", { p_letter_ids: ids, p_posted_on: postedOn }),
  settings: (salesOpen: boolean, hours: string | null) => careCall<Json>("care_admin_settings", { p_sales_open: salesOpen, p_support_hours: hours }),
  setPlanPrice: (plan: string, monthlyMinor: number, active: boolean) => careCall<Json>("care_admin_set_plan_price", { p_plan: plan, p_monthly_minor: monthlyMinor, p_active: active }),
  schedulePriceChange: (plan: string, freq: string, newMinor: number, effective: string, reason: string) =>
    careCall<Json>("care_admin_schedule_price_change", { p_plan: plan, p_frequency: freq, p_new_minor: newMinor, p_effective: effective, p_reason: reason }),
};

export const dt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export const dd = (d?: string | null) => (d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const gbp = (minor?: number | null) => `£${(Number(minor ?? 0) / 100).toFixed(2)}`;
export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

export const ARUDD_CODES: [string, string][] = [
  ["0", "0 Refer to payer"], ["1", "1 Instruction cancelled"], ["2", "2 Payer deceased"], ["3", "3 Account transferred"],
  ["5", "5 No account"], ["6", "6 No instruction"], ["7", "7 Amount differs"], ["8", "8 Amount not yet due"],
  ["9", "9 Presentation overdue"], ["A", "A Service user differs"], ["B", "B Account closed"],
];
export const ADDACS_CODES: [string, string][] = [
  ["0", "0 Instruction cancelled - refer to payer"], ["1", "1 Instruction cancelled by payer"], ["2", "2 Payer deceased"],
  ["3", "3 Account transferred"], ["B", "B Account closed"], ["C", "C Account moved (new details)"], ["D", "D Advance notice disputed"],
];
export const DDICA_CODES: [string, string][] = [
  ["1", "1 Amount and/or date differs"], ["2", "2 No advance notice received"], ["3", "3 DDI cancelled by paying bank"],
  ["4", "4 Payer cancelled DDI with service user"], ["5", "5 No instruction held / payer disputes signature"], ["6", "6 Signature on DDI is not payer's"],
  ["7", "7 Claim raised at service user's request"], ["8", "8 Service user not recognised by payer"],
];

export const USAGE_KINDS: [string, string][] = [
  ["support_call", "Support call / chat"], ["remote_session", "Remote help session"], ["wifi_setup", "Wi-Fi setup / tune-up"],
  ["device_setup", "Device setup / data transfer"], ["router_replacement", "OCCTA router/hub replacement sent"], ["health_check", "Health check (Plus)"], ["extender_loan", "Wi-Fi extender loaned (Plus)"], ["other", "Other"],
];

export const REVIEW_LABEL: Record<string, string> = {
  age_extra_check: "75+: pause, welcome call before approval", support_needs: "Support needs", vulnerability_review_open: "Open vulnerability review",
  account_holder_mismatch: "Account holder name differs", phone_assisted: "Phone-assisted sale",
};

export const STATUS_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default", pending_mandate: "secondary", pending_review: "destructive", paused: "destructive", cancel_pending: "outline", cancelled: "outline", declined: "outline",
};

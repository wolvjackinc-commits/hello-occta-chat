// Browser client for OCCTA Care. Reads go through SECURITY DEFINER database
// functions (care_my_* for customers, care_admin_* for staff); anything that
// needs keys, PDFs or email goes through the care-join / care-admin functions.
import { supabase } from "@/integrations/supabase/client";
import { invokeFn } from "@/lib/invokeFn";

const rpc = supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

export async function careCall<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

async function fn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await invokeFn<T>(name, { body });
  if (error) throw new Error(error.message);
  return data as T;
}

export type CarePlanRow = { code: "essentials" | "plus"; name: string; monthly_minor: number; quarterly_minor: number; annual_minor: number };
export type CareCatalogue = { sales_open: boolean; terms_version: string; terms_summary: string; support_hours: string; plans: CarePlanRow[] };

export type CareEligibility = { eligible: boolean; reasons: string[]; review: string[]; date_of_birth_known?: boolean };

export type CareSubscriptionView = {
  id: string; reference: string; plan_code: "essentials" | "plus"; frequency: "monthly" | "quarterly" | "annual"; price_minor: number;
  collection_day: number; status: string; joined_at: string; cooling_off_ends_at: string; service_starts_on: string;
  first_collection_date: string; cancel_effective_date: string | null; cancelled_at: string | null; terms_version: string;
  mandate: { status: string; last4: string; sort_last2: string; bank_name: string | null; holder: string } | null;
};

export type CareMyOverview = {
  signed_in: boolean;
  eligibility?: CareEligibility;
  subscription?: CareSubscriptionView | null;
  next_payment?: { due_date: string; amount_minor: number } | null;
  payments?: { due_date: string; amount_minor: number; period_start: string; period_end: string; status: string }[];
  letters?: { id: string; type: string; created_at: string; pdf_path: string | null; posted_on: string | null }[];
  usage?: { kind: string; occurred_at: string }[];
  requests?: { id: string; kind: string; status: string; created_at: string }[];
  refunds?: { amount_minor: number; status: string; paid_at: string | null }[];
  support_needs?: { needs: string[]; carer_name: string | null } | null;
};

export const careApi = {
  catalogue: () => careCall<CareCatalogue>("care_public_catalogue"),
  myOverview: () => careCall<CareMyOverview>("care_my_overview"),
  cancel: (reason: string | null) => careCall<{ ok: boolean; status?: string; effective_date?: string; refund_minor?: number; error?: string }>("care_my_cancel", { p_reason: reason }),
  request: (kind: string, details: string) => careCall<{ ok: boolean; error?: string; ticket_id?: string }>("care_my_request", { p_kind: kind, p_details: details }),
  updateSupportNeeds: (needs: string[], consent: boolean, other?: string | null, carerName?: string | null, carerContact?: string | null) =>
    careCall<{ ok: boolean; error?: string }>("care_my_update_support_needs", { p_needs: needs, p_consent: consent, p_other: other ?? null, p_carer_name: carerName ?? null, p_carer_contact: carerContact ?? null }),
  changePlan: (plan: string, keyFacts: string[], keyFactsSha: string) =>
    careCall<{ ok: boolean; error?: string; new_price_minor?: number; effective_date?: string }>("care_my_change_plan", { p_plan: plan, p_agree: true, p_key_facts: keyFacts, p_key_facts_sha: keyFactsSha }),
  letterUrl: async (path: string) => {
    const { data, error } = await supabase.storage.from("care-documents").createSignedUrl(path, 300);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  },
};

export type JoinStart = {
  ok: true; application_id: string; price_minor: number; first_collection_date: string; channel: string; key_facts: string[];
  key_facts_sha256: string; terms_version: string; date_of_birth_known: boolean; verification: { sms: string | null; email: string | null };
};

export const careJoin = {
  invite: (invite_token: string) => fn<{ ok: boolean; plan_code: string; frequency: string; collection_day: number; expires_at: string }>("care-join", { action: "invite", invite_token }),
  start: (b: { plan: string; frequency: string; collection_day: number; invite_token?: string | null }) => fn<JoinStart>("care-join", { action: "start", ...b }),
  sendCode: (application_id: string, method: "sms" | "email") => fn<{ ok: boolean; verification_id: string; destination: string; resend_in: number }>("care-join", { action: "send_code", application_id, method }),
  verifyCode: (verification_id: string, code: string) => fn<{ ok: boolean; verified: boolean }>("care-join", { action: "verify_code", verification_id, code }),
  submit: (b: Record<string, unknown>) => fn<{ ok: boolean; reference: string; status: string; first_collection_date: string; cooling_off_ends_on: string; price_minor: number }>("care-join", { action: "submit", ...b }),
};

export const careAdminFn = {
  revealBank: (mandate_id: string, reason: string) => fn<{ ok: boolean; reference: string; account_holder_name: string; sort_code: string; account_number: string; bank_name: string | null; service_user_number: string; collection_name: string }>("care-admin", { action: "reveal_bank", mandate_id, reason }),
  sendInvite: (b: Record<string, unknown>) => fn<{ ok: boolean; invite_id: string; expires_at: string; email: string }>("care-admin", { action: "send_invite", ...b }),
  revokeInvite: (invite_id: string, reason: string) => fn<{ ok: boolean }>("care-admin", { action: "revoke_invite", invite_id, reason }),
  evidencePack: (subscription_id: string, purpose: string, dispute_id?: string | null) => fn<{ ok: boolean; url: string | null; sha256: string; evidence_pack_id: string }>("care-admin", { action: "evidence_pack", subscription_id, purpose, dispute_id: dispute_id ?? null }),
  printBatch: (letter_ids?: string[]) => fn<{ ok: boolean; url: string | null; batch_number: string; count: number; letter_ids: string[] }>("care-admin", { action: "print_batch", letter_ids }),
  dispatchNow: () => fn<{ ok: boolean; result: unknown }>("care-admin", { action: "dispatch_now" }),
};

export async function sha256HexBrowser(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const CARE_REASON_TEXT: Record<string, string> = {
  not_signed_in: "Sign in to your OCCTA account to join.",
  sales_closed: "OCCTA Care isn't taking new members right now.",
  no_account: "Care is for OCCTA customers. Your account isn't set up yet.",
  business_account: "Care is for home customers. Please call us about business support.",
  account_not_active: "Your OCCTA account isn't active, so Care can't be added.",
  under_18: "You need to be 18 or over to join.",
  no_postal_address: "We need your postal address on your account (we post important letters about Care).",
  no_email: "We need an email address on your account.",
  overdue_bill: "You have an overdue OCCTA bill. Once it's paid you can join. If money is tight, please talk to us first.",
  already_member: "You already have OCCTA Care.",
  contact_us_first: "Please call us on 0800 260 6626 and we'll help you set up Care.",
};

export const CARE_STATUS_TEXT: Record<string, string> = {
  pending_review: "Being checked by our team",
  pending_mandate: "Setting up your Direct Debit",
  active: "Active",
  paused: "Paused",
  cancel_pending: "Cancelled (ends soon)",
  cancelled: "Cancelled",
  declined: "Not started",
};

export const CARE_REQUEST_KINDS: { code: string; label: string }[] = [
  { code: "help", label: "Help with something" },
  { code: "wifi_setup", label: "Wi-Fi setup or tune-up" },
  { code: "device_setup", label: "Set up a phone, tablet or computer" },
  { code: "router_fault", label: "My OCCTA router or hub isn't working" },
  { code: "repair_quote", label: "A repair quote for my device" },
  { code: "health_check", label: "Book my yearly health check (Care Plus)" },
  { code: "extender", label: "Wi-Fi extender loan (Care Plus)" },
];

export const CARE_LETTER_LABEL: Record<string, string> = {
  welcome_pack: "Welcome pack", dd_confirmation: "Direct Debit confirmation", advance_notice: "Payment notice",
  change_notice: "Change notice", renewal_reminder: "Renewal reminder", usage_reminder: "Check-in",
  payment_failed: "Missed payment", service_paused: "Care paused", mandate_cancelled: "Direct Debit cancelled",
  cancellation_confirmation: "Cancellation confirmation", refund_confirmation: "Refund", application_declined: "Application",
  indemnity_followup: "Payment refund",
};

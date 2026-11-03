// OCCTA Care Sales Desk client helpers.
import { supabase } from "@/integrations/supabase/client";
import { invokeFn } from "@/lib/invokeFn";
import { careCall } from "@/lib/care/api";

export type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function fn<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await invokeFn<T>("care-sales", { body });
  if (error) throw new Error(error.message);
  return data as T;
}

export const careSales = {
  config: () => fn<{ ok: boolean; role: "agent" | "supervisor"; transcription: boolean; ai: boolean }>({ action: "config" }),
  find: (q: string) => careCall<J[]>("care_sales_find_customer", { p_query: q }),
  create: (b: { customer: string; plan: string; frequency: string; day: number; callRef: string; callAt: string; notes: string }) =>
    careCall<{ ok: boolean; id: string; reference: string }>("care_sales_create", {
      p_customer: b.customer, p_plan: b.plan, p_frequency: b.frequency, p_day: b.day, p_call_reference: b.callRef, p_call_at: b.callAt, p_notes: b.notes,
    }),
  list: (scope: "mine" | "all", status: string | null) => careCall<J[]>("care_sales_list", { p_scope: scope, p_status: status }),
  get: (id: string) => careCall<J>("care_sales_get", { p_sale: id }),
  decide: (id: string, decision: "approve" | "decline" | "bypass", note: string) => careCall<J>("care_sales_decide", { p_sale: id, p_decision: decision, p_note: note }),
  withdraw: (id: string, note: string) => careCall<J>("care_sales_withdraw", { p_sale: id, p_note: note }),
  report: () => careCall<J[]>("care_sales_report"),
  async uploadRecording(saleId: string, file: File): Promise<string> {
    const ext = (file.name.split(".").pop() ?? "mp3").toLowerCase();
    const u = await fn<{ ok: boolean; path: string; token: string }>({ action: "upload_url", sale_id: saleId, ext });
    const { error } = await supabase.storage.from("care-sales").uploadToSignedUrl(u.path, u.token, file, { contentType: file.type || "audio/mpeg" });
    if (error) throw new Error(error.message);
    return u.path;
  },
  score: (saleId: string, recordingPath: string | null, transcript: string, source: "audio_local" | null = null) =>
    fn<{ ok: boolean; decision: string; score: number }>({ action: "score", sale_id: saleId, recording_path: recordingPath, transcript, transcript_source: source }),
  createCustomer: (b: Record<string, string>) => fn<{ ok: boolean; customer: J }>({ action: "create_customer", ...b }),
  earliestFirstDate: () => careCall<string>("care_sales_earliest_first_date"),
  followup: (saleId: string) => careCall<J>("care_sales_followup", { p_sale: saleId }),
  letterUpdate: (letterId: string, e: Record<string, string>) => careCall<J>("care_sales_letter_update", { p_letter: letterId,
    p_posted_on: e.posted_on || null, p_royal_mail_ref: e.royal_mail_ref || null, p_tracking_url: e.tracking_url || null, p_received_on: e.received_on || null }),
  reminderCall: (saleId: string, outcome: string, note: string) => careCall<J>("care_sales_reminder_call", { p_sale: saleId, p_outcome: outcome, p_note: note }),
  letterUrl: (saleId: string, letterId: string) => fn<{ ok: boolean; url: string | null }>({ action: "letter_url", sale_id: saleId, letter_id: letterId }),
  recordingUrl: (saleId: string) => fn<{ ok: boolean; url: string | null }>({ action: "recording_url", sale_id: saleId }),
  complete: (saleId: string, b: Record<string, unknown>) => fn<{ ok: boolean; reference: string; status: string; first_collection_date: string; cooling_off_ends_on: string; provider: string }>({ action: "complete", sale_id: saleId, ...b }),
};

export const staffUsers = {
  list: () => invokeFn<{ ok: boolean; staff: J[] }>("admin-staff-users", { body: { action: "list" } }),
  create: (b: { email: string; full_name: string; password: string; role: string }) => invokeFn<J>("admin-staff-users", { body: { action: "create", ...b } }),
  resetPassword: (user_id: string, password: string) => invokeFn<J>("admin-staff-users", { body: { action: "reset_password", user_id, password } }),
  setActive: (user_id: string, active: boolean) => invokeFn<J>("admin-staff-users", { body: { action: "set_active", user_id, active } }),
};

export const SALE_STATUS: Record<string, string> = {
  awaiting_recording: "Needs recording", scoring: "Checking call", passed: "Passed: complete sign-up", held: "Held: supervisor or bypass",
  declined: "Declined", approved: "Approved: complete sign-up", link_sent: "Link sent", joined: "Signed up", withdrawn: "Withdrawn",
};

export const SALES_ERRORS: Record<string, string> = {
  recording_too_short: "That recording is under 20 seconds. Check you chose the right file.",
  recording_required: "Upload the call recording first. It's the evidence if the sale is ever disputed.",
  transcript_too_short: "That transcript is too short to check. Paste the whole call.",
  sale_not_passed_or_approved: "This sale hasn't passed the call check, or been approved or bypassed.",
  choose_dd_provider: "Choose which portal the Direct Debit goes on (AccessPay or FastPay).",
  bank_details_invalid: "Check the sort code (6 digits) and account number (8 digits).",
  account_holder_required: "Enter the name on the bank account.",
  confirmations_required: "Tick all four confirmations once you've read the Direct Debit Instruction and the customer has agreed.",
  date_of_birth_required: "Enter the customer's date of birth.",
  email_or_phone_required: "Enter an email or a mobile number so we can contact them.",
  not_eligible: "This customer can't join Care right now.",
  first_payment_date_required: "Choose the first payment date.",
  first_payment_date_too_soon: "That first payment date is too soon: we must post 10 working days' notice first.",
  first_payment_date_too_far: "Choose a first payment date within the next 90 days.",
  accesspay_only_1st_or_15th: "AccessPay can only collect on the 1st or the 15th. Choose FastPay for other days.",
  payment_day_must_be_1_to_28: "Choose a payment day from the 1st to the 28th.",
  add_posted_date_first: "Add the posted date before the received date.",
  received_before_posted: "The received date can't be before the posted date.",
  date_in_future: "That date is in the future.",
  tracking_url_must_start_https: "The tracking link must start with https://",
  letters_not_received_yet: "Mark a letter as received first.",
  letter_not_sendable: "That letter was cancelled.",
  customer_already_has_an_open_care_sale: "This customer already has an open Care sale.",
  customer_asked_for_no_offers: "This customer asked not to be offered things. They can join themselves from My OCCTA.",
  account_exists_search_instead: "That email already has an OCCTA account. Search for it instead.",
  uk_address_required: "Enter the full UK home address, including a valid postcode.",
  full_name_required: "Enter the customer's first and last name.",
  invalid_email: "Enter a valid email address.",
  bypass_reason_required_min_20_chars: "Write why you're bypassing the call check (at least 20 characters).",
  already_bypassed: "This sale was already bypassed. The reason is locked.",
  bypass_reason_is_locked: "The bypass reason is locked and can't be changed.",
  nothing_to_bypass: "This sale doesn't need a bypass.",
  cannot_approve_your_own_sale: "A different supervisor must approve your own sale.",
  ai_not_configured: "Call scoring isn't available (ANTHROPIC_API_KEY missing). Tell an admin.",
};

export function salesError(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  const key = Object.keys(SALES_ERRORS).find((k) => m.includes(k));
  return key ? SALES_ERRORS[key] : m;
}

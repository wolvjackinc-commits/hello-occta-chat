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
  recordingUrl: (saleId: string) => fn<{ ok: boolean; url: string | null }>({ action: "recording_url", sale_id: saleId }),
  sendLink: (saleId: string, provider: string) => fn<{ ok: boolean; invite_id: string; expires_at: string; email: string }>({ action: "send_link", sale_id: saleId, provider_code: provider }),
};

export const staffUsers = {
  list: () => invokeFn<{ ok: boolean; staff: J[] }>("admin-staff-users", { body: { action: "list" } }),
  create: (b: { email: string; full_name: string; password: string; role: string }) => invokeFn<J>("admin-staff-users", { body: { action: "create", ...b } }),
  resetPassword: (user_id: string, password: string) => invokeFn<J>("admin-staff-users", { body: { action: "reset_password", user_id, password } }),
  setActive: (user_id: string, active: boolean) => invokeFn<J>("admin-staff-users", { body: { action: "set_active", user_id, active } }),
};

export const SALE_STATUS: Record<string, string> = {
  awaiting_recording: "Needs recording", scoring: "Checking call", passed: "Passed: send link", held: "Held: supervisor",
  declined: "Declined", approved: "Approved: send link", link_sent: "Link sent", joined: "Customer joined", withdrawn: "Withdrawn",
};

export const SALES_ERRORS: Record<string, string> = {
  transcription_not_configured: "This computer couldn't transcribe the recording. Try Chrome or Edge, and the audio-only M4A file from Zoom.",
  recording_too_short: "That recording is under 20 seconds. Check you chose the right file.",
  recording_too_large_for_auto_transcription: "That recording is over 25 MB. Export it as MP3, or paste the transcript.",
  recording_required: "Upload the call recording first. It's the evidence if the sale is ever disputed.",
  transcript_too_short: "That transcript is too short to check. Paste the whole call.",
  sale_not_passed_or_approved: "This sale hasn't passed the call check or been approved by a supervisor.",
  customer_already_has_an_open_care_sale: "This customer already has an open Care sale.",
  customer_asked_for_no_offers: "This customer asked not to be offered things. They can join themselves from My OCCTA.",
  account_exists_search_instead: "That email already has an OCCTA account. Search for it instead.",
  uk_address_required: "Enter the full UK home address, including a valid postcode.",
  full_name_required: "Enter the customer's first and last name.",
  invalid_email: "Enter a valid email address.",
  bypass_reason_required_min_20_chars: "Write why you're bypassing the call check (at least 20 characters).",
  nothing_to_bypass: "This sale doesn't need a bypass.",
  cannot_approve_your_own_sale: "A different supervisor must approve your own sale.",
  ai_not_configured: "Call scoring isn't available (ANTHROPIC_API_KEY missing). Tell an admin.",
};

export function salesError(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  const key = Object.keys(SALES_ERRORS).find((k) => m.includes(k));
  return key ? SALES_ERRORS[key] : m;
}

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
  decide: (id: string, decision: "approve" | "decline", note: string) => careCall<J>("care_sales_decide", { p_sale: id, p_decision: decision, p_note: note }),
  withdraw: (id: string, note: string) => careCall<J>("care_sales_withdraw", { p_sale: id, p_note: note }),
  report: () => careCall<J[]>("care_sales_report"),
  async uploadRecording(saleId: string, file: File): Promise<string> {
    const ext = (file.name.split(".").pop() ?? "mp3").toLowerCase();
    const u = await fn<{ ok: boolean; path: string; token: string }>({ action: "upload_url", sale_id: saleId, ext });
    const { error } = await supabase.storage.from("care-sales").uploadToSignedUrl(u.path, u.token, file, { contentType: file.type || "audio/mpeg" });
    if (error) throw new Error(error.message);
    return u.path;
  },
  score: (saleId: string, recordingPath: string | null, transcript: string) =>
    fn<{ ok: boolean; decision: string; score: number }>({ action: "score", sale_id: saleId, recording_path: recordingPath, transcript }),
  recordingUrl: (saleId: string) => fn<{ ok: boolean; url: string | null }>({ action: "recording_url", sale_id: saleId }),
  sendLink: (saleId: string) => fn<{ ok: boolean; invite_id: string; expires_at: string; email: string }>({ action: "send_link", sale_id: saleId }),
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
  transcription_not_configured: "Upload the Zoom transcript (.vtt) for this call too, or paste it.",
  recording_too_large_for_auto_transcription: "That recording is over 25 MB. Export it as MP3, or paste the transcript.",
  recording_required: "Upload the call recording first. It's the evidence if the sale is ever disputed.",
  transcript_too_short: "That transcript is too short to check. Paste the whole call.",
  sale_not_passed_or_approved: "This sale hasn't passed the call check or been approved by a supervisor.",
  customer_already_has_an_open_care_sale: "This customer already has an open Care sale.",
  customer_asked_for_no_offers: "This customer asked not to be offered things. They can join themselves from My OCCTA.",
  cannot_approve_your_own_sale: "A different supervisor must approve your own sale.",
  ai_not_configured: "Call scoring isn't available (ANTHROPIC_API_KEY missing). Tell an admin.",
};

export function salesError(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  const key = Object.keys(SALES_ERRORS).find((k) => m.includes(k));
  return key ? SALES_ERRORS[key] : m;
}

/** Turns a Zoom transcript (.vtt, or .srt/.txt) into "[mm:ss] Speaker: words" lines. */
export function parseTranscriptFile(text: string): string {
  if (!/-->/.test(text)) return text.trim();
  const out: string[] = [];
  let stamp = "";
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line || /^WEBVTT/i.test(line) || /^\d+$/.test(line) || /^NOTE\b/.test(line)) continue;
    const t = line.match(/^(\d{1,2}:)?(\d{1,2}):(\d{2})[.,]\d{3}\s*-->/);
    if (t) { const h = Number((t[1] ?? "0:").replace(":", "")), m = Number(t[2]) + h * 60; stamp = `[${String(m).padStart(2, "0")}:${t[3]}]`; continue; }
    out.push(`${stamp} ${line}`.trim());
  }
  return out.join("\n");
}

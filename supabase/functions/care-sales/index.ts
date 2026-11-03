// OCCTA Care Sales Desk (sales_agent; supervisors = sales_admin, compliance_admin, admin, super_admin).
//
//   config       — is automatic transcription / AI scoring available?
//   upload_url   — signed upload URL for the call recording (private bucket care-sales)
//   recording_url— short-lived link to play the recording
//   score        — transcript (from the recording via OPENAI_API_KEY, or pasted) scored
//                  against the Care script by Claude; pass / hold / decline decided by
//                  careQaDecision (fixed rules), never by the model alone
//   send_link    — only for a passed or supervisor-approved sale: email the customer
//                  their sign-up link (they complete everything themselves)
import { getServiceClient, jsonResponse, corsHeaders } from "../_shared/quoteHelpers.ts";
import { sendCareInvite } from "../_shared/careInvite.ts";
import { CARE_PROVIDER_CODES } from "../_shared/careProvider.ts";
import { CARE_QA_RED_FLAGS, CARE_SALES_SCRIPT, careQaDecision } from "../_shared/careSalesScript.ts";
import { carePlan, carePriceMinor, pounds, CARE_NOT_INCLUDED } from "../_shared/careTerms.ts";

const BUCKET = "care-sales";
const MAX_TRANSCRIBE_BYTES = 25 * 1024 * 1024;
const QA_MODEL = Deno.env.get("CARE_QA_MODEL")?.trim() || "claude-sonnet-5-5";

type Sale = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function transcribe(blob: Blob, filename: string): Promise<string> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("transcription_not_configured");
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("model", Deno.env.get("CARE_TRANSCRIBE_MODEL")?.trim() || "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("language", "en");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) throw new Error(`transcription_failed_${res.status}`);
  const j = await res.json() as { text?: string; segments?: { start: number; text: string }[] };
  if (j.segments?.length) {
    return j.segments.map((s) => `[${String(Math.floor(s.start / 60)).padStart(2, "0")}:${String(Math.floor(s.start % 60)).padStart(2, "0")}] ${s.text.trim()}`).join("\n");
  }
  return String(j.text ?? "");
}

async function scoreCall(sale: Sale, customer: { full_name?: string; postcode?: string; address_line1?: string }, transcript: string) {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ai_not_configured");
  const price = carePriceMinor(sale.plan_code, sale.frequency) ?? 0;
  const freqText = sale.frequency === "monthly" ? "a month" : sale.frequency === "quarterly" ? "every 3 months" : "a year";
  const system = `You are OCCTA's compliance QA reviewer for telephone sales of OCCTA Care, a UK home tech SUPPORT subscription that is NOT insurance.
You check a call transcript against the mandatory script and red flags below, strictly and fairly. Quote the transcript as evidence. If the transcript does not show something, it did not happen. Speakers are not labelled: infer agent vs customer from context.

The sale being checked: ${carePlan(sale.plan_code)?.name} at ${pounds(price)} ${freqText}, VAT included, collection day ${sale.collection_day}. Customer on the OCCTA account: ${customer.full_name ?? "unknown"}, postcode ${customer.postcode ?? "unknown"}, address ${customer.address_line1 ?? "unknown"}.
Correct prices: Care Essentials £4.99/month, £14.97 every 3 months, £49.90/year; Care Plus £8.99/month, £26.97 every 3 months, £89.90/year. VAT included.
What Care never includes: ${CARE_NOT_INCLUDED.join(" ")}
OCCTA takes payment by Direct Debit or bank transfer only. Bank details must never be taken on the call: the customer enters them via the emailed link.

SCRIPT STEPS (id: what must be shown${""}):
${CARE_SALES_SCRIPT.map((s) => `- ${s.id}${s.mandatory ? " [MANDATORY]" : ""}: ${s.check}`).join("\n")}

RED FLAGS (id: definition):
${CARE_QA_RED_FLAGS.map((f) => `- ${f.id}: ${f.detail}`).join("\n")}

Reply with ONE JSON object and nothing else:
{"checks":[{"id":"<step id>","status":"met|partial|missing","evidence":"<short quote or why missing>"}],
 "red_flags":[{"id":"<red flag id>","quote":"<quote>","explanation":"<why>"}],
 "score":<0-100: how well the call met the script and treated the customer fairly>,
 "summary":"<2-3 sentences>",
 "strengths":["<what the agent did well>"],
 "corrections":["<specific thing the agent must do differently, phrased as an instruction>"],
 "customer_understood":<true|false>,
 "account_holder_confirmed":<true|false>}
Include every script step id exactly once in checks. Only list red flags you can evidence.`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: QA_MODEL, max_tokens: 4000, system,
      messages: [{ role: "user", content: `CALL TRANSCRIPT (call reference ${sale.call_reference}):\n\n${transcript.slice(0, 120_000)}` }] }),
  });
  if (!res.ok) { console.error("care-sales scoring failed", res.status, (await res.text()).slice(0, 500)); throw new Error(`ai_failed_${res.status}`); }
  const j = await res.json() as { content?: { type: string; text?: string }[] };
  const text = (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("ai_bad_response");
  const qa = JSON.parse(m[0]) as {
    checks: { id: string; status: string; evidence?: string }[]; red_flags: { id: string; quote?: string; explanation?: string; severity?: string }[];
    score: number; summary?: string; strengths?: string[]; corrections?: string[]; customer_understood?: boolean; account_holder_confirmed?: boolean;
  };
  const known = new Set(CARE_SALES_SCRIPT.map((s) => s.id));
  qa.checks = (qa.checks ?? []).filter((c) => known.has(c.id));
  for (const s of CARE_SALES_SCRIPT) if (!qa.checks.find((c) => c.id === s.id)) qa.checks.push({ id: s.id, status: "missing", evidence: "Not assessed" });
  const sev = new Map(CARE_QA_RED_FLAGS.map((f) => [f.id, f.severity]));
  qa.red_flags = (qa.red_flags ?? []).filter((f) => sev.has(f.id)).map((f) => ({ ...f, severity: sev.get(f.id) }));
  if (qa.account_holder_confirmed === false && !qa.red_flags.find((f) => f.id === "not_account_holder")) {
    const c = qa.checks.find((x) => x.id === "identity"); if (c && c.status === "met") c.status = "partial";
  }
  qa.score = Math.max(0, Math.min(100, Math.round(Number(qa.score) || 0)));
  const d = careQaDecision(qa);
  return { qa: { ...qa, decision: d.decision, decision_reasons: d.reasons, model: QA_MODEL, scored_at: new Date().toISOString() }, decision: d.decision };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  const svc = getServiceClient();
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return jsonResponse({ error: "missing_jwt" }, 401);
  const { data: u } = await svc.auth.getUser(auth.slice(7));
  if (!u?.user) return jsonResponse({ error: "invalid_jwt" }, 401);
  const uid = u.user.id;
  const { data: role } = await svc.rpc("care_sales_role", { _uid: uid });
  if (!role) return jsonResponse({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "config") {
    return jsonResponse({ ok: true, role, transcription: !!Deno.env.get("OPENAI_API_KEY"), ai: !!Deno.env.get("ANTHROPIC_API_KEY") });
  }

  // Care isn't only for broadband customers: open a free OCCTA account for someone new on the call.
  if (action === "create_customer") {
    const t = (k: string, max = 120) => String(body[k] ?? "").trim().slice(0, max);
    const email = t("email", 200).toLowerCase();
    const name = t("full_name"), line1 = t("address_line1"), city = t("city", 80);
    const postcode = t("postcode", 10).toUpperCase().replace(/\s+/g, " ");
    const phone = t("phone", 20).replace(/[^\d+ ]/g, "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: "invalid_email" }, 400);
    if (!/[A-Za-z]{2,} [A-Za-z]{2,}/.test(name)) return jsonResponse({ error: "full_name_required" }, 400);
    if (line1.length < 3 || city.length < 2 || !/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/.test(postcode)) return jsonResponse({ error: "uk_address_required" }, 400);
    const { data: existing } = await svc.from("profiles").select("id").ilike("email", email).limit(1).maybeSingle();
    if (existing) return jsonResponse({ error: "account_exists_search_instead" }, 409);
    const { data: created, error: cerr } = await svc.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } });
    if (cerr || !created?.user) return jsonResponse({ error: "account_create_failed", detail: cerr?.message }, 500);
    const id = created.user.id;
    const { error: perr } = await svc.from("profiles").upsert({ id, email, full_name: name, phone: phone || null, address_line1: line1,
      address_line2: t("address_line2") || null, city, postcode, account_type: "residential" }, { onConflict: "id" });
    if (perr) return jsonResponse({ error: "account_create_failed", detail: perr.message }, 500);
    await svc.from("care_events").insert({ customer_id: id, actor_type: "staff", actor_id: uid, event: "account_opened_for_care_sale", details: { email } });
    const { data: prof } = await svc.from("profiles").select("id, full_name, account_number, postcode, address_line1, email").eq("id", id).single();
    const { data: elig } = await svc.rpc("care_eligibility", { p_customer: id });
    return jsonResponse({ ok: true, customer: { ...prof, email_masked: email.replace(/^(.{2}).*(@.*)$/, "$1***$2"), eligibility: elig } });
  }

  const { data: sale } = await svc.from("care_sales").select("*").eq("id", String(body.sale_id ?? "")).maybeSingle() as { data: Sale | null };
  if (!sale || (sale.agent_id !== uid && role !== "supervisor")) return jsonResponse({ error: "not_found" }, 404);
  const editable = ["awaiting_recording", "passed", "held", "declined"].includes(sale.status);

  if (action === "upload_url") {
    if (!editable) return jsonResponse({ error: "sale_locked" }, 400);
    const ext = String(body.ext ?? "mp3").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "mp3";
    const path = `${sale.id}/recording-${Date.now()}.${ext}`;
    const { data, error } = await svc.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return jsonResponse({ error: "upload_url_failed" }, 500);
    return jsonResponse({ ok: true, path, token: data.token, signed_url: data.signedUrl });
  }

  if (action === "recording_url") {
    if (!sale.recording_path) return jsonResponse({ error: "no_recording" }, 404);
    const { data } = await svc.storage.from(BUCKET).createSignedUrl(sale.recording_path, 600);
    return jsonResponse({ ok: true, url: data?.signedUrl ?? null });
  }

  if (action === "score") {
    if (!editable) return jsonResponse({ error: "sale_locked" }, 400);
    const path = body.recording_path ? String(body.recording_path) : sale.recording_path;
    if (path && !path.startsWith(`${sale.id}/`)) return jsonResponse({ error: "bad_path" }, 400);
    let transcript = String(body.transcript ?? "").trim();
    let source: "pasted" | "audio_auto" | "audio_local" = body.transcript_source === "audio_local" ? "audio_local" : "pasted";
    let bytes: number | null = sale.recording_bytes ?? null;
    if (path) {
      const { data: blob, error } = await svc.storage.from(BUCKET).download(path);
      if (error || !blob) return jsonResponse({ error: "recording_not_found" }, 400);
      bytes = blob.size;
      await svc.from("care_sales").update({ recording_path: path, recording_bytes: bytes, status: "scoring" }).eq("id", sale.id);
      if (transcript.length < 200) {
        if (!Deno.env.get("OPENAI_API_KEY")) return jsonResponse({ error: "transcription_not_configured", hint: "Paste the call transcript, or ask an admin to add OPENAI_API_KEY." }, 400);
        if (blob.size > MAX_TRANSCRIBE_BYTES) return jsonResponse({ error: "recording_too_large_for_auto_transcription", hint: "Max 25 MB. Export as MP3, or paste the transcript." }, 400);
        try { transcript = await transcribe(blob, path.split("/").pop()!); source = "audio_auto"; }
        catch (e) { await svc.from("care_sales").update({ status: sale.status }).eq("id", sale.id); return jsonResponse({ error: (e as Error).message }, 502); }
      }
    }
    if (!path) return jsonResponse({ error: "recording_required", hint: "Upload the call recording. A transcript alone isn't enough evidence." }, 400);
    if (transcript.length < 200) return jsonResponse({ error: "transcript_too_short" }, 400);
    const { data: cust } = await svc.from("profiles").select("full_name, postcode, address_line1").eq("id", sale.customer_id).maybeSingle();
    let r;
    try { r = await scoreCall(sale, cust ?? {}, transcript); }
    catch (e) { await svc.from("care_sales").update({ status: sale.status === "scoring" ? "awaiting_recording" : sale.status }).eq("id", sale.id); return jsonResponse({ error: (e as Error).message }, 502); }
    await svc.rpc("care_sales_save_qa", { p_sale: sale.id, p_transcript: transcript.slice(0, 200_000), p_source: source, p_qa: r.qa,
      p_score: r.qa.score, p_decision: r.decision, p_model: QA_MODEL });
    await svc.from("care_events").insert({ customer_id: sale.customer_id, actor_type: "staff", actor_id: uid, event: "care_sale_scored",
      details: { sale_id: sale.id, score: r.qa.score, decision: r.decision, source, bytes } });
    return jsonResponse({ ok: true, decision: r.decision, score: r.qa.score });
  }

  if (action === "send_link") {
    if (!(sale.status === "approved" || (sale.status === "passed" && sale.qa_decision === "pass"))) return jsonResponse({ error: "sale_not_passed_or_approved" }, 400);
    const provider = body.provider_code ? String(body.provider_code) : null;
    if (provider && !CARE_PROVIDER_CODES.includes(provider)) return jsonResponse({ error: "invalid_provider" }, 400);
    const checks = ((sale.qa?.checks ?? []) as { id: string; status: string }[]);
    const scriptConfirmed: Record<string, unknown> = Object.fromEntries(checks.map((c) => [c.id, c.status === "met"]));
    scriptConfirmed.qa = { sale_id: sale.id, sale_reference: sale.reference, score: sale.qa_score, decision: sale.qa_decision,
      supervisor_decision: sale.supervisor_decision, supervisor_id: sale.supervisor_id, recording_path: sale.recording_path };
    const r = await sendCareInvite(svc, { customerId: sale.customer_id, plan: sale.plan_code, frequency: sale.frequency, day: sale.collection_day,
      actor: sale.agent_id, callRef: `${sale.call_reference} (${sale.reference})`, callNotes: sale.agent_notes ?? "", scriptConfirmed, provider });
    if (!r.ok) return jsonResponse({ error: r.error, reasons: r.reasons ?? [] }, r.status ?? 400);
    await svc.from("care_sales").update({ status: "link_sent", invite_id: r.invite_id }).eq("id", sale.id);
    return jsonResponse(r);
  }

  return jsonResponse({ error: "unknown_action" }, 400);
});

// OCCTA Care Sales Desk (sales_agent; supervisors = sales_admin, compliance_admin, admin, super_admin).
//
//   config       — is automatic transcription / AI scoring available?
//   upload_url   — signed upload URL for the call recording (private bucket care-sales)
//   recording_url— short-lived link to play the recording
//   score        — transcript (made on the agent's computer from the recording) scored
//                  against the Care script by Claude; pass / hold / decline decided by
//                  careQaDecision (fixed rules), never by the model alone
//   create_customer — open a free OCCTA account for someone new (email optional)
//   complete     — passed or approved/bypassed sale: take the Direct Debit on the call and
//                  sign the customer up; the welcome summary and DD confirmation + Guarantee are posted
import { getServiceClient, jsonResponse, corsHeaders, getRequestIp, sha256Hex } from "../_shared/quoteHelpers.ts";
import { encryptJson } from "../_shared/ddCrypto.ts";
import { careProvider, CARE_PROVIDER_CODES } from "../_shared/careProvider.ts";
import { CARE_QA_RED_FLAGS, CARE_SALES_SCRIPT, careQaDecision } from "../_shared/careSalesScript.ts";
import { carePlan, carePriceMinor, pounds, CARE_NOT_INCLUDED, careKeyFacts, careTermsCanonicalText } from "../_shared/careTerms.ts";
import { longDate } from "../_shared/careLetters.ts";

const BUCKET = "care-sales";
const QA_MODEL = Deno.env.get("CARE_QA_MODEL")?.trim() || "claude-sonnet-5-5";

type Sale = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

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
OCCTA takes payment by Direct Debit or bank transfer only. Bank details are taken on the call for the Direct Debit, after the customer confirms they are the account holder; card details must never be taken.

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
    return jsonResponse({ ok: true, role, ai: !!Deno.env.get("ANTHROPIC_API_KEY") });
  }

  // Care isn't only for broadband customers: open a free OCCTA account for someone new on the call.
  if (action === "create_customer") {
    const t = (k: string, max = 120) => String(body[k] ?? "").trim().slice(0, max);
    const email = t("email", 200).toLowerCase();
    const name = t("full_name"), line1 = t("address_line1"), city = t("city", 80);
    const postcode = t("postcode", 10).toUpperCase().replace(/\s+/g, " ");
    const phone = t("phone", 20).replace(/[^\d+ ]/g, "");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: "invalid_email" }, 400);
    if (!email && phone.replace(/\D/g, "").length < 10) return jsonResponse({ error: "email_or_phone_required" }, 400);
    if (!/[A-Za-z]{2,} [A-Za-z]{2,}/.test(name)) return jsonResponse({ error: "full_name_required" }, 400);
    if (line1.length < 3 || city.length < 2 || !/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/.test(postcode)) return jsonResponse({ error: "uk_address_required" }, 400);
    if (email) {
      const { data: existing } = await svc.from("profiles").select("id").ilike("email", email).limit(1).maybeSingle();
      if (existing) return jsonResponse({ error: "account_exists_search_instead" }, 409);
    }
    // No email: the login needs one, so it gets a private placeholder address; the profile keeps none and every letter is posted.
    const loginEmail = email || `care-${crypto.randomUUID()}@no-email.occta.co.uk`;
    const { data: created, error: cerr } = await svc.auth.admin.createUser({ email: loginEmail, email_confirm: true, user_metadata: { full_name: name } });
    if (cerr || !created?.user) return jsonResponse({ error: "account_create_failed", detail: cerr?.message }, 500);
    const id = created.user.id;
    const { error: perr } = await svc.from("profiles").upsert({ id, email: email || null, full_name: name, phone: phone || null, address_line1: line1,
      address_line2: t("address_line2") || null, city, postcode, account_type: "residential" }, { onConflict: "id" });
    if (perr) return jsonResponse({ error: "account_create_failed", detail: perr.message }, 500);
    await svc.from("care_events").insert({ customer_id: id, actor_type: "staff", actor_id: uid, event: "account_opened_for_care_sale", details: { email: email || null } });
    const { data: prof } = await svc.from("profiles").select("id, full_name, account_number, postcode, address_line1, email").eq("id", id).single();
    const { data: elig } = await svc.rpc("care_eligibility", { p_customer: id });
    return jsonResponse({ ok: true, customer: { ...prof, email_masked: email ? email.replace(/^(.{2}).*(@.*)$/, "$1***$2") : null, eligibility: elig } });
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
    const transcript = String(body.transcript ?? "").trim();
    const source: "pasted" | "audio_local" = body.transcript_source === "audio_local" ? "audio_local" : "pasted";
    let bytes: number | null = sale.recording_bytes ?? null;
    if (path) {
      const { data: blob, error } = await svc.storage.from(BUCKET).download(path);
      if (error || !blob) return jsonResponse({ error: "recording_not_found" }, 400);
      bytes = blob.size;
      await svc.from("care_sales").update({ recording_path: path, recording_bytes: bytes, status: "scoring" }).eq("id", sale.id);
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

  // A short-lived link to one of this sale's letters (the summary, DD confirmation and anything sent later).
  if (action === "letter_url") {
    const { data: l } = await svc.from("care_letters").select("id, pdf_path, subscription_id").eq("id", String(body.letter_id ?? "")).maybeSingle();
    if (!l || !sale.subscription_id || l.subscription_id !== sale.subscription_id || !l.pdf_path) return jsonResponse({ error: "not_found" }, 404);
    const { data: signed } = await svc.storage.from("care-documents").createSignedUrl(l.pdf_path, 600);
    return jsonResponse({ ok: true, url: signed?.signedUrl ?? null });
  }

  // Telesales: the whole sign-up happens on the recorded call. It runs the same checks as an online sign-up
  // (eligibility, age, account-holder name, reviews, letters, staff tasks); the call recording is the verification.
  if (action === "complete") {
    if (!(sale.status === "approved" || (sale.status === "passed" && sale.qa_decision === "pass"))) return jsonResponse({ error: "sale_not_passed_or_approved" }, 400);
    const plan = String(body.plan ?? sale.plan_code), frequency = String(body.frequency ?? sale.frequency);
    const firstDate = String(body.first_payment_date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDate)) return jsonResponse({ error: "first_payment_date_required" }, 400);
    const day = Number(firstDate.slice(8, 10));
    if (!carePlan(plan) || carePriceMinor(plan, frequency) == null) return jsonResponse({ error: "invalid_choice" }, 400);
    const provider = String(body.provider_code ?? "");
    if (!CARE_PROVIDER_CODES.includes(provider)) return jsonResponse({ error: "choose_dd_provider" }, 400);
    const bank = (body.bank ?? {}) as Record<string, unknown>;
    const sort = String(bank.sort_code ?? "").replace(/\D/g, "");
    let acct = String(bank.account_number ?? "").replace(/\D/g, "");
    if (acct.length === 7) acct = `0${acct}`;
    const holder = String(bank.account_holder_name ?? "").trim().replace(/\s+/g, " ");
    if (sort.length !== 6 || acct.length !== 8) return jsonResponse({ error: "bank_details_invalid" }, 400);
    if (holder.length < 2 || holder.length > 120) return jsonResponse({ error: "account_holder_required" }, 400);
    const confirm = (body.confirm ?? {}) as Record<string, unknown>;
    if (!["ddi_read", "account_holder", "customer_agreed", "over_18"].every((k) => confirm[k] === true)) return jsonResponse({ error: "confirmations_required" }, 400);
    const prov = await careProvider(svc, provider);
    const now = new Date();

    // An internal invite (never emailed) carries the seller, the call and the chosen DD provider into the standard sign-up.
    const hash = await sha256Hex(crypto.randomUUID() + crypto.randomUUID());
    const { data: inv, error: ierr } = await svc.from("care_invites").insert({
      token_hash: hash, customer_id: sale.customer_id, plan_code: plan, frequency, collection_day: day, created_by: sale.agent_id, provider_code: provider,
      script_confirmed: { telesales: true, confirmations: confirm, completed_by: uid, confirmed_at: now.toISOString(),
        qa: { sale_id: sale.id, sale_reference: sale.reference, score: sale.qa_score, decision: sale.qa_decision,
          supervisor_decision: sale.supervisor_decision, recording_path: sale.recording_path } },
      call_reference: `${sale.call_reference} (${sale.reference})`.slice(0, 120), call_notes: (sale.agent_notes ?? "").slice(0, 2000) || null,
      expires_at: new Date(now.getTime() + 3600_000).toISOString(),
    }).select("id").single();
    if (ierr || !inv) return jsonResponse({ error: "complete_failed", detail: ierr?.message }, 500);
    const fail = async (out: Record<string, unknown>, status = 400) => {
      await svc.from("care_invites").update({ revoked_at: new Date().toISOString(), revoked_reason: "telesales_not_completed" }).eq("id", inv.id);
      return jsonResponse(out, status);
    };
    const ip = getRequestIp(req);
    const { data: st, error: serr } = await svc.rpc("care_start_application", { p_customer: sale.customer_id, p_plan: plan, p_frequency: frequency,
      p_day: day === 15 ? 15 : 1, p_invite_hash: hash, p_ip: ip, p_ua: "OCCTA Sales Desk" });
    const start = st as Record<string, unknown> | null;
    if (serr || !start?.ok) return fail(serr ? { error: "complete_failed", detail: serr.message } : start ?? { error: "complete_failed" });
    // The agent's chosen date replaces the default 1st/15th (rules checked in the database).
    const { data: fd, error: fderr } = await svc.rpc("care_sales_set_first_date", { p_application: start.application_id, p_date: firstDate, p_provider: provider });
    if (fderr) return fail({ error: fderr.message }, 400);
    start.first_collection_date = (fd as Record<string, unknown>).first_collection_date;
    const keyFacts = careKeyFacts({ planCode: plan, frequency, priceMinor: Number(start.price_minor), collectionDay: day,
      firstCollectionDate: longDate(String(start.first_collection_date)), ddName: prov.name });
    const { data: recorded } = await svc.rpc("care_record_key_facts", { p_application: start.application_id, p_customer: sale.customer_id,
      p_key_facts: keyFacts, p_sha: await sha256Hex(JSON.stringify(keyFacts)) });
    if (!recorded) return fail({ error: "key_facts_not_recorded" }, 500);
    const { data: vrf, error: verr } = await svc.from("care_verifications").insert({ application_id: start.application_id, customer_id: sale.customer_id,
      method: "call_recording", destination_masked: `Recorded call ${sale.call_reference}`.slice(0, 80), destination_hash: await sha256Hex(sale.id),
      expires_at: new Date(now.getTime() + 1800_000).toISOString(), verified_at: now.toISOString() }).select("id").single();
    if (verr || !vrf) return fail({ error: "complete_failed", detail: verr?.message }, 500);
    let enc: { ciphertext_hex: string; nonce_hex: string; key_id: string };
    try {
      enc = await encryptJson({ account_holder_name: holder, sort_code: sort, account_number: acct, bank_name: String(bank.bank_name ?? "").slice(0, 120), purpose: "occta_care" });
    } catch { return fail({ error: "encryption_unavailable" }, 503); }
    const { data: sub, error: suberr } = await svc.rpc("care_submit_application", { p_application: start.application_id, p_customer: sale.customer_id, p: {
      terms_sha256: await sha256Hex(careTermsCanonicalText()), tick_terms: true, tick_dd: true, tick_account_holder: true, declared_over_18: true,
      tick_early_start: body.start_now === true, ticked_early_start_at: body.start_now === true ? now.toISOString() : null,
      verification_id: vrf.id, bank_ciphertext: enc.ciphertext_hex, bank_nonce: enc.nonce_hex, enc_key_id: enc.key_id,
      masked_account_last4: acct.slice(-4), masked_sort_last2: sort.slice(-2), account_holder_name: holder, bank_name: String(bank.bank_name ?? "").slice(0, 120),
      date_of_birth: typeof body.date_of_birth === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date_of_birth) ? body.date_of_birth : null,
      ip, user_agent: "OCCTA Sales Desk", page_url: "sales-desk", client_snapshot: { sale_id: sale.id, completed_by: uid, confirmations: confirm },
    } });
    const r = sub as Record<string, unknown> | null;
    if (suberr || !r?.ok) return fail(suberr ? { error: "complete_failed", detail: suberr.message } : r ?? { error: "complete_failed" });
    await svc.from("care_sales").update({ status: "joined", invite_id: inv.id, subscription_id: r.subscription_id, plan_code: plan, frequency, collection_day: day }).eq("id", sale.id);
    await svc.from("care_events").insert({ subscription_id: r.subscription_id, customer_id: sale.customer_id, actor_type: "staff", actor_id: uid,
      event: "telesales_completed", details: { sale_id: sale.id, provider } });
    // Make the letters now rather than on the next 5-minute run, so the agent can print them straight away.
    await svc.rpc("care_dispatch_messages");
    return jsonResponse({ ...r, provider: prov.portal });
  }

  return jsonResponse({ error: "unknown_action" }, 400);
});

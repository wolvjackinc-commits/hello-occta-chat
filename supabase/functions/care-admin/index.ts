// OCCTA Care staff actions that need the server (encryption keys, PDFs, email).
// Everything else in Admin → OCCTA Care goes through care_admin_* database
// functions, which check roles and write the audit trail themselves.
//
// Actions:
//   reveal_bank     — decrypt a Care mandate's bank details to key into AccessPay (finance roles, reason required, audited)
//   send_invite     — phone-assisted sale: email the customer a link to complete sign-up themselves
//   revoke_invite
//   evidence_pack   — one PDF with everything we hold about a member's agreement and payments
//   print_batch     — one PDF of every letter waiting to be printed (the exact stored, hashed PDFs joined together), then mark them 'in batch'
//   dispatch_now    — run the letter/email worker immediately
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { getServiceClient, jsonResponse, corsHeaders, requireStaff, generateTokenPair, sendTrackedCommunication, escapeHtml } from "../_shared/quoteHelpers.ts";
import { decryptJson } from "../_shared/ddCrypto.ts";
import { getCronSecret } from "../_shared/cronSecret.ts";
import { sendCareInvite } from "../_shared/careInvite.ts";
import { careProvider, CARE_PROVIDER_CODES } from "../_shared/careProvider.ts";
import { providerInstructionText } from "../_shared/directDebitGuarantee.ts";
import { CARE_DD, CARE_PHONE_SCRIPT, CARE_RULES, carePlan, careFrequency, carePriceMinor, pounds } from "../_shared/careTerms.ts";
import { longDate } from "../_shared/careLetters.ts";
import { renderCareReportPdf, sha256Bytes } from "../_shared/careLetterPdf.ts";

const BUCKET = "care-documents";
const SITE = "https://www.occta.co.uk";
const STAFF = ["admin", "super_admin", "finance_admin", "support_agent", "sales_agent", "sales_admin", "compliance_admin"];
const FINANCE = ["admin", "super_admin", "finance_admin"];
// Evidence packs hold special-category data (support needs, carers): finance and compliance only.
const EVIDENCE = ["admin", "super_admin", "finance_admin", "compliance_admin"];

const dt = (v: unknown) => (v ? new Date(String(v)).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "-");

async function audit(svc: ReturnType<typeof getServiceClient>, actor: string, action: string, entityId: string | null, metadata: Record<string, unknown>) {
  await svc.from("audit_logs").insert({ actor_user_id: actor, action, entity: "occta_care", entity_id: entityId, metadata });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  const staff = await requireStaff(req, STAFF);
  if ("error" in staff) return jsonResponse({ error: staff.error }, staff.status);
  const actor = staff.userId;
  const svc = getServiceClient();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? "");

  // --------------------------------------------------------------- reveal_bank
  if (action === "reveal_bank") {
    const fin = await requireStaff(req, FINANCE);
    if ("error" in fin) return jsonResponse({ error: "finance_role_required" }, 403);
    const reason = String(body.reason ?? "").trim();
    if (reason.length < 5) return jsonResponse({ error: "reason_required" }, 400);
    const { data: m } = await svc.from("care_mandates").select("id, subscription_id, customer_id, reference, status, provider_code, bank_details_ciphertext, enc_nonce")
      .eq("id", String(body.mandate_id ?? "")).maybeSingle();
    if (!m) return jsonResponse({ error: "not_found" }, 404);
    if (!["awaiting_lodgement", "lodged", "cancel_requested"].includes(m.status)) return jsonResponse({ error: "not_needed_for_this_status" }, 400);
    if (!m.bank_details_ciphertext || !m.enc_nonce) return jsonResponse({ error: "details_purged" }, 410);
    let plain: Record<string, string>;
    try {
      plain = await decryptJson<Record<string, string>>(String(m.bank_details_ciphertext), String(m.enc_nonce));
    } catch {
      return jsonResponse({ error: "decrypt_failed" }, 500);
    }
    await svc.from("care_events").insert({ subscription_id: m.subscription_id, customer_id: m.customer_id, actor_type: "staff", actor_id: actor,
      event: "bank_details_revealed", details: { mandate_id: m.id, reason } });
    await audit(svc, actor, "care_bank_details_revealed", m.id, { reason, reference: m.reference });
    const prov = await careProvider(svc, m.provider_code);
    return jsonResponse({ ok: true, reference: m.reference, account_holder_name: plain.account_holder_name, sort_code: plain.sort_code,
      account_number: plain.account_number, bank_name: plain.bank_name ?? null, service_user_number: prov.sun,
      collection_name: prov.name, provider_name: prov.portal });
  }

  // --------------------------------------------------------------- send_invite
  if (action === "send_invite") {
    const customerId = String(body.customer_id ?? "");
    const plan = String(body.plan ?? "");
    const frequency = String(body.frequency ?? "");
    const day = Number(body.collection_day ?? 1);
    const confirmed = (body.script_confirmed ?? {}) as Record<string, boolean>;
    const missing = CARE_PHONE_SCRIPT.filter((l) => confirmed[l.id] !== true).map((l) => l.id);
    if (missing.length) return jsonResponse({ error: "script_not_confirmed", missing }, 400);
    if (!carePlan(plan) || !careFrequency(frequency) || ![1, 15].includes(day)) return jsonResponse({ error: "invalid_choice" }, 400);
    const callRef = String(body.call_reference ?? "").trim();
    if (callRef.length < 3) return jsonResponse({ error: "call_reference_required" }, 400);
    const provider = body.provider_code ? String(body.provider_code) : null;
    if (provider && !CARE_PROVIDER_CODES.includes(provider)) return jsonResponse({ error: "invalid_provider" }, 400);

    const r = await sendCareInvite(svc, { customerId, plan, frequency, day, actor, callRef, callNotes: String(body.call_notes ?? ""), scriptConfirmed: confirmed, provider });
    if (!r.ok) return jsonResponse({ error: r.error, reasons: r.reasons ?? [] }, r.status ?? 400);
    await audit(svc, actor, "care_invite_sent", r.invite_id, { customer_id: customerId, plan, frequency });
    return jsonResponse(r);
  }

  if (action === "revoke_invite") {
    const { error } = await svc.from("care_invites").update({ revoked_at: new Date().toISOString(), revoked_reason: String(body.reason ?? "revoked by staff").slice(0, 200) })
      .eq("id", String(body.invite_id ?? "")).is("used_at", null);
    if (error) return jsonResponse({ error: error.message }, 500);
    await audit(svc, actor, "care_invite_revoked", String(body.invite_id ?? ""), {});
    return jsonResponse({ ok: true });
  }

  // ------------------------------------------------------------- evidence_pack
  if (action === "evidence_pack") {
    const ev = await requireStaff(req, EVIDENCE);
    if ("error" in ev) return jsonResponse({ error: "finance_or_compliance_role_required" }, 403);
    const subId = String(body.subscription_id ?? "");
    const purpose = String(body.purpose ?? "internal_review");
    if (!["indemnity_challenge", "ddi_copy", "complaint", "customer_request", "internal_review"].includes(purpose)) return jsonResponse({ error: "invalid_purpose" }, 400);
    const { data: s } = await svc.from("care_subscriptions").select("*").eq("id", subId).maybeSingle();
    if (!s) return jsonResponse({ error: "not_found" }, 404);
    const [prof, consents, mandates, cols, letters, comms, usage, reqs, refunds, disputes, events, inv, needs] = await Promise.all([
      svc.from("profiles").select("full_name, email, phone, account_number, address_line1, address_line2, city, postcode").eq("id", s.customer_id).maybeSingle(),
      svc.from("care_consents").select("*").eq("subscription_id", subId).order("created_at"),
      svc.from("care_mandates").select("id, reference, provider_code, status, account_holder_name, bank_name, masked_account_last4, masked_sort_last2, signed_at, lodge_due_by, lodged_at, provider_reference, activated_at, rejected_at, rejection_reason, cancel_requested_at, cancelled_at, cancel_source, cancel_reason_code").eq("subscription_id", subId).order("created_at"),
      svc.from("care_collections").select("*").eq("subscription_id", subId).order("due_date"),
      svc.from("care_letters").select("id, letter_type, status, delivery, pdf_sha256, posted_on, mail_house_on, email_status, email_sent_at, provider_id, copy_for, created_at, dedupe_key").eq("subscription_id", subId).order("created_at"),
      svc.from("communications_log").select("template_name, recipient_email, subject, status, sent_at, opened_at").eq("user_id", s.customer_id).like("template_name", "care_%").order("created_at"),
      svc.from("care_usage").select("kind, notes, occurred_at, source").eq("subscription_id", subId).order("occurred_at"),
      svc.from("care_requests").select("kind, details, status, created_at").eq("subscription_id", subId).order("created_at"),
      svc.from("care_refunds").select("amount_minor, reason, status, paid_at, paid_reference, created_at").eq("subscription_id", subId).order("created_at"),
      svc.from("care_disputes").select("kind, bacs_reason_code, amount_minor, received_on, respond_by, status, decision_note").eq("subscription_id", subId).order("created_at"),
      svc.from("care_events").select("id, actor_type, event, details, created_at").eq("subscription_id", subId).order("id"),
      s.invite_id ? svc.from("care_invites").select("created_by, call_reference, call_notes, script_confirmed, created_at, used_at, sent_to_email").eq("id", s.invite_id).maybeSingle() : Promise.resolve({ data: null }),
      svc.from("care_support_needs").select("needs, carer_name, consent_at, consent_source").eq("customer_id", s.customer_id).maybeSingle(),
    ]);
    const p = prof.data;
    const join = (consents.data ?? []).find((c: Record<string, unknown>) => c.kind === "join") as Record<string, unknown> | undefined;
    const mand = (mandates.data ?? [])[0] as Record<string, unknown> | undefined;
    const sections: { heading: string; rows?: [string, string][]; lines?: string[] }[] = [];
    sections.push({ heading: "Member", rows: [
      ["Name", p?.full_name ?? "-"], ["OCCTA account", p?.account_number ?? "-"], ["Address", [p?.address_line1, p?.address_line2, p?.city, p?.postcode].filter(Boolean).join(", ")],
      ["Email / phone", `${p?.email ?? "-"} / ${p?.phone ?? "-"}`], ["Care reference", s.reference], ["Status", `${s.status}${s.status_reason ? ` (${s.status_reason})` : ""}`],
      ["Plan", `${carePlan(s.plan_code)?.name ?? s.plan_code}, ${s.frequency}, ${pounds(s.price_minor)} per collection`], ["Joined", dt(s.joined_at)],
      ["Cooling-off ended", dt(s.cooling_off_ends_at)], ["Channel", s.channel], ["Terms version", s.terms_version],
    ] });
    if (join) sections.push({ heading: "Agreement evidence (immutable record)", rows: [
      ["Consent id", String(join.id)], ["Terms SHA-256", String(join.terms_sha256)], ["Key facts SHA-256", String(join.key_facts_sha256)],
      ["Key facts shown", dt(join.key_facts_shown_at)], ["Ticked terms", dt(join.ticked_terms_at)], ["Ticked Direct Debit", dt(join.ticked_dd_at)],
      ["Ticked account holder", dt(join.ticked_account_holder_at)], ["Asked to start early", join.ticked_early_start ? `Yes (${dt(join.ticked_early_start_at)})` : "No"],
      ["Declared 18 or over", join.declared_over_18 ? "Yes" : "No"],
      ["Verified", `${join.verification_method === "sms_otp" ? "SMS code" : "Email code"} to ${join.verification_destination} at ${dt(join.verified_at)}`],
      ["IP address", String(join.ip ?? "-")], ["Device", String(join.user_agent ?? "-")], ["Page", String(join.page_url ?? "-")],
      ["Staff involved", join.staff_id ? String(join.staff_id) : "None (self-service)"],
    ], lines: ["Key facts shown and agreed:", ...((join.key_facts as string[]) ?? []).map((k) => `- ${k}`)] });
    for (const c of (consents.data ?? []).filter((x: Record<string, unknown>) => x.kind !== "join") as Record<string, unknown>[]) {
      sections.push({ heading: `Later agreement: ${c.kind}`, rows: [["When", dt(c.created_at)], ["Plan / price", `${c.plan_code} ${pounds(Number(c.price_minor))}`], ["Key facts SHA-256", String(c.key_facts_sha256)], ["IP", String(c.ip ?? "-")]] });
    }
    if (inv.data) sections.push({ heading: "Phone-assisted sale", rows: [
      ["Staff user", String(inv.data.created_by)], ["Call reference / recording", String(inv.data.call_reference ?? "-")], ["Notes", String(inv.data.call_notes ?? "-")],
      ["Link sent", `${dt(inv.data.created_at)} to ${inv.data.sent_to_email}`], ["Customer completed", dt(inv.data.used_at)],
      ...(((inv.data.script_confirmed as { qa?: Record<string, unknown> })?.qa) ? (() => { const q = (inv.data.script_confirmed as { qa: Record<string, unknown> }).qa;
        return [["Sales Desk sale", String(q.sale_reference ?? "-")], ["Call check", `${q.decision ?? "-"} (score ${q.score ?? "-"})${q.supervisor_decision ? `, supervisor ${q.supervisor_decision}` : ""}`],
          ["Recording on file", String(q.recording_path ?? "-")]] as [string, string][]; })() : []),
    ], lines: ["Script lines confirmed as read out:", ...((inv.data.script_confirmed as { script?: string[] })?.script ?? []).map((l) => `- ${l}`)] });
    if (mand) {
      const prov = await careProvider(svc, mand.provider_code);
      sections.push({ heading: "Direct Debit Instruction (paperless)", rows: [
        ["Collected by", `${prov.name}, Service User Number ${prov.sun} (${prov.portal})`], ["Reference", String(mand.reference)],
        ["Account holder", String(mand.account_holder_name)], ["Bank", `${mand.bank_name ?? "-"}, sort code ending ${mand.masked_sort_last2}, account ending ${mand.masked_account_last4}`],
        ["Authorised", `${dt(mand.signed_at)} online, after one-time code verification${join ? ` to ${join.verification_destination}` : ""}${join?.ip ? `, from IP ${join.ip}` : ""}`],
        ["Lodged with provider", `${dt(mand.lodged_at)}${mand.provider_reference ? ` (provider ref ${mand.provider_reference})` : ""}`], ["Active", dt(mand.activated_at)],
        ["Status", `${mand.status}${mand.cancel_source ? ` (${mand.cancel_source}${mand.cancel_reason_code ? ` ${mand.cancel_reason_code}` : ""})` : ""}`],
      ], lines: [`Instruction wording: ${providerInstructionText({ legal_collection_name: prov.name, service_user_number: prov.sun, advance_notice_working_days: CARE_DD.noticeWorkingDays })}`] });
    }
    sections.push({ heading: "Collections and advance notice", lines: (cols.data ?? []).map((c: Record<string, unknown>) =>
      `${longDate(String(c.due_date))}: ${pounds(Number(c.amount_minor))} for ${longDate(String(c.period_start))}-${longDate(String(c.period_end))}, ${c.kind}, status ${c.status}; notice ${c.notice_kind ?? "-"} queued ${dt(c.notice_sent_at)}${c.notice_dedupe ? ` (letter ${c.notice_dedupe})` : ""}${c.bank_received_date ? `; money received ${longDate(String(c.bank_received_date))}` : ""}${c.unpaid_reason_code ? `; returned (ARUDD ${c.unpaid_reason_code})` : ""}`) });
    sections.push({ heading: "Letters (PDF hashes prove content)", lines: (letters.data ?? []).map((l: Record<string, unknown>) =>
      `${dt(l.created_at)}: ${l.letter_type} [${l.dedupe_key ?? "-"}]${l.copy_for ? ` (copy for ${l.copy_for})` : ""}; ${l.status}${l.posted_on ? `, posted ${longDate(String(l.posted_on))}` : ""}${l.mail_house_on ? `, handed to mail house ${longDate(String(l.mail_house_on))}${l.provider_id ? ` (${l.provider_id})` : ""}` : ""}; email ${l.email_status ?? "-"}${l.email_sent_at ? ` at ${dt(l.email_sent_at)}` : ""}; sha256 ${l.pdf_sha256 ?? "-"}`) });
    sections.push({ heading: "Emails", lines: (comms.data ?? []).map((c: Record<string, unknown>) => `${dt(c.sent_at)}: ${c.subject} to ${c.recipient_email} (${c.status}${c.opened_at ? `, opened ${dt(c.opened_at)}` : ""})`) });
    sections.push({ heading: "Service used", lines: [...(usage.data ?? []).map((u: Record<string, unknown>) => `${dt(u.occurred_at)}: ${u.kind}${u.notes ? ` - ${u.notes}` : ""}`),
      ...(reqs.data ?? []).map((r: Record<string, unknown>) => `${dt(r.created_at)}: customer request ${r.kind} (${r.status})`)] });
    sections.push({ heading: "Refunds and disputes", lines: [...(refunds.data ?? []).map((f: Record<string, unknown>) => `${dt(f.created_at)}: refund ${pounds(Number(f.amount_minor))} ${f.status}${f.paid_at ? ` paid ${f.paid_at} ref ${f.paid_reference}` : ""} - ${f.reason}`),
      ...(disputes.data ?? []).map((d: Record<string, unknown>) => `${d.received_on}: ${d.kind} ${d.bacs_reason_code ?? ""} ${d.amount_minor ? pounds(Number(d.amount_minor)) : ""} - ${d.status}${d.decision_note ? `: ${d.decision_note}` : ""}`)] });
    if (needs.data) sections.push({ heading: "Support needs (special category, shared with consent)", rows: [["Needs", (needs.data.needs ?? []).join(", ") || "-"], ["Carer", needs.data.carer_name ?? "-"], ["Consent", `${dt(needs.data.consent_at)} (${needs.data.consent_source})`]] });
    sections.push({ heading: "Full timeline", lines: (events.data ?? []).map((e: Record<string, unknown>) => `${dt(e.created_at)} [${e.actor_type}] ${e.event} ${JSON.stringify(e.details ?? {}).slice(0, 220)}`) });

    const pdf = renderCareReportPdf(`OCCTA Care evidence pack (${purpose.replace(/_/g, " ")})`, s.reference, sections);
    const sha = await sha256Bytes(pdf);
    const path = `evidence/${subId}/${Date.now()}-${purpose}.pdf`;
    const up = await svc.storage.from(BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: false });
    if (up.error) return jsonResponse({ error: "upload_failed", detail: up.error.message }, 500);
    const { data: eid, error: rerr } = await svc.rpc("care_record_evidence_pack", { p_sub: subId, p_purpose: purpose, p_path: path, p_sha: sha, p_actor: actor,
      p_dispute: body.dispute_id ? String(body.dispute_id) : null });
    if (rerr) return jsonResponse({ error: "record_failed", detail: rerr.message }, 500);
    await audit(svc, actor, "care_evidence_pack_created", String(eid), { subscription_id: subId, purpose, sha256: sha });
    const { data: signed } = await svc.storage.from(BUCKET).createSignedUrl(path, 600);
    return jsonResponse({ ok: true, evidence_pack_id: eid, sha256: sha, url: signed?.signedUrl ?? null });
  }

  // --------------------------------------------------------------- print_batch
  if (action === "print_batch") {
    const ids = Array.isArray(body.letter_ids) ? (body.letter_ids as unknown[]).map(String) : null;
    let q = svc.from("care_letters").select("id, letter_type, copy_for, created_at, pdf_path").in("status", ["awaiting_print", "needs_manual"]).not("pdf_path", "is", null).order("created_at").limit(200);
    if (ids?.length) q = q.in("id", ids);
    const { data: letters, error } = await q;
    if (error) return jsonResponse({ error: error.message }, 500);
    if (!letters?.length) return jsonResponse({ error: "nothing_to_print" }, 400);
    // Join the exact stored PDFs (the ones whose hashes are on record), never a re-render.
    const merged = await PDFDocument.create();
    for (const l of letters as Record<string, unknown>[]) {
      const { data: blob, error: derr } = await svc.storage.from(BUCKET).download(String(l.pdf_path));
      if (derr || !blob) return jsonResponse({ error: "stored_pdf_unreadable", letter_id: l.id }, 500);
      const doc = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      for (const pg of pages) merged.addPage(pg);
      // Duplex printing: start every letter on a fresh sheet.
      if (pages.length % 2 === 1) merged.addPage([pages[0].getWidth(), pages[0].getHeight()]);
    }
    const pdf = new Uint8Array(await merged.save()) as Uint8Array<ArrayBuffer>;
    const sha = await sha256Bytes(pdf);
    const number = `CARE-PRINT-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const path = `batches/${number}.pdf`;
    const up = await svc.storage.from(BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: false });
    if (up.error) return jsonResponse({ error: "upload_failed", detail: up.error.message }, 500);
    const { data: batch } = await svc.from("care_print_batches").insert({ batch_number: number, letter_count: letters.length, pdf_path: path, pdf_sha256: sha, created_by: actor }).select("id").single();
    await svc.from("care_letters").update({ status: "in_batch", batch_id: batch?.id }).in("id", letters.map((l: Record<string, unknown>) => String(l.id))).eq("status", "awaiting_print");
    await svc.from("care_letters").update({ batch_id: batch?.id }).in("id", letters.map((l: Record<string, unknown>) => String(l.id))).eq("status", "needs_manual");
    await audit(svc, actor, "care_print_batch_created", batch?.id ?? null, { number, count: letters.length, sha256: sha });
    const { data: signed } = await svc.storage.from(BUCKET).createSignedUrl(path, 900);
    return jsonResponse({ ok: true, batch_id: batch?.id, batch_number: number, count: letters.length, url: signed?.signedUrl ?? null,
      letter_ids: letters.map((l: Record<string, unknown>) => l.id) });
  }

  // -------------------------------------------------------------- dispatch_now
  if (action === "dispatch_now") {
    const secret = await getCronSecret();
    if (!secret) return jsonResponse({ error: "token_unavailable" }, 500);
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/care-dispatch`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-cron-secret": secret }, body: "{}",
    });
    return jsonResponse({ ok: res.ok, result: await res.json().catch(() => null) });
  }

  return jsonResponse({ error: "unknown_action" }, 400);
});

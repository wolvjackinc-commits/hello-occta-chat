// OCCTA Care outbox worker: the ONLY place Care letters and emails are produced.
//
// Called every 5 minutes by public.care_dispatch_messages() (single-use cron
// token) and straight after a sign-up by care-join. Staff can also trigger it
// from Admin → OCCTA Care.
//
// For each outbox item:
//   1. Build the content once (careLetters.ts).
//   2. Letter: render the PDF, store it (immutable, hashed), then post it via
//      Stannp ONLY when STANNP_API_KEY is set AND STANNP_MODE=live (test mode
//      never counts as posted), otherwise leave it in the print queue for
//      staff (they mark it posted with the posting date). A letter handed to
//      Stannp is 'sent_to_mail_house' with mail_house_on, never 'posted'.
//      Notice for a payment only counts once it has been delivered
//      (see public.care_notice_delivered_on).
//      Braille or a missing address goes to 'needs_manual'. A carer copy is a
//      second letter marked "COPY FOR <carer>".
//   3. Email the same content, with the letter PDF attached.
// Test records never send anything.
import { getServiceClient, jsonResponse, corsHeaders, requireStaff, sendTrackedCommunication, escapeHtml } from "../_shared/quoteHelpers.ts";
import { isCronSecret } from "../_shared/cronSecret.ts";
import { renderBrandedEmail } from "../_shared/brandedEmailShell.ts";
import { buildCareLetter, careLetterText, type CareLetterContent, type CareRecipient } from "../_shared/careLetters.ts";
import { renderCareLetterPdf, sha256Bytes, toBase64 } from "../_shared/careLetterPdf.ts";
import { careProvider } from "../_shared/careProvider.ts";

const BUCKET = "care-documents";

/** Today's date in the UK, as YYYY-MM-DD. */
function londonToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
const SITE = "https://www.occta.co.uk";

type Outbox = {
  id: string; letter_id: string | null; subscription_id: string | null; customer_id: string | null;
  kind: "letter_and_email" | "email_only"; template: string; payload: Record<string, unknown>;
  lease: string; is_test: boolean; attempts: number;
};

function emailHtml(c: CareLetterContent): string {
  const sections: { heading: string; html: string }[] = [];
  if (c.facts?.length) {
    sections.push({
      heading: "The details",
      html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${c.facts
        .map(([k, v]) => `<tr><td style="padding:6px 8px 6px 0;font-weight:700;vertical-align:top;width:40%">${escapeHtml(k)}</td><td style="padding:6px 0;vertical-align:top">${escapeHtml(v)}</td></tr>`)
        .join("")}</table>`,
    });
  }
  for (const b of c.boxes ?? []) {
    sections.push({ heading: b.heading, html: `<ul style="margin:0;padding-left:18px">${b.lines.map((l) => `<li style="margin:0 0 6px 0">${escapeHtml(l)}</li>`).join("")}</ul>` });
  }
  if (c.guarantee) {
    sections.push({ heading: "The Direct Debit Guarantee", html: c.guarantee.split(/\n\n+/).map((p) => `<p style="margin:0 0 8px 0;font-size:13px">${escapeHtml(p)}</p>`).join("") });
  }
  sections.push({ heading: "Good to know", html: c.closing.map((p) => `<p style="margin:0 0 8px 0">${escapeHtml(p)}</p>`).join("") });
  return renderBrandedEmail({
    preheader: c.preheader,
    eyebrow: "OCCTA Care",
    reference: c.reference,
    greeting: c.greeting.replace(/,$/, ""),
    intro: c.paragraphs.map((p) => `<p style="margin:0 0 12px 0">${escapeHtml(p)}</p>`).join(""),
    sections,
    cta: { label: "Open My OCCTA Care", url: `${SITE}/dashboard?tab=care` },
    closingHtml: `<p style="margin:0;font-size:12px;color:#666">This email is a copy of a letter we've also posted to you. The letter is attached as a PDF.</p>`,
  });
}

async function postViaStannp(pdf: Uint8Array<ArrayBuffer>, r: CareRecipient, apiKey: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const form = new FormData();
  form.append("test", "false");
  form.append("file", new Blob([pdf], { type: "application/pdf" }), "letter.pdf");
  form.append("duplex", "true");
  form.append("recipient[firstname]", r.name);
  form.append("recipient[address1]", r.address_line1 ?? "");
  form.append("recipient[address2]", r.address_line2 ?? "");
  form.append("recipient[city]", r.city ?? "");
  form.append("recipient[postcode]", r.postcode ?? "");
  form.append("recipient[country]", "GB");
  try {
    const res = await fetch("https://api-eu1.stannp.com/v1/letters/create", {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${apiKey}:`)}` },
      body: form,
    });
    const body = await res.json().catch(() => ({})) as { success?: boolean; data?: { id?: string | number }; error?: string };
    if (!res.ok || body.success === false) return { ok: false, error: `stannp_${res.status}_${String(body.error ?? "").slice(0, 80)}` };
    return { ok: true, id: String(body.data?.id ?? "") };
  } catch (e) {
    return { ok: false, error: `stannp_request_failed_${(e as Error).message.slice(0, 60)}` };
  }
}

async function processItem(svc: ReturnType<typeof getServiceClient>, item: Outbox): Promise<{ id: string; status: string; error?: string }> {
  if (item.is_test) {
    await svc.rpc("care_finish_outbox", { p_id: item.id, p_lease: item.lease, p_ok: true, p_error: null, p_status: "suppressed_test" });
    if (item.letter_id) await svc.from("care_letters").update({ status: "cancelled", error: "test_record" }).eq("id", item.letter_id);
    return { id: item.id, status: "suppressed_test" };
  }

  const recipient = (item.payload.recipient ?? {}) as CareRecipient;
  const letterDate = new Date();
  if (item.subscription_id) {
    // Letters name whoever collects this member's DD (AccessPay or FastPay), taken from their mandate.
    const { data: md } = await svc.from("care_mandates").select("provider_code").eq("subscription_id", item.subscription_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const prov = await careProvider(svc, md?.provider_code);
    item.payload = { ...item.payload, dd_collection_name: prov.name, dd_service_user_number: prov.sun };
  }
  const content = buildCareLetter(item.template, item.payload, recipient, letterDate);
  let attachment: { filename: string; content: string; contentType: string } | undefined;
  let letterStatus: string | null = null;

  if (item.kind === "letter_and_email" && item.letter_id) {
    const { data: letter } = await svc.from("care_letters").select("*").eq("id", item.letter_id).maybeSingle();
    if (!letter) throw new Error("letter_row_missing");
    const needs: string[] = Array.isArray(recipient.needs) ? recipient.needs : [];
    let pdf: Uint8Array<ArrayBuffer>;
    if (letter.pdf_path) {
      // A retry after a partial failure: reuse the stored PDF, never re-render a different one.
      const { data: blob, error } = await svc.storage.from(BUCKET).download(letter.pdf_path);
      if (error || !blob) throw new Error("stored_pdf_unreadable");
      pdf = new Uint8Array(await blob.arrayBuffer());
    } else {
      pdf = renderCareLetterPdf(content, { largePrint: !!letter.large_print });
      const sha = await sha256Bytes(pdf);
      const path = `letters/${letter.customer_id}/${letter.id}.pdf`;
      const up = await svc.storage.from(BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: false });
      if (up.error && !/exists/i.test(up.error.message)) throw new Error(`upload_failed_${up.error.message.slice(0, 60)}`);
      const { error: uerr } = await svc.from("care_letters").update({ pdf_path: path, pdf_sha256: sha, letter_date: letterDate.toISOString().slice(0, 10) }).eq("id", letter.id).is("pdf_path", null);
      if (uerr) throw new Error(`letter_update_failed_${uerr.message.slice(0, 60)}`);
      letter.pdf_path = path;
    }

    if (letter.status === "posting") {
      // A previous attempt died while handing this letter to the mail house: never send it twice.
      letterStatus = "needs_manual";
      await svc.from("care_letters").update({ status: letterStatus, delivery: "manual", error: "check_stannp_before_posting: a previous attempt may already have sent it" }).eq("id", letter.id).eq("status", "posting");
    }
    if (letter.status === "rendering") {
      const hasAddress = !!(recipient.address_line1 && recipient.postcode);
      const stannpKey = Deno.env.get("STANNP_MODE") === "live" ? Deno.env.get("STANNP_API_KEY") : undefined;
      if (!hasAddress) {
        letterStatus = "needs_manual";
        await svc.from("care_letters").update({ status: letterStatus, delivery: "manual", error: "no_postal_address" }).eq("id", letter.id);
      } else if (needs.includes("braille")) {
        letterStatus = "needs_manual";
        await svc.from("care_letters").update({ status: letterStatus, delivery: "manual", error: "braille_requested: send a Braille version" }).eq("id", letter.id);
      } else if (stannpKey) {
        // Claim the letter first so a crash mid-request can't post it twice.
        const { data: claimed } = await svc.from("care_letters").update({ status: "posting" }).eq("id", letter.id).eq("status", "rendering").select("id");
        if (!claimed?.length) throw new Error("letter_already_claimed");
        const sent = await postViaStannp(pdf, recipient, stannpKey);
        letterStatus = sent.ok ? "sent_to_mail_house" : "awaiting_print";
        await svc.from("care_letters").update(sent.ok
          ? { status: letterStatus, delivery: "stannp", provider_id: sent.id, mail_house_on: londonToday() }
          : { status: letterStatus, delivery: "print_queue", error: sent.error }).eq("id", letter.id);
      } else {
        letterStatus = "awaiting_print";
        await svc.from("care_letters").update({ status: letterStatus, delivery: "print_queue" }).eq("id", letter.id);
      }

      // Carer copy: posted by staff, because we hold a free-text contact, not a validated address.
      if (needs.includes("carer_copy") && recipient.carer_name) {
        const copyPdf = renderCareLetterPdf(content, { largePrint: !!letter.large_print, copyFor: recipient.carer_name });
        const { data: copyRow } = await svc.from("care_letters").insert({
          subscription_id: letter.subscription_id, customer_id: letter.customer_id, letter_type: letter.letter_type,
          recipient: { ...recipient, name: recipient.carer_name, copy_contact: recipient.carer_contact }, payload: letter.payload,
          large_print: letter.large_print, copy_for: recipient.carer_name, status: "rendering", dedupe_key: `${letter.dedupe_key ?? letter.id}:carer`,
        }).select("id").maybeSingle();
        if (copyRow?.id) {
          const cpath = `letters/${letter.customer_id}/${copyRow.id}.pdf`;
          await svc.storage.from(BUCKET).upload(cpath, copyPdf, { contentType: "application/pdf", upsert: false });
          await svc.from("care_letters").update({ pdf_path: cpath, pdf_sha256: await sha256Bytes(copyPdf) }).eq("id", copyRow.id);
          await svc.from("care_letters").update({ status: "needs_manual", delivery: "manual", error: `carer_copy: post to ${recipient.carer_contact ?? "carer"}` }).eq("id", copyRow.id);
        }
      }
    }
    attachment = { filename: `OCCTA-Care-${item.template.replace(/_/g, "-")}-${recipient.reference.replace(/\s+/g, "-")}.pdf`, content: toBase64(pdf), contentType: "application/pdf" };
  }

  // Email copy (skipped when the customer has no email on file; the letter still goes).
  let emailStatus = "no_email";
  let alreadyEmailed = false;
  if (item.letter_id) {
    const { data: l } = await svc.from("care_letters").select("email_status").eq("id", item.letter_id).maybeSingle();
    alreadyEmailed = !!l?.email_status && (l.email_status === "sent" || l.email_status === "sending");
    if (l?.email_status === "sending") {
      // A previous attempt died mid-send: don't risk a duplicate. Posting still counts as notice.
      emailStatus = "unknown_after_retry";
      await svc.from("care_letters").update({ email_status: emailStatus }).eq("id", item.letter_id);
    } else if (l?.email_status === "sent") {
      emailStatus = "sent";
    }
  }
  if (recipient.email && !alreadyEmailed) {
    if (item.letter_id) await svc.from("care_letters").update({ email_status: "sending" }).eq("id", item.letter_id);
    const sent = await sendTrackedCommunication(svc, {
      template_name: `care_${item.template}`,
      recipient_email: recipient.email,
      subject: content.subject,
      html: emailHtml(content),
      user_id: item.customer_id,
      metadata: { care_outbox_id: item.id, care_letter_id: item.letter_id, subscription_id: item.subscription_id, reference: recipient.reference, text: careLetterText(content).slice(0, 4000) },
      attachments: attachment ? [attachment] : undefined,
    });
    emailStatus = sent.ok ? "sent" : `failed:${sent.error.slice(0, 80)}`;
    if (item.letter_id) {
      await svc.from("care_letters").update({ email_status: emailStatus, email_log_id: sent.trackingLogId ?? null,
        email_sent_at: sent.ok ? new Date().toISOString() : null }).eq("id", item.letter_id);
    }
    if (!sent.ok && !item.letter_id) throw new Error(`email_failed_${sent.error.slice(0, 60)}`);
  }

  await svc.rpc("care_finish_outbox", { p_id: item.id, p_lease: item.lease, p_ok: true, p_error: null, p_status: null });
  await svc.from("care_events").insert({
    subscription_id: item.subscription_id, customer_id: item.customer_id, actor_type: "system", event: "message_sent",
    details: { template: item.template, letter_id: item.letter_id, letter_status: letterStatus, email_status: emailStatus },
  });
  return { id: item.id, status: "done" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const cronOk = await isCronSecret(req.headers.get("x-cron-secret"));
  if (!cronOk) {
    const staff = await requireStaff(req, ["admin", "super_admin", "finance_admin", "support_agent", "compliance_admin"]);
    if ("error" in staff) return jsonResponse({ error: "unauthorized" }, 401);
  }

  const svc = getServiceClient();
  const { data: items, error } = await svc.rpc("care_claim_outbox", { p_limit: 10 });
  if (error) return jsonResponse({ error: "claim_failed", detail: error.message }, 500);

  const results: Array<{ id: string; status: string; error?: string }> = [];
  for (const item of (items ?? []) as Outbox[]) {
    try {
      results.push(await processItem(svc, item));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown_error";
      console.error("[care-dispatch] item failed", item.id, msg);
      await svc.rpc("care_finish_outbox", { p_id: item.id, p_lease: item.lease, p_ok: false, p_error: msg, p_status: null });
      results.push({ id: item.id, status: "retry", error: msg });
    }
  }
  return jsonResponse({ ok: true, processed: results.length, results });
});

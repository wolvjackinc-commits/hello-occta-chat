// One-off production remediation task for account OCC69244673 (invoice INV-2607-0005).
//
// The recurring billing job failed on 25 July 2026, so the July invoice was
// never issued or delivered. This task restores that invoice (preserving the
// original 25 July 2026 issue date), stores the branded OCCTA PDF, issues a
// fresh 30-day Direct Debit setup link (cancelling superseded ones) and sends
// ONE combined branded email through the official OCCTA transactional system.
//
// Actions:
//   prepare -> validate invoice, build + store PDF, rotate DD setup link
//   send    -> send combined email (duplicate-guarded), then mark invoice sent

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { itemiseInvoice, buildInvoicePdfBytes, sha256Hex } from "../_shared/billingHelpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret, x-task-secret",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ACCOUNT = "OCC69244673";
const INVOICE_NUMBER = "INV-2607-0005";
const TEMPLATE = "invoice_dd_transition";
const APP_ORIGIN = Deno.env.get("PUBLIC_APP_ORIGIN") ?? "https://www.occta.co.uk";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";
  const internal = req.headers.get("x-internal-secret, x-task-secret") ?? "";
  const cronSecret = Deno.env.get("CRON_JOB_SECRET") ?? "";
  const taskSecret = Deno.env.get("TASK_HUTT_RESTORE_SECRET") ?? "";
  const okAuth =
    auth === `Bearer ${serviceKey}` ||
    (cronSecret && internal === cronSecret) ||
    (taskSecret && req.headers.get("x-task-secret") === taskSecret);
  let jwtRole: string | null = null;
  try {
    const t = auth.replace(/^Bearer\s+/i, "");
    if (t.split(".").length === 3) {
      jwtRole = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))?.role ?? null;
    }
  } catch { /* ignore */ }
  if (!okAuth && jwtRole !== "service_role") {
    return json({ error: "forbidden", saw_role: jwtRole, has_auth: Boolean(auth) }, 403);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const body = await req.json().catch(() => ({}));
  const action: string = body?.action ?? "prepare";

  // ---- Load customer + invoice -------------------------------------------
  const { data: profile } = await supabase
    .from("profiles").select("id, full_name, email, account_number")
    .eq("account_number", ACCOUNT).maybeSingle();
  if (!profile) return json({ error: "profile_not_found" }, 404);

  const { data: inv } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, issue_date, due_date, billing_period_start, billing_period_end, subtotal, vat_total, total, pdf_storage_key")
    .eq("user_id", profile.id).eq("invoice_number", INVOICE_NUMBER).maybeSingle();
  if (!inv) return json({ error: "invoice_not_found" }, 404);

  // ---- Guard: never send twice through the official provider --------------
  const { data: alreadySent } = await supabase
    .from("communications_log")
    .select("id, provider_message_id, sent_at, status")
    .eq("invoice_id", inv.id).eq("template_name", TEMPLATE).eq("status", "sent")
    .maybeSingle();

  if (action === "status") {
    return json({ profile, invoice: inv, already_sent: alreadySent ?? null });
  }

  if (action === "prepare") {
    // 1. Validate amounts (no late fee / penalty / setup fee lines allowed).
    const totals = itemiseInvoice(
      [{
        description: "Flex — monthly broadband service",
        amount_minor: 3499,
        period_label: "25 Jul 2026 to 24 Aug 2026 (billed in advance)",
      }],
      "inclusive",
      20,
    );
    if (totals.total_gross_minor !== 3499 || totals.subtotal_net_minor !== 2916 || totals.vat_total_minor !== 583) {
      return json({ error: "amount_mismatch", totals }, 500);
    }
    const { data: lines } = await supabase.from("invoice_lines").select("description, line_total").eq("invoice_id", inv.id);
    const banned = /late fee|penalty|interest|activation|setup/i;
    if ((lines ?? []).some((l) => banned.test(l.description))) {
      return json({ error: "disallowed_charge_line_present", lines }, 500);
    }

    // 2. Normal payment terms (7 days) from the actual delivery date, with
    //    the original 25 July 2026 issue date preserved.
    const dueDate = body?.due_date ?? "2026-08-13";
    await supabase.from("invoices").update({
      issue_date: "2026-07-25",
      billing_period_start: "2026-07-25",
      billing_period_end: "2026-08-25", // stored exclusive => displays 24 Aug 2026
      due_date: dueDate,
      subtotal: 29.16,
      vat_total: 5.83,
      total: 34.99,
      status: inv.status === "paid" ? "paid" : "issued",
    }).eq("id", inv.id);

    // 3. Branded OCCTA PDF -> private storage.
    const pdfBytes = buildInvoicePdfBytes({
      invoiceNumber: INVOICE_NUMBER,
      accountNumber: ACCOUNT,
      customerName: profile.full_name ?? "Customer",
      issueDate: "2026-07-25",
      dueDate,
      periodStart: "2026-07-25",
      periodEndExclusive: "2026-08-25",
      totals,
      isFirstInvoice: false,
    });
    const key = `${profile.id}/${inv.id}/${INVOICE_NUMBER}.pdf`;
    const up = await supabase.storage.from("invoice-pdfs")
      .upload(key, new Uint8Array(pdfBytes), { contentType: "application/pdf", upsert: true });
    if (up.error) return json({ error: "pdf_upload_failed", details: up.error.message }, 500);
    await supabase.from("invoices").update({ pdf_storage_key: key }).eq("id", inv.id);
    const { data: signed } = await supabase.storage.from("invoice-pdfs").createSignedUrl(key, 60 * 60 * 24 * 30);

    // 4. Cancel superseded DD setup links, issue one fresh 30-day link.
    const { data: oldPrs } = await supabase
      .from("payment_requests").select("id, payment_request_number, status")
      .eq("user_id", profile.id).eq("type", "dd_setup").neq("status", "completed");
    for (const p of oldPrs ?? []) {
      if (p.status !== "cancelled") {
        await supabase.from("payment_requests")
          .update({ status: "cancelled", archived_at: new Date().toISOString(), archived_reason: "superseded_by_new_dd_setup_link" })
          .eq("id", p.id);
      }
    }
    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const { data: newPr, error: prErr } = await supabase.from("payment_requests").insert({
      user_id: profile.id,
      account_number: ACCOUNT,
      type: "dd_setup",
      status: "sent",
      amount: 34.99,
      currency: "GBP",
      invoice_id: inv.id,
      due_date: dueDate,
      customer_email: profile.email,
      customer_name: profile.full_name,
      token_hash: await sha256Hex(token),
      expires_at: expires.toISOString(),
      notes: "Direct Debit mandate setup — invoice INV-2607-0005 (July 2026 recurring billing recovery)",
      metadata: { source: "recurring_billing_recovery_2026-07-25", invoice_id: inv.id, delivery_channel: "occta_transactional_email" },
    }).select("id, payment_request_number, expires_at").single();
    if (prErr) return json({ error: "dd_request_create_failed", details: prErr.message }, 500);

    return json({
      ok: true,
      invoice_id: inv.id,
      pdf_key: key,
      pdf_signed_url: signed?.signedUrl ?? null,
      dd_request: newPr,
      dd_url: `${APP_ORIGIN}/dd/setup?token=${token}`,
      cancelled_previous: (oldPrs ?? []).map((p) => p.payment_request_number),
      already_sent: alreadySent ?? null,
    });
  }

  if (action === "send") {
    if (alreadySent) {
      return json({ ok: true, skipped: "already_accepted_by_provider", log: alreadySent });
    }
    const ddUrl: string = body?.dd_url;
    const pdfUrl: string = body?.pdf_url;
    const ddRequestId: string = body?.dd_request_id;
    const ddRequestNumber: string = body?.dd_request_number ?? "";
    const ddExpiry: string = body?.dd_expiry ?? "";
    const dueDate: string = body?.due_date ?? "2026-08-13";
    if (!ddUrl || !pdfUrl || !ddRequestId) return json({ error: "missing_link_inputs" }, 400);

    const subject = `Your OCCTA invoice ${INVOICE_NUMBER} — £34.99 and Direct Debit setup`;
    const html_body = `
      <p>Here is your monthly OCCTA invoice that was originally due to be issued on <strong>25 July 2026</strong>.
      It was delayed by a fault in our billing run, so we are sending it now. Your price and your billing date have not changed,
      and no late fee, penalty or interest has been added.</p>

      <h3 style="margin:24px 0 8px">Invoice summary</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0">Invoice number</td><td style="padding:6px 0;text-align:right"><strong>${INVOICE_NUMBER}</strong></td></tr>
        <tr><td style="padding:6px 0">Issue date</td><td style="padding:6px 0;text-align:right">25 July 2026</td></tr>
        <tr><td style="padding:6px 0">Billing period</td><td style="padding:6px 0;text-align:right">25 July 2026 to 24 August 2026</td></tr>
        <tr><td style="padding:6px 0">Net</td><td style="padding:6px 0;text-align:right">£29.16</td></tr>
        <tr><td style="padding:6px 0">VAT (20%)</td><td style="padding:6px 0;text-align:right">£5.83</td></tr>
        <tr style="border-top:2px solid #0d0d0d"><td style="padding:10px 0"><strong>Total due (incl. VAT)</strong></td><td style="padding:10px 0;text-align:right"><strong>£34.99</strong></td></tr>
        <tr><td style="padding:6px 0">Payment due by</td><td style="padding:6px 0;text-align:right"><strong>${dueDate === "2026-08-13" ? "13 August 2026" : dueDate}</strong> (our standard 7-day terms)</td></tr>
      </table>

      <p><a href="${pdfUrl}"><strong>Download your invoice PDF</strong></a> (secure link, valid for 30 days).</p>

      <hr />
      <h3 style="margin:24px 0 8px">Please set up your Direct Debit</h3>
      <p>We would like to collect your monthly payments by Direct Debit. Please complete your mandate using the secure
      button below — it is valid for 30 days${ddExpiry ? ` (until ${ddExpiry})` : ""}.</p>
      <ul>
        <li>Future monthly payments will only be collected by Direct Debit <strong>once your mandate has been completed and activated</strong>.</li>
        <li>No Direct Debit will be taken until then, and <strong>no collection will be attempted immediately</strong>.</li>
        <li>We will always give you <strong>advance notice</strong> of the amount and date before any Direct Debit collection is taken.</li>
        <li>Your service billing date stays the <strong>25th of each month</strong>, and your monthly charge remains <strong>£34.99 including VAT</strong>.</li>
      </ul>

      <hr />
      <h3 style="margin:24px 0 8px">The Direct Debit Guarantee</h3>
      <p style="font-size:13px;color:#555">
        This Guarantee is offered by all banks and building societies that accept instructions to pay Direct Debits.
        If there are any changes to the amount, date or frequency of your Direct Debit, OCCTA Limited will notify you in advance
        of your account being debited or as otherwise agreed. If you ask OCCTA Limited to collect a payment, confirmation of the
        amount and date will be given to you at the time of the request. If an error is made in the payment of your Direct Debit,
        by OCCTA Limited or your bank or building society, you are entitled to a full and immediate refund of the amount paid
        from your bank or building society. If you receive a refund you are not entitled to, you must pay it back when
        OCCTA Limited asks you to. You can cancel a Direct Debit at any time by simply contacting your bank or building society.
        Written confirmation may be required. Please also notify us.
      </p>

      <hr />
      <p>Need a hand? Call us on <strong>0800 260 6626</strong> or email
      <a href="mailto:hello@occta.co.uk">hello@occta.co.uk</a> and we will help.</p>
      <p style="font-size:13px;color:#555">Account number: ${ACCOUNT}${ddRequestNumber ? ` · Direct Debit request: ${ddRequestNumber}` : ""}</p>
    `;

    const sendResp = await supabase.functions.invoke("send-email", {
      body: {
        type: "custom_admin",
        to: profile.email,
        invoiceId: inv.id,
        paymentRequestId: ddRequestId,
        logToCommunications: true,
        userId: profile.id,
        data: {
          subject,
          title: `Invoice ${INVOICE_NUMBER} & Direct Debit setup`,
          preheader: `Invoice ${INVOICE_NUMBER} — £34.99 for 25 Jul to 24 Aug 2026, plus your Direct Debit setup link.`,
          greeting: `Dear ${(profile.full_name ?? "Customer").split(" ")[0]}`,
          html_body,
          cta_text: "Complete your Direct Debit mandate",
          cta_url: ddUrl,
        },
      },
    });
    if (sendResp.error) {
      return json({ error: "email_failed", details: String((sendResp.error as any)?.message ?? sendResp.error) }, 502);
    }
    const r = sendResp.data as any;
    const messageId = r?.data?.data?.id ?? r?.data?.id ?? r?.id ?? null;
    if (!messageId) return json({ error: "no_provider_acceptance", response: r }, 502);

    // Provider accepted -> retag the log row for this template + mark invoice sent.
    const { data: logRow } = await supabase
      .from("communications_log")
      .select("id")
      .eq("invoice_id", inv.id).eq("provider_message_id", messageId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (logRow) {
      await supabase.from("communications_log").update({
        template_name: TEMPLATE,
        payment_request_id: ddRequestId,
        user_id: profile.id,
        metadata: {
          subject,
          invoice_number: INVOICE_NUMBER,
          dd_request_number: ddRequestNumber,
          dd_expires_at: ddExpiry,
          delivery_channel: "occta_transactional_email",
          worldpay_used: false,
        },
      }).eq("id", logRow.id);
    }

    await supabase.from("invoices").update({ status: "sent" }).eq("id", inv.id);

    await supabase.from("payment_request_events").insert({
      request_id: ddRequestId,
      event_type: "sent",
      metadata: { channel: "occta_transactional_email", invoice_number: INVOICE_NUMBER },
    });

    await supabase.from("audit_logs").insert({
      action: "invoice_late_issue_recovery",
      entity: "invoices",
      entity_id: inv.id,
      metadata: {
        invoice_number: INVOICE_NUMBER,
        reason: "Recurring billing job failed on 25 July 2026; invoice generated and delivered late.",
        original_issue_date_preserved: "2026-07-25",
        billing_period: "2026-07-25 to 2026-08-24",
        total: 34.99,
        due_date: dueDate,
        dd_request_number: ddRequestNumber,
        provider_message_id: messageId,
        worldpay_used: false,
        card_link_created: false,
      },
    });

    await supabase.from("activity_log").insert({
      actor_type: "system",
      customer_id: profile.id,
      invoice_id: inv.id,
      event_type: "invoice_late_issue_recovery",
      title: `Invoice ${INVOICE_NUMBER} issued late after failed recurring billing run`,
      details: "Original issue date 25 July 2026 preserved. Combined invoice + Direct Debit setup email sent via OCCTA transactional email. No late fee applied, no card payment link created.",
      source_module: "billing",
      severity: "info",
    });

    return json({ ok: true, provider_message_id: messageId, recipient: profile.email, subject, log_id: logRow?.id ?? null });
  }

  return json({ error: "unknown_action" }, 400);
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import { perfServe } from "../_shared/perfLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

async function sha256(s: string) {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" }); }
  catch { return iso ?? ""; }
}

function buildInvoicePdfBytes(args: {
  invoiceNumber: string; accountNumber: string; customerName: string;
  issueDate: string; dueDate: string;
  periodStart: string; periodEnd: string;
  lineDescription: string; total: number; isProRata: boolean;
}): Uint8Array {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(13,13,13); doc.rect(0,0,w,32,"F");
  doc.setTextColor(255,255,255); doc.setFontSize(20); doc.setFont("helvetica","bold");
  doc.text("OCCTA", 14, 20);
  doc.setFillColor(250,204,21); doc.rect(44, 11, 38, 13, "F");
  doc.setTextColor(13,13,13); doc.setFontSize(11); doc.text("TELECOM", 47, 20);
  doc.setTextColor(255,255,255); doc.setFontSize(14);
  doc.text("INVOICE", w - 14, 20, { align: "right" });

  let y = 46; doc.setTextColor(13,13,13); doc.setFontSize(9);
  doc.text(`Invoice #: ${args.invoiceNumber}`, 14, y);
  doc.text(`Account: ${args.accountNumber}`, 14, y + 6);
  doc.text(`Issue date: ${fmtDate(args.issueDate)}`, w - 14, y, { align: "right" });
  doc.text(`Due date: ${fmtDate(args.dueDate)}`, w - 14, y + 6, { align: "right" });

  y += 22; doc.setFontSize(10); doc.setFont("helvetica","bold");
  doc.text("Bill to", 14, y); doc.setFont("helvetica","normal");
  doc.text(args.customerName || "Customer", 14, y + 6);

  y += 22; doc.setFillColor(245,245,240); doc.rect(14, y, w - 28, 8, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(9);
  doc.text("Description", 18, y + 5);
  doc.text("Amount", w - 18, y + 5, { align: "right" });

  y += 12; doc.setFont("helvetica","normal");
  doc.text(args.lineDescription, 18, y);
  doc.text(`£${args.total.toFixed(2)}`, w - 18, y, { align: "right" });
  doc.text(`Period: ${fmtDate(args.periodStart)} – ${fmtDate(args.periodEnd)}${args.isProRata ? "  (pro-rata)" : ""}`,
           18, y + 6);

  y += 22; doc.setFillColor(13,13,13); doc.rect(14, y, w - 28, 10, "F");
  doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text("TOTAL DUE", 18, y + 7);
  doc.text(`£${args.total.toFixed(2)}`, w - 18, y + 7, { align: "right" });

  doc.setTextColor(102,102,102); doc.setFontSize(8); doc.setFont("helvetica","normal");
  doc.text("OCCTA Limited · Company No. 13828933 · 22 Pavilion View, Huddersfield, HD3 3WU",
           w / 2, 285, { align: "center" });

  return doc.output("arraybuffer") as unknown as Uint8Array;
}

function buildEmailHtml(args: {
  customerName: string; invoiceNumber: string; total: number;
  issueDate: string; dueDate: string;
  periodStart: string; periodEnd: string;
  payNowUrl: string | null; pdfUrl: string | null; dashboardUrl: string;
}) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111;background:#fff">
  <div style="max-width:600px;margin:0 auto;padding:24px;border:4px solid #111">
    <h1 style="font-size:22px;margin:0 0 12px">Your OCCTA invoice ${escapeHtml(args.invoiceNumber)}</h1>
    <p>Hi ${escapeHtml(args.customerName || "there")},</p>
    <p>Your first invoice is ready.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr><td style="padding:6px 0;color:#555">Invoice number</td><td style="text-align:right"><b>${escapeHtml(args.invoiceNumber)}</b></td></tr>
      <tr><td style="padding:6px 0;color:#555">Billing period</td><td style="text-align:right">${escapeHtml(fmtDate(args.periodStart))} – ${escapeHtml(fmtDate(args.periodEnd))}</td></tr>
      <tr><td style="padding:6px 0;color:#555">Issued</td><td style="text-align:right">${escapeHtml(fmtDate(args.issueDate))}</td></tr>
      <tr><td style="padding:6px 0;color:#555">Due</td><td style="text-align:right">${escapeHtml(fmtDate(args.dueDate))}</td></tr>
      <tr><td style="padding:6px 0;color:#555">Total due</td><td style="text-align:right"><b>£${args.total.toFixed(2)}</b></td></tr>
    </table>
    ${args.payNowUrl ? `<p style="text-align:center"><a href="${args.payNowUrl}" style="display:inline-block;background:#facc15;color:#111;padding:12px 24px;text-decoration:none;border:3px solid #111;font-weight:bold">Pay now</a></p>` : ""}
    <p>
      ${args.pdfUrl ? `<a href="${args.pdfUrl}">Download PDF</a> · ` : ""}
      <a href="${args.dashboardUrl}">Open dashboard</a>
    </p>
    <p style="font-size:12px;color:#666;margin-top:24px">Need help? Reply to this email or visit our Support page.</p>
  </div></body></html>`;
}

Deno.serve(perfServe("process-first-billing", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = req.headers.get("x-cron-secret");
  const expected = Deno.env.get("CRON_JOB_SECRET");
  const auth = req.headers.get("Authorization");
  if (!auth && cronSecret !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const appOrigin = Deno.env.get("PUBLIC_APP_ORIGIN") ?? "https://www.occta.co.uk";
  const dashboardUrl = `${appOrigin}/dashboard`;

  const { data: jobs, error } = await supabase
    .from("first_billing_jobs")
    .select("*")
    .in("status", ["pending", "retry_scheduled"])
    .lte("next_attempt_at", nowIso)
    .limit(25);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const job of jobs ?? []) {
    // Eligibility gate: only process jobs linked to a live canonical order,
    // an active service, a valid customer + payment method, not blocked,
    // not already invoiced for this period.
    const { data: eligible } = await supabase.rpc(
      "first_billing_job_is_eligible", { _job_id: job.id });
    if (!eligible) {
      results.push({ id: job.id, skipped: "not_eligible", blocker: job.blocker ?? null });
      continue;
    }

    // Claim.
    const { data: claimed } = await supabase
      .from("first_billing_jobs")
      .update({ status: "processing", attempts: (job.attempts ?? 0) + 1 })
      .eq("id", job.id)
      .in("status", ["pending", "retry_scheduled"])
      .select("id").maybeSingle();
    if (!claimed) { results.push({ id: job.id, skipped: true }); continue; }

    try {
      // Re-read canonical state (eligibility was already checked).
      const { data: ord } = await supabase
        .from("orders")
        .select("id, lifecycle_status, payment_method_id, customer_id, occta_order_number")
        .eq("id", job.order_id).maybeSingle();
      if (!ord || ord.lifecycle_status !== "live")
        throw new Error("order_not_live");

      const { data: svc } = await supabase.from("services")
        .select("id, status, plan_name, service_type, price_monthly, user_id")
        .eq("id", job.service_id).maybeSingle();
      if (!svc || svc.status !== "active") throw new Error("service_not_active");

      const { data: pm } = await supabase.from("payment_methods")
        .select("method, dd_setup_status, active")
        .eq("id", ord.payment_method_id!).maybeSingle();
      if (!pm) throw new Error("payment_method_missing");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, account_number")
        .eq("id", ord.customer_id!).maybeSingle();
      const recipientEmail = profile?.email ?? "";
      const customerName = profile?.full_name ?? "Customer";
      const accountNumber = profile?.account_number ?? "";
      if (!recipientEmail) throw new Error("customer_email_missing");

      // Compute amount in pence via DB helper (stays consistent with stored inputs).
      const { data: amtMinor } = await supabase.rpc("compute_first_billing_amount_minor", {
        _monthly_minor: job.amount_minor,
        _billable_days: job.billable_days,
        _full_cycle_days: job.full_cycle_days,
        _is_pro_rata: job.is_pro_rata,
      });
      const totalMinor = Number(amtMinor ?? job.amount_minor ?? 0);
      const total = Math.round(totalMinor) / 100;

      // Idempotency: only one invoice per (service, period, type='first_pro_rata'|'monthly').
      const invoiceType = job.is_pro_rata ? "first_pro_rata" : "monthly";
      const { data: existingInv } = await supabase
        .from("invoices")
        .select("id, invoice_number, status, pdf_storage_key, pdf_hash, email_sent_at")
        .eq("service_id", job.service_id)
        .eq("billing_period_start", job.period_start)
        .eq("billing_period_end", job.period_end)
        .eq("invoice_type", invoiceType)
        .maybeSingle();

      let invoiceId = existingInv?.id ?? job.invoice_id ?? null;
      let invoiceNumber = existingInv?.invoice_number ?? null;
      let invoiceStatus = existingInv?.status ?? null;
      let pdfStorageKey: string | null = existingInv?.pdf_storage_key ?? null;
      let pdfHash: string | null = existingInv?.pdf_hash ?? null;
      const alreadyEmailed = !!existingInv?.email_sent_at;

      if (!invoiceId) {
        const { data: invNumData } = await supabase.rpc("generate_invoice_number");
        invoiceNumber = invNumData || `INV-${Date.now().toString(36).toUpperCase()}`;

        // Always start as `draft` — promoted only after PDF + email succeed.
        invoiceStatus = "draft";

        const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 14);

        const { data: inv, error: invErr } = await supabase.from("invoices").insert({
          user_id: svc.user_id,
          service_id: job.service_id,
          order_id: job.order_id,
          invoice_number: invoiceNumber,
          status: invoiceStatus,
          issue_date: today,
          due_date: dueDate.toISOString().slice(0, 10),
          billing_period_start: job.period_start,
          billing_period_end: job.period_end,
          invoice_type: invoiceType,
          subtotal: total,
          vat_total: 0,
          total,
          pro_rata: {
            amount_minor: totalMinor,
            monthly_minor: job.amount_minor,
            billable_days: job.billable_days,
            full_cycle_days: job.full_cycle_days,
            is_pro_rata: job.is_pro_rata,
            calc_method: job.calc_method,
          },
          notes: job.is_pro_rata
            ? `First (pro-rata) invoice: ${job.billable_days} of ${job.full_cycle_days} days`
            : `First monthly invoice`,
        }).select("id").single();
        if (invErr) throw invErr;
        invoiceId = inv.id;

        await supabase.from("invoice_lines").insert({
          invoice_id: invoiceId,
          description: `${svc.plan_name ?? svc.service_type} — ${job.is_pro_rata ? "pro-rata " : ""}service (${job.period_start} to ${job.period_end})`,
          qty: 1,
          unit_price: total,
          line_total: total,
          vat_rate: 0,
        });
      }

      // -------- Invoice PDF (idempotent) --------
      if (!pdfStorageKey) {
        const pdfBytes = buildInvoicePdfBytes({
          invoiceNumber: invoiceNumber!, accountNumber, customerName,
          issueDate: today,
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0,10),
          periodStart: job.period_start, periodEnd: job.period_end,
          lineDescription: `${svc.plan_name ?? svc.service_type} — ${job.is_pro_rata ? "pro-rata " : "monthly"} service`,
          total, isProRata: !!job.is_pro_rata,
        });
        const buf = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes as any);
        const hashBuf = await crypto.subtle.digest("SHA-256", buf);
        pdfHash = Array.from(new Uint8Array(hashBuf))
          .map((b) => b.toString(16).padStart(2, "0")).join("");
        pdfStorageKey = `${svc.user_id}/${invoiceId}/${invoiceNumber}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("invoice-pdfs")
          .upload(pdfStorageKey, buf, { contentType: "application/pdf", upsert: true });
        if (upErr) throw new Error(`pdf_upload_failed:${upErr.message}`);
        await supabase.from("invoices").update({
          pdf_storage_key: pdfStorageKey,
          pdf_hash: pdfHash,
          pdf_generated_at: new Date().toISOString(),
        }).eq("id", invoiceId);
      }

      // -------- Branch on payment method (PR for invoice_link, task for DD-pending) --------
      let prId: string | null = job.payment_request_id ?? null;
      let ddTaskId: string | null = job.dd_setup_task_id ?? null;
      let payNowUrl: string | null = null;

      if (pm.method === "invoice_link") {
        if (!prId) {
          const { data: existingPR } = await supabase
            .from("payment_requests").select("id, provider_checkout_url")
            .eq("invoice_id", invoiceId).maybeSingle();
          if (existingPR) {
            prId = existingPR.id;
            payNowUrl = (existingPR as any).provider_checkout_url ?? null;
          } else {
            const token = crypto.randomUUID();
            const tokenHash = await sha256(token);
            const expires = new Date(); expires.setDate(expires.getDate() + 14);
            const { data: pr, error: prErr } = await supabase
              .from("payment_requests").insert({
                type: "card_payment",
                invoice_id: invoiceId,
                user_id: svc.user_id,
                customer_email: recipientEmail,
                customer_name: customerName,
                amount: total,
                currency: "GBP",
                status: "sent",
                expires_at: expires.toISOString(),
                token_hash: tokenHash,
                notes: `First invoice ${invoiceNumber}`,
              }).select("id, provider_checkout_url").single();
            if (prErr) throw prErr;
            prId = pr.id;
            payNowUrl = (pr as any).provider_checkout_url ?? `${appOrigin}/pay?token=${token}`;
          }
        }
      } else if (pm.method === "direct_debit") {
        if (pm.dd_setup_status !== "active" && !ddTaskId) {
          const { data: task } = await supabase.from("admin_tasks").insert({
            title: `Direct Debit setup pending for invoice ${invoiceNumber}`,
            description: `Customer's Direct Debit is not yet active for order ${ord.occta_order_number ?? job.order_id}. Issue a Worldpay fallback link if appropriate.`,
            priority: "high",
            status: "open",
            created_by: ord.customer_id ?? svc.user_id,
            related_customer_id: ord.customer_id ?? svc.user_id,
          }).select("id").maybeSingle();
          ddTaskId = task?.id ?? null;
        }
      }

      // -------- Promote invoice to ready_to_send before attempting email --------
      if (invoiceStatus === "draft") {
        await supabase.from("invoices").update({ status: "ready_to_send" }).eq("id", invoiceId);
        invoiceStatus = "ready_to_send";
      }

      // -------- Send invoice email (only if not already sent) --------
      let emailMessageId: string | null = null;
      if (!alreadyEmailed) {
        let pdfSignedUrl: string | null = null;
        if (pdfStorageKey) {
          const { data: signed } = await supabase.storage
            .from("invoice-pdfs").createSignedUrl(pdfStorageKey, 60 * 60 * 24 * 14);
          pdfSignedUrl = signed?.signedUrl ?? null;
        }
        const html = buildEmailHtml({
          customerName, invoiceNumber: invoiceNumber!, total,
          issueDate: today,
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0,10),
          periodStart: job.period_start, periodEnd: job.period_end,
          payNowUrl, pdfUrl: pdfSignedUrl, dashboardUrl,
        });
        const sendResp = await supabase.functions.invoke("send-email", {
          body: {
            to: recipientEmail,
            subject: `Your OCCTA invoice ${invoiceNumber}`,
            html,
            idempotencyKey: `invoice-first:${invoiceId}`,
          },
        });
        if (sendResp.error) {
          // Mark invoice email as failed (but keep PR and invoice intact, no duplicates).
          await supabase.from("invoices").update({
            email_error: String(sendResp.error.message || "send_failed").slice(0, 1000),
            email_attempts: (existingInv as any)?.email_attempts != null
              ? (existingInv as any).email_attempts + 1 : 1,
          }).eq("id", invoiceId);
          throw new Error("invoice_email_failed");
        }
        emailMessageId = (sendResp.data as any)?.message_id ?? null;

        // Email accepted -> mark invoice as sent + log.
        await supabase.from("invoices").update({
          status: "sent",
          email_sent_at: new Date().toISOString(),
          email_provider_message_id: emailMessageId,
          email_error: null,
        }).eq("id", invoiceId);

        await supabase.from("communications_log").insert({
          invoice_id: invoiceId,
          user_id: svc.user_id,
          payment_request_id: prId,
          template_name: "invoice_first_send",
          recipient_email: recipientEmail,
          status: "sent",
          provider_message_id: emailMessageId,
          sent_at: new Date().toISOString(),
          metadata: { invoice_number: invoiceNumber, total, is_pro_rata: !!job.is_pro_rata },
        });
      }

      await supabase.from("first_billing_jobs").update({
        status: "done",
        invoice_id: invoiceId,
        payment_request_id: prId,
        dd_setup_task_id: ddTaskId,
        processed_at: new Date().toISOString(),
        last_error: null,
      }).eq("id", job.id);

      results.push({ id: job.id, invoice_id: invoiceId, method: pm.method });
    } catch (e) {
      const attempts = (job.attempts ?? 0) + 1;
      const giveUp = attempts >= 6;
      const backoff = Math.min(120, Math.pow(2, attempts));
      const next = new Date(Date.now() + backoff * 60_000).toISOString();
      await supabase.from("first_billing_jobs").update({
        status: giveUp ? "failed" : "retry_scheduled",
        attempts,
        last_error: String((e as Error)?.message ?? e).slice(0, 1000),
        next_attempt_at: next,
      }).eq("id", job.id);
      results.push({ id: job.id, error: String((e as Error)?.message ?? e) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}));
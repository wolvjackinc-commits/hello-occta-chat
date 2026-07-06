import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { perfServe } from "../_shared/perfLog.ts";
import {
  itemiseInvoice,
  buildInvoicePdfBytes,
  computeProRataMinor,
  sha256Hex,
  type RawLine,
  type VatMode,
} from "../_shared/billingHelpers.ts";
import { assertServiceLive } from "../_shared/billingGate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(perfServe("process-first-billing", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = req.headers.get("x-cron-secret");
  const expected = Deno.env.get("CRON_JOB_SECRET");
  if (!expected || cronSecret !== expected) {
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

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB",
        { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    } catch { return iso; }
  };
  const fmtInclusivePeriod = (startIso: string, endExclusiveIso: string) => {
    const end = new Date(endExclusiveIso + "T00:00:00Z");
    end.setUTCDate(end.getUTCDate() - 1);
    return `${fmtDate(startIso)} to ${fmtDate(end.toISOString().slice(0, 10))}`;
  };

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
    // Eligibility helper skips rows with any non-null/manual_hold blocker.
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

      // Two-doc billing gate. No-op when flag off; blocks when service not
      // confirmed live, activation blocked pending review, or accepted
      // document hashes missing.
      const gate = await assertServiceLive({
        orderId: job.order_id,
        serviceId: job.service_id,
        supabaseUrl: Deno.env.get("SUPABASE_URL")!,
        serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      });
      if (!gate.allowed) throw new Error(`billing_gate_blocked:${gate.reason}`);

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

      // ── Compose invoice lines from job snapshot ──
      const vatMode: VatMode = (job.vat_mode as VatMode) ?? "inclusive";
      const vatRate = Number(job.vat_rate ?? 20);

      const proRataMinor = computeProRataMinor(
        Number(job.amount_minor),
        Number(job.billable_days),
        Number(job.full_cycle_days),
        !!job.is_pro_rata,
      );

      const rawLines: RawLine[] = [];
      if (proRataMinor > 0) {
        rawLines.push({
          description: `${svc.plan_name ?? svc.service_type} — ${job.is_pro_rata ? "pro-rata service" : "monthly service"}`,
          amount_minor: proRataMinor,
          period_label: job.is_pro_rata
            ? `${fmtInclusivePeriod(job.period_start, job.period_end)} · ${job.billable_days} of ${job.full_cycle_days} days`
            : `${fmtInclusivePeriod(job.period_start, job.period_end)}`,
        });
      }
      if (Number(job.activation_fee_minor) > 0) {
        rawLines.push({
          description: "Activation / setup fee",
          amount_minor: Number(job.activation_fee_minor),
          period_label: "One-off (per accepted Contract Summary)",
        });
      }
      const oneOffLines = Array.isArray(job.one_off_lines) ? job.one_off_lines : [];
      for (const l of oneOffLines) {
        const amt = Number(l?.amount_minor ?? 0);
        if (amt > 0) {
          rawLines.push({
            description: String(l?.label ?? "One-off charge"),
            amount_minor: amt,
            period_label: "One-off (per accepted Contract Summary)",
          });
        }
      }

      const totals = itemiseInvoice(rawLines, vatMode, vatRate);
      const totalMinor = totals.total_gross_minor;
      const total = totalMinor / 100;

      // Idempotency: unique per (service, period, invoice_type).
      const invoiceType = job.is_pro_rata ? "first_pro_rata" : "monthly";
      const { data: existingInv } = await supabase
        .from("invoices")
        .select("id, invoice_number, status, pdf_storage_key, pdf_hash, email_sent_at, email_attempts")
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
          subtotal: totals.subtotal_net_minor / 100,
          vat_total: totals.vat_total_minor / 100,
          vat_enabled: true,
          vat_rate: totals.vat_rate,
          total,
          pro_rata: {
            amount_minor: proRataMinor,
            monthly_minor: job.amount_minor,
            billable_days: job.billable_days,
            full_cycle_days: job.full_cycle_days,
            is_pro_rata: job.is_pro_rata,
            calc_method: job.calc_method,
            activation_fee_minor: job.activation_fee_minor ?? 0,
            one_off_charges_minor: job.one_off_charges_minor ?? 0,
            vat_mode: vatMode,
            vat_rate: totals.vat_rate,
            subtotal_net_minor: totals.subtotal_net_minor,
            vat_total_minor: totals.vat_total_minor,
            total_gross_minor: totals.total_gross_minor,
          },
          notes: job.is_pro_rata
            ? `First (pro-rata) invoice: ${job.billable_days} of ${job.full_cycle_days} days`
            : `First monthly invoice`,
        }).select("id").single();
        if (invErr) throw invErr;
        invoiceId = inv.id;

        const lineRows = totals.lines.map((l) => ({
          invoice_id: invoiceId,
          description: l.period_label ? `${l.description} (${l.period_label})` : l.description,
          qty: 1,
          unit_price: l.gross_minor / 100,
          line_total: l.gross_minor / 100,
          vat_rate: l.vat_rate,
        }));
        if (lineRows.length > 0) {
          await supabase.from("invoice_lines").insert(lineRows);
        }
      }

      // ── PDF (idempotent) ──
      if (!pdfStorageKey) {
        const pdfBytes = buildInvoicePdfBytes({
          invoiceNumber: invoiceNumber!, accountNumber, customerName,
          issueDate: today,
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          periodStart: job.period_start,
          periodEndExclusive: job.period_end,
          totals,
          isFirstInvoice: true,
        });
        const buf = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes as any);
        pdfHash = await sha256Hex(buf);
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

      // ── Branch on payment method ──
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
            const tokenHash = await sha256Hex(token);
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
        // Only mark as awaiting_dd_collection if a confirmed active mandate exists.
        // Never call the DD provider from this worker.
        const { data: activeMandate } = await supabase.from("dd_mandates")
          .select("id, status").eq("user_id", svc.user_id).eq("status", "active").maybeSingle();
        if (activeMandate && pm.dd_setup_status === "active") {
          await supabase.from("invoices").update({
            status: "awaiting_dd_collection",
          }).eq("id", invoiceId);
          invoiceStatus = "awaiting_dd_collection";
        } else if (!ddTaskId) {
          const { data: task } = await supabase.from("admin_tasks").insert({
            title: `DD not active for first invoice ${invoiceNumber}`,
            description: `Customer's Direct Debit mandate is not active for order ${ord.occta_order_number ?? job.order_id}. No provider collection has been attempted. Issue a Worldpay fallback link if appropriate.`,
            priority: "high",
            status: "open",
            created_by: ord.customer_id ?? svc.user_id,
            related_customer_id: ord.customer_id ?? svc.user_id,
          }).select("id").maybeSingle();
          ddTaskId = task?.id ?? null;
        }
      }

      if (invoiceStatus === "draft") {
        await supabase.from("invoices").update({ status: "ready_to_send" }).eq("id", invoiceId);
        invoiceStatus = "ready_to_send";
      }

      let emailMessageId: string | null = null;
      if (!alreadyEmailed) {
        let pdfSignedUrl: string | null = null;
        if (pdfStorageKey) {
          const { data: signed } = await supabase.storage
            .from("invoice-pdfs").createSignedUrl(pdfStorageKey, 60 * 60 * 24 * 14);
          pdfSignedUrl = signed?.signedUrl ?? null;
        }
        const dueDateStr = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
        const emailLines = totals.lines.map((l) => ({
          description: l.period_label ? `${l.description} (${l.period_label})` : l.description,
          qty: 1,
          line_total: l.gross_minor / 100,
        }));
        const sendResp = await supabase.functions.invoke("send-email", {
          body: {
            type: "invoice_sent",
            to: recipientEmail,
            invoiceId,
            logToCommunications: true,
            userId: svc.user_id,
            data: {
              customer_name: customerName,
              account_number: accountNumber,
              invoice_number: invoiceNumber,
              invoice_id: invoiceId,
              issue_date: fmtDate(today),
              due_date: fmtDate(dueDateStr),
              billing_period: fmtInclusivePeriod(job.period_start, job.period_end),
              lines: emailLines,
              subtotal: totals.subtotal_net_minor / 100,
              vat_total: totals.vat_total_minor / 100,
              total,
              pay_now_url: payNowUrl ?? `${appOrigin}/pay-invoice?id=${invoiceId}`,
              invoice_pdf_url: pdfSignedUrl,
              dashboard_url: dashboardUrl,
            },
          },
          headers: { "idempotency-key": `invoice-first:${invoiceId}` } as any,
        });
        if (sendResp.error) {
          await supabase.from("invoices").update({
            email_error: String(sendResp.error.message || "send_failed").slice(0, 1000),
            email_attempts: (existingInv as any)?.email_attempts != null
              ? (existingInv as any).email_attempts + 1 : 1,
          }).eq("id", invoiceId);
          throw new Error("invoice_email_failed");
        }
        emailMessageId = (sendResp.data as any)?.message_id ?? null;

        const nextStatus = invoiceStatus === "awaiting_dd_collection" ? "awaiting_dd_collection" : "sent";
        await supabase.from("invoices").update({
          status: nextStatus,
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

      results.push({ id: job.id, invoice_id: invoiceId, method: pm.method, total });
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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { perfServe } from "../_shared/perfLog.ts";
import {
  itemiseInvoice,
  buildInvoicePdfBytes,
  sha256Hex,
  nextAnchorBillingDate,
  poundsToMinor,
  type RawLine,
  type VatMode,
} from "../_shared/billingHelpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/**
 * Service-driven recurring monthly billing.
 * Called by the daily invoice-generation cron and by the legacy
 * generate-invoices delegate. Picks up services whose
 * `next_billing_date <= today`, creates one invoice per service per period
 * (guarded by the unique index `invoices_service_period_unique`),
 * generates a PDF, creates a Worldpay payment request for invoice_link
 * customers OR handles DD safely, sends one email, and advances
 * `services.next_billing_date` using the anchor helper (correctly handles
 * billing days 29/30/31 by clamping to the month's last valid day).
 */
Deno.serve(perfServe("process-recurring-billing", async (req) => {
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

  // Pull due active services. Limit per run to keep the function bounded.
  const { data: services, error } = await supabase
    .from("services")
    .select("id, user_id, order_id, service_type, plan_name, price_monthly, billing_anchor_day, next_billing_date, contract_summary_id, status, billing_enabled")
    .eq("status", "active")
    .eq("billing_enabled", true)
    .lte("next_billing_date", today)
    .not("next_billing_date", "is", null)
    .limit(100);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const svc of services ?? []) {
    try {
      const anchor = Number(svc.billing_anchor_day ?? 1);
      const periodStart = svc.next_billing_date as string;
      // period_end is exclusive = next anchor strictly after period_start.
      const dayAfterStart = (() => {
        const d = new Date(periodStart + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + 1);
        return d.toISOString().slice(0, 10);
      })();
      const periodEnd = nextAnchorBillingDate(dayAfterStart, anchor);

      // ── Determine VAT mode from accepted CS snapshot ──
      let vatMode: VatMode = "inclusive";
      let monthlyMinor = poundsToMinor(svc.price_monthly);
      if (svc.contract_summary_id) {
        const { data: cs } = await supabase.from("contract_summaries")
          .select("customer_type, monthly_price_incl_vat, business_monthly_ex_vat")
          .eq("id", svc.contract_summary_id).maybeSingle();
        if (cs?.customer_type === "business") {
          vatMode = "exclusive";
          monthlyMinor = poundsToMinor(cs.business_monthly_ex_vat ?? svc.price_monthly);
        } else {
          vatMode = "inclusive";
          monthlyMinor = poundsToMinor(cs?.monthly_price_incl_vat ?? svc.price_monthly);
        }
      }
      if (!monthlyMinor || monthlyMinor <= 0) {
        throw new Error("monthly_price_missing");
      }

      // Any existing non-cancelled invoice for this service/period/type wins.
      const invoiceType = "monthly";
      const { data: existingInv } = await supabase
        .from("invoices")
        .select("id, invoice_number, status, pdf_storage_key, email_sent_at")
        .eq("service_id", svc.id)
        .eq("billing_period_start", periodStart)
        .eq("billing_period_end", periodEnd)
        .eq("invoice_type", invoiceType)
        .neq("status", "cancelled")
        .maybeSingle();

      // Load customer + payment method context.
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, account_number")
        .eq("id", svc.user_id).maybeSingle();
      const recipientEmail = profile?.email ?? "";
      const customerName = profile?.full_name ?? "Customer";
      const accountNumber = profile?.account_number ?? "";
      if (!recipientEmail) throw new Error("customer_email_missing");

      let pmMethod: string | null = null;
      let ddStatus: string | null = null;
      if (svc.order_id) {
        const { data: ord } = await supabase.from("orders")
          .select("payment_method_id")
          .eq("id", svc.order_id).maybeSingle();
        if (ord?.payment_method_id) {
          const { data: pm } = await supabase.from("payment_methods")
            .select("method, dd_setup_status").eq("id", ord.payment_method_id).maybeSingle();
          pmMethod = pm?.method ?? null;
          ddStatus = pm?.dd_setup_status ?? null;
        }
      }

      const rawLines: RawLine[] = [
        {
          description: `${svc.plan_name ?? svc.service_type} — monthly service`,
          amount_minor: monthlyMinor,
          period_label: `${fmtInclusivePeriod(periodStart, periodEnd)} (billed in advance)`,
        },
      ];
      const totals = itemiseInvoice(rawLines, vatMode, 20);
      const total = totals.total_gross_minor / 100;

      let invoiceId = existingInv?.id ?? null;
      let invoiceNumber = existingInv?.invoice_number ?? null;
      let invoiceStatus = existingInv?.status ?? null;
      let pdfStorageKey: string | null = existingInv?.pdf_storage_key ?? null;
      const alreadyEmailed = !!existingInv?.email_sent_at;

      if (!invoiceId) {
        const { data: invNumData } = await supabase.rpc("generate_invoice_number");
        invoiceNumber = invNumData || `INV-${Date.now().toString(36).toUpperCase()}`;
        const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 14);
        invoiceStatus = "draft";

        const { data: inv, error: invErr } = await supabase.from("invoices").insert({
          user_id: svc.user_id,
          service_id: svc.id,
          order_id: svc.order_id,
          invoice_number: invoiceNumber,
          status: invoiceStatus,
          issue_date: today,
          due_date: dueDate.toISOString().slice(0, 10),
          billing_period_start: periodStart,
          billing_period_end: periodEnd,
          invoice_type: invoiceType,
          subtotal: totals.subtotal_net_minor / 100,
          vat_total: totals.vat_total_minor / 100,
          vat_enabled: true,
          vat_rate: totals.vat_rate,
          total,
          notes: `Monthly invoice for billing period ${periodStart} to ${periodEnd} (billed in advance)`,
        }).select("id").single();
        if (invErr) throw invErr;
        invoiceId = inv.id;

        await supabase.from("invoice_lines").insert(
          totals.lines.map((l) => ({
            invoice_id: invoiceId,
            description: l.period_label ? `${l.description} (${l.period_label})` : l.description,
            qty: 1,
            unit_price: l.gross_minor / 100,
            line_total: l.gross_minor / 100,
            vat_rate: l.vat_rate,
          })),
        );
      }

      // PDF (idempotent)
      if (!pdfStorageKey) {
        const pdfBytes = buildInvoicePdfBytes({
          invoiceNumber: invoiceNumber!, accountNumber, customerName,
          issueDate: today,
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          periodStart, periodEndExclusive: periodEnd, totals,
          isFirstInvoice: false,
        });
        const buf = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes as any);
        const pdfHash = await sha256Hex(buf);
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

      // Payment method branch
      let payNowUrl: string | null = null;
      if (pmMethod === "invoice_link") {
        const { data: existingPR } = await supabase
          .from("payment_requests").select("id, provider_checkout_url")
          .eq("invoice_id", invoiceId).maybeSingle();
        if (existingPR) {
          payNowUrl = (existingPR as any).provider_checkout_url ?? null;
        } else {
          const token = crypto.randomUUID();
          const tokenHash = await sha256Hex(token);
          const expires = new Date(); expires.setDate(expires.getDate() + 14);
          const { data: pr } = await supabase
            .from("payment_requests").insert({
              type: "card_payment",
              invoice_id: invoiceId,
              user_id: svc.user_id,
              customer_email: recipientEmail,
              customer_name: customerName,
              account_number: accountNumber,
              amount: total,
              currency: "GBP",
              status: "sent",
              expires_at: expires.toISOString(),
              token_hash: tokenHash,
              notes: `Monthly invoice ${invoiceNumber}`,
            }).select("id, provider_checkout_url").single();
          payNowUrl = (pr as any)?.provider_checkout_url ?? `${appOrigin}/pay?token=${token}`;
        }
      } else if (pmMethod === "direct_debit") {
        const { data: activeMandate } = await supabase.from("dd_mandates")
          .select("id, status").eq("user_id", svc.user_id).eq("status", "active").maybeSingle();
        if (activeMandate && ddStatus === "active") {
          await supabase.from("invoices").update({
            status: "awaiting_dd_collection",
          }).eq("id", invoiceId);
          invoiceStatus = "awaiting_dd_collection";
        } else {
          await supabase.from("admin_tasks").insert({
            title: `DD not active for monthly invoice ${invoiceNumber}`,
            description: `Customer's Direct Debit mandate is not active. Monthly invoice ${invoiceNumber} has been generated but no collection has been attempted. Issue a Worldpay fallback link if appropriate.`,
            priority: "high",
            status: "open",
            created_by: svc.user_id,
            related_customer_id: svc.user_id,
          });
        }
      }

      if (invoiceStatus === "draft") {
        await supabase.from("invoices").update({ status: "ready_to_send" }).eq("id", invoiceId);
        invoiceStatus = "ready_to_send";
      }

      // Email once
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
              billing_period: fmtInclusivePeriod(periodStart, periodEnd),
              lines: emailLines,
              subtotal: totals.subtotal_net_minor / 100,
              vat_total: totals.vat_total_minor / 100,
              total,
              pay_now_url: payNowUrl ?? `${appOrigin}/pay-invoice?id=${invoiceId}`,
              invoice_pdf_url: pdfSignedUrl,
              dashboard_url: dashboardUrl,
            },
          },
          headers: { "idempotency-key": `invoice-monthly:${invoiceId}` } as any,
        });
        if (sendResp.error) {
          await supabase.from("invoices").update({
            email_error: String(sendResp.error.message || "send_failed").slice(0, 1000),
          }).eq("id", invoiceId);
          throw new Error("invoice_email_failed");
        }
        const emailMessageId = (sendResp.data as any)?.message_id ?? null;
        const nextStatus = invoiceStatus === "awaiting_dd_collection" ? "awaiting_dd_collection" : "sent";
        await supabase.from("invoices").update({
          status: nextStatus,
          email_sent_at: new Date().toISOString(),
          email_provider_message_id: emailMessageId,
          email_error: null,
        }).eq("id", invoiceId);
      }

      // Advance cursor only after email accepted (or already emailed).
      await supabase.from("services").update({
        next_billing_date: periodEnd,
      }).eq("id", svc.id);

      // Keep billing_settings loosely in sync (informational only).
      await supabase.from("billing_settings").update({
        next_invoice_date: periodEnd,
        billing_day: anchor,
        billing_mode: "fixed_day",
        updated_at: new Date().toISOString(),
      }).eq("user_id", svc.user_id);

      results.push({ service_id: svc.id, invoice_id: invoiceId, total, period: `${periodStart}→${periodEnd}` });
    } catch (e) {
      results.push({ service_id: svc.id, error: String((e as Error)?.message ?? e) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}));
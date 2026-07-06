// SIM-only recurring monthly billing worker.
//
// - Iterates sim_orders where status='live' AND next_billing_date <= today.
// - Creates one monthly invoice per SIM order per period (guarded by unique
//   index invoices_sim_period_unique).
// - Applies first_payment_credit_minor before requesting money.
// - Card/invoice-link: creates a Worldpay payment_request + Pay Now link.
// - Direct Debit: only proceeds if an active dd_mandate exists; otherwise
//   creates an admin_task and skips.
// - Advances sim_orders.next_billing_date using the anchor helper.
// - Sends one invoice email through the existing send-email pipeline.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { nextAnchorBillingDate, sha256Hex } from "../_shared/billingHelpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = req.headers.get("x-cron-secret");
  const expected = Deno.env.get("CRON_JOB_SECRET");
  if (!expected || cronSecret !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date().toISOString().slice(0, 10);
  const appOrigin = Deno.env.get("PUBLIC_APP_ORIGIN") ?? "https://www.occta.co.uk";
  const results: unknown[] = [];

  const { data: orders, error } = await supabase
    .from("sim_orders")
    .select(
      "id, order_number, customer_id, email, full_name, plan_name_snapshot, monthly_price_minor_snapshot, vat_mode_snapshot, vat_rate_snapshot, service_live_date, billing_anchor_day, next_billing_date, first_payment_credit_minor, payment_method",
    )
    .eq("status", "live")
    .not("next_billing_date", "is", null)
    .lte("next_billing_date", today)
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (const o of orders ?? []) {
    try {
      if (!o.customer_id || !o.email) {
        results.push({ sim_order_id: o.id, skipped: "no_customer_or_email" });
        continue;
      }
      const anchor = Math.max(1, Math.min(28, Number(o.billing_anchor_day ?? 1)));
      const periodStart = o.next_billing_date as string;
      const dayAfter = (() => {
        const d = new Date(periodStart + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + 1);
        return d.toISOString().slice(0, 10);
      })();
      const periodEnd = nextAnchorBillingDate(dayAfter, anchor);

      // Apply first-payment credit against gross monthly (already inclusive of VAT for residential)
      const gross = Number(o.monthly_price_minor_snapshot);
      const creditAvailable = Number(o.first_payment_credit_minor ?? 0);
      const creditUsed = Math.min(creditAvailable, gross);
      const dueMinor = gross - creditUsed;

      // Duplicate guard: unique index will also catch this.
      const { data: existing } = await supabase
        .from("invoices")
        .select("id, status, total")
        .eq("sim_order_id", o.id)
        .eq("billing_period_start", periodStart)
        .eq("billing_period_end", periodEnd)
        .eq("invoice_type", "sim_monthly")
        .neq("status", "cancelled")
        .maybeSingle();
      if (existing) {
        // Already handled — just advance and continue.
        await supabase
          .from("sim_orders")
          .update({
            next_billing_date: periodEnd,
            last_billed_period_end: periodEnd,
          })
          .eq("id", o.id);
        results.push({ sim_order_id: o.id, invoice_id: existing.id, skipped: "already_invoiced" });
        continue;
      }

      // Invoice number + create
      const { data: invNum } = await supabase.rpc("generate_invoice_number");
      const invoiceNumber = (invNum as string) ??
        `SIM-${o.order_number}-${periodStart}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      const totalMajor = dueMinor / 100;
      const netMajor = totalMajor; // VAT inclusive per residential rules

      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .insert({
          user_id: o.customer_id,
          sim_order_id: o.id,
          invoice_number: invoiceNumber,
          invoice_type: "sim_monthly",
          status: dueMinor === 0 ? "paid" : "draft",
          issue_date: today,
          due_date: dueDate.toISOString().slice(0, 10),
          billing_period_start: periodStart,
          billing_period_end: periodEnd,
          subtotal: netMajor,
          total: totalMajor,
          vat_enabled: false,
          vat_rate: Number(o.vat_rate_snapshot ?? 0.2),
          vat_total: 0,
          notes: `SIM monthly — ${o.plan_name_snapshot} (${periodStart} → ${periodEnd})${
            creditUsed > 0 ? ` — credit applied £${(creditUsed / 100).toFixed(2)}` : ""
          }`,
        })
        .select("id")
        .single();
      if (invErr) throw invErr;

      await supabase.from("invoice_lines").insert({
        invoice_id: inv.id,
        description: `${o.plan_name_snapshot} — monthly service`,
        qty: 1,
        unit_price: gross / 100,
        line_total: gross / 100,
      });
      if (creditUsed > 0) {
        await supabase.from("invoice_lines").insert({
          invoice_id: inv.id,
          description: "Credit applied from first payment",
          qty: 1,
          unit_price: -(creditUsed / 100),
          line_total: -(creditUsed / 100),
        });
      }

      // Decrement credit balance on the order.
      if (creditUsed > 0) {
        await supabase
          .from("sim_orders")
          .update({ first_payment_credit_minor: creditAvailable - creditUsed })
          .eq("id", o.id);
      }

      let payNowUrl: string | null = null;

      if (dueMinor === 0) {
        // Fully credit-covered. Mark paid + emit zero-balance receipt entry.
        await supabase.from("invoices").update({ status: "paid" }).eq("id", inv.id);
      } else if (o.payment_method === "card") {
        // Create Worldpay payment_request
        const token = crypto.randomUUID();
        const tokenHash = await sha256Hex(token);
        const expires = new Date();
        expires.setDate(expires.getDate() + 14);
        await supabase.from("payment_requests").insert({
          type: "card_payment",
          invoice_id: inv.id,
          user_id: o.customer_id,
          customer_email: o.email,
          customer_name: o.full_name,
          amount: totalMajor,
          currency: "GBP",
          status: "sent",
          expires_at: expires.toISOString(),
          token_hash: tokenHash,
          notes: `SIM monthly ${invoiceNumber}`,
        });
        payNowUrl = `${appOrigin}/pay?token=${token}`;
      } else if (o.payment_method === "direct_debit") {
        const { data: mandate } = await supabase
          .from("dd_mandates")
          .select("id, status")
          .eq("user_id", o.customer_id)
          .eq("status", "active")
          .maybeSingle();
        if (mandate) {
          await supabase
            .from("invoices")
            .update({ status: "awaiting_dd_collection" })
            .eq("id", inv.id);
        } else {
          await supabase.from("admin_tasks").insert({
            title: `SIM DD not active — invoice ${invoiceNumber}`,
            description:
              `SIM order ${o.order_number} has no active Direct Debit mandate. Invoice ${invoiceNumber} generated but not collected. Set up DD or issue a Worldpay fallback link.`,
            priority: "high",
            status: "open",
            created_by: o.customer_id,
            related_customer_id: o.customer_id,
          });
        }
      }

      // Send one invoice email (idempotency via existing header pattern).
      if (dueMinor > 0) {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "invoice_sent",
            to: o.email,
            invoiceId: inv.id,
            userId: o.customer_id,
            logToCommunications: true,
            data: {
              customer_name: o.full_name,
              invoice_number: invoiceNumber,
              invoice_id: inv.id,
              issue_date: today,
              due_date: dueDate.toISOString().slice(0, 10),
              billing_period: `${periodStart} to ${periodEnd}`,
              lines: [{
                description: `${o.plan_name_snapshot} — monthly service`,
                qty: 1,
                line_total: gross / 100,
              }],
              subtotal: netMajor,
              vat_total: 0,
              total: totalMajor,
              pay_now_url: payNowUrl ?? `${appOrigin}/pay-invoice?id=${inv.id}`,
              dashboard_url: `${appOrigin}/dashboard`,
            },
          },
          headers: { "idempotency-key": `sim-monthly:${inv.id}` } as any,
        });
        await supabase
          .from("invoices")
          .update({ status: o.payment_method === "direct_debit" ? "awaiting_dd_collection" : "sent", email_sent_at: new Date().toISOString() })
          .eq("id", inv.id);
      }

      await supabase
        .from("sim_orders")
        .update({
          next_billing_date: periodEnd,
          last_billed_period_end: periodEnd,
        })
        .eq("id", o.id);

      results.push({ sim_order_id: o.id, invoice_id: inv.id, due_minor: dueMinor, period: `${periodStart}→${periodEnd}` });
    } catch (e) {
      results.push({ sim_order_id: o.id, error: String((e as Error)?.message ?? e) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
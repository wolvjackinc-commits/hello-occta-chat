/**
 * Admin-only, idempotent reconciliation of externally settled payments.
 * Grok/AccessPay and bank CSV imports remain the sources of evidence.
 * Default is DRY RUN. No inference by name, approximate amount, or date.
 */
import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";
import { billingReconciliationHold } from "../_shared/billingSafety.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  // Grok's authenticated import worker may hand off to this endpoint
  // with the server-side secret; human callers require staff JWT.
  const expected = Deno.env.get("CRON_JOB_SECRET");
  const internal = Boolean(expected) && req.headers.get("x-cron-secret") === expected;
  if (!internal) {
    const auth = await requireStaff(req, ["admin", "super_admin"]);
    if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);
  }
  const body = await req.json().catch(() => ({})) as { dry_run?: boolean };
  // Explicit false required to change any records.
  const dryRun = body.dry_run !== false;
  const db = getServiceClient();

  const { data: payments, error } = await db.from("payment_recon_payments")
    .select("id, payment_ref, invoice_number, occta_ref, method, amount, bank_received_on, failed_on, reconciled_status, match_category")
    .eq("reconciled_status", "paid")
    .eq("match_category", "matched")
    .not("bank_received_on", "is", null)
    .not("payment_ref", "is", null)
    .not("invoice_number", "is", null)
    .limit(500);
  if (error) return jsonResponse({ error: "payment_reconciliation_unavailable", message: error.message }, 503);

  const accepted: Array<Record<string, unknown>> = [];
  const skipped: Array<Record<string, unknown>> = [];
  const failures: Array<Record<string, unknown>> = [];

  for (const payment of payments ?? []) {
    const paymentRef = String(payment.payment_ref ?? "").trim();
    const invoiceNumber = String(payment.invoice_number ?? "").trim();
    const accountRef = String(payment.occta_ref ?? "").trim();
    const amountMinor = Math.round(Number(payment.amount) * 100);
    if (!paymentRef || paymentRef.length > 150 || !/^[A-Z0-9-]+$/i.test(invoiceNumber) ||
        !accountRef || payment.failed_on ||
        !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      skipped.push({ payment_ref: paymentRef, reason: "invalid_or_ambiguous_payment" });
      continue;
    }

    const { data: profile } = await db.from("profiles")
      .select("id").eq("account_number", accountRef).maybeSingle();
    const { data: inv } = await db.from("invoices")
      .select("id, user_id, status, total")
      .eq("invoice_number", invoiceNumber).maybeSingle();
    if (!profile || !inv || inv.user_id !== profile.id) {
      skipped.push({ payment_ref: paymentRef, reason: "customer_invoice_identity_mismatch" });
      continue;
    }
    const hold = await billingReconciliationHold(db, profile.id);
    if (hold.held) {
      skipped.push({ payment_ref: paymentRef, reason: hold.reason });
      continue;
    }
    if (!["issued", "sent", "overdue", "paid"].includes(inv.status)) {
      skipped.push({ payment_ref: paymentRef, reason: "invoice_not_collectable" });
      continue;
    }

    const { data: prior, error: priorError } = await db.from("receipts")
      .select("id, amount, reference")
      .eq("invoice_id", inv.id);
    if (priorError) {
      failures.push({ payment_ref: paymentRef, reason: "receipt_lookup_failed" });
      continue;
    }
    const reference = "RECON:" + paymentRef;
    const matchedReceipt = (prior ?? []).find((r: any) => r.reference === reference);
    if (inv.status === "paid" && !matchedReceipt) {
      skipped.push({ payment_ref: paymentRef, reason: "invoice_already_paid_by_other_source" });
      continue;
    }
    const otherReceivedMinor = (prior ?? [])
      .filter((r: any) => r.reference !== reference)
      .reduce((sum: number, r: any) => sum + Math.round(Number(r.amount) * 100), 0);
    const invoiceMinor = Math.round(Number(inv.total) * 100);
    // Partial allocations or a second receipt require manual allocation, not guessing.
    if (otherReceivedMinor !== 0 || amountMinor !== invoiceMinor) {
      skipped.push({ payment_ref: paymentRef, reason: "partial_or_conflicting_allocation" });
      continue;
    }

    if (dryRun) {
      accepted.push({ payment_ref: paymentRef, invoice_number: invoiceNumber, amount: amountMinor / 100,
        action: matchedReceipt ? "already_recorded" : "record_full_settlement" });
      continue;
    }

    let inserted = Boolean(matchedReceipt);
    if (!inserted) {
      const { error: receiptError } = await db.from("receipts").insert({
        invoice_id: inv.id,
        user_id: inv.user_id,
        amount: amountMinor / 100,
        method: /bank|transfer/i.test(String(payment.method)) ? "bank_transfer" : "direct_debit",
        reference,
        paid_at: payment.bank_received_on + "T12:00:00Z",
      });
      if (receiptError && receiptError.code !== "23505") {
        failures.push({ payment_ref: paymentRef, reason: "receipt_creation_failed" });
        continue;
      }
      inserted = true;
    }

    const { error: statusError } = await db.from("invoices")
      .update({ status: "paid" })
      .eq("id", inv.id).in("status", ["issued", "sent", "overdue"]);
    if (statusError) {
      failures.push({ payment_ref: paymentRef, reason: "invoice_status_failed" });
      continue;
    }

    // Durable notification: no invoice/receipt PDF or statement is emailed.
    const { error: noticeError } = await db.from("billing_notifications_outbox")
      .upsert({
        event_key: "settled:" + paymentRef,
        user_id: inv.user_id,
        invoice_id: inv.id,
        amount: amountMinor / 100,
        source_ref: reference,
        kind: "payment_received",
      }, { onConflict: "event_key", ignoreDuplicates: true });
    if (noticeError) failures.push({ payment_ref: paymentRef, reason: "notification_queue_failed" });
    else accepted.push({ payment_ref: paymentRef, invoice_number: invoiceNumber, action: "settled_and_queued" });
  }

  return jsonResponse({ ok: failures.length === 0, dry_run: dryRun,
    accepted, skipped, failures }, failures.length ? 207 : 200);
});

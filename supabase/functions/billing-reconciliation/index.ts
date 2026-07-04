import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";

/**
 * billing-reconciliation — read-only report + optional safe apply.
 *
 * Report mode returns one row per active service classifying its
 * billing state (OK, missing_first_invoice, missing_next_billing_date,
 * payment_link_missing, email_missing, manual_review). Apply mode
 * performs only deterministic fixes and is admin-only.
 *
 * Never edits historical invoices, never edits accepted Contract
 * Summaries, never creates duplicates.
 */

type Mode = "report" | "apply";

interface Body { mode?: Mode; service_ids?: string[]; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return jsonResponse({ error: "unauthenticated" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: who } = await userClient.auth.getUser();
  if (!who?.user) return jsonResponse({ error: "unauthenticated" }, 401);

  const svc = getServiceClient();
  const [a, sa, fa] = await Promise.all([
    svc.rpc("has_role", { _user_id: who.user.id, _role: "admin" }),
    svc.rpc("has_role", { _user_id: who.user.id, _role: "super_admin" }),
    svc.rpc("has_role", { _user_id: who.user.id, _role: "finance_admin" }),
  ]);
  if (!a.data && !sa.data && !fa.data) return jsonResponse({ error: "forbidden" }, 403);

  let body: Body = {};
  try { body = await req.json(); } catch { /* default */ }
  const mode: Mode = body.mode === "apply" ? "apply" : "report";

  // Pull active services + linked data.
  let q = svc.from("services")
    .select("id, user_id, order_id, status, actual_activation_date, next_billing_date, billing_anchor_day, billing_enabled, price_monthly, plan_name, contract_summary_id")
    .eq("status", "active");
  if (body.service_ids?.length) q = q.in("id", body.service_ids);
  const { data: services, error: svcErr } = await q;
  if (svcErr) return jsonResponse({ error: "services_query_failed", message: svcErr.message }, 500);

  const userIds = Array.from(new Set((services ?? []).map((s: any) => s.user_id)));
  const orderIds = Array.from(new Set((services ?? []).map((s: any) => s.order_id).filter(Boolean)));
  const csIds    = Array.from(new Set((services ?? []).map((s: any) => s.contract_summary_id).filter(Boolean)));

  const [profRes, ordRes, csRes] = await Promise.all([
    userIds.length ? svc.from("profiles").select("id, full_name, email, account_number").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
    orderIds.length ? svc.from("orders").select("id, occta_order_number, payment_method, payment_method_id, lifecycle_status").in("id", orderIds) : Promise.resolve({ data: [] as any[] }),
    csIds.length ? svc.from("contract_summaries").select("id, accepted_at, pdf_storage_key, pdf_hash").in("id", csIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const profileById = new Map((profRes.data ?? []).map((p: any) => [p.id, p]));
  const orderById   = new Map((ordRes.data ?? []).map((o: any) => [o.id, o]));
  const csById      = new Map((csRes.data ?? []).map((c: any) => [c.id, c]));

  const rows: any[] = [];
  let autoFixed = 0;

  for (const s of services ?? []) {
    const profile = profileById.get((s as any).user_id);
    const order = (s as any).order_id ? orderById.get((s as any).order_id) : null;
    const cs = (s as any).contract_summary_id ? csById.get((s as any).contract_summary_id) : null;

    const [invRes, prRes, fbRes] = await Promise.all([
      svc.from("invoices")
        .select("id, invoice_number, issue_date, status, total, billing_period_start, billing_period_end, invoice_type, email_sent_at")
        .eq("service_id", (s as any).id)
        .order("issue_date", { ascending: true }),
      svc.from("payment_requests").select("id, invoice_id, status").eq("user_id", (s as any).user_id),
      svc.from("first_billing_jobs").select("id, status, blocker, invoice_id").eq("service_id", (s as any).id),
    ]);
    const invoices = invRes.data ?? [];
    const firstInvoice = invoices[0] ?? null;
    const lastInvoice = invoices[invoices.length - 1] ?? null;
    const paymentRequests = prRes.data ?? [];
    const firstBillingJobs = fbRes.data ?? [];

    const paymentMethod = order?.payment_method ?? null;
    const activationDate = (s as any).actual_activation_date ?? null;
    const nextBillingDate = (s as any).next_billing_date ?? null;
    const anchor = (s as any).billing_anchor_day ?? null;
    const monthlyPrice = (s as any).price_monthly ?? null;

    const missingFirstInvoice = invoices.length === 0;
    const missingNextBillingDate = !nextBillingDate && !!activationDate && !!anchor;
    const missingPaymentRequest = paymentMethod === "invoice_link" && !!firstInvoice && !paymentRequests.some((pr: any) => pr.invoice_id === firstInvoice.id);
    const missingEmail = !!firstInvoice && !firstInvoice.email_sent_at;

    let classification = "ok";
    let recommended = "None";
    if (!activationDate)                { classification = "manual_review"; recommended = "Missing actual_activation_date — admin must confirm live"; }
    else if (!cs)                       { classification = "manual_review"; recommended = "Service is not linked to a Contract Summary"; }
    else if (!cs?.pdf_hash)             { classification = "manual_review"; recommended = "Accepted CS PDF/hash missing"; }
    else if (!paymentMethod)            { classification = "manual_review"; recommended = "Payment method not captured on order"; }
    else if (missingFirstInvoice)       { classification = "missing_first_invoice"; recommended = "Enqueue/unblock first-billing job"; }
    else if (missingNextBillingDate)    { classification = "recurring_schedule_missing"; recommended = "Backfill services.next_billing_date"; }
    else if (missingPaymentRequest)     { classification = "payment_link_missing"; recommended = "Create Worldpay payment_request for existing invoice"; }
    else if (missingEmail)              { classification = "email_missing"; recommended = "Re-send invoice email (idempotent)"; }

    const safeToAutoFix =
      classification !== "ok" &&
      classification !== "manual_review" &&
      !!activationDate &&
      !!cs?.pdf_hash &&
      !!monthlyPrice &&
      !!paymentMethod &&
      !!anchor;

    let applied: string | null = null;
    if (mode === "apply" && safeToAutoFix) {
      try {
        if (classification === "recurring_schedule_missing") {
          // Next anchor strictly after activation.
          const act = new Date(activationDate + "T00:00:00Z");
          const year = act.getUTCFullYear();
          const month = act.getUTCMonth();
          const monthEnd = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
          let next: Date;
          if (anchor > act.getUTCDate() && anchor <= monthEnd) {
            next = new Date(Date.UTC(year, month, anchor));
          } else {
            const nMonthEnd = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
            next = new Date(Date.UTC(year, month + 1, Math.min(anchor, nMonthEnd)));
          }
          await svc.from("services").update({ next_billing_date: next.toISOString().slice(0, 10) }).eq("id", (s as any).id);
          applied = "next_billing_date_backfilled";
          autoFixed++;
        } else if (classification === "missing_first_invoice") {
          const blockedJob = firstBillingJobs.find((j: any) => j.status !== "done" && j.blocker);
          if (blockedJob) {
            await svc.from("first_billing_jobs").update({ blocker: null, status: "pending", next_attempt_at: new Date().toISOString() }).eq("id", blockedJob.id);
            applied = "first_billing_job_unblocked";
            autoFixed++;
          }
          // Do NOT create new first_billing_jobs from here — that is the job of confirm-service-live.
        }
        // Payment link + email fixes are intentionally left to the existing process-first-billing worker
        // to guarantee identical PDF hashing, idempotency key format, and email template contract.
      } catch (e) {
        applied = `error:${(e as Error).message}`;
      }
    }

    rows.push({
      account_number: profile?.account_number ?? null,
      customer_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      order_number: order?.occta_order_number ?? null,
      order_status: order?.lifecycle_status ?? null,
      service_id: (s as any).id,
      service_status: (s as any).status,
      actual_activation_date: activationDate,
      contract_summary_id: (s as any).contract_summary_id,
      monthly_price: monthlyPrice,
      payment_method: paymentMethod,
      billing_anchor_day: anchor,
      next_billing_date: nextBillingDate,
      first_invoice: firstInvoice ? {
        number: firstInvoice.invoice_number, total: firstInvoice.total,
        status: firstInvoice.status, issue_date: firstInvoice.issue_date,
        period: `${firstInvoice.billing_period_start} → ${firstInvoice.billing_period_end}`,
      } : null,
      last_invoice_period: lastInvoice ? `${lastInvoice.billing_period_start} → ${lastInvoice.billing_period_end}` : null,
      classification, recommended,
      safe_to_auto_fix: safeToAutoFix,
      applied,
    });
  }

  const summary = {
    total: rows.length,
    ok: rows.filter(r => r.classification === "ok").length,
    manual_review: rows.filter(r => r.classification === "manual_review").length,
    auto_fixable: rows.filter(r => r.safe_to_auto_fix).length,
    auto_fixed: autoFixed,
  };

  return jsonResponse({ mode, summary, rows });
});
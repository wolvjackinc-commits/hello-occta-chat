// verify-live-billing-chain
//
// Idempotent post-activation safety net. Runs in three modes:
//   - "report" (default): read-only, classifies every recent live broadband
//                         service. No writes.
//   - "fix":    applies ONLY deterministic safe fixes and creates admin
//               tasks for anything ambiguous.
//   - "single": scoped to one service_id (used by confirm-service-live
//               post-check kickoff).
//
// Callable by:
//   - Admin/super_admin/finance_admin JWT (from UI).
//   - Cron: header `x-cron-secret: <CRON_JOB_SECRET>` (no JWT needed).
//   - Internal service_role kickoff from confirm-service-live.
//
// Guardrails (hard):
//   - Never creates duplicate invoices, payment requests, welcome emails
//     or receipts.
//   - Never edits paid invoices, signed Contract Summaries, DD encryption,
//     Worldpay webhook state, cancellation, SIM.
//   - Suspended services, missing accepted CS, DD mandate missing, or
//     any conflict → admin_task only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";

type Mode = "report" | "fix" | "single";

interface Body {
  mode?: Mode;
  service_id?: string;
  lookback_days?: number;
  include_archived?: boolean;
}

type Classification =
  | "ok"
  | "missing_welcome_email"
  | "missing_order_live_timestamp"
  | "missing_service_live_timestamp"
  | "missing_first_billing_job"
  | "first_billing_job_failed"
  | "first_billing_job_blocked"
  | "missing_first_invoice"
  | "missing_payment_request"
  | "dd_mandate_not_active"
  | "missing_next_billing_date"
  | "recurring_not_ready"
  | "manual_review_required"
  | "manual_review_missing_order_link"
  | "contract_summary_not_accepted"
  | "profile_archived";

interface Row {
  service_id: string;
  order_id: string | null;
  order_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  account_number: string | null;
  email: string | null;
  service_status: string | null;
  billing_enabled: boolean;
  payment_method: string | null;
  actual_activation_date: string | null;
  order_live_at: string | null;
  service_live_confirmed_at: string | null;
  contract_summary_accepted: boolean;
  monthly_price_incl_vat: number | null;
  billing_anchor_day: number | null;
  next_billing_date: string | null;
  first_invoice_id: string | null;
  first_invoice_status: string | null;
  first_invoice_paid: boolean;
  payment_request_id: string | null;
  payment_request_status: string | null;
  welcome_email_status: string | null;
  first_billing_job_status: string | null;
  first_billing_job_blocker: string | null;
  dd_mandate_status: string | null;
  classifications: Classification[];
  recommended: string[];
  applied: string[];
  admin_task_created: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  // Auth: either admin JWT OR cron secret OR internal service kickoff.
  const cronSecret = req.headers.get("x-cron-secret");
  const isCron = !!cronSecret && cronSecret === Deno.env.get("CRON_JOB_SECRET");
  const isInternal = req.headers.get("x-internal-kickoff") === (Deno.env.get("CRON_JOB_SECRET") ?? "__none__");

  const svc = getServiceClient();

  let actorId: string | null = null;
  if (!isCron && !isInternal) {
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
    actorId = who.user.id;
    const [a, sa, fa] = await Promise.all([
      svc.rpc("has_role", { _user_id: actorId, _role: "admin" }),
      svc.rpc("has_role", { _user_id: actorId, _role: "super_admin" }),
      svc.rpc("has_role", { _user_id: actorId, _role: "finance_admin" }),
    ]);
    if (!a.data && !sa.data && !fa.data) return jsonResponse({ error: "forbidden" }, 403);
  }

  let body: Body = {};
  try { body = await req.json(); } catch { /* default */ }
  const mode: Mode = body.mode === "fix" ? "fix" : body.mode === "single" ? "single" : "report";
  const lookbackDays = Math.max(1, Math.min(365, body.lookback_days ?? 120));
  const includeArchived = !!body.include_archived;

  // Load target service set.
  let servicesQ = svc.from("services")
    .select("id, user_id, order_id, status, actual_activation_date, activation_confirmed_at, billing_enabled, billing_anchor_day, next_billing_date, contract_summary_id, service_type, archived_at, created_at")
    .is("archived_at", null);

  if (mode === "single") {
    if (!body.service_id) return jsonResponse({ error: "missing_service_id" }, 400);
    servicesQ = servicesQ.eq("id", body.service_id);
  } else {
    // Canonical Live Chain Check target: real, non-archived, currently-billable
    // customer services. We deliberately DO NOT restrict by service_type — any
    // real billable service (broadband, landline, etc.) belongs in production
    // readiness. Archived/test profiles are filtered post-query.
    servicesQ = servicesQ.in("status", ["active", "suspended"]);
  }

  const { data: services, error: svcErr } = await servicesQ;
  if (svcErr) return jsonResponse({ error: "services_query_failed", message: svcErr.message }, 500);

  // Filter out services belonging to archived profiles (test/archived customers)
  // unless the caller explicitly asked to include them.
  let scopedServices = services ?? [];
  if (scopedServices.length && !includeArchived && mode !== "single") {
    const userIds = Array.from(new Set(scopedServices.map((s: any) => s.user_id).filter(Boolean)));
    if (userIds.length) {
      const { data: profs } = await svc.from("profiles")
        .select("id, archived_at")
        .in("id", userIds);
      const archived = new Set((profs ?? []).filter((p: any) => p.archived_at).map((p: any) => p.id));
      scopedServices = scopedServices.filter((s: any) => !archived.has(s.user_id));
    }
  }

  const rows: Row[] = [];
  const summary = {
    total: 0, ok: 0,
    auto_fixed: 0,
    manual_review: 0,
    missing_welcome: 0,
    missing_first_invoice: 0,
    missing_payment_link: 0,
    missing_next_billing_date: 0,
    dd_mandate_not_active: 0,
    recurring_ready: 0,
    recurring_not_ready: 0,
  };

  for (const s of scopedServices) {
    summary.total++;

    const row: Row = {
      service_id: s.id,
      order_id: (s as any).order_id ?? null,
      order_number: null,
      customer_id: (s as any).user_id ?? null,
      customer_name: null,
      account_number: null,
      email: null,
      service_status: (s as any).status ?? null,
      billing_enabled: !!(s as any).billing_enabled,
      payment_method: null,
      actual_activation_date: (s as any).actual_activation_date ?? null,
      order_live_at: null,
      service_live_confirmed_at: (s as any).activation_confirmed_at ?? null,
      contract_summary_accepted: false,
      monthly_price_incl_vat: null,
      billing_anchor_day: (s as any).billing_anchor_day ?? null,
      next_billing_date: (s as any).next_billing_date ?? null,
      first_invoice_id: null,
      first_invoice_status: null,
      first_invoice_paid: false,
      payment_request_id: null,
      payment_request_status: null,
      welcome_email_status: null,
      first_billing_job_status: null,
      first_billing_job_blocker: null,
      dd_mandate_status: null,
      classifications: [],
      recommended: [],
      applied: [],
      admin_task_created: false,
    };

    // Order
    let order: any = null;
    if (row.order_id) {
      const { data } = await svc.from("orders")
        .select("id, occta_order_number, customer_id, payment_method, actual_service_live_at_utc, actual_activation_date, preferred_billing_anchor_day, contract_summary_id, status")
        .eq("id", row.order_id).maybeSingle();
      order = data;
      row.order_number = order?.occta_order_number ?? null;
      row.customer_id = order?.customer_id ?? row.customer_id;
      row.payment_method = order?.payment_method ?? null;
      row.order_live_at = order?.actual_service_live_at_utc ?? null;
    } else if (row.customer_id) {
      // Fallback: look for a single deterministic order for this customer with
      // an accepted Contract Summary. If exactly one match, we can safely link
      // it in fix mode. Otherwise classify manual_review_missing_order_link.
      const { data: candidates } = await svc.from("orders")
        .select("id, occta_order_number, payment_method, actual_service_live_at_utc, contract_summary_id, status")
        .eq("customer_id", row.customer_id)
        .not("contract_summary_id", "is", null);
      const withCs = candidates ?? [];
      if (withCs.length === 1) {
        order = withCs[0];
        row.order_id = order.id;
        row.order_number = order.occta_order_number ?? null;
        row.payment_method = order.payment_method ?? null;
        row.order_live_at = order.actual_service_live_at_utc ?? null;
        if (mode === "fix" || mode === "single") {
          const { error } = await svc.from("services")
            .update({ order_id: order.id })
            .eq("id", s.id)
            .is("order_id", null);
          if (!error) row.applied.push("service_order_link_repaired");
        }
      }
    }

    // Profile
    if (row.customer_id) {
      const { data: prof } = await svc.from("profiles")
        .select("full_name, email, account_number")
        .eq("id", row.customer_id).maybeSingle();
      row.customer_name = prof?.full_name ?? null;
      row.email = prof?.email ?? null;
      row.account_number = prof?.account_number ?? null;
    }

    // Contract summary
    const csId = (s as any).contract_summary_id ?? order?.contract_summary_id ?? null;
    if (csId) {
      const { data: cs } = await svc.from("contract_summaries")
        .select("id, status, accepted_at, monthly_price_incl_vat")
        .eq("id", csId).maybeSingle();
      row.contract_summary_accepted = cs?.status === "accepted" && !!cs?.accepted_at;
      row.monthly_price_incl_vat = cs?.monthly_price_incl_vat ?? null;
    }

    // Welcome email
    const { data: welcome } = await svc.from("service_activation_outbox")
      .select("status")
      .eq("service_id", s.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    row.welcome_email_status = (welcome as any)?.status ?? null;

    // First billing job
    const { data: fbj } = await svc.from("first_billing_jobs")
      .select("id, status, blocker, last_error")
      .eq("service_id", s.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    row.first_billing_job_status = (fbj as any)?.status ?? null;
    row.first_billing_job_blocker = (fbj as any)?.blocker ?? null;

    // First invoice
    if (row.order_id) {
      const { data: inv } = await svc.from("invoices")
        .select("id, status, total")
        .eq("order_id", row.order_id)
        .eq("service_id", s.id)
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      row.first_invoice_id = (inv as any)?.id ?? null;
      row.first_invoice_status = (inv as any)?.status ?? null;
      row.first_invoice_paid = row.first_invoice_status === "paid";
    }

    // Payment request for that invoice
    if (row.first_invoice_id) {
      const { data: pr } = await svc.from("payment_requests")
        .select("id, status, expires_at")
        .eq("invoice_id", row.first_invoice_id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      row.payment_request_id = (pr as any)?.id ?? null;
      row.payment_request_status = (pr as any)?.status ?? null;
    }

    // DD mandate
    if (row.customer_id) {
      const { data: dd } = await svc.from("dd_mandates")
        .select("status")
        .eq("user_id", row.customer_id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      row.dd_mandate_status = (dd as any)?.status ?? null;
    }

    // ------- classification -------
    const status = row.service_status;
    const isLive = status === "active";
    const isSuspended = status === "suspended";

    // Any service in this scope must be live/suspended and have activation date.
    if (!row.actual_activation_date) {
      row.classifications.push("missing_service_live_timestamp");
    }
    // Priority 1 guard visibility: any live/suspended service without an
    // accepted Contract Summary is invalid and must not auto-fix or bill.
    if (!row.contract_summary_accepted) {
      row.classifications.push("contract_summary_not_accepted");
      row.recommended.push("Contract Summary not accepted — order/service cannot proceed. Manual review required.");
    }
    if (!row.order_live_at && row.actual_activation_date) {
      row.classifications.push("missing_order_live_timestamp");
      row.recommended.push("Backfill orders.actual_service_live_at_utc from service activation date.");
    }
    if (row.welcome_email_status !== "sent" && row.welcome_email_status !== "processed" && row.welcome_email_status !== "queued") {
      row.classifications.push("missing_welcome_email");
    }
    if (!row.first_billing_job_status) {
      row.classifications.push("missing_first_billing_job");
    } else if (row.first_billing_job_status === "failed") {
      row.classifications.push("first_billing_job_failed");
    } else if (row.first_billing_job_blocker && row.first_billing_job_status === "pending") {
      row.classifications.push("first_billing_job_blocked");
    }
    if (!row.first_invoice_id && !isSuspended && row.first_billing_job_status !== "pending") {
      row.classifications.push("missing_first_invoice");
    }
    if (row.first_invoice_id && !row.first_invoice_paid && row.payment_method === "invoice_link" && !row.payment_request_id) {
      row.classifications.push("missing_payment_request");
    }
    if (row.payment_method === "direct_debit" && row.dd_mandate_status !== "active") {
      row.classifications.push("dd_mandate_not_active");
    }
    if (!row.next_billing_date) {
      row.classifications.push("missing_next_billing_date");
    }
    // Recurring ready = active, billing_enabled, next_billing_date, actionable payment method, no blocker.
    const recurringReady =
      isLive &&
      row.billing_enabled &&
      !!row.next_billing_date &&
      row.contract_summary_accepted &&
      (row.payment_method === "invoice_link" || row.payment_method === "direct_debit") &&
      !row.first_billing_job_blocker &&
      row.first_billing_job_status !== "failed" &&
      row.classifications.every(c => c === "ok");
    if (!recurringReady) {
      if (isLive) row.classifications.push("recurring_not_ready");
      summary.recurring_not_ready++;
    } else {
      summary.recurring_ready++;
    }

    if (row.classifications.length === 0) {
      row.classifications.push("ok");
      summary.ok++;
    }

    if (row.classifications.includes("missing_welcome_email")) summary.missing_welcome++;
    if (row.classifications.includes("missing_first_invoice")) summary.missing_first_invoice++;
    if (row.classifications.includes("missing_payment_request")) summary.missing_payment_link++;
    if (row.classifications.includes("missing_next_billing_date")) summary.missing_next_billing_date++;
    if (row.classifications.includes("dd_mandate_not_active")) summary.dd_mandate_not_active++;

    // ------- safe deterministic fixes (fix + single modes only) -------
    const canFix = (mode === "fix" || mode === "single") && !row.first_invoice_paid;
    const isKnownManual =
      isSuspended ||
      !row.contract_summary_accepted ||
      !row.actual_activation_date;

    if (canFix && !isKnownManual) {
      // 1. Backfill order live timestamp.
      if (row.classifications.includes("missing_order_live_timestamp") && row.order_id && row.actual_activation_date) {
        const stamp = row.service_live_confirmed_at ?? `${row.actual_activation_date}T00:00:00Z`;
        const { error } = await svc.from("orders")
          .update({ actual_service_live_at_utc: stamp })
          .eq("id", row.order_id)
          .is("actual_service_live_at_utc", null);
        if (!error) { row.applied.push("order_live_timestamp_backfilled"); row.order_live_at = stamp; }
      }

      // 2. Clear stale awaiting_billing_engine_handover blocker when data is complete
      //    AND payment_method is invoice_link (DD requires an active mandate).
      if (
        row.first_billing_job_blocker === "awaiting_billing_engine_handover" &&
        row.contract_summary_accepted &&
        row.actual_activation_date &&
        row.monthly_price_incl_vat &&
        row.billing_anchor_day &&
        row.payment_method === "invoice_link"
      ) {
        const { data: job } = await svc.from("first_billing_jobs")
          .select("id").eq("service_id", s.id)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if ((job as any)?.id) {
          const { error } = await svc.from("first_billing_jobs")
            .update({ blocker: null, next_attempt_at: new Date().toISOString() })
            .eq("id", (job as any).id)
            .eq("blocker", "awaiting_billing_engine_handover");
          if (!error) row.applied.push("first_billing_job_blocker_cleared");
        }
      }

      // 3. Set missing next_billing_date on service (deterministic from anchor).
      if (
        row.classifications.includes("missing_next_billing_date") &&
        row.actual_activation_date &&
        row.billing_anchor_day
      ) {
        const d = new Date(row.actual_activation_date + "T00:00:00Z");
        // Next billing = following month's anchor day.
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth() + 1;
        const lastDayNext = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        const day = Math.min(row.billing_anchor_day, lastDayNext);
        const next = new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);
        const { error } = await svc.from("services")
          .update({ next_billing_date: next })
          .eq("id", s.id).is("next_billing_date", null);
        if (!error) { row.applied.push("next_billing_date_backfilled"); row.next_billing_date = next; }
      }

      if (row.applied.length > 0) summary.auto_fixed++;
    }

    // ------- admin task creation for non-safe cases -------
    const needsAdminTask =
      !row.first_invoice_paid && (
        (isSuspended && !!row.first_billing_job_blocker) ||
        row.classifications.includes("dd_mandate_not_active") ||
        row.classifications.includes("first_billing_job_failed") ||
        (row.classifications.includes("first_billing_job_blocked") && row.applied.length === 0) ||
        (row.classifications.includes("missing_first_invoice") && isLive && row.applied.length === 0 && !row.first_billing_job_blocker) ||
        (row.classifications.includes("missing_payment_request") && row.applied.length === 0)
      );

    if ((mode === "fix" || mode === "single") && needsAdminTask) {
      const title = `Billing chain: ${row.order_number ?? row.service_id} — ${row.classifications.filter(c => c !== "ok").join(", ")}`;
      // Idempotent by title+account+service — check for open existing task.
      const { data: existing } = await svc.from("admin_tasks")
        .select("id")
        .eq("title", title)
        .in("status", ["open", "in_progress"])
        .limit(1).maybeSingle();
      if (!existing) {
        const { error } = await svc.from("admin_tasks").insert({
          title,
          description: [
            `Service ${row.service_id}`,
            `Order ${row.order_number ?? row.order_id}`,
            `Customer ${row.customer_name ?? ""} (${row.account_number ?? "-"})`,
            `Payment method: ${row.payment_method ?? "unknown"}`,
            `Classifications: ${row.classifications.join(", ")}`,
            `First billing job: ${row.first_billing_job_status ?? "none"} / blocker: ${row.first_billing_job_blocker ?? "-"}`,
            `Applied auto-fixes: ${row.applied.join(", ") || "none"}`,
          ].join("\n"),
          status: "open",
          priority: row.classifications.includes("dd_mandate_not_active") ? "high" : "medium",
          related_customer_id: row.customer_id,
          related_account_number: row.account_number,
        });
        if (!error) { row.admin_task_created = true; summary.manual_review++; }
      }
    }

    rows.push(row);
  }

  return jsonResponse({ mode, summary, rows });
});
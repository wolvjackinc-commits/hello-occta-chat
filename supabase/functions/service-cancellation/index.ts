// Service cancellation workflow (Phase 8): request | preview | approve | submit_to_giacom | confirm_cease | withdraw
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const c = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await c.auth.getUser();
  return data.user ?? null;
}

async function isAdmin(admin: ReturnType<typeof createClient>, uid: string) {
  const { data } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
  return !!data;
}

async function appendHistory(admin: any, caseId: string, fromStatus: string | null, toStatus: string, actor: string | null, role: string, reason?: string, metadata?: unknown) {
  await admin.from("cancellation_case_history").insert({
    case_id: caseId, from_status: fromStatus, to_status: toStatus,
    actor_user_id: actor, actor_role: role, reason, metadata,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const action = String(body.action || "");
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const user = await getUser(req);
    if (!user) return json({ error: "unauthenticated" }, 401);
    const isStaff = await isAdmin(admin, user.id);

    if (action === "request") {
      const serviceId = String(body.service_id || "");
      const reasonCode = body.reason_code ? String(body.reason_code) : null;
      const notes = body.notes ? String(body.notes).slice(0, 2000) : null;
      const requestedDate = body.requested_date ? String(body.requested_date) : null;
      if (!serviceId) return json({ error: "service_id required" }, 400);

      const { data: svc, error: svcErr } = await admin.from("services")
        .select("id, user_id, order_id, contract_summary_id, status, activation_date, notice_period_days")
        .eq("id", serviceId).maybeSingle();
      if (svcErr || !svc) return json({ error: "service_not_found" }, 404);
      if (!isStaff && svc.user_id !== user.id) return json({ error: "forbidden" }, 403);
      if (svc.status !== "active" && svc.status !== "live") {
        return json({ error: "service_not_live", status: svc.status }, 409);
      }

      const { data: ord } = await admin.from("orders")
        .select("id, customer_id, occta_order_number, contract_acceptance_id, contract_summary_id, lifecycle_status")
        .eq("id", svc.order_id).maybeSingle();

      const idemKey = body.idempotency_key
        ? String(body.idempotency_key)
        : `cancel-req:${serviceId}:${user.id}`;

      const { data: existing } = await admin.from("service_cancellation_cases")
        .select("id, status")
        .eq("idempotency_key", idemKey).maybeSingle();
      if (existing) return json({ ok: true, case_id: existing.id, status: existing.status, idempotent: true });

      const { data: openCase } = await admin.from("service_cancellation_cases")
        .select("id, status")
        .eq("service_id", serviceId)
        .not("status", "in", "(completed,withdrawn,rejected)")
        .maybeSingle();
      if (openCase) return json({ ok: true, case_id: openCase.id, status: openCase.status, already_open: true });

      const insertRow: any = {
        customer_id: ord?.customer_id ?? svc.user_id,
        account_number: ord?.occta_order_number ?? null,
        order_id: svc.order_id,
        service_id: serviceId,
        contract_summary_id: svc.contract_summary_id ?? ord?.contract_summary_id ?? null,
        contract_acceptance_id: ord?.contract_acceptance_id ?? null,
        status: "requested",
        source: isStaff ? "admin" : "customer",
        reason_code: reasonCode,
        notes,
        requested_date: requestedDate,
        idempotency_key: idemKey,
        request_ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
        request_user_agent: req.headers.get("user-agent") ?? null,
        requested_by_user: isStaff ? null : user.id,
        requested_by_staff: isStaff ? user.id : null,
      };
      const { data: created, error: insErr } = await admin.from("service_cancellation_cases")
        .insert(insertRow).select("id").single();
      if (insErr) return json({ error: "create_failed", detail: insErr.message }, 500);

      await appendHistory(admin, created.id, null, "requested", user.id, isStaff ? "admin" : "customer", reasonCode ?? undefined);

      // ack email (idempotent)
      const recipient = user.email ?? null;
      if (recipient) {
        await admin.from("cancellation_email_outbox").insert({
          case_id: created.id, email_type: "acknowledgement",
          recipient_email: recipient, idempotency_key: `cancel-ack:${created.id}`,
        });
      }
      return json({ ok: true, case_id: created.id, status: "requested" });
    }

    if (action === "preview") {
      const caseId = String(body.case_id || "");
      if (!caseId) return json({ error: "case_id required" }, 400);
      const { data: c } = await admin.from("service_cancellation_cases")
        .select("*").eq("id", caseId).maybeSingle();
      if (!c) return json({ error: "case_not_found" }, 404);
      if (!isStaff && c.customer_id !== user.id) return json({ error: "forbidden" }, 403);

      const requested = c.requested_date || new Date().toISOString().slice(0, 10);
      const { data: preview, error: pErr } = await admin.rpc("compute_cancellation_preview", {
        p_service_id: c.service_id, p_requested_date: requested,
      });
      if (pErr) return json({ error: "preview_failed", detail: pErr.message }, 500);

      const reasons: string[] = (preview as any)?.manual_review_reasons ?? [];
      const nextStatus = reasons.length > 0 ? "manual_review_required" : "preview_ready";

      await admin.from("service_cancellation_cases").update({
        preview_snapshot: preview,
        preview_formula_version: (preview as any)?.formula_version ?? "standard_v1",
        preview_generated_at: new Date().toISOString(),
        proposed_cease_date: (preview as any)?.proposed_cease_date ?? null,
        notice_period_days: (preview as any)?.notice_period_days ?? null,
        minimum_term_end_date: (preview as any)?.minimum_term_end_date ?? null,
        manual_review_reasons: reasons,
        status: c.status === "requested" ? nextStatus : c.status,
      }).eq("id", caseId);

      if (c.status === "requested") {
        await appendHistory(admin, caseId, "requested", nextStatus, user.id, isStaff ? "admin" : "customer", "preview_computed");
      }

      // Durable manual-review reconciliation task when blocking reasons exist
      if (reasons.length > 0) {
        await admin.rpc("flag_cancellation_manual_review", { p_case_id: caseId, p_reasons: reasons });
      }

      // Strip internal-only fields for customer responses
      const out = isStaff
        ? preview
        : {
            proposed_cease_date: (preview as any)?.proposed_cease_date,
            notice_period_days: (preview as any)?.notice_period_days,
            unbilled_service_minor: (preview as any)?.unbilled_service_minor,
            unpaid_invoices_minor: (preview as any)?.unpaid_invoices_minor,
            credits_minor: (preview as any)?.credits_minor,
            etf_minor: (preview as any)?.etf_minor,
            final_balance_minor: (preview as any)?.final_balance_minor,
            currency: (preview as any)?.currency ?? "GBP",
            subject_to_confirmation: true,
          };
      return json({ ok: true, status: nextStatus, preview: out });
    }

    if (action === "approve") {
      if (!isStaff) return json({ error: "forbidden" }, 403);
      const caseId = String(body.case_id || "");
      const confirmed = !!body.staff_confirmed;
      if (!confirmed) return json({ error: "confirmation_required" }, 400);
      const { data: c } = await admin.from("service_cancellation_cases")
        .select("*").eq("id", caseId).maybeSingle();
      if (!c) return json({ error: "case_not_found" }, 404);
      if (!["preview_ready", "manual_review_required"].includes(c.status)) {
        return json({ error: "invalid_state", status: c.status }, 409);
      }

      await admin.from("service_cancellation_cases").update({
        status: "approved_for_cease",
        approved_by_staff: user.id,
        approved_at: new Date().toISOString(),
      }).eq("id", caseId);
      await appendHistory(admin, caseId, c.status, "approved_for_cease", user.id, "admin", "preview_approved");

      await admin.from("orders").update({
        lifecycle_status: "cancellation_requested",
        cancellation_requested_at: new Date().toISOString(),
        cancellation_preview: c.preview_snapshot,
      }).eq("id", c.order_id);

      // Urgent Giacom cease task
      await admin.from("admin_tasks").insert({
        task_type: "giacom_cease",
        priority: "urgent",
        status: "open",
        related_id: c.id,
        title: `Submit cease to Giacom (case ${c.id.slice(0, 8)})`,
        description: `Proposed cease date: ${c.proposed_cease_date}. Service ${c.service_id}.`,
      });

      // confirmed cease email
      const { data: prof } = await admin.from("profiles").select("email").eq("id", c.customer_id).maybeSingle();
      if (prof?.email) {
        await admin.from("cancellation_email_outbox").insert({
          case_id: c.id, email_type: "confirmed_cease",
          recipient_email: prof.email, idempotency_key: `cancel-confirmed:${c.id}`,
        });
      }
      return json({ ok: true, status: "approved_for_cease" });
    }

    if (action === "record_giacom_submission") {
      if (!isStaff) return json({ error: "forbidden" }, 403);
      const caseId = String(body.case_id || "");
      const ref = body.giacom_reference ? String(body.giacom_reference) : null;
      const { data: c } = await admin.from("service_cancellation_cases").select("*").eq("id", caseId).maybeSingle();
      if (!c) return json({ error: "case_not_found" }, 404);
      if (c.status !== "approved_for_cease" && c.status !== "submitted_to_giacom") {
        return json({ error: "invalid_state", status: c.status }, 409);
      }
      await admin.from("service_cancellation_cases").update({
        status: "submitted_to_giacom",
        giacom_cease_reference: ref,
        giacom_submitted_at: c.giacom_submitted_at ?? new Date().toISOString(),
      }).eq("id", caseId);
      await appendHistory(admin, caseId, c.status, "submitted_to_giacom", user.id, "admin", "giacom_recorded", { ref });
      return json({ ok: true, status: "submitted_to_giacom" });
    }

    if (action === "mark_cease_committed") {
      if (!isStaff) return json({ error: "forbidden" }, 403);
      const caseId = String(body.case_id || "");
      const supplierDate = body.supplier_cease_date ? String(body.supplier_cease_date) : null;
      const { data: c } = await admin.from("service_cancellation_cases").select("*").eq("id", caseId).maybeSingle();
      if (!c) return json({ error: "case_not_found" }, 404);
      if (!["submitted_to_giacom", "approved_for_cease"].includes(c.status)) {
        return json({ error: "invalid_state", status: c.status }, 409);
      }
      await admin.from("service_cancellation_cases").update({
        status: "cease_committed",
        supplier_confirmed_cease_date: supplierDate,
        cease_committed_at: new Date().toISOString(),
        cease_committed_by: user.id,
      }).eq("id", caseId);
      await appendHistory(admin, caseId, c.status, "cease_committed", user.id, "admin", "supplier_committed", { supplier_date: supplierDate });
      return json({ ok: true, status: "cease_committed" });
    }

    if (action === "confirm_cease") {
      if (!isStaff) return json({ error: "forbidden" }, 403);
      const caseId = String(body.case_id || "");
      const actual = String(body.actual_cease_date || "");
      if (!actual) return json({ error: "actual_cease_date required" }, 400);
      const { data, error } = await admin.rpc("finalize_service_cancellation", {
        p_case_id: caseId, p_actual_cease_date: actual, p_admin_user: user.id,
      });
      if (error) return json({ error: "finalize_failed", detail: error.message }, 500);
      return json({ ok: true, result: data });
    }

    if (action === "withdraw") {
      const caseId = String(body.case_id || "");
      const reason = body.reason ? String(body.reason).slice(0, 1000) : null;
      const { data: c } = await admin.from("service_cancellation_cases").select("*").eq("id", caseId).maybeSingle();
      if (!c) return json({ error: "case_not_found" }, 404);
      if (!isStaff && c.customer_id !== user.id) return json({ error: "forbidden" }, 403);
      if (["cease_committed", "completed"].includes(c.status)) {
        return json({ error: "withdrawal_blocked_post_cease", status: c.status }, 409);
      }
      if (["withdrawn", "rejected"].includes(c.status)) {
        return json({ ok: true, status: c.status, idempotent: true });
      }
      await admin.from("service_cancellation_cases").update({
        status: "withdrawn",
        withdrawn_by: user.id,
        withdrawn_at: new Date().toISOString(),
        withdrawn_reason: reason,
      }).eq("id", caseId);
      await appendHistory(admin, caseId, c.status, "withdrawn", user.id, isStaff ? "admin" : "customer", reason ?? "withdrawn");

      // Restore order lifecycle if previously set to cancellation_requested
      if (c.status === "approved_for_cease") {
        await admin.from("orders").update({
          lifecycle_status: "active",
          cancellation_requested_at: null,
        }).eq("id", c.order_id);
      }
      return json({ ok: true, status: "withdrawn" });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: "exception", detail: String(e?.message ?? e) }, 500);
  }
});
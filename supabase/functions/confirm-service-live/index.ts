import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";

/**
 * Phase 4 — confirm-service-live
 *
 * The single production action that turns a committed canonical order
 * into an active customer service and starts the billing lifecycle.
 *
 * - Staff-only (admin / super_admin / finance_admin).
 * - All state changes — service upsert, order promotion, history,
 *   activation-email outbox row and first-billing job — are written
 *   in a single transaction inside `confirm_service_live_tx`
 *   (SECURITY DEFINER). If any of the outbox writes fail the whole
 *   activation is rolled back, so we never leave a "live" service
 *   without its durable email/billing jobs.
 * - Never calls Giacom / supplier / Worldpay / DD providers.
 */

interface Input {
  order_id: string;
  actual_activation_date: string;          // YYYY-MM-DD
  activation_reference: string;
  activation_notes?: string;
  giacom_reference?: string;               // optional: only required if order lacks one
  customer_note?: string;
  internal_note?: string;
  confirm: boolean;                        // explicit admin checkbox
}

const MISSING_REQ_TO_HUMAN: Record<string, string> = {
  order_not_committed: "Order is not in the committed state.",
  missing_contract_summary: "Order is not linked to a Contract Summary.",
  missing_customer: "Order is not linked to a customer account.",
  missing_payment_method: "No payment method captured for this order.",
  missing_giacom_reference: "Giacom reference is required before activation.",
  missing_actual_activation_date: "Actual activation date is required.",
  missing_activation_reference: "Activation reference is required.",
  cs_not_accepted: "Contract Summary has not been accepted.",
  cs_pdf_missing: "Accepted Contract Summary PDF or hash is missing.",
  payment_method_not_found: "Payment method record could not be found.",
  missing_billing_anchor_day: "Preferred billing anchor day is not set.",
  contract_summary_not_found: "Contract Summary record could not be found.",
  order_not_found: "Order could not be found.",
};

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
  const actor = who?.user;
  if (!actor) return jsonResponse({ error: "unauthenticated" }, 401);

  const svc = getServiceClient();

  // Activation is restricted to admin/super_admin/finance_admin.
  const [admin, sa, fa] = await Promise.all([
    svc.rpc("has_role", { _user_id: actor.id, _role: "admin" }),
    svc.rpc("has_role", { _user_id: actor.id, _role: "super_admin" }),
    svc.rpc("has_role", { _user_id: actor.id, _role: "finance_admin" }),
  ]);
  if (!admin.data && !sa.data && !fa.data) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  let body: Input;
  try { body = await req.json(); }
  catch { return jsonResponse({ error: "invalid_json" }, 400); }

  if (!body?.order_id) return jsonResponse({ error: "missing_order_id" }, 400);
  if (!body?.confirm) return jsonResponse({ error: "explicit_confirmation_required" }, 400);
  if (!body?.actual_activation_date) return jsonResponse({ error: "missing_actual_activation_date" }, 400);
  if (!body?.activation_reference || !body.activation_reference.trim()) {
    return jsonResponse({ error: "missing_activation_reference" }, 400);
  }

  // Atomic transaction.
  let tx: any;
  try {
    const { data, error } = await svc.rpc("confirm_service_live_tx", {
      _order_id: body.order_id,
      _actor: actor.id,
      _actual_activation_date: body.actual_activation_date,
      _activation_reference: body.activation_reference.trim(),
      _activation_notes: body.activation_notes ?? null,
      _giacom_reference: body.giacom_reference ?? null,
      _customer_note: body.customer_note ?? null,
      _internal_note: body.internal_note ?? null,
    });
    if (error) {
      const code = String(error.message ?? "").replace(/^.*?confirm_service_live_tx[^:]*:\s*/, "").split(":")[0] || "tx_failed";
      const human = MISSING_REQ_TO_HUMAN[code] ?? error.message;
      return jsonResponse({ error: code, message: human }, 422);
    }
    tx = data;
  } catch (e) {
    return jsonResponse({ error: "tx_exception", message: (e as Error).message }, 500);
  }

  const serviceId: string | null = tx?.service_id ?? null;
  const alreadyLive: boolean = !!tx?.already_live;

  // NOTE: service-activation-email outbox and first-billing-job rows are
  // written atomically inside `confirm_service_live_tx`. Do not insert
  // them here — that would double-write or hide rollback failures.

  // Load order for audit metadata only (no PII duplicated downstream).
  const { data: order } = await svc.from("orders")
    .select("id, occta_order_number, customer_id")
    .eq("id", body.order_id).maybeSingle();

  // Customer-visible timeline event (one only).
  if (!alreadyLive) {
    await svc.rpc("log_event", {
      _actor_type: "admin",
      _event_type: "service_activated",
      _title: `Service activated for ${order?.occta_order_number ?? body.order_id}`,
      _details: {
        order_id: body.order_id,
        service_id: serviceId,
        activation_date: body.actual_activation_date,
        is_pro_rata: tx?.is_pro_rata ?? null,
        billable_days: tx?.billable_days ?? null,
        full_cycle_days: tx?.full_cycle_days ?? null,
        calc_method: tx?.calc_method ?? null,
      },
      _order_id: body.order_id,
      _customer_id: order?.customer_id ?? null,
      _source_module: "orders",
      _severity: "info",
    });
    // Admin audit
    await svc.from("audit_logs").insert({
      actor_user_id: actor.id,
      action: "confirm_service_live",
      entity: "orders",
      entity_id: body.order_id,
      metadata: {
        service_id: serviceId,
        activation_reference_present: true,
        giacom_reference_present: !!body.giacom_reference,
        next_billing_date: tx?.next_billing_date ?? null,
        is_pro_rata: tx?.is_pro_rata ?? null,
        billable_days: tx?.billable_days ?? null,
        full_cycle_days: tx?.full_cycle_days ?? null,
        monthly_price_minor: tx?.monthly_price_minor ?? null,
        calc_method: tx?.calc_method ?? null,
      },
    });
  }

  return jsonResponse({
    ok: true,
    already_live: alreadyLive,
    service_id: serviceId,
    order_id: body.order_id,
    next_billing_date: tx?.next_billing_date ?? null,
    minimum_term_end_date: tx?.minimum_term_end_date ?? null,
    billing_anchor_day: tx?.billing_anchor_day ?? null,
    is_pro_rata: tx?.is_pro_rata ?? null,
    billable_days: tx?.billable_days ?? null,
    full_cycle_days: tx?.full_cycle_days ?? null,
    monthly_price_minor: tx?.monthly_price_minor ?? null,
    calc_method: tx?.calc_method ?? null,
  });
});
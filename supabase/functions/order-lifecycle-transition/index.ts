import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";

/**
 * Phase 3 — order-lifecycle-transition
 *
 * Server-side canonical order lifecycle controller.
 *
 * Responsibilities:
 *   - Authenticate the caller and confirm staff role.
 *   - Validate the requested transition against an explicit matrix.
 *   - Enforce per-transition input requirements (e.g. ordered requires
 *     entered_in_giacom_at, committed requires expected_activation_date).
 *   - Apply the transition + Giacom tracking fields to public.orders
 *     in a single update, mirroring lifecycle_status to the legacy
 *     status enum through a fixed mapping.
 *   - Append exactly one row to public.order_status_history.
 *   - Idempotent: duplicate calls with the same target status and no
 *     new operational fields return the existing row instead of
 *     inserting a duplicate history entry.
 *   - Never sets `live` — that is reserved for Phase 4
 *     confirm-service-live.
 */

const ALLOWED: Record<string, string[]> = {
  order_received: ["ordered", "cancelled", "failed"],
  ordered: ["processing", "on_hold", "cancellation_requested", "failed"],
  processing: ["committed", "on_hold", "cancellation_requested", "failed"],
  committed: ["processing", "on_hold", "cancellation_requested"],
  on_hold: ["processing", "committed", "cancellation_requested"],
  cancellation_requested: ["committed", "cancelled"],
  // failed only transitions via override flag handled below
  failed: [],
  cancelled: [],
  live: [],
};

const FAILED_OVERRIDE_TARGETS = new Set(["processing", "cancelled"]);

// Legacy status enum mirror — public.orders.status is ('pending'|'confirmed'|'active'|'cancelled').
function legacyStatusFor(lifecycle: string): "pending" | "confirmed" | "active" | "cancelled" | null {
  switch (lifecycle) {
    case "order_received":
    case "ordered":
    case "processing":
    case "on_hold":
    case "cancellation_requested":
      return "pending";
    case "committed":
      return "confirmed";
    case "cancelled":
    case "failed":
      return "cancelled";
    case "live":
      return "active";
    default:
      return null;
  }
}

interface TransitionInput {
  order_id: string;
  to_status: string;
  customer_note?: string | null;
  internal_note?: string | null;
  giacom_reference?: string | null;
  giacom_product_ref?: string | null;
  router_reference?: string | null;
  entered_in_giacom_at?: string | null; // ISO
  expected_activation_date?: string | null; // YYYY-MM-DD
  override?: boolean;
  source?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  // Authenticate caller via JWT.
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
  const { data: isStaff } = await svc.rpc("is_staff", { _user_id: actor.id });
  if (!isStaff) return jsonResponse({ error: "forbidden" }, 403);

  // Parse + validate body.
  let body: TransitionInput;
  try { body = await req.json(); }
  catch { return jsonResponse({ error: "invalid_json" }, 400); }

  if (!body?.order_id || !body?.to_status) {
    return jsonResponse({ error: "missing_fields" }, 400);
  }
  if (body.to_status === "live") {
    return jsonResponse({ error: "live_reserved_for_confirm_service_live" }, 400);
  }

  // Load order.
  const { data: order, error: oErr } = await svc
    .from("orders")
    .select("id, occta_order_number, lifecycle_status, status, entered_in_giacom_at, giacom_reference, expected_activation_date")
    .eq("id", body.order_id)
    .maybeSingle();
  if (oErr || !order) return jsonResponse({ error: "order_not_found" }, 404);
  if (!order.occta_order_number) return jsonResponse({ error: "order_missing_occta_number" }, 409);

  const from = order.lifecycle_status ?? "order_received";
  const to = body.to_status;

  // Validate transition.
  const isOverride = !!body.override;
  if (from === to) {
    // Idempotent no-op: only insert history if operational fields change.
    return await applyOperationalUpdateOnly(svc, order, body, actor.id);
  }
  const allowed = ALLOWED[from] ?? [];
  const isFailedOverride =
    from === "failed" && isOverride && FAILED_OVERRIDE_TARGETS.has(to);
  if (!allowed.includes(to) && !isFailedOverride) {
    return jsonResponse(
      { error: "invalid_transition", from, to, allowed: isOverride ? Array.from(FAILED_OVERRIDE_TARGETS) : allowed },
      422,
    );
  }

  // Per-transition requirements.
  if (to === "ordered") {
    if (!body.entered_in_giacom_at) {
      return jsonResponse({ error: "ordered_requires_entered_in_giacom_at" }, 422);
    }
  }
  if (to === "committed") {
    const expected =
      body.expected_activation_date ?? order.expected_activation_date ?? null;
    if (!expected) {
      return jsonResponse({ error: "committed_requires_expected_activation_date" }, 422);
    }
    if (!body.internal_note && !body.customer_note) {
      return jsonResponse({ error: "committed_requires_confirmation_note" }, 422);
    }
  }
  if (isFailedOverride && !body.internal_note) {
    return jsonResponse({ error: "failed_override_requires_internal_note" }, 422);
  }

  // Build update payload.
  const upd: Record<string, unknown> = {
    lifecycle_status: to,
    updated_at: new Date().toISOString(),
  };
  const legacy = legacyStatusFor(to);
  if (legacy) upd.status = legacy;
  if (body.entered_in_giacom_at) upd.entered_in_giacom_at = body.entered_in_giacom_at;
  if (body.giacom_reference) upd.giacom_reference = body.giacom_reference;
  if (body.giacom_product_ref) upd.giacom_product_ref = body.giacom_product_ref;
  if (body.router_reference) upd.router_reference = body.router_reference;
  if (body.expected_activation_date) upd.expected_activation_date = body.expected_activation_date;
  if (to === "cancellation_requested") upd.cancellation_requested_at = new Date().toISOString();

  // Concurrency-safe transition: only update if lifecycle_status still equals `from`.
  const { data: updated, error: uErr } = await svc
    .from("orders")
    .update(upd)
    .eq("id", order.id)
    .eq("lifecycle_status", from)
    .select("id, occta_order_number, lifecycle_status, status, entered_in_giacom_at, giacom_reference, expected_activation_date")
    .maybeSingle();
  if (uErr) return jsonResponse({ error: "update_failed", detail: uErr.message }, 500);
  if (!updated) {
    // Someone else moved it — fail-closed.
    return jsonResponse({ error: "concurrent_transition" }, 409);
  }

  // Append history (single row).
  await svc.from("order_status_history").insert({
    order_id: order.id,
    previous_status: from,
    new_status: to,
    changed_by: actor.id,
    source: body.source ?? "admin",
    customer_note: body.customer_note ?? null,
    internal_note: body.internal_note ?? null,
    giacom_reference: updated.giacom_reference ?? null,
    expected_activation_date: updated.expected_activation_date ?? null,
    metadata: {
      override: isFailedOverride || undefined,
      router_reference: body.router_reference ?? undefined,
      giacom_product_ref: body.giacom_product_ref ?? undefined,
    },
  });

  // Audit log.
  await svc.rpc("log_event", {
    _actor_type: "admin",
    _event_type: "order_lifecycle_transition",
    _title: `Order ${updated.occta_order_number}: ${from} → ${to}`,
    _details: { order_id: order.id, from, to, override: isFailedOverride },
    _order_id: order.id,
    _source_module: "orders",
    _severity: "info",
  });

  return jsonResponse({ ok: true, order: updated, from, to });
});

async function applyOperationalUpdateOnly(
  svc: ReturnType<typeof getServiceClient>,
  order: { id: string; lifecycle_status: string | null; giacom_reference: string | null; expected_activation_date: string | null; entered_in_giacom_at: string | null; occta_order_number: string | null; status: string | null },
  body: TransitionInput,
  actorId: string,
) {
  const upd: Record<string, unknown> = {};
  if (body.giacom_reference && body.giacom_reference !== order.giacom_reference) {
    upd.giacom_reference = body.giacom_reference;
  }
  if (body.giacom_product_ref) upd.giacom_product_ref = body.giacom_product_ref;
  if (body.router_reference) upd.router_reference = body.router_reference;
  if (body.expected_activation_date && body.expected_activation_date !== order.expected_activation_date) {
    upd.expected_activation_date = body.expected_activation_date;
  }
  if (body.entered_in_giacom_at && !order.entered_in_giacom_at) {
    upd.entered_in_giacom_at = body.entered_in_giacom_at;
  }
  const hasOperationalChange = Object.keys(upd).length > 0
    || !!body.customer_note || !!body.internal_note;

  if (!hasOperationalChange) {
    // Pure idempotent no-op (e.g. double-click).
    return jsonResponse({ ok: true, order, noop: true });
  }

  if (Object.keys(upd).length > 0) {
    upd.updated_at = new Date().toISOString();
    await svc.from("orders").update(upd).eq("id", order.id);
  }
  await svc.from("order_status_history").insert({
    order_id: order.id,
    previous_status: order.lifecycle_status,
    new_status: order.lifecycle_status,
    changed_by: actorId,
    source: body.source ?? "admin",
    customer_note: body.customer_note ?? null,
    internal_note: body.internal_note ?? null,
    giacom_reference: (upd.giacom_reference as string) ?? order.giacom_reference ?? null,
    expected_activation_date:
      (upd.expected_activation_date as string) ?? order.expected_activation_date ?? null,
    metadata: { operational_update: true },
  });
  const { data: fresh } = await svc.from("orders")
    .select("id, occta_order_number, lifecycle_status, status, entered_in_giacom_at, giacom_reference, expected_activation_date")
    .eq("id", order.id).maybeSingle();
  return jsonResponse({ ok: true, order: fresh, operational: true });
}
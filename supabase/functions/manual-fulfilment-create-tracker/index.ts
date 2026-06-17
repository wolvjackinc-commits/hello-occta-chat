import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";

/**
 * Phase 6 — manual-fulfilment-create-tracker
 *
 * Creates a Manual Giacom Tracking row for a canonical OCCTA order.
 * Idempotent: re-invocation returns the existing tracker.
 *
 * - Staff-only (admin / super_admin / finance_admin).
 * - All eligibility checks live in the SECURITY DEFINER RPC
 *   `create_manual_fulfilment_tracker_for_order`.
 * - No supplier / Worldpay / DD / billing API is ever called from here.
 */

interface Input {
  order_id: string;
  notes?: string;
}

const HUMAN: Record<string, string> = {
  order_not_found:        "Order not found.",
  order_not_eligible:     "This order is not yet eligible for a manual fulfilment tracker.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")    return jsonResponse({ error: "method_not_allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
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
  const [admin, sa, fa] = await Promise.all([
    svc.rpc("has_role", { _user_id: actor.id, _role: "admin" }),
    svc.rpc("has_role", { _user_id: actor.id, _role: "super_admin" }),
    svc.rpc("has_role", { _user_id: actor.id, _role: "finance_admin" }),
  ]);
  if (!admin.data && !sa.data && !fa.data) return jsonResponse({ error: "forbidden" }, 403);

  let body: Input;
  try { body = await req.json(); }
  catch { return jsonResponse({ error: "invalid_json" }, 400); }
  if (!body?.order_id) return jsonResponse({ error: "missing_order_id" }, 400);

  const { data, error } = await svc.rpc("create_manual_fulfilment_tracker_for_order", {
    _order_id: body.order_id,
    _actor: actor.id,
    _notes: body.notes ?? null,
  });
  if (error) {
    const code = String(error.message ?? "").replace(/^.*?:\s*/, "").split(":")[0] || "rpc_failed";
    return jsonResponse({ error: code, message: HUMAN[code] ?? error.message }, 422);
  }

  await svc.from("audit_logs").insert({
    actor_user_id: actor.id,
    action: "manual_fulfilment_create_tracker",
    entity: "orders",
    entity_id: body.order_id,
    metadata: {
      tracker_id: (data as any)?.tracker_id ?? null,
      already_exists: (data as any)?.already_exists ?? false,
    },
  });

  return jsonResponse({ ok: true, ...(data as any) });
});
/**
 * Journey 2 — record the outcome of the shared submission step against the
 * Journey 2 session and return the customer's order number.
 *
 * The order itself is created by the existing `journey-submit-order` service.
 * This function only mirrors the result onto the session so the completion
 * page, admin views and the funnel report agree with the canonical order.
 */
import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({ token: z.string().min(16) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "journey2_finalise", 30, 60))) return jsonResponse({ error: "rate_limited" }, 429);

  const supabase = getServiceClient();
  const tokenHash = await sha256Hex(parsed.data.token);

  const { data: session } = await supabase
    .from("customer_journey_sessions")
    .select("id, status, quote_id, order_journey_id, order_id, guest_order_id, completed_at")
    .eq("public_token_hash", tokenHash)
    .maybeSingle();
  if (!session) return jsonResponse({ error: "session_not_found" }, 404);
  if (!session.quote_id) return jsonResponse({ error: "contract_not_prepared" }, 409);

  const { data: journey } = await supabase
    .from("order_journeys")
    .select("id, status, current_step, submitted_at, completed_at, order_id, contract_summary_id, customer_id")
    .eq("quote_id", session.quote_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!journey) return jsonResponse({ error: "journey_missing" }, 409);

  if (!journey.submitted_at) {
    return jsonResponse({ ok: true, submitted: false, current_step: journey.current_step });
  }

  const { data: order } = journey.order_id
    ? await supabase
        .from("orders")
        .select("id, occta_order_number, lifecycle_status, preferred_start_date, guest_order_id, customer_id")
        .eq("id", journey.order_id)
        .maybeSingle()
    : { data: null as any };

  const { data: acceptance } = journey.contract_summary_id
    ? await supabase
        .from("contract_acceptances")
        .select("id")
        .eq("contract_summary_id", journey.contract_summary_id)
        .order("accepted_at", { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null as any };

  const { data: pm } = await supabase
    .from("payment_methods")
    .select("id, method, billing_anchor_day, dd_setup_status")
    .eq("journey_id", journey.id)
    .eq("active", true)
    .maybeSingle();

  if (!session.completed_at) {
    await supabase.from("customer_journey_sessions").update({
      status: "completed",
      current_step: "complete",
      last_completed_step: "review",
      completed_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      order_id: order?.id ?? null,
      guest_order_id: order?.guest_order_id ?? null,
      customer_id: order?.customer_id ?? journey.customer_id ?? null,
      contract_summary_id: journey.contract_summary_id ?? null,
      contract_acceptance_id: acceptance?.id ?? null,
      payment_method_id: pm?.id ?? null,
    }).eq("id", session.id);

    await supabase.rpc("log_event", {
      _actor_type: "public",
      _event_type: "journey2_order_completed",
      _title: `Journey 2 order completed ${order?.occta_order_number ?? ""}`.trim(),
      _details: { session_id: session.id, order_id: order?.id ?? null, occta_order_number: order?.occta_order_number ?? null },
      _source_module: "journey2",
      _quote_id: session.quote_id,
    }).then(() => {}).catch(() => {});
  }

  return jsonResponse({
    ok: true,
    submitted: true,
    order_number: order?.occta_order_number ?? null,
    preferred_start_date: order?.preferred_start_date ?? null,
    payment_method: pm ? { method: pm.method, billing_anchor_day: pm.billing_anchor_day, dd_setup_status: pm.dd_setup_status } : null,
  });
});
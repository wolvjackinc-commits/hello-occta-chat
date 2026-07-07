// Public-callable notifier used by the Worldpay return page when a SIM-linked
// payment comes back as failed/cancelled/error.
//
// It does NOT modify invoices, receipts or payment_requests. It only:
//   - marks the linked sim_orders row as `payment_failed` (idempotent, and
//     only while the order is still in a pre-live state so a real live/paid
//     order can never be regressed by this endpoint);
//   - sends the `sim-payment-failed` lifecycle email once, keyed by
//     `sim-payment-failed:<sim_order_id>:<payment_request_id|invoice_id>`.
//
// Worldpay webhook remains the sole source of truth for actual payment
// success. This endpoint is a failure-side courtesy notifier only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const j = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const APP_ORIGIN = Deno.env.get("PUBLIC_APP_ORIGIN") ?? "https://www.occta.co.uk";
const SAFE_TRANSITION_FROM = new Set(["awaiting_payment", "payment_failed", "draft"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({}));
    const invoiceId: string | undefined = body?.invoiceId;
    const reportedStatus: string = String(body?.status ?? "failed");
    if (!invoiceId) return j(400, { error: "invoiceId required" });
    if (!["failed", "cancelled", "error", "expired"].includes(reportedStatus)) {
      return j(200, { ok: true, skipped: "non-failure status" });
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, sim_order_id, status")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!invoice?.sim_order_id) return j(200, { ok: true, skipped: "not a sim invoice" });
    // Never touch an already-paid invoice or emit failure emails for it.
    if (invoice.status === "paid") return j(200, { ok: true, skipped: "invoice paid" });

    const { data: order } = await supabase
      .from("sim_orders")
      .select("id, order_number, plan_name_snapshot, sim_type, customer_id, email, full_name, status")
      .eq("id", invoice.sim_order_id)
      .maybeSingle();
    if (!order) return j(200, { ok: true, skipped: "order missing" });
    if (!SAFE_TRANSITION_FROM.has(order.status)) {
      return j(200, { ok: true, skipped: `status ${order.status} not eligible` });
    }

    if (order.status !== "payment_failed") {
      await supabase.from("sim_orders").update({ status: "payment_failed" }).eq("id", order.id);
    }

    // Resolve most recent payment_request tied to this invoice (if any) so we
    // key the idempotency deterministically per attempt.
    const { data: pr } = await supabase
      .from("payment_requests")
      .select("id")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const key = `sim-payment-failed:${order.id}:${pr?.id ?? invoiceId}`;

    if (order.email) {
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "sim_lifecycle",
            to: order.email,
            userId: order.customer_id ?? null,
            logToCommunications: true,
            data: {
              template: "sim-payment-failed",
              customer_name: order.full_name,
              order_number: order.order_number,
              plan_name: order.plan_name_snapshot,
              sim_type: order.sim_type,
              dashboard_url: `${APP_ORIGIN}/dashboard`,
              support_url: `${APP_ORIGIN}/support`,
              retry_hint: "You can retry payment from your dashboard, or reply to this email and our team will help.",
            },
          },
          headers: { "idempotency-key": key } as any,
        });
      } catch (_e) { /* never block on email failure */ }
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: null,
      action: "sim_payment_failed",
      entity: "sim_order",
      entity_id: order.id,
      metadata: { invoice_id: invoiceId, payment_request_id: pr?.id ?? null, reported_status: reportedStatus },
    }).then(() => null, () => null);

    return j(200, { ok: true, order_id: order.id, notified: true });
  } catch (e) {
    console.error("sim-payment-failed-notify error", e);
    return j(500, { error: (e as Error).message });
  }
});
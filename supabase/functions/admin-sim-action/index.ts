import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { nextAnchorBillingDate } from "../_shared/billingHelpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const j = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return j(401, { error: "Unauthorized" });
    const { data: userData, error: uerr } = await supabase.auth.getUser(jwt);
    if (uerr || !userData?.user) return j(401, { error: "Unauthorized" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return j(403, { error: "Forbidden" });

    const body = await req.json();
    const { action, order_id, payload } = body ?? {};
    if (!action || !order_id) return j(400, { error: "Missing action or order_id" });

    const { data: order, error: oerr } = await supabase.from("sim_orders").select("*").eq("id", order_id).maybeSingle();
    if (oerr || !order) return j(404, { error: "Order not found" });

    const update: Record<string, unknown> = {};
    let auditMeta: Record<string, unknown> = { action };

    switch (action) {
      case "approve": {
        // Move to fulfilment lane based on sim_type
        update.status = order.sim_type === "esim" ? "esim_ready" : "physical_sim_pending";
        break;
      }
      case "reject":
      case "cancel": {
        update.status = "cancelled";
        update.admin_notes = payload?.reason ?? order.admin_notes;
        break;
      }
      case "on_hold": {
        update.status = "on_hold";
        update.admin_notes = payload?.reason ?? order.admin_notes;
        break;
      }
      case "set_iccid": {
        if (!payload?.iccid) return j(400, { error: "iccid required" });
        update.iccid = payload.iccid;
        update.provisioned_msisdn = payload.provisioned_msisdn ?? order.provisioned_msisdn;
        update.provisioned_plan_name = payload.provisioned_plan_name ?? order.provisioned_plan_name;
        break;
      }
      case "esim_sent": {
        update.status = "esim_sent";
        // Record delivery entry
        await supabase.from("sim_esim_deliveries").insert({
          order_id,
          qr_storage_path: payload?.qr_storage_path ?? null,
          activation_code: payload?.activation_code ?? null,
          smdp_address: payload?.smdp_address ?? null,
          sent_at: new Date().toISOString(),
          sent_by: userData.user.id,
          notes: payload?.notes ?? null,
        });
        break;
      }
      case "mark_dispatched": {
        update.status = "physical_sim_dispatched";
        update.dispatched_at = new Date().toISOString();
        update.dispatch_tracking = payload?.tracking ?? null;
        break;
      }
      case "pac_required": update.status = "pac_required"; break;
      case "stac_required": update.status = "stac_required"; break;
      case "port_requested":
        update.status = "port_requested";
        update.port_requested_at = new Date().toISOString();
        break;
      case "port_scheduled":
        update.status = "port_scheduled";
        update.port_scheduled_at = payload?.date ?? new Date().toISOString();
        break;
      case "port_completed":
        update.status = "port_completed";
        update.port_completed_at = new Date().toISOString();
        break;
      case "mark_service_live": {
        // Billing gate: service goes live on service_live_date; first payment already
        // taken (card) is treated as a credit for the first period.
        const liveDate = payload?.service_live_date ?? new Date().toISOString().slice(0, 10);
        const anchorDay = payload?.billing_anchor_day ?? new Date(liveDate + "T00:00:00Z").getUTCDate();
        const anchor = Math.max(1, Math.min(28, Number(anchorDay)));
        update.status = "live";
        update.service_live_date = liveDate;
        update.billing_anchor_day = anchor;
        // Next billing date = first anchor strictly after service_live_date.
        update.next_billing_date = nextAnchorBillingDate(liveDate, anchor);
        // Card: first_payment_paid_minor becomes credit against first month.
        if (order.payment_method === "card" && (order.first_payment_paid_minor ?? 0) > 0) {
          update.first_payment_credit_minor = order.first_payment_paid_minor;
        }
        auditMeta = { ...auditMeta, live_date: liveDate, next_billing_date: update.next_billing_date, anchor };
        break;
      }
      case "fail": update.status = "failed"; break;
      default:
        return j(400, { error: `Unknown action: ${action}` });
    }

    if (Object.keys(update).length) {
      const { error: uErr } = await supabase.from("sim_orders").update(update).eq("id", order_id);
      if (uErr) return j(500, { error: uErr.message });
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user.id,
      action: `sim_${action}`,
      entity: "sim_order",
      entity_id: order_id,
      metadata: { ...auditMeta, payload: payload ?? null },
    }).then(() => null, () => null);

    return j(200, { ok: true, order_id, applied: update });
  } catch (e) {
    console.error("admin-sim-action error", e);
    return j(500, { error: (e as Error).message });
  }
});
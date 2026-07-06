import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { nextAnchorBillingDate, sha256Hex } from "../_shared/billingHelpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const j = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const APP_ORIGIN = Deno.env.get("PUBLIC_APP_ORIGIN") ?? "https://www.occta.co.uk";

/** Fire-and-forget SIM lifecycle email via existing send-email pipeline. */
async function sendSimEmail(
  supabase: ReturnType<typeof createClient>,
  order: Record<string, unknown>,
  template: string,
  extra: Record<string, unknown> = {},
  idempotencyKey?: string,
) {
  const email = order.email as string | null;
  if (!email) return;
  const key = idempotencyKey ?? `${template}:${order.id}`;
  try {
    await supabase.functions.invoke("send-email", {
      body: {
        type: "sim_lifecycle",
        to: email,
        userId: order.customer_id ?? null,
        logToCommunications: true,
        data: {
          template,
          customer_name: order.full_name,
          order_number: order.order_number,
          plan_name: order.plan_name_snapshot,
          sim_type: order.sim_type,
          dashboard_url: `${APP_ORIGIN}/dashboard`,
          support_url: `${APP_ORIGIN}/support`,
          ...extra,
        },
      },
      headers: { "idempotency-key": key } as any,
    });
  } catch (_e) { /* never block admin action on email failure */ }
}

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
    const emailJobs: Array<() => Promise<void>> = [];

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
        emailJobs.push(() => sendSimEmail(supabase, order, "sim-esim-ready", {
          delivery_note: "Your eSIM activation details are ready in your dashboard.",
        }, `sim-esim-ready:${order_id}`));
        break;
      }
      case "mark_dispatched": {
        update.status = "physical_sim_dispatched";
        update.dispatched_at = new Date().toISOString();
        update.dispatch_tracking = payload?.tracking ?? null;
        emailJobs.push(() => sendSimEmail(supabase, order, "sim-physical-dispatched", {
          tracking: payload?.tracking ?? null,
          dispatched_at: new Date().toISOString().slice(0, 10),
        }, `sim-physical-dispatched:${order_id}`));
        break;
      }
      case "pac_required":
        update.status = "pac_required";
        emailJobs.push(() => sendSimEmail(supabase, order, "sim-pac-required", {}, `sim-pac-required:${order_id}`));
        break;
      case "stac_required":
        update.status = "stac_required";
        emailJobs.push(() => sendSimEmail(supabase, order, "sim-stac-required", {}, `sim-stac-required:${order_id}`));
        break;
      case "port_requested":
        update.status = "port_requested";
        update.port_requested_at = new Date().toISOString();
        break;
      case "port_scheduled":
        update.status = "port_scheduled";
        update.port_scheduled_at = payload?.date ?? new Date().toISOString();
        emailJobs.push(() => sendSimEmail(supabase, order, "sim-port-scheduled", {
          scheduled_date: (payload?.date ?? new Date().toISOString()).toString().slice(0, 10),
        }, `sim-port-scheduled:${order_id}:${payload?.date ?? ""}`));
        break;
      case "port_completed":
        update.status = "port_completed";
        update.port_completed_at = new Date().toISOString();
        emailJobs.push(() => sendSimEmail(supabase, order, "sim-port-completed", {}, `sim-port-completed:${order_id}`));
        break;
      case "mark_service_live": {
        // Book the FIRST live service period immediately (service_live_date →
        // first billing anchor). Any card first-payment already collected is
        // applied to this period. Underpayment creates a balance payment_request.
        // Overpayment carries forward as first_payment_credit_minor for the
        // next recurring invoice.
        const liveDate = (payload?.service_live_date ?? new Date().toISOString().slice(0, 10)) as string;
        const anchorDay = payload?.billing_anchor_day ?? new Date(liveDate + "T00:00:00Z").getUTCDate();
        const anchor = Math.max(1, Math.min(28, Number(anchorDay)));
        const firstAnchor = nextAnchorBillingDate(liveDate, anchor);
        // full cycle = anchor of previous month → firstAnchor
        const prevAnchorD = new Date(firstAnchor + "T00:00:00Z");
        prevAnchorD.setUTCMonth(prevAnchorD.getUTCMonth() - 1);
        const prevAnchor = prevAnchorD.toISOString().slice(0, 10);
        const oneDay = 86400000;
        const fullCycleDays = Math.max(1, Math.round((new Date(firstAnchor + "T00:00:00Z").getTime() - prevAnchorD.getTime()) / oneDay));
        const billableDays = Math.max(0, Math.round((new Date(firstAnchor + "T00:00:00Z").getTime() - new Date(liveDate + "T00:00:00Z").getTime()) / oneDay));
        const monthlyMinor = Number(order.monthly_price_minor_snapshot ?? 0);
        const proRataMinor = billableDays > 0
          ? (billableDays >= fullCycleDays ? monthlyMinor : Math.round(monthlyMinor * billableDays / fullCycleDays))
          : 0;

        const paidMinor = Number(order.first_payment_paid_minor ?? 0);
        const deliveryMinor = Number(order.delivery_fee_minor_snapshot ?? 0);
        // Delivery fee stays consumed by the checkout invoice; only the
        // service portion of the checkout payment can credit the first period.
        const paidTowardService = Math.max(0, paidMinor - deliveryMinor);
        const creditApplied = Math.min(paidTowardService, proRataMinor);
        const balanceDueMinor = proRataMinor - creditApplied;
        const creditCarry = paidTowardService - creditApplied;

        // Idempotency: bail if we already booked this first period.
        const { data: existingFirst } = await supabase
          .from("invoices")
          .select("id, status")
          .eq("sim_order_id", order_id)
          .eq("invoice_type", "sim_first_period")
          .neq("status", "cancelled")
          .maybeSingle();

        let firstPeriodInvoiceId: string | null = existingFirst?.id ?? null;
        let balancePayNowUrl: string | null = null;

        if (!existingFirst && proRataMinor > 0) {
          const { data: invNum } = await supabase.rpc("generate_invoice_number");
          const invoiceNumber = (invNum as string) ?? `SIMP-${order.order_number}-${liveDate}`;
          const today = new Date().toISOString().slice(0, 10);
          const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 14);
          const status = balanceDueMinor === 0 ? "paid" : (order.payment_method === "direct_debit" ? "awaiting_dd_collection" : "sent");
          const { data: inv, error: invErr } = await supabase.from("invoices").insert({
            user_id: order.customer_id,
            sim_order_id: order_id,
            invoice_number: invoiceNumber,
            invoice_type: "sim_first_period",
            status,
            issue_date: today,
            due_date: dueDate.toISOString().slice(0, 10),
            billing_period_start: liveDate,
            billing_period_end: firstAnchor,
            subtotal: proRataMinor / 100,
            total: balanceDueMinor / 100,
            vat_enabled: false,
            vat_rate: Number(order.vat_rate_snapshot ?? 0.2),
            vat_total: 0,
            notes: `SIM first live period — ${order.plan_name_snapshot} (${liveDate} → ${firstAnchor})${creditApplied > 0 ? ` — credit applied £${(creditApplied / 100).toFixed(2)}` : ""}`,
          }).select("id").single();
          if (invErr) return j(500, { error: invErr.message });
          firstPeriodInvoiceId = inv.id;

          await supabase.from("invoice_lines").insert({
            invoice_id: inv.id,
            description: `${order.plan_name_snapshot} — service ${liveDate} → ${firstAnchor} (${billableDays}/${fullCycleDays} days)`,
            qty: 1,
            unit_price: proRataMinor / 100,
            line_total: proRataMinor / 100,
          });
          if (creditApplied > 0) {
            await supabase.from("invoice_lines").insert({
              invoice_id: inv.id,
              description: "Credit applied from checkout payment",
              qty: 1,
              unit_price: -(creditApplied / 100),
              line_total: -(creditApplied / 100),
            });
          }

          if (balanceDueMinor > 0 && order.payment_method === "card") {
            const token = crypto.randomUUID();
            const tokenHash = await sha256Hex(token);
            const expires = new Date(); expires.setDate(expires.getDate() + 14);
            await supabase.from("payment_requests").insert({
              type: "card_payment",
              invoice_id: inv.id,
              user_id: order.customer_id,
              customer_email: order.email,
              customer_name: order.full_name,
              amount: balanceDueMinor / 100,
              currency: "GBP",
              status: "sent",
              expires_at: expires.toISOString(),
              token_hash: tokenHash,
              notes: `SIM first-period balance ${invoiceNumber}`,
            });
            balancePayNowUrl = `${APP_ORIGIN}/pay?token=${token}`;
          }
        }

        update.status = "live";
        update.service_live_date = liveDate;
        update.billing_anchor_day = anchor;
        update.next_billing_date = firstAnchor;
        update.first_payment_credit_minor = creditCarry;

        auditMeta = {
          ...auditMeta,
          live_date: liveDate,
          anchor,
          first_period: { start: liveDate, end: firstAnchor, billable_days: billableDays, full_cycle_days: fullCycleDays, prev_anchor: prevAnchor },
          pro_rata_minor: proRataMinor,
          credit_applied_minor: creditApplied,
          balance_due_minor: balanceDueMinor,
          credit_carry_minor: creditCarry,
          first_period_invoice_id: firstPeriodInvoiceId,
          next_billing_date: firstAnchor,
        };

        emailJobs.push(() => sendSimEmail(supabase, order, "sim-service-live", {
          service_live_date: liveDate,
          first_period_start: liveDate,
          first_period_end: firstAnchor,
          next_billing_date: firstAnchor,
          pro_rata_amount: (proRataMinor / 100).toFixed(2),
          credit_applied_amount: (creditApplied / 100).toFixed(2),
          balance_due_amount: (balanceDueMinor / 100).toFixed(2),
          balance_pay_now_url: balancePayNowUrl,
          credit_carry_amount: (creditCarry / 100).toFixed(2),
        }, `sim-service-live:${order_id}`));
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

    // Dispatch lifecycle emails after DB update; never block on failures.
    for (const job of emailJobs) { job().catch(() => null); }

    return j(200, { ok: true, order_id, applied: update });
  } catch (e) {
    console.error("admin-sim-action error", e);
    return j(500, { error: (e as Error).message });
  }
});
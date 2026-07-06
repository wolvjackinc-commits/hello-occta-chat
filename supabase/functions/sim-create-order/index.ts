import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Require authenticated user (SIM orders need a real customer account).
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json(401, { error: "Unauthorized" });
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) return json(401, { error: "Unauthorized" });
    const userId = userData.user.id;

    const body = await req.json();
    const {
      plan_id,
      sim_type,
      esim_device_brand,
      esim_device_model,
      esim_eid,
      delivery_address,
      number_choice,
      current_msisdn,
      current_provider,
      pac_code,
      pac_expiry,
      stac_code,
      preferred_transfer_date,
      full_name,
      email,
      phone,
      billing_address,
      payment_method,
      consent,
    } = body ?? {};

    if (!plan_id || !sim_type || !number_choice || !full_name || !email || !payment_method) {
      return json(400, { error: "Missing required fields" });
    }
    if (!["esim", "physical"].includes(sim_type)) return json(400, { error: "Invalid sim_type" });
    if (!["card", "direct_debit"].includes(payment_method)) return json(400, { error: "Invalid payment_method" });
    if (!["keep", "new", "new_with_stac", "provide_later"].includes(number_choice)) return json(400, { error: "Invalid number_choice" });
    if (sim_type === "physical" && !delivery_address) return json(400, { error: "Delivery address required for physical SIM" });

    // Confirm settings + plan are actively purchasable — never trust client price.
    const { data: settings } = await supabase.from("sim_settings").select("*").eq("singleton", true).maybeSingle();
    if (!settings?.standalone_enabled) return json(400, { error: "SIM ordering is not currently available" });
    if (sim_type === "esim" && !settings.esim_enabled) return json(400, { error: "eSIM not available" });
    if (sim_type === "physical" && !settings.physical_sim_enabled) return json(400, { error: "Physical SIM not available" });
    if (payment_method === "direct_debit" && !settings.direct_debit_enabled) return json(400, { error: "Direct Debit not available" });

    const { data: plan, error: planErr } = await supabase
      .from("sim_plans")
      .select("*")
      .eq("id", plan_id)
      .eq("is_active", true)
      .eq("checkout_visible", true)
      .maybeSingle();
    if (planErr || !plan) return json(400, { error: "Plan not available" });
    if (sim_type === "esim" && !plan.esim_available) return json(400, { error: "This plan is not available as eSIM" });
    if (sim_type === "physical" && !plan.physical_sim_available) return json(400, { error: "This plan is not available as physical SIM" });

    const deliveryFeeMinor = sim_type === "physical" ? (plan.delivery_fee_minor ?? 0) : 0;
    const firstPaymentMinor = payment_method === "card"
      ? (plan.first_payment_minor ?? plan.monthly_price_minor) + deliveryFeeMinor
      : 0; // DD collects nothing at checkout

    // Determine initial status
    let initialStatus = "draft";
    if (payment_method === "card") initialStatus = "awaiting_payment";
    if (payment_method === "direct_debit") initialStatus = "dd_mandate_pending";

    // Insert SIM order (snapshot pricing)
    const { data: orderIns, error: orderErr } = await supabase
      .from("sim_orders")
      .insert({
        customer_id: userId,
        plan_id: plan.id,
        plan_slug_snapshot: plan.slug,
        plan_name_snapshot: plan.name,
        monthly_price_minor_snapshot: plan.monthly_price_minor,
        first_payment_minor_snapshot: firstPaymentMinor,
        delivery_fee_minor_snapshot: deliveryFeeMinor,
        vat_mode_snapshot: plan.vat_mode,
        vat_rate_snapshot: plan.vat_rate,
        min_term_months_snapshot: plan.min_term_months,
        full_name,
        email,
        phone: phone ?? null,
        billing_address: billing_address ?? {},
        sim_type,
        esim_device_brand: esim_device_brand ?? null,
        esim_device_model: esim_device_model ?? null,
        esim_eid: esim_eid ?? null,
        delivery_address: delivery_address ?? null,
        number_choice,
        current_msisdn: current_msisdn ?? null,
        current_provider: current_provider ?? null,
        pac_code: pac_code ?? null,
        pac_expiry: pac_expiry ?? null,
        stac_code: stac_code ?? null,
        preferred_transfer_date: preferred_transfer_date ?? null,
        payment_method,
        status: initialStatus,
        consent: consent ?? {},
      })
      .select("*")
      .single();
    if (orderErr || !orderIns) return json(500, { error: orderErr?.message ?? "Failed to create order" });

    let invoiceId: string | null = null;

    if (payment_method === "card" && firstPaymentMinor > 0) {
      // Create first-payment invoice (paid on Worldpay success by existing webhook)
      const totalMajor = firstPaymentMinor / 100;
      const { data: invNum } = await supabase.rpc("generate_invoice_number");
      const invoiceNumber = (invNum as string) ?? `SIM-${orderIns.order_number}`;
      const { data: invIns, error: invErr } = await supabase
        .from("invoices")
        .insert({
          user_id: userId,
          invoice_number: invoiceNumber,
          invoice_type: "sim_first_payment",
          subtotal: totalMajor,
          total: totalMajor,
          tax: 0,
          vat_enabled: plan.vat_mode === "excluded",
          vat_rate: Number(plan.vat_rate),
          vat_total: 0,
          status: "sent",
          currency: "GBP",
          issue_date: new Date().toISOString().slice(0, 10),
          due_date: new Date().toISOString().slice(0, 10),
          notes: `SIM first payment — ${plan.name} (order ${orderIns.order_number})`,
        })
        .select("id")
        .single();
      if (invErr || !invIns) return json(500, { error: invErr?.message ?? "Failed to create invoice" });
      invoiceId = invIns.id;

      await supabase.from("invoice_lines").insert({
        invoice_id: invoiceId,
        description: `${plan.name} — first payment`,
        quantity: 1,
        unit_price: (firstPaymentMinor - deliveryFeeMinor) / 100,
        total: (firstPaymentMinor - deliveryFeeMinor) / 100,
      });
      if (deliveryFeeMinor > 0) {
        await supabase.from("invoice_lines").insert({
          invoice_id: invoiceId,
          description: "Physical SIM delivery",
          quantity: 1,
          unit_price: deliveryFeeMinor / 100,
          total: deliveryFeeMinor / 100,
        });
      }

      await supabase.from("sim_orders").update({ first_payment_invoice_id: invoiceId }).eq("id", orderIns.id);
    }

    // Log order creation to audit trail (admin sees new DD orders in SIM orders list with status=dd_mandate_pending).
    await supabase.from("audit_logs").insert({
      actor_user_id: userId,
      action: "sim_order_created",
      entity: "sim_order",
      entity_id: orderIns.id,
      metadata: { order_number: orderIns.order_number, payment_method, plan_slug: plan.slug },
    }).then(() => null, () => null);

    return json(200, {
      order_id: orderIns.id,
      order_number: orderIns.order_number,
      status: orderIns.status,
      payment_method,
      invoice_id: invoiceId,
    });
  } catch (e) {
    console.error("sim-create-order error", e);
    return json(500, { error: (e as Error).message });
  }
});
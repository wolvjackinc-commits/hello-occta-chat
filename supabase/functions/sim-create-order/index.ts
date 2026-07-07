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

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-f]/gi, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

async function encryptBankDetails(plain: Record<string, unknown>) {
  // Match journey-payment-method key handling exactly (any of: hex, base64,
  // raw 32-byte, else SHA-256 of raw secret).
  let rawKey = (Deno.env.get("DD_FIELD_ENC_KEY") ?? "").trim();
  if (!rawKey) throw new Error("DD_FIELD_ENC_KEY_missing");
  if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) rawKey = rawKey.slice(1, -1);
  const noWs = rawKey.replace(/\s+/g, "");
  let keyBytes: Uint8Array | null = null;
  if (/^[0-9a-f]{64}$/i.test(noWs)) keyBytes = hexToBytes(noWs);
  if (!keyBytes) {
    const hexOnly = noWs.replace(/^0x/i, "").replace(/[^0-9a-f]/gi, "");
    if (hexOnly.length === 64) keyBytes = hexToBytes(hexOnly);
  }
  if (!keyBytes) {
    let b64 = noWs.replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/=]/g, "").replace(/=+$/, "");
    const pad = b64.length % 4;
    if (pad === 2) b64 += "=="; else if (pad === 3) b64 += "=";
    if (b64.length % 4 === 0) {
      try {
        const bin = atob(b64);
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        if (bytes.length === 32) keyBytes = bytes;
      } catch { /* fallthrough */ }
    }
  }
  if (!keyBytes && noWs.length === 32) keyBytes = new TextEncoder().encode(noWs);
  if (!keyBytes) {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey));
    keyBytes = new Uint8Array(hash);
  }
  if (keyBytes.length !== 32) throw new Error(`DD_FIELD_ENC_KEY_bad_length:${keyBytes.length}`);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(JSON.stringify(plain));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, enc));
  return {
    ciphertext_hex: "\\x" + Array.from(ct).map((b) => b.toString(16).padStart(2, "0")).join(""),
    nonce_hex: "\\x" + Array.from(nonce).map((b) => b.toString(16).padStart(2, "0")).join(""),
    key_id: "DD_FIELD_ENC_KEY_v1",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth optional for card checkout (guest allowed). DD path requires auth
    // because bank details, mandate consent, and future collection are tied
    // to a real customer account.
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    let userId: string | null = null;
    if (jwt) {
      const { data: userData } = await supabase.auth.getUser(jwt);
      if (userData?.user) userId = userData.user.id;
    }

    const body = await req.json();
    const {
      plan_id,
      customer_segment: submittedSegment,
      business_name,
      company_number,
      vat_number,
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
      dd_details,
    } = body ?? {};

    if (!plan_id || !sim_type || !number_choice || !full_name || !email || !payment_method) {
      return json(400, { error: "Missing required fields" });
    }
    if (!["esim", "physical"].includes(sim_type)) return json(400, { error: "Invalid sim_type" });
    if (!["card", "direct_debit"].includes(payment_method)) return json(400, { error: "Invalid payment_method" });
    if (!["keep", "new", "new_with_stac", "provide_later"].includes(number_choice)) return json(400, { error: "Invalid number_choice" });
    if (sim_type === "physical" && !delivery_address) return json(400, { error: "Delivery address required for physical SIM" });

    if (payment_method === "direct_debit") {
      if (!userId) return json(401, { error: "auth_required_for_dd" });
      if (!dd_details) return json(400, { error: "dd_details required" });
      const dd = dd_details as Record<string, string | boolean | undefined>;
      if (
        typeof dd.account_holder_name !== "string" || !dd.account_holder_name ||
        typeof dd.sort_code !== "string" || !/^\d{6}$/.test(dd.sort_code) ||
        typeof dd.account_number !== "string" || !/^\d{8}$/.test(dd.account_number) ||
        typeof dd.bank_name !== "string" || !dd.bank_name ||
        !dd.uk_account_confirmed || !dd.payer_authorised_confirmed || !dd.guarantee_acknowledged
      ) {
        return json(400, { error: "dd_details_invalid" });
      }
    }

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
    // Enforce business-details on business plans.
    if (plan.customer_segment === "business" && !business_name) {
      return json(400, { error: "business_name_required" });
    }
    // Ignore any spoofed segment from client; source of truth = plan row.
    const customerSegment = plan.customer_segment ?? submittedSegment ?? "consumer";
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

    // Generate order-success token (customer receives raw token, DB stores SHA-256).
    const orderToken = crypto.randomUUID() + "-" + crypto.randomUUID();
    const orderTokenHash = await sha256Hex(orderToken);

    // DD masking (safe to expose)
    let ddMaskedLast4: string | null = null;
    let ddMaskedSort: string | null = null;
    let ddBankName: string | null = null;
    let ddAccountHolder: string | null = null;
    if (payment_method === "direct_debit" && dd_details) {
      ddMaskedLast4 = String(dd_details.account_number).slice(-4);
      ddMaskedSort = String(dd_details.sort_code).slice(-2);
      ddBankName = String(dd_details.bank_name);
      ddAccountHolder = String(dd_details.account_holder_name);
    }

    // Insert SIM order (snapshot pricing)
    const { data: orderIns, error: orderErr } = await supabase
      .from("sim_orders")
      .insert({
        customer_id: userId,
        is_guest: !userId,
        order_token_hash: orderTokenHash,
        plan_id: plan.id,
        plan_slug_snapshot: plan.slug,
        plan_name_snapshot: plan.name,
        customer_segment: customerSegment,
        business_name: customerSegment === "business" ? (business_name ?? null) : null,
        company_number: customerSegment === "business" ? (company_number ?? null) : null,
        vat_number: customerSegment === "business" ? (vat_number ?? null) : null,
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
        dd_masked_last4: ddMaskedLast4,
        dd_masked_sort_last2: ddMaskedSort,
        dd_bank_name: ddBankName,
        dd_account_holder: ddAccountHolder,
      })
      .select("*")
      .single();
    if (orderErr || !orderIns) return json(500, { error: orderErr?.message ?? "Failed to create order" });

    let invoiceId: string | null = null;

    // DD path — encrypt + persist bank details into dd_intake_requests, then
    // create an admin task to activate the mandate.
    if (payment_method === "direct_debit" && dd_details) {
      try {
        const enc = await encryptBankDetails({
          account_holder_name: dd_details.account_holder_name,
          sort_code: dd_details.sort_code,
          account_number: dd_details.account_number,
          bank_name: dd_details.bank_name,
          billing_address: billing_address ?? {},
          postcode: (billing_address?.postcode ?? null),
        });
        const { data: intakeIns, error: intakeErr } = await supabase
          .from("dd_intake_requests")
          .insert({
            journey_id: null,
            payment_method_id: null,
            bank_details_ciphertext: enc.ciphertext_hex,
            enc_key_id: enc.key_id,
            enc_alg: "AES-256-GCM",
            nonce: enc.nonce_hex,
            masked_account_last4: ddMaskedLast4!,
            masked_sort_last2: ddMaskedSort!,
            bank_name: ddBankName,
            uk_account_confirmed: !!dd_details.uk_account_confirmed,
            payer_authorised_confirmed: !!dd_details.payer_authorised_confirmed,
          })
          .select("id")
          .single();
        if (intakeErr) throw intakeErr;
        await supabase.from("sim_orders").update({ dd_intake_id: intakeIns.id }).eq("id", orderIns.id);
        await supabase.from("admin_tasks").insert({
          title: `SIM DD activation — ${orderIns.order_number}`,
          description: `New SIM Direct Debit mandate captured for ${full_name} (${email}). Bank: ${ddBankName}, sort ****${ddMaskedSort}, acc ****${ddMaskedLast4}. Activate mandate with DD provider before service goes live.`,
          priority: "high",
          status: "open",
          created_by: userId,
          related_customer_id: userId,
        });
      } catch (e) {
        console.error("SIM DD encryption failed", e);
        // Roll the order back to admin_review with a note so admin can follow up manually.
        await supabase.from("sim_orders").update({
          status: "admin_review",
          admin_notes: `DD encryption failed: ${String((e as Error).message).slice(0, 300)}`,
        }).eq("id", orderIns.id);
      }
    }

    if (payment_method === "card" && firstPaymentMinor > 0) {
      // Create first-payment invoice (paid on Worldpay success by existing webhook)
      const totalMajor = firstPaymentMinor / 100;
      const { data: invNum } = await supabase.rpc("generate_invoice_number");
      const invoiceNumber = (invNum as string) ?? `SIM-${orderIns.order_number}`;
      const { data: invIns, error: invErr } = await supabase
        .from("invoices")
        .insert({
          user_id: userId,
          sim_order_id: orderIns.id,
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

    // Fire-and-forget order confirmation email via existing send-email pipeline.
    supabase.functions.invoke("send-email", {
      body: {
        type: "order_confirmation",
        to: email,
        userId: userId,
        orderNumber: orderIns.order_number,
        logToCommunications: true,
        data: {
          customer_name: full_name,
          order_number: orderIns.order_number,
          plan_name: plan.name,
          sim_type,
          payment_method,
          first_payment_amount: firstPaymentMinor > 0 ? (firstPaymentMinor / 100).toFixed(2) : "0.00",
          order_success_url: `${Deno.env.get("PUBLIC_APP_ORIGIN") ?? "https://www.occta.co.uk"}/sim/order-success/${orderIns.id}?t=${orderToken}`,
        },
      },
      headers: { "idempotency-key": `sim-order-created:${orderIns.id}` } as any,
    }).catch(() => null);

    // DD-received acknowledgement for Direct Debit orders.
    if (payment_method === "direct_debit") {
      supabase.functions.invoke("send-email", {
        body: {
          type: "sim_lifecycle",
          to: email,
          userId,
          logToCommunications: true,
          data: {
            template: "sim-dd-received",
            customer_name: full_name,
            order_number: orderIns.order_number,
            plan_name: plan.name,
            dashboard_url: `${Deno.env.get("PUBLIC_APP_ORIGIN") ?? "https://www.occta.co.uk"}/dashboard`,
          },
        },
        headers: { "idempotency-key": `sim-dd-received:${orderIns.id}` } as any,
      }).catch(() => null);
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
      order_token: orderToken,
    });
  } catch (e) {
    console.error("sim-create-order error", e);
    return json(500, { error: (e as Error).message });
  }
});
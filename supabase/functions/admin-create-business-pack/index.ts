/**
 * Admin: build a complete customer-facing Contract Summary + Signature Pack for
 * a bespoke business broadband order, ready for digital signature BEFORE the
 * order is placed with the supplier.
 *
 * Pack contents (customer-facing): full charge breakdown with VAT, first
 * payment, installation appointment terms, router terms, Wi-Fi coverage
 * limitations, cancellation / cease / transfer-away charges, and the required
 * per-order acknowledgements. Internal supplier route, cost and margin data is
 * stored on contract_summaries.internal_pack and is NEVER exposed to the
 * customer (it is excluded from the public token allow-list).
 *
 * Actions:
 *   preview — no writes. Returns the exact pack + email that would be created.
 *   prepare — creates the customer account, quote request, quote, Contract
 *             Summary, immutable PDF, order shell, signing link and the
 *             Direct Debit setup link. NO email is sent.
 *   send    — emails the prepared pack + signing link to the customer.
 */
import {
  corsHeaders, jsonResponse, getServiceClient, requireStaff,
  generateTokenPair, sendResendEmail, brutalistEmailShell, escapeHtml, sha256Hex,
} from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({
  action: z.enum(["preview", "prepare", "send"]),
  confirm: z.boolean().optional(),
  expires_in_days: z.number().int().min(1).max(60).optional(),
});

// ── Order configuration (Gigi — Hairmonic Head Spa / Monet Beauty Clinic) ─────
const ORDER = {
  contact_name: "Gigi",
  business_name: "Hairmonic Head Spa / Monet Beauty Clinic",
  email: "hairmonic@gmail.com",
  address_line_1: "Monet Beauty Clinic, 56 Maida Vale",
  town: "London",
  postcode: "W9 1PP",
  plan_name: "Essential Fibre Flex 30",
  download: 80,
  upload: 20,
  broadband_ex: 31.66, broadband_vat: 6.33, broadband_inc: 37.99,
  router_month_ex: 4.16, router_month_vat: 0.83, router_month_inc: 4.99,
  monthly_ex: 35.82, monthly_vat: 7.16, monthly_inc: 42.98,
  router_oneoff_ex: 73.33, router_oneoff_vat: 14.67, router_oneoff_inc: 88.00,
  install_ex: 73.17, install_vat: 14.63, install_inc: 87.80,
  first_payment_inc: 218.78,
  install_date: "2026-09-01",
  install_window: "1:00 pm to 4:00 pm",
} as const;

const SERVICE_ADDRESS = `${ORDER.address_line_1}, ${ORDER.town}, ${ORDER.postcode}`;
const TEMPLATE_CS_ID = "2a2efc54-c23f-4825-84ea-8d15a51b7510";

const f = (n: number) => `£${n.toFixed(2)}`;

const SPEED_NOTES = [
  "Estimated download speed: up to 80 Mbps. Estimated upload speed: up to 20 Mbps. These are estimates for this line and are not guaranteed.",
  "Speeds quoted are the speeds delivered to the router. Actual speeds inside the premises depend on Wi-Fi conditions, the number of devices in use, building construction and in-premises wiring.",
  "Unlimited usage — no data caps and no traffic shaping in normal business use.",
  "Broadband is not a guaranteed emergency-call service during a power cut. Please keep a mobile phone available.",
].join("\n");

const CEASE_TEXT = [
  "This is a 30-day rolling (Flex 30) agreement. You may cancel at any time by giving 30 days' notice; you pay for the service up to the end of the notice period.",
  "There is no early-termination charge for ending a Flex 30 agreement after it has gone live.",
  "One-off charges already incurred are non-refundable once the work has been carried out: the router one-off charge (£88.00 inc VAT) and the standard installation / activation charge (£87.80 inc VAT).",
  "If you cancel after the order has been placed with the network but before installation completes, any supplier cancellation, abort or missed-appointment charge actually incurred will be passed on to you at cost.",
  "If the service is transferred away to another provider, the transfer is treated as a cease and the same 30 days' notice and any outstanding charges apply.",
  "Where a network cease or migration charge is levied by the network operator, it is passed on at cost and shown as a separate line on your invoice.",
].join(" ");

const PAYMENT_SCHEDULE = [
  `First payment due: ${f(ORDER.first_payment_inc)} inc VAT (first month broadband ${f(ORDER.broadband_inc)}, first month router charge ${f(ORDER.router_month_inc)}, router one-off ${f(ORDER.router_oneoff_inc)}, standard installation / activation ${f(ORDER.install_inc)}).`,
  `Monthly payment thereafter: ${f(ORDER.monthly_inc)} inc VAT per month.`,
  "Payment method: Direct Debit. Your Direct Debit Instruction is completed straight after you sign this Contract Summary and is protected by the Direct Debit Guarantee.",
  "Collections are taken on the 1st or the 15th of the month. Monthly billing starts once the service is confirmed live.",
].join(" ");

const PACK_SECTIONS = {
  business_name_label: "Business / trading name",
  mark_ready_for_supplier: true,
  acknowledgements: [
    { key: "ack_address", text: `I confirm that the installation address is ${SERVICE_ADDRESS}.` },
    { key: "ack_authorised", text: "I confirm that I am authorised to place this broadband order for the business/premises." },
    { key: "ack_product", text: `I confirm that I wish to proceed with ${ORDER.plan_name}.` },
    { key: "ack_monthly", text: `I understand the monthly recurring charge is ${f(ORDER.monthly_inc)} inc VAT per month.` },
    { key: "ack_first_payment", text: `I understand the first payment is ${f(ORDER.first_payment_inc)} inc VAT.` },
    { key: "ack_appointment", text: `I understand the requested installation appointment is 1 September 2026, ${ORDER.install_window}, subject to final confirmation.` },
    { key: "ack_speeds", text: "I understand that broadband speeds and Wi-Fi performance may vary." },
    { key: "ack_wifi", text: "I understand that Wi-Fi coverage across three floors may require boosters, mesh Wi-Fi, or access points at additional cost." },
    { key: "ack_cancellation", text: "I understand cancellation, cease, or migration-away charges may apply if the service is cancelled or transferred away." },
    { key: "ack_terms", text: "I agree to OCCTA's applicable broadband terms, privacy policy, and service terms." },
  ],
  sections: [
    {
      title: "Your package",
      rows: [
        { label: "Package", value: ORDER.plan_name },
        { label: "Contract type", value: "30-day rolling / Flex 30" },
        { label: "Estimated download speed", value: `Up to ${ORDER.download} Mbps` },
        { label: "Estimated upload speed", value: `Up to ${ORDER.upload} Mbps` },
        { label: "Provider", value: "OCCTA Broadband" },
      ],
    },
    {
      title: "Monthly charges — full VAT breakdown",
      rows: [
        { label: "Broadband monthly", value: `${f(ORDER.broadband_ex)} ex VAT + ${f(ORDER.broadband_vat)} VAT = ${f(ORDER.broadband_inc)} inc VAT` },
        { label: "Router monthly", value: `${f(ORDER.router_month_ex)} ex VAT + ${f(ORDER.router_month_vat)} VAT = ${f(ORDER.router_month_inc)} inc VAT` },
        { label: "Total monthly recurring", value: `${f(ORDER.monthly_ex)} ex VAT + ${f(ORDER.monthly_vat)} VAT = ${f(ORDER.monthly_inc)} inc VAT` },
      ],
    },
    {
      title: "One-off charges — full VAT breakdown",
      rows: [
        { label: "Router one-off charge", value: `${f(ORDER.router_oneoff_ex)} ex VAT + ${f(ORDER.router_oneoff_vat)} VAT = ${f(ORDER.router_oneoff_inc)} inc VAT` },
        { label: "Standard installation / activation", value: `${f(ORDER.install_ex)} ex VAT + ${f(ORDER.install_vat)} VAT = ${f(ORDER.install_inc)} inc VAT` },
      ],
    },
    {
      title: "First payment",
      intro: "Your first payment covers your first month plus the one-off charges:",
      rows: [
        { label: "First month broadband", value: `${f(ORDER.broadband_inc)} inc VAT` },
        { label: "First month router charge", value: `${f(ORDER.router_month_inc)} inc VAT` },
        { label: "Router one-off charge", value: `${f(ORDER.router_oneoff_inc)} inc VAT` },
        { label: "Standard installation / activation", value: `${f(ORDER.install_inc)} inc VAT` },
        { label: "Total first payment", value: `${f(ORDER.first_payment_inc)} inc VAT` },
        { label: "Monthly payment thereafter", value: `${f(ORDER.monthly_inc)} inc VAT per month` },
      ],
    },
    {
      title: "Installation",
      rows: [
        { label: "Installation type", value: "Standard installation" },
        { label: "Requested appointment", value: `1 September 2026, ${ORDER.install_window}` },
      ],
      bullets: [
        "This appointment is subject to final network supplier confirmation.",
        "You or an authorised representative must be available at the premises throughout the appointment window.",
        "If the appointment is missed, delayed, aborted, or additional work is required, extra supplier charges may apply and will be passed on to you at cost.",
        "The engineer will install the service to a single termination point. Additional internal cabling, trunking or relocation of the termination point is not included.",
      ],
    },
    {
      title: "Router",
      bullets: [
        "A business-grade router is supplied for use with this service.",
        `The router is charged as a one-off ${f(ORDER.router_oneoff_inc)} inc VAT plus ${f(ORDER.router_month_inc)} inc VAT per month.`,
        "The router is configured for this broadband service. OCCTA does not support third-party firmware or configurations.",
        "Please keep the router safe and available; a replacement for loss or damage is chargeable.",
      ],
    },
    {
      title: "Wi-Fi coverage — important limitation",
      bullets: [
        "The speeds shown are the speeds delivered to the router, not the Wi-Fi speed in every room.",
        "The premises has three floors. A single router cannot be guaranteed to give full, even Wi-Fi coverage across three floors.",
        "Full coverage across three floors may require Wi-Fi boosters, a mesh Wi-Fi system, or additional access points, and possibly extra cabling.",
        "Boosters, mesh systems, access points and any additional cabling are NOT included in this order and are chargeable as extra.",
        "Wi-Fi performance is affected by walls, floors, mirrors, metal fittings, salon equipment and the number of connected devices.",
      ],
    },
    {
      title: "Cancellation, cease and transfer-away charges",
      intro: CEASE_TEXT,
    },
    {
      title: "Signature",
      intro: "By signing below you confirm the details in this pack are correct and you wish to proceed.",
      bullets: [
        "Customer full name and business name are captured with your signature.",
        "Your email address, IP address and the exact date and time of signing are recorded as part of your digital signature evidence.",
        "A copy of this signed Contract Summary is emailed to you and stored in your OCCTA account.",
      ],
    },
  ],
} as const;

const INTERNAL_PACK = {
  visibility: "admin_only",
  supplier_route: "Sky FTTP 80/20, 1-month route, standard installation, Business Hub router",
  reason: [
    "Standard installation available.",
    "Earliest confirmed requested appointment: 1 September 2026, 1:00 pm to 4:00 pm.",
    "Business Hub is the correct router option for this route.",
    "Customer pricing has been uplifted to keep OCCTA profitable.",
  ],
  cost: {
    broadband_monthly: { ex_vat: 27.00, inc_vat: 32.40 },
    router_monthly: { ex_vat: 1.00, inc_vat: 1.20 },
    router_one_off: { ex_vat: 65.00, inc_vat: 78.00 },
    installation: { ex_vat: 69.00, inc_vat: 82.80 },
  },
  customer_charge: {
    broadband_monthly: { ex_vat: 31.66, inc_vat: 37.99 },
    router_monthly: { ex_vat: 4.16, inc_vat: 4.99 },
    router_one_off: { ex_vat: 73.33, inc_vat: 88.00 },
    installation: { ex_vat: 73.17, inc_vat: 87.80 },
  },
  margin_ex_vat: {
    broadband_monthly: 4.66,
    router_monthly: 3.16,
    total_recurring_monthly: 7.82,
    router_one_off: 8.33,
    installation_one_off: 4.17,
    total_one_off: 12.50,
    first_month_total: 20.32,
    estimated_12_month: 106.34,
  },
} as const;

function buildEmail(opts: { csNumber: string; csUrl: string; daysValid: number }) {
  const { csNumber, csUrl, daysValid } = opts;
  const row = (l: string, v: string) =>
    `<tr><td style="padding:8px 14px;font-size:13px;color:#555;border-top:1px solid #ddd;">${escapeHtml(l)}</td><td style="padding:8px 14px;font-size:13px;border-top:1px solid #ddd;">${v}</td></tr>`;
  return brutalistEmailShell(
    "Your OCCTA broadband agreement — ready to sign",
    `<p>Hi ${escapeHtml(ORDER.contact_name)},</p>
     <p>Thanks for choosing OCCTA for <strong>${escapeHtml(ORDER.business_name)}</strong>. Everything for your order is set out in full below and in your Contract Summary <strong>${escapeHtml(csNumber)}</strong>. Please read it, tick each acknowledgement and sign — we place the order with the network only after you've signed.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:collapse;border:3px solid #000;">
       <tr><td colspan="2" style="padding:10px 14px;background:#000;color:#facc15;font-size:11px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;">Your order</td></tr>
       ${row("Package", `<strong>${escapeHtml(ORDER.plan_name)}</strong> — 30-day rolling`)}
       ${row("Estimated speeds", `Up to ${ORDER.download} Mbps down / up to ${ORDER.upload} Mbps up`)}
       ${row("Monthly", `<strong>${f(ORDER.monthly_inc)} inc VAT</strong> (broadband ${f(ORDER.broadband_inc)} + router ${f(ORDER.router_month_inc)})`)}
       ${row("First payment", `<strong>${f(ORDER.first_payment_inc)} inc VAT</strong> — includes router ${f(ORDER.router_oneoff_inc)} and installation ${f(ORDER.install_inc)}`)}
       ${row("Installation", `1 September 2026, ${ORDER.install_window} — subject to final network confirmation`)}
       ${row("Installation address", escapeHtml(SERVICE_ADDRESS))}
       ${row("Payment", "Direct Debit — set up straight after signing")}
     </table>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:collapse;border:3px solid #000;">
       <tr><td colspan="2" style="padding:10px 14px;background:#000;color:#facc15;font-size:11px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;">Your first payment, itemised</td></tr>
       ${row("First month broadband", `${f(ORDER.broadband_inc)} inc VAT`)}
       ${row("First month router charge", `${f(ORDER.router_month_inc)} inc VAT`)}
       ${row("Router one-off charge", `${f(ORDER.router_oneoff_inc)} inc VAT`)}
       ${row("Standard installation / activation", `${f(ORDER.install_inc)} inc VAT`)}
       ${row("Total first payment", `<strong>${f(ORDER.first_payment_inc)} inc VAT</strong>`)}
       ${row("Every month after that", `<strong>${f(ORDER.monthly_inc)} inc VAT</strong> per month`)}
     </table>
     <p>Every figure above is explainable line by line — nothing is bundled or hidden. The one-off router and installation charges are paid once, with your first payment only; from month two you pay ${f(ORDER.monthly_inc)} inc VAT and nothing else unless you ask us for extra equipment or work.</p>
     <p style="margin:18px 0;padding:12px 14px;border:3px solid #000;background:#facc15;font-size:13px;font-weight:700;">Appointment slot: if you sign today before 6:00pm, we can hold your ${escapeHtml(ORDER.install_window)} appointment on 1 September 2026. If it's signed after 6:00pm, we'll book you the next available slot instead and confirm the new date with you.</p>
     <p><strong>Wi-Fi across three floors.</strong> The speeds above are delivered to the router. One router cannot be guaranteed to cover three floors evenly — boosters, mesh Wi-Fi or access points may be needed and are chargeable extra. This is set out in full in your Contract Summary so there are no surprises.</p>
     <p><strong>What happens next.</strong> Sign the Contract Summary, then complete your Direct Debit Instruction on the next screen. Once both are done we place the order and confirm your appointment.</p>
     <p style="font-size:12px;color:#555;">This signing link is private to you and expires in ${daysValid} days.</p>
     <p style="font-size:12px;color:#555;">Questions? Reply to this email or call us on 0800 260 6626.</p>`,
    { label: "Read and sign your Contract Summary", url: csUrl },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  // Internal service invocation (admin tooling / scripted remediation) or a
  // signed-in admin. Nothing else may reach this function.
  const internal = req.headers.get("x-internal-service") === "1" &&
    (req.headers.get("Authorization") ?? "").includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "\u0000");
  let actorId: string | null = null;
  if (!internal) {
    const auth = await requireStaff(req, ["admin", "super_admin"]);
    if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);
    actorId = auth.userId;
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const { action, confirm } = parsed.data;
  const daysValid = parsed.data.expires_in_days ?? 21;
  if (action !== "preview" && confirm !== true) {
    return jsonResponse({ error: "confirm_required", message: "Pass confirm:true for prepare/send." }, 400);
  }

  const supabase = getServiceClient();
  const appBase = Deno.env.get("APP_BASE_URL") || "https://www.occta.co.uk";

  if (action === "preview") {
    return jsonResponse({
      ok: true, action: "preview", email_sent: false,
      recipient: ORDER.email,
      service_address: SERVICE_ADDRESS,
      pack_sections: PACK_SECTIONS,
      internal_pack: INTERNAL_PACK,
      speed_notes: SPEED_NOTES,
      payment_schedule: PAYMENT_SCHEDULE,
      cease_cancellation_charges: CEASE_TEXT,
      email_html: buildEmail({ csNumber: "CS-XXXX-preview", csUrl: `${appBase}/quote/contract-summary/PREVIEW-TOKEN`, daysValid }),
    });
  }

  // ── Idempotency: reuse an unsigned pack for this customer if one exists ─────
  const { data: existingCs } = await supabase
    .from("contract_summaries")
    .select("*")
    .eq("customer_email_snapshot", ORDER.email)
    .in("status", ["draft", "issued", "viewed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: tpl } = await supabase
    .from("contract_summaries").select("*").eq("id", TEMPLATE_CS_ID).maybeSingle();
  if (!tpl) return jsonResponse({ error: "template_not_found" }, 500);

  let cs: any = existingCs;
  const nowIso = new Date().toISOString();
  const pair = await generateTokenPair();
  const tokenExpiresAt = new Date(Date.now() + daysValid * 86_400_000).toISOString();

  // ── Customer account (create once, reuse thereafter) ───────────────────────
  let customerId: string | null = cs?.customer_id ?? null;
  let accountNumber: string | null = cs?.account_number ?? null;
  if (!customerId) {
    const { data: existingProfile } = await supabase
      .from("profiles").select("id, account_number").eq("email", ORDER.email).maybeSingle();
    if (existingProfile) {
      customerId = existingProfile.id;
      accountNumber = existingProfile.account_number;
    } else {
      const { data: created, error: cErr } = await supabase.auth.admin.createUser({
        email: ORDER.email,
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { full_name: ORDER.contact_name, created_by_admin: actorId },
      });
      if (cErr || !created?.user) return jsonResponse({ error: "customer_create_failed", details: cErr?.message }, 500);
      customerId = created.user.id;
      await new Promise((r) => setTimeout(r, 600));
      await supabase.from("profiles").update({
        full_name: ORDER.contact_name,
        account_type: "business",
        business_trading_name: ORDER.business_name,
        address_line1: ORDER.address_line_1,
        city: ORDER.town,
        postcode: ORDER.postcode,
        admin_notes: `Business account — ${ORDER.business_name}. Created for bespoke business signature pack.`,
      }).eq("id", customerId);
      const { data: prof } = await supabase
        .from("profiles").select("account_number").eq("id", customerId).maybeSingle();
      accountNumber = prof?.account_number ?? null;
    }
  }

  if (!cs) {
    // ── Quote request + quote ────────────────────────────────────────────────
    const qrIns = await supabase.from("quote_requests").insert({
      customer_id: customerId,
      full_name: ORDER.contact_name,
      business_name: ORDER.business_name,
      email: ORDER.email,
      phone: "n/a",
      postcode: ORDER.postcode,
      address_line_1: ORDER.address_line_1,
      town: ORDER.town,
      service_interest: "broadband",
      plan_preference: "flex",
      customer_type: "business",
      preferred_contact_method: "email",
      source: "admin_business_pack",
      status: "quoted",
      message: `Bespoke business signature pack — ${ORDER.plan_name}, install ${ORDER.install_date} ${ORDER.install_window}.`,
    }).select("id").single();
    if (qrIns.error) return jsonResponse({ error: "quote_request_failed", details: qrIns.error.message }, 500);

    const qIns = await supabase.from("quotes").insert({
      quote_request_id: qrIns.data.id,
      customer_id: customerId,
      plan_name: ORDER.plan_name,
      service_type: "broadband",
      plan_type: "flex",
      customer_type: "business",
      monthly_net: ORDER.monthly_ex,
      monthly_vat_rate: 20,
      monthly_vat_amount: ORDER.monthly_vat,
      monthly_gross: ORDER.monthly_inc,
      router_net: ORDER.router_oneoff_ex,
      router_vat_amount: ORDER.router_oneoff_vat,
      router_gross: ORDER.router_oneoff_inc,
      installation_net: ORDER.install_ex,
      installation_vat_amount: ORDER.install_vat,
      installation_gross: ORDER.install_inc,
      total_due_today_gross: ORDER.first_payment_inc,
      estimated_download_speed: ORDER.download,
      estimated_upload_speed: ORDER.upload,
      speed_notes: SPEED_NOTES,
      notice_period: "30 days",
      notice_period_days: 30,
      status: "approved",
      speed_bucket: "essential",
      plan_term: "flex_30",
      supplier_name: "Sky",
      supplier_product_id: "sky_fttp_80_20_1m",
      admin_notes: `Internal route: ${INTERNAL_PACK.supplier_route}. First-month margin £${INTERNAL_PACK.margin_ex_vat.first_month_total.toFixed(2)} ex VAT.`,
      etf_policy_snapshot: tpl.etf_policy_snapshot,
    }).select("id").single();
    if (qIns.error) return jsonResponse({ error: "quote_failed", details: qIns.error.message }, 500);

    // ── Contract Summary ─────────────────────────────────────────────────────
    const csIns = await supabase.from("contract_summaries").insert({
      quote_id: qIns.data.id,
      quote_request_id: qrIns.data.id,
      customer_id: customerId,
      account_number: accountNumber,
      version: 1,
      status: "issued",
      customer_email_snapshot: ORDER.email,
      customer_name_snapshot: ORDER.contact_name,
      service_address: SERVICE_ADDRESS,
      plan_name: ORDER.plan_name,
      service_type: "broadband",
      plan_type: "flex",
      customer_type: "business",
      monthly_price_incl_vat: ORDER.monthly_inc,
      business_monthly_ex_vat: ORDER.monthly_ex,
      business_monthly_incl_vat: ORDER.monthly_inc,
      one_off_charges_json: [
        { label: "Router one-off charge", amount: ORDER.router_oneoff_inc },
        { label: "Standard installation / activation", amount: ORDER.install_inc },
      ],
      router_charge: ORDER.router_oneoff_inc,
      installation_charge: ORDER.install_inc,
      setup_charge: 0,
      delivery_charge: 0,
      contract_length: "Flex 30 — 30-day rolling. Cancel with 30 days notice.",
      notice_period: "30 days",
      notice_period_days: 30,
      minimum_term_months: 1,
      estimated_download_speed: ORDER.download,
      estimated_upload_speed: ORDER.upload,
      speed_notes: SPEED_NOTES,
      cease_cancellation_charges: CEASE_TEXT,
      payment_schedule: PAYMENT_SCHEDULE,
      price_rise_policy: tpl.price_rise_policy,
      vulnerable_customer_note: tpl.vulnerable_customer_note,
      complaints_adr_info: tpl.complaints_adr_info,
      terms_version: tpl.terms_version,
      privacy_version: tpl.privacy_version,
      billing_start_rule: tpl.billing_start_rule,
      etf_policy_snapshot: tpl.etf_policy_snapshot,
      speed_bucket: "essential",
      plan_term: "flex_30",
      router_option: { option: "business_hub", label: "Business-grade router", oneOff: ORDER.router_oneoff_inc, monthly: ORDER.router_month_inc },
      setup_option: { option: "standard_installation", label: "Standard installation / activation", oneOff: ORDER.install_inc },
      pack_sections: PACK_SECTIONS,
      internal_pack: INTERNAL_PACK,
      public_token_hash: pair.hash,
      token_expires_at: tokenExpiresAt,
      issued_at: nowIso,
      is_information_update: false,
    }).select("*").single();
    if (csIns.error) return jsonResponse({ error: "cs_failed", details: csIns.error.message }, 500);
    cs = csIns.data;

    // ── Order shell (awaiting signature) ─────────────────────────────────────
    await supabase.from("orders").insert({
      user_id: customerId,
      customer_id: customerId,
      service_type: "broadband",
      plan_name: ORDER.plan_name,
      plan_price: ORDER.monthly_inc,
      postcode: ORDER.postcode,
      address_line1: ORDER.address_line_1,
      city: ORDER.town,
      installation_date: ORDER.install_date,
      preferred_start_date: ORDER.install_date,
      expected_activation_date: ORDER.install_date,
      status: "pending",
      lifecycle_status: "order_received",
      payment_method: "direct_debit",
      quote_id: qIns.data.id,
      contract_summary_id: cs.id,
      customer_type_v2: "business",
      business_billing_contact: `${ORDER.contact_name} — ${ORDER.email}`,
      internal_notes: `Awaiting signature. Route: ${INTERNAL_PACK.supplier_route}. Appointment ${ORDER.install_date} ${ORDER.install_window}.`,
    });
  } else {
    // Rotate the signing token so the link is guaranteed live, and refresh pack content.
    const { error: updErr } = await supabase.from("contract_summaries").update({
      public_token_hash: pair.hash,
      token_expires_at: tokenExpiresAt,
      pack_sections: PACK_SECTIONS,
      internal_pack: INTERNAL_PACK,
    }).eq("id", cs.id);
    if (updErr) return jsonResponse({ error: "token_rotate_failed", details: updErr.message }, 500);
  }

  // ── Direct Debit setup link, carried into the pack for post-signature ──────
  // Superseded links are archived so only the newest one is live.
  await supabase.from("payment_requests").update({
    archived_at: nowIso,
    archived_reason: "Superseded by a fresh Direct Debit setup link issued with the signature pack.",
  }).eq("user_id", customerId).eq("type", "dd_setup").is("archived_at", null);

  const ddPair = await generateTokenPair();
  const ddIns = await supabase.from("payment_requests").insert({
    user_id: customerId,
    type: "dd_setup",
    status: "sent",
    amount: 0,
    currency: "GBP",
    customer_email: ORDER.email,
    customer_name: ORDER.contact_name,
    account_number: accountNumber,
    notes: `Direct Debit for ${ORDER.business_name} — first payment ${f(ORDER.first_payment_inc)}, then ${f(ORDER.monthly_inc)}/mo.`,
    token_hash: ddPair.hash,
    expires_at: new Date(Date.now() + 60 * 86_400_000).toISOString(),
    created_by: actorId,
    // contract_summary_id is deliberately not set: CS-linked payment requests
    // are only permitted once the Contract Summary has been signed.
    metadata: { contract_summary_id: cs.id, cs_number: cs.cs_number, purpose: "business_signature_pack" },
  }).select("id, payment_request_number").single();
  if (ddIns.error) return jsonResponse({ error: "dd_link_failed", details: ddIns.error.message }, 500);

  const ddPath = `/dd/setup?token=${encodeURIComponent(ddPair.raw)}`;
  await supabase.from("contract_summaries").update({
    pack_sections: { ...PACK_SECTIONS, dd_setup_path: ddPath },
  }).eq("id", cs.id);

  // ── Immutable PDF ──────────────────────────────────────────────────────────
  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const pdfRes = await fetch(`${projectUrl}/functions/v1/generate-contract-summary-pdf`, {
    method: "POST",
    headers: { Authorization: `Bearer ${svcKey}`, "Content-Type": "application/json", "x-internal-service": "1" },
    body: JSON.stringify({ contract_summary_id: cs.id, internal: true, actor_id: actorId }),
  });
  if (!pdfRes.ok) {
    const body = await pdfRes.text().catch(() => "");
    return jsonResponse({ error: "pdf_generation_failed", contract_summary_id: cs.id, details: body.slice(0, 300) }, 502);
  }

  const csUrl = `${appBase}/quote/contract-summary/${pair.raw}`;
  const html = buildEmail({ csNumber: String(cs.cs_number), csUrl, daysValid });

  if (action === "prepare") {
    return jsonResponse({
      ok: true, action: "prepare", email_sent: false,
      customer_id: customerId,
      account_number: accountNumber,
      contract_summary_id: cs.id,
      cs_number: cs.cs_number,
      signing_url: csUrl,
      dd_setup_url: `${appBase}${ddPath}`,
      dd_payment_request: ddIns.data.payment_request_number,
      token_expires_at: tokenExpiresAt,
      email_html: html,
    });
  }

  const send = await sendResendEmail({
    to: ORDER.email,
    subject: `${ORDER.contact_name}, your OCCTA broadband agreement is ready to sign (${cs.cs_number})`,
    html,
    replyTo: "hello@occta.co.uk",
  });

  await supabase.from("contract_summaries").update({ emailed_at: new Date().toISOString() }).eq("id", cs.id);
  await supabase.from("communications_log").insert({
    user_id: customerId,
    template_name: "business_signature_pack_issued",
    recipient_email: ORDER.email,
    subject: `Your OCCTA broadband agreement is ready to sign (${cs.cs_number})`,
    status: send?.ok === false ? "failed" : "sent",
    metadata: { contract_summary_id: cs.id, cs_number: cs.cs_number, signing_url_hash: await sha256Hex(csUrl) },
  }).then(undefined, () => {});

  return jsonResponse({
    ok: true, action: "send", email_sent: send?.ok !== false,
    contract_summary_id: cs.id, cs_number: cs.cs_number,
    signing_url: csUrl, dd_setup_url: `${appBase}${ddPath}`,
  });
});

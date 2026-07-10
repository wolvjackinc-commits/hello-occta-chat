// Admin-only legacy contract remediation flow.
//
// One-shot remediation for the legacy Dullabhbhai Mistry account (OCC70547490).
// Exposes two actions on the same endpoint:
//   - action: "preview"  → returns everything that WOULD be created/sent.
//                          Makes NO writes.
//   - action: "send"     → creates the quote_request + quote, blocks billing
//                          on the existing service until acceptance, sends the
//                          daughter email with the unified journey link and
//                          logs an audit row + admin task.
//
// Hard constraints (see user request):
//   * Do not create a second service — reuse the existing service row.
//   * Do not create invoices, payment_requests, or receipts.
//   * Do not touch signed Contract Summary PDFs/hashes.
//   * Do not send anything on preview.
//   * Refuse if an active remediation quote already exists.

import {
  corsHeaders,
  jsonResponse,
  getServiceClient,
  requireStaff,
  generateTokenPair,
  sendResendEmail,
  brutalistEmailShell,
  escapeHtml,
  recordEmailCommunication,
} from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

// --- Locked configuration for this remediation --------------------------------
const TARGET_ACCOUNT_NUMBER = "OCC70547490";
const PLAN_NAME = "OCCTA Unlimited UK Calls — Contract Saver 24";
const SERVICE_WORDING = "Digital Voice / Home Phone / Landline replacement";
const MONTHLY_NET = 33.33;
const MONTHLY_VAT = 6.67;
const MONTHLY_GROSS = 40.0;
const VAT_RATE = 20;
const BILLING_ANCHOR_DAY = 1;
const EFFECTIVE_START_ISO = "2026-08-01";
const RECIPIENT_EMAIL = "previnamistry67@gmail.com";
const CONTRACT_LENGTH_MONTHS = 24;
const PLAN_TYPE = "contract_saver";
const EMAIL_SUBJECT = "New 24-month Contract Saver home phone agreement — Dullabhbhai Mistry";
const USAGE_WORDING =
  "Unlimited UK calls are for normal residential use to standard UK numbers. " +
  "International, premium-rate, special-rate, non-geographic chargeable numbers, " +
  "directory enquiry services and any out-of-bundle usage may be charged separately where applicable. " +
  "Future network/supplier changes linked to the UK digital phone switchover may affect services or charges, " +
  "but OCCTA will explain any confirmed changes to you before applying them.";
const REMEDIATION_TAG = "legacy_remediation_v1";

// --- Final legacy quarterly invoice (May–Jul 2026) ---------------------------
// This is the final legacy landline bill before the new Contract Saver 24
// starts on 01 Aug 2026. Mixed VAT treatment because OCCTA VAT registration
// is effective 01 Jul 2026 — May + June are outside registration (no VAT),
// July is inside registration (VAT @ 20%). Recomposed to preserve the same
// £70.25 quarterly total the customer was paying under the legacy plan.
const LEGACY_INV_PERIOD_START = "2026-05-01";
const LEGACY_INV_PERIOD_END = "2026-07-31";
const LEGACY_INV_TOTAL = 70.25;
const LEGACY_INV_SUBTOTAL = 66.35; // 23.42 + 23.42 + 19.51
const LEGACY_INV_VAT_TOTAL = 3.90; // July line only, 20% of 19.51 rounded
const LEGACY_INV_LINES = [
  {
    description:
      "OCCTA Talk — Final legacy quarterly landline service (May 2026). " +
      "Includes share of 200 UK landline minutes and 50 UK mobile minutes. " +
      "Outside OCCTA VAT registration period (registration effective 01 Jul 2026) — no VAT applied.",
    net: 23.42,
    vat_rate: 0,
  },
  {
    description:
      "OCCTA Talk — Final legacy quarterly landline service (June 2026). " +
      "Outside OCCTA VAT registration period (registration effective 01 Jul 2026) — no VAT applied.",
    net: 23.42,
    vat_rate: 0,
  },
  {
    description:
      "OCCTA Talk — Final legacy quarterly landline service (July 2026). " +
      "VAT applied at 20% (OCCTA VAT registration effective 01 Jul 2026).",
    net: 19.51,
    vat_rate: 20,
  },
];
const LEGACY_INV_NOTES =
  "OCCTA Talk — Final legacy quarterly landline service (May 2026 – July 2026). " +
  "Includes 200 UK landline minutes and 50 UK mobile minutes. " +
  "From 01 Aug 2026, the account is being moved to the new OCCTA Unlimited UK Calls — Contract Saver 24 " +
  "plan subject to customer acceptance. Mixed VAT: May+June outside VAT registration, July at 20% " +
  "(OCCTA VAT registration effective 01 Jul 2026).";

const Schema = z.object({
  action: z.enum(["preview", "send"]),
  customer_id: z.string().uuid(),
  confirm: z.boolean().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  try {
  const auth = await requireStaff(req, ["admin", "super_admin"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const { action, customer_id, confirm } = parsed.data;

  const supabase = getServiceClient();

  // Load customer + gate on the specific account this flow is designed for.
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, account_number, full_name, email, archived_at")
    .eq("id", customer_id)
    .maybeSingle();
  if (profErr) return jsonResponse({ error: "profile_lookup_failed", details: profErr.message }, 500);
  if (!profile) return jsonResponse({ error: "profile_not_found" }, 404);
  if (profile.account_number !== TARGET_ACCOUNT_NUMBER) {
    return jsonResponse({ error: "not_eligible", message: "This flow is scoped to the specific legacy account only." }, 403);
  }
  if (profile.archived_at) return jsonResponse({ error: "profile_archived" }, 409);

  // Load the single existing service — we reuse it, we do not create another.
  const { data: services, error: svcErr } = await supabase
    .from("services")
    .select("id, service_type, status, plan_name, price_monthly, billing_enabled, billing_anchor_day, contract_summary_id, archived_at")
    .eq("user_id", customer_id)
    .is("archived_at", null);
  if (svcErr) return jsonResponse({ error: "service_lookup_failed", details: svcErr.message }, 500);
  if (!services || services.length === 0) return jsonResponse({ error: "no_service" }, 409);
  if (services.length > 1) return jsonResponse({ error: "ambiguous_service", details: "Multiple active services on this customer — resolve manually." }, 409);
  const service = services[0];

  // Look up any existing final legacy invoice for the May–Jul 2026 period
  // (idempotency guard — we never issue two).
  const { data: existingLegacyInvoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, issue_date, due_date, total, subtotal, vat_total, billing_period_start, billing_period_end")
    .eq("user_id", customer_id)
    .eq("billing_period_start", LEGACY_INV_PERIOD_START)
    .eq("billing_period_end", LEGACY_INV_PERIOD_END)
    .order("created_at", { ascending: false })
    .limit(1);
  const existingLegacyInvoice = existingLegacyInvoices?.[0] ?? null;

  // Look up any existing card_payment payment_request linked to that invoice.
  let existingLegacyPr: { id: string; payment_request_number: string | null; status: string } | null = null;
  if (existingLegacyInvoice) {
    const { data: prs } = await supabase
      .from("payment_requests")
      .select("id, payment_request_number, status")
      .eq("invoice_id", existingLegacyInvoice.id)
      .eq("type", "card_payment")
      .order("created_at", { ascending: false })
      .limit(1);
    existingLegacyPr = prs?.[0] ?? null;
  }

  // Idempotency: refuse if an active remediation quote already exists.
  const { data: prior } = await supabase
    .from("quotes")
    .select("id, quote_number, status, admin_notes, created_at")
    .eq("customer_id", customer_id)
    .ilike("admin_notes", `%${REMEDIATION_TAG}%`)
    .not("status", "in", "(rejected,expired)")
    .order("created_at", { ascending: false })
    .limit(1);
  const existingRemediation = prior?.[0] ?? null;

  // Build the recipient/email preview payload.
  const emailSubject = EMAIL_SUBJECT;
  const preview = {
    customer: {
      id: profile.id,
      account_number: profile.account_number,
      full_name: profile.full_name,
      profile_email: profile.email,
    },
    recipient_email: RECIPIENT_EMAIL,
    existing_service: {
      id: service.id,
      service_type: service.service_type,
      current_plan: service.plan_name,
      current_price_monthly: service.price_monthly,
      billing_enabled: service.billing_enabled,
      billing_anchor_day: service.billing_anchor_day,
    },
    new_plan: {
      plan_name: PLAN_NAME,
      service_wording: SERVICE_WORDING,
      monthly_net: MONTHLY_NET,
      monthly_vat: MONTHLY_VAT,
      monthly_gross: MONTHLY_GROSS,
      vat_rate: VAT_RATE,
      plan_type: PLAN_TYPE,
      customer_type: "residential",
      contract_length_months: CONTRACT_LENGTH_MONTHS,
      usage_wording: USAGE_WORDING,
    },
    billing: {
      anchor_day: BILLING_ANCHOR_DAY,
      effective_start_date: EFFECTIVE_START_ISO,
      no_back_billing: true,
      collection_blocked_until: [
        "Contract Summary accepted",
        "DD mandate completed and active",
        "Advance notice requirements met",
      ],
    },
    already_remediated: existingRemediation
      ? {
          quote_id: existingRemediation.id,
          quote_number: existingRemediation.quote_number,
          status: existingRemediation.status,
          created_at: existingRemediation.created_at,
        }
      : null,
    legacy_invoice: {
      period_start: LEGACY_INV_PERIOD_START,
      period_end: LEGACY_INV_PERIOD_END,
      subtotal: LEGACY_INV_SUBTOTAL,
      vat_total: LEGACY_INV_VAT_TOTAL,
      total: LEGACY_INV_TOTAL,
      vat_treatment: "Mixed: May+June no VAT (pre-registration), July VAT @ 20% (from 01 Jul 2026).",
      lines: LEGACY_INV_LINES,
      already_created: existingLegacyInvoice
        ? {
            id: existingLegacyInvoice.id,
            invoice_number: existingLegacyInvoice.invoice_number,
            status: existingLegacyInvoice.status,
            issue_date: existingLegacyInvoice.issue_date,
            due_date: existingLegacyInvoice.due_date,
            total: existingLegacyInvoice.total,
            payment_request_number: existingLegacyPr?.payment_request_number ?? null,
            payment_request_status: existingLegacyPr?.status ?? null,
          }
        : null,
    },
    email_subject: emailSubject,
    email_html_preview: buildEmailHtml({
      firstName: recipientFirstName(profile.full_name),
      journeyUrl: "https://www.occta.co.uk/quote/{TOKEN}",
      legacyInvoiceUrl: "https://www.occta.co.uk/pay?token={LEGACY_TOKEN}",
      legacyInvoiceNumber: existingLegacyInvoice?.invoice_number ?? "INV-<pending>",
      legacyInvoiceTotal: LEGACY_INV_TOTAL,
    }),
  };

  if (action === "preview") {
    return jsonResponse({ ok: true, action: "preview", preview });
  }

  // ---- SEND path -----------------------------------------------------------
  if (!confirm) return jsonResponse({ error: "confirmation_required", message: "Preview first, then call send with confirm=true." }, 400);
  if (existingRemediation) {
    return jsonResponse({
      error: "already_remediated",
      message: `A remediation quote already exists (${existingRemediation.quote_number}, status=${existingRemediation.status}). Refusing to duplicate.`,
      existing: existingRemediation,
    }, 409);
  }

  // 0. Create (or reuse) the final legacy invoice + payment_request BEFORE
  //    we create the Contract Saver 24 quote — so the daughter email carries
  //    both links in a single message. Idempotent on (user_id, period).
  let legacyInvoiceId = existingLegacyInvoice?.id ?? null;
  let legacyInvoiceNumber = existingLegacyInvoice?.invoice_number ?? null;
  let legacyPayToken: string | null = null;
  let legacyPrId: string | null = existingLegacyPr?.id ?? null;
  const todayIso = new Date().toISOString().slice(0, 10);
  const dueIso = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  if (!legacyInvoiceId) {
    const { data: newInv, error: invErr } = await supabase
      .from("invoices")
      .insert({
        user_id: customer_id,
        service_id: service.id,
        status: "issued",
        issue_date: todayIso,
        due_date: dueIso,
        currency: "GBP",
        subtotal: LEGACY_INV_SUBTOTAL,
        vat_total: LEGACY_INV_VAT_TOTAL,
        total: LEGACY_INV_TOTAL,
        vat_enabled: true,
        vat_rate: 20,
        billing_period_start: LEGACY_INV_PERIOD_START,
        billing_period_end: LEGACY_INV_PERIOD_END,
        invoice_type: "legacy_final_landline_quarter",
        notes: LEGACY_INV_NOTES,
      })
      .select("id, invoice_number")
      .single();
    if (invErr || !newInv) return jsonResponse({ error: "legacy_invoice_create_failed", details: invErr?.message }, 500);
    legacyInvoiceId = newInv.id;
    legacyInvoiceNumber = newInv.invoice_number;
    const lineRows = LEGACY_INV_LINES.map((l) => ({
      invoice_id: newInv.id,
      description: l.description,
      qty: 1,
      unit_price: l.net,
      vat_rate: l.vat_rate,
      line_total: l.net,
      metadata: { source: REMEDIATION_TAG },
    }));
    const { error: linesErr } = await supabase.from("invoice_lines").insert(lineRows);
    if (linesErr) {
      await supabase.from("invoices").delete().eq("id", newInv.id);
      return jsonResponse({ error: "legacy_invoice_lines_failed", details: linesErr.message }, 500);
    }
  }
  if (!legacyPrId) {
    const { raw: rawPayToken, hash: payTokenHash } = await generateTokenPair();
    const prExpires = new Date(Date.now() + 30 * 86400_000).toISOString();
    const { data: newPr, error: prErr } = await supabase
      .from("payment_requests")
      .insert({
        user_id: customer_id,
        account_number: profile.account_number,
        type: "card_payment",
        status: "sent",
        amount: LEGACY_INV_TOTAL,
        currency: "GBP",
        invoice_id: legacyInvoiceId,
        due_date: dueIso,
        customer_email: RECIPIENT_EMAIL,
        customer_name: profile.full_name ?? "Dullabhbhai Mistry",
        notes: `Final legacy landline invoice ${legacyInvoiceNumber} — May–Jul 2026.`,
        token_hash: payTokenHash,
        expires_at: prExpires,
        created_by: auth.userId,
        metadata: { source: REMEDIATION_TAG, legacy_final_quarter: true },
      })
      .select("id")
      .single();
    if (prErr || !newPr) return jsonResponse({ error: "legacy_payment_request_failed", details: prErr?.message }, 500);
    legacyPrId = newPr.id;
    legacyPayToken = rawPayToken;
  }
  const legacyInvoicePayUrl = legacyPayToken
    ? `https://www.occta.co.uk/pay?token=${legacyPayToken}`
    : null; // pre-existing PR: we don't have the raw token, admin must re-mint if needed

  // 1. Create the quote_request (source = 'admin_legacy_remediation').
  const { data: qr, error: qrErr } = await supabase
    .from("quote_requests")
    .insert({
      customer_id: customer_id,
      full_name: profile.full_name ?? "Dullabhbhai Mistry",
      email: RECIPIENT_EMAIL,
      phone: "",
      postcode: "CV21 2SX",
      address_line_1: "14 Manor Road",
      town: "Rugby",
      service_interest: "digital_voice",
      plan_preference: "contract_saver",
      customer_type: "residential",
      preferred_contact_method: "email",
      marketing_consent: false,
      status: "quoted",
      source: "admin_legacy_remediation",
      message: "Legacy contract remediation — new OCCTA Unlimited UK Calls agreement for existing landline customer.",
    })
    .select("id")
    .single();
  if (qrErr || !qr) return jsonResponse({ error: "quote_request_failed", details: qrErr?.message }, 500);

  // 2. Create the quote — plain flex, no setup/router/delivery/installation.
  const { raw: token, hash: tokenHash } = await generateTokenPair();
  const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString();
  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .insert({
      quote_request_id: qr.id,
      customer_id: customer_id,
      plan_name: PLAN_NAME,
      service_type: "digital_voice",
      plan_type: PLAN_TYPE,
      customer_type: "residential",
      contract_length_months: CONTRACT_LENGTH_MONTHS,
      monthly_net: MONTHLY_NET,
      monthly_vat_rate: VAT_RATE,
      monthly_vat_amount: MONTHLY_VAT,
      monthly_gross: MONTHLY_GROSS,
      setup_net: 0, setup_vat_amount: 0, setup_gross: 0,
      router_net: 0, router_vat_amount: 0, router_gross: 0,
      delivery_net: 0, delivery_vat_amount: 0, delivery_gross: 0,
      installation_net: 0, installation_vat_amount: 0, installation_gross: 0,
      total_due_today_gross: 0,
      speed_notes: SERVICE_WORDING,
      speed_disclaimer: USAGE_WORDING,
      expires_at: expiresAt,
      token_expires_at: expiresAt,
      public_token_hash: tokenHash,
      status: "sent",
      sent_at: new Date().toISOString(),
      locked_at: new Date().toISOString(),
      unified_journey_opt_in: true,
      admin_notes: `[${REMEDIATION_TAG}] Legacy remediation — Contract Saver 24 (24-month minimum term). Existing service ${service.id}. Billing anchor day 1, effective start ${EFFECTIVE_START_ISO}. Early termination charges may apply. Do not create invoice until CS accepted + DD mandate active.`,
      customer_notes: null,
      created_by: auth.userId,
    })
    .select("id, quote_number")
    .single();
  if (qErr || !quote) return jsonResponse({ error: "quote_create_failed", details: qErr?.message }, 500);

  // 3. Block billing on the existing service until CS is accepted + DD active.
  //    Reuse the same row — do NOT create a second service.
  const { error: svcUpdErr } = await supabase
    .from("services")
    .update({
      billing_enabled: false,
      billing_anchor_day: BILLING_ANCHOR_DAY,
      activation_notes: `[${REMEDIATION_TAG}] Billing paused pending new Contract Summary acceptance + DD mandate. Effective start ${EFFECTIVE_START_ISO}.`,
    })
    .eq("id", service.id);
  if (svcUpdErr) {
    // Roll back the quote so we don't leave a stray sent quote with no service block.
    await supabase.from("quotes").delete().eq("id", quote.id);
    await supabase.from("quote_requests").delete().eq("id", qr.id);
    return jsonResponse({ error: "service_update_failed", details: svcUpdErr.message }, 500);
  }

  // 4. Send the daughter email with the unified journey link.
  const journeyUrl = `https://www.occta.co.uk/quote/${token}`;
  const html = buildEmailHtml({
    firstName: recipientFirstName(profile.full_name),
    journeyUrl,
    legacyInvoiceUrl: legacyInvoicePayUrl,
    legacyInvoiceNumber: legacyInvoiceNumber ?? "",
    legacyInvoiceTotal: LEGACY_INV_TOTAL,
  });
  const sendRes = await sendResendEmail({
    to: RECIPIENT_EMAIL,
    subject: EMAIL_SUBJECT,
    html,
  });
  await recordEmailCommunication(supabase, {
    template_name: "legacy_remediation_agreement",
    recipient_email: RECIPIENT_EMAIL,
    sendResult: sendRes,
    metadata: { quote_id: quote.id, customer_id, service_id: service.id, tag: REMEDIATION_TAG },
    user_id: customer_id,
  });
  if (!sendRes.ok) {
    return jsonResponse({
      error: "email_send_failed",
      message: "Quote was created and billing was blocked, but the email failed. Resend from the Communications page.",
      quote_id: quote.id,
      quote_number: quote.quote_number,
      details: sendRes.error,
    }, 502);
  }

  // 5. Log audit + event + admin task.
  await supabase.from("audit_logs").insert({
    action: "send",
    entity: "quote",
    entity_id: quote.id,
    metadata: {
      flow: REMEDIATION_TAG,
      customer_id,
      account_number: profile.account_number,
      service_id: service.id,
      quote_number: quote.quote_number,
      recipient_email: RECIPIENT_EMAIL,
      billing_blocked: true,
      effective_start: EFFECTIVE_START_ISO,
      legacy_invoice_id: legacyInvoiceId,
      legacy_invoice_number: legacyInvoiceNumber,
      legacy_payment_request_id: legacyPrId,
    },
  });
  await supabase.rpc("log_event", {
    _actor_type: "admin",
    _event_type: "legacy_remediation_sent",
    _title: `Legacy remediation sent (${quote.quote_number})`,
    _details: { customer_id, service_id: service.id, recipient: RECIPIENT_EMAIL },
    _source_module: "quote",
    _quote_id: quote.id,
    _severity: "info",
  }).catch(() => {});
  await supabase.from("admin_tasks").insert({
    title: `Legacy remediation awaiting acceptance — ${profile.full_name ?? profile.account_number}`,
    description: `New agreement (${quote.quote_number}) sent to ${RECIPIENT_EMAIL}. Billing on service ${service.id} is paused until CS accepted + DD mandate active.`,
    priority: "high",
    status: "open",
    related_customer_id: customer_id,
    related_account_number: profile.account_number,
    related_quote_id: quote.id,
    created_by: auth.userId,
  });

  return jsonResponse({
    ok: true,
    action: "send",
    quote_id: quote.id,
    quote_number: quote.quote_number,
    journey_url: journeyUrl,
    service_id: service.id,
    billing_blocked: true,
    legacy_invoice_id: legacyInvoiceId,
    legacy_invoice_number: legacyInvoiceNumber,
    legacy_invoice_pay_url: legacyInvoicePayUrl,
  });
  } catch (err) {
    console.error("[admin-legacy-remediation] uncaught", err);
    return jsonResponse({
      error: "uncaught",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }, 500);
  }
});

function recipientFirstName(fullName: string | null | undefined): string {
  if (!fullName) return "there";
  return fullName.split(" ")[0] || "there";
}

function buildEmailHtml(opts: {
  firstName: string;
  journeyUrl: string;
  legacyInvoiceUrl: string | null;
  legacyInvoiceNumber: string;
  legacyInvoiceTotal: number;
}): string {
  const legacyBlock = `
    <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px 0;">Final legacy bill (May 2026 – July 2026)</h2>
    <p>Our records show the last confirmed paid invoice is <strong>INV-2605-0001</strong>, covering <strong>February 2026 to April 2026</strong>. That invoice was for <strong>£70.25</strong> and is marked as paid.</p>
    <p>We have now prepared the final legacy bill for the next period, <strong>1 May 2026 to 31 July 2026</strong>, to keep the account up to date before the new agreement starts.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 12px 0;font-size:13px;">
      <tr><td style="padding:4px 12px 4px 0;">Invoice</td><td style="padding:4px 0;"><strong>${escapeHtml(opts.legacyInvoiceNumber)}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;">Period</td><td style="padding:4px 0;">01 May 2026 – 31 July 2026</td></tr>
      <tr><td style="padding:4px 12px 4px 0;">Amount due</td><td style="padding:4px 0;"><strong>£${opts.legacyInvoiceTotal.toFixed(2)}</strong></td></tr>
    </table>
    <p style="font-size:12px;color:#555;">VAT is applied only to the July 2026 portion of this invoice, because OCCTA's VAT registration is effective from 01 July 2026. May and June are outside VAT registration and are shown without VAT.</p>
    ${opts.legacyInvoiceUrl ? `<p><a href="${opts.legacyInvoiceUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;font-weight:600;border:2px solid #111;">Pay the final legacy bill</a></p>` : ""}
  `;
  const body = `
    <p>Hello,</p>
    <p>We're writing about the OCCTA landline service for <strong>${escapeHtml(opts.firstName)}</strong> (account <strong>${TARGET_ACCOUNT_NUMBER}</strong>).</p>

    ${legacyBlock}

    <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px 0;">Why we're writing</h2>
    <p>Openreach is switching off the old copper phone network as part of the UK-wide <strong>Great Switch Off</strong>. Traditional landlines are being replaced with a <strong>Digital Voice / Home Phone</strong> service that runs over broadband. We need to move ${escapeHtml(opts.firstName)}'s service onto the new digital landline platform and put an up-to-date agreement in place.</p>

    <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px 0;">Your new plan</h2>
    <p style="margin:0 0 6px 0;"><strong>OCCTA Unlimited UK Calls — Contract Saver 24</strong> — Digital Voice / Home Phone / Landline replacement</p>
    <p>We are offering a new <strong>OCCTA Unlimited UK Calls — Contract Saver 24</strong> plan at <strong>£40.00 per month including VAT</strong>. This is a <strong>24-month agreement</strong> designed to give a clear fixed monthly price for the service during the contract term, subject to the terms of the agreement, fair usage and any applicable regulatory/network changes.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 12px 0;font-size:13px;">
      <tr><td style="padding:4px 12px 4px 0;">Monthly price</td><td style="padding:4px 0;"><strong>£40.00 inc VAT</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;">Net</td><td style="padding:4px 0;">£33.33</td></tr>
      <tr><td style="padding:4px 12px 4px 0;">VAT @ 20%</td><td style="padding:4px 0;">£6.67</td></tr>
      <tr><td style="padding:4px 12px 4px 0;">Contract</td><td style="padding:4px 0;"><strong>Contract Saver 24 — 24-month minimum term</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;">Billing date</td><td style="padding:4px 0;">1st of each month</td></tr>
      <tr><td style="padding:4px 12px 4px 0;">Starts</td><td style="padding:4px 0;">1 August 2026 (no back-billing)</td></tr>
    </table>
    <p style="font-size:12px;color:#555;">${escapeHtml(USAGE_WORDING)}</p>
    <p style="font-size:12px;color:#555;"><strong>Because this is a 24-month Contract Saver plan, early termination charges may apply if the service is cancelled before the end of the minimum term.</strong></p>

    <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px 0;">Future network migration</h2>
    <p>Future network/supplier changes linked to the UK digital phone switchover may affect services or charges. OCCTA will always explain any confirmed changes to you in writing before applying them, and there are <strong>no automatic annual or CPI price rises</strong>.</p>

    <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px 0;">What to do next</h2>
    <ol style="padding-left:18px;">
      <li>Open the secure link below.</li>
      <li>Review the Contract Summary (price, contract length, notice period, cancellation charges, digital voice power-cut warning).</li>
      <li>Tick to accept and e-sign.</li>
      <li>Enter the bank details to set up the Direct Debit mandate on the same secure page.</li>
    </ol>
    <p style="font-size:12px;color:#555;">Nothing will be charged until the agreement is accepted, the Direct Debit mandate is active, and advance notice requirements have been met.</p>

    <p style="font-size:11px;color:#777;margin-top:16px;">This secure link is unique to this account and expires in 30 days. If you have any questions before signing, reply to this email or call 0800 260 6626 (Mon–Fri, 9am–6pm).</p>

    <p style="font-size:11px;color:#777;margin-top:16px;">OCCTA Limited · VAT No. 520 6072 30</p>
  `;
  return brutalistEmailShell(
    "Your OCCTA landline — new agreement & Direct Debit",
    body,
    { label: "Review & accept agreement", url: opts.journeyUrl },
  );
}
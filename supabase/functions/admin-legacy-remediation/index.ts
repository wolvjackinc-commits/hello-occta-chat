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
//   * Refuse if a non-superseded remediation quote already exists.

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
const PLAN_NAME = "OCCTA Unlimited UK Calls";
const SERVICE_WORDING = "Digital Voice / Home Phone / Landline replacement";
const MONTHLY_NET = 33.33;
const MONTHLY_VAT = 6.67;
const MONTHLY_GROSS = 40.0;
const VAT_RATE = 20;
const BILLING_ANCHOR_DAY = 1;
const EFFECTIVE_START_ISO = "2026-08-01";
const RECIPIENT_EMAIL = "previnamistry67@gmail.com";
const USAGE_WORDING =
  "Unlimited UK calls are for normal residential use to standard UK numbers. " +
  "International, premium-rate, special-rate, non-geographic chargeable numbers, " +
  "directory enquiry services and any out-of-bundle usage may be charged separately where applicable.";
const REMEDIATION_TAG = "legacy_remediation_v1";

const Schema = z.object({
  action: z.enum(["preview", "send"]),
  customer_id: z.string().uuid(),
  confirm: z.boolean().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

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

  // Idempotency: refuse if a non-superseded remediation quote already exists.
  const { data: prior } = await supabase
    .from("quotes")
    .select("id, quote_number, status, admin_notes, created_at")
    .eq("customer_id", customer_id)
    .ilike("admin_notes", `%${REMEDIATION_TAG}%`)
    .neq("status", "superseded")
    .order("created_at", { ascending: false })
    .limit(1);
  const existingRemediation = prior?.[0] ?? null;

  // Build the recipient/email preview payload.
  const emailSubject = "Important: your OCCTA landline service — updated agreement & Direct Debit setup";
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
      plan_type: "flex",
      customer_type: "residential",
      contract_length_months: null,
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
    email_subject: emailSubject,
    email_html_preview: buildEmailHtml({
      firstName: recipientFirstName(profile.full_name),
      journeyUrl: "https://www.occta.co.uk/quote/{TOKEN}",
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
      plan_preference: "flex",
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
      plan_type: "flex",
      customer_type: "residential",
      contract_length_months: null,
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
      admin_notes: `[${REMEDIATION_TAG}] Legacy remediation — existing service ${service.id}. Billing anchor day 1, effective start ${EFFECTIVE_START_ISO}. Do not create invoice until CS accepted + DD mandate active.`,
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
  });
  const sendRes = await sendResendEmail({
    to: RECIPIENT_EMAIL,
    subject: "Important: your OCCTA landline service — updated agreement & Direct Debit setup",
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
  });
});

function recipientFirstName(fullName: string | null | undefined): string {
  if (!fullName) return "there";
  return fullName.split(" ")[0] || "there";
}

function buildEmailHtml(opts: { firstName: string; journeyUrl: string }): string {
  const body = `
    <p>Hello,</p>
    <p>We're writing about the OCCTA landline service for <strong>${escapeHtml(opts.firstName)}</strong> (account <strong>${TARGET_ACCOUNT_NUMBER}</strong>).</p>

    <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px 0;">Why we're writing</h2>
    <p>Openreach is switching off the old copper phone network as part of the UK-wide <strong>Great Switch Off</strong>. Traditional landlines are being replaced with a <strong>Digital Voice / Home Phone</strong> service that runs over broadband. We need to move ${escapeHtml(opts.firstName)}'s service onto the new digital landline platform and put an up-to-date agreement in place.</p>

    <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px 0;">Your new plan</h2>
    <p style="margin:0 0 6px 0;"><strong>OCCTA Unlimited UK Calls</strong> — Digital Voice / Home Phone / Landline replacement</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 12px 0;font-size:13px;">
      <tr><td style="padding:4px 12px 4px 0;">Monthly price</td><td style="padding:4px 0;"><strong>£40.00 inc VAT</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;">Net</td><td style="padding:4px 0;">£33.33</td></tr>
      <tr><td style="padding:4px 12px 4px 0;">VAT @ 20%</td><td style="padding:4px 0;">£6.67</td></tr>
      <tr><td style="padding:4px 12px 4px 0;">Contract</td><td style="padding:4px 0;">Flexible monthly — no minimum term</td></tr>
      <tr><td style="padding:4px 12px 4px 0;">Billing date</td><td style="padding:4px 0;">1st of each month</td></tr>
      <tr><td style="padding:4px 12px 4px 0;">Starts</td><td style="padding:4px 0;">1 August 2026 (no back-billing)</td></tr>
    </table>
    <p style="font-size:12px;color:#555;">${escapeHtml(USAGE_WORDING)}</p>

    <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px 0;">Future network migration</h2>
    <p>If Openreach or our upstream supplier changes wholesale costs for the digital landline platform in the future, we will always tell you in writing before any price change. You would have the right to leave penalty-free. There are <strong>no automatic annual or CPI price rises</strong>.</p>

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
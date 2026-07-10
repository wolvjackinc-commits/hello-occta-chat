// Admin-only legacy contract remediation flow — Abhay Pratap Singh.
//
// Scoped to a specific email/name. Unlike the Dullabhbhai flow, this
// customer does NOT yet exist in the DB, so the send path also creates
// the auth user + profile + service on first invocation. Idempotent.
//
// Actions:
//   preview       → read-only. Reports whether the profile/service already
//                   exist (based on email), returns full plan/email preview.
//   send          → creates (if missing) auth user, profile, service,
//                   quote_request, quote; blocks billing on the service;
//                   emails the customer. NO invoice, NO payment_request,
//                   NO receipt.
//   resend_email  → reuses the existing remediation quote, rotates the
//                   journey token, re-emails. No new records.
//
// Hard constraints:
//   * No duplicate profile or service (idempotent lookups by email).
//   * No invoice, no payment_request, no receipt.
//   * Billing remains blocked until CS accepted + DD mandate active.
//   * Refuse if an active remediation quote already exists on send.

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

// --- Locked configuration for this remediation ------------------------------
const TARGET_EMAIL = "abhayaghori@gmail.com";
const FULL_NAME = "Abhay Pratap Singh";
const PHONE = "+44 7831 025074";
const ADDR_LINE1 = "41 Velocity West";
const CITY = "Leeds";
const POSTCODE = "LS11 9BG";
const SERVICE_ADDRESS_TEXT = `${ADDR_LINE1}, ${CITY}, ${POSTCODE}`;

const LEGACY_MONTHLY = 21.59;
const LATEST_PAYMENT_DATE_ISO = "2026-07-06";
const LATEST_PAYMENT_AMOUNT = 21.59;
const LATEST_PAYMENT_SOURCE = "admin_supplied";

const PLAN_NAME = "OCCTA Essential FTTC 40/10 — Contract Saver 24";
const SERVICE_WORDING = "Broadband — BTW FTTC 40/10";
const MONTHLY_NET = 29.16;
const MONTHLY_VAT = 5.83;
const MONTHLY_GROSS = 34.99;
const VAT_RATE = 20;
const BILLING_ANCHOR_DAY = 1;
const EFFECTIVE_START_ISO = "2026-08-01";
const CONTRACT_LENGTH_MONTHS = 24;
const PLAN_TYPE = "contract_saver";
const EMAIL_SUBJECT = "Your new 24-month OCCTA broadband agreement";
const USAGE_WORDING =
  "Actual broadband speeds may vary depending on line and network conditions. " +
  "Fair usage applies. Future network/supplier changes linked to the UK digital " +
  "switchover may affect services or charges, but OCCTA will explain any confirmed " +
  "changes in writing before applying them.";
const REMEDIATION_TAG = "abhay_legacy_remediation_v1";

const Schema = z.object({
  action: z.enum(["preview", "send", "resend_email"]),
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
    const { action, confirm } = parsed.data;

    const supabase = getServiceClient();

    // ---- Lookup existing profile by email (idempotency) ------------------
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, account_number, full_name, email, phone, address_line1, city, postcode, archived_at")
      .ilike("email", TARGET_EMAIL)
      .maybeSingle();

    let existingService: any = null;
    let existingRemediation: any = null;
    if (existingProfile) {
      const { data: services } = await supabase
        .from("services")
        .select("id, service_type, status, plan_name, price_monthly, billing_enabled, billing_anchor_day, service_address, archived_at")
        .eq("user_id", existingProfile.id)
        .is("archived_at", null);
      if (services && services.length > 1) {
        return jsonResponse({ error: "ambiguous_service", details: "Multiple active services on this customer — resolve manually." }, 409);
      }
      existingService = services?.[0] ?? null;

      const { data: prior } = await supabase
        .from("quotes")
        .select("id, quote_number, status, admin_notes, created_at")
        .eq("customer_id", existingProfile.id)
        .ilike("admin_notes", `%${REMEDIATION_TAG}%`)
        .not("status", "in", "(rejected,expired)")
        .order("created_at", { ascending: false })
        .limit(1);
      existingRemediation = prior?.[0] ?? null;
    }

    // ---- Build preview payload ------------------------------------------
    const preview = {
      customer: {
        exists: !!existingProfile,
        id: existingProfile?.id ?? null,
        account_number: existingProfile?.account_number ?? null,
        full_name: existingProfile?.full_name ?? FULL_NAME,
        email: existingProfile?.email ?? TARGET_EMAIL,
        phone: existingProfile?.phone ?? PHONE,
        address_line1: existingProfile?.address_line1 ?? ADDR_LINE1,
        city: existingProfile?.city ?? CITY,
        postcode: existingProfile?.postcode ?? POSTCODE,
        will_be_created: !existingProfile,
      },
      existing_service: existingService
        ? {
            id: existingService.id,
            service_type: existingService.service_type,
            current_plan: existingService.plan_name,
            current_price_monthly: existingService.price_monthly,
            billing_enabled: existingService.billing_enabled,
            billing_anchor_day: existingService.billing_anchor_day,
          }
        : {
            id: null,
            service_type: "broadband",
            current_plan: SERVICE_WORDING,
            current_price_monthly: LEGACY_MONTHLY,
            billing_enabled: false,
            billing_anchor_day: null,
            will_be_created: true,
          },
      legacy_snapshot: {
        legacy_monthly: LEGACY_MONTHLY,
        latest_payment_date: LATEST_PAYMENT_DATE_ISO,
        latest_payment_amount: LATEST_PAYMENT_AMOUNT,
        latest_payment_source: LATEST_PAYMENT_SOURCE,
        latest_payment_note:
          "Admin supplied latest payment evidence: £21.59 paid on 06 July 2026. System record not found / pending reconciliation.",
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
        july_double_charge_avoided: true,
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
      email_subject: EMAIL_SUBJECT,
      email_html_preview: buildEmailHtml({
        firstName: firstNameOf(existingProfile?.full_name ?? FULL_NAME),
        journeyUrl: "https://www.occta.co.uk/quote/{TOKEN}",
        accountNumber: existingProfile?.account_number ?? "<assigned on send>",
      }),
    };

    if (action === "preview") {
      return jsonResponse({ ok: true, action: "preview", preview });
    }

    // ---- RESEND EMAIL ---------------------------------------------------
    if (action === "resend_email") {
      if (!confirm) return jsonResponse({ error: "confirmation_required" }, 400);
      if (!existingProfile) return jsonResponse({ error: "no_customer" }, 409);
      if (!existingRemediation) {
        return jsonResponse({ error: "no_existing_quote", message: "No remediation quote to resend. Use action=send." }, 409);
      }
      const { raw: token, hash: tokenHash } = await generateTokenPair();
      const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString();
      const { error: qUpdErr } = await supabase
        .from("quotes")
        .update({ public_token_hash: tokenHash, token_expires_at: expiresAt, expires_at: expiresAt })
        .eq("id", existingRemediation.id);
      if (qUpdErr) return jsonResponse({ error: "quote_token_update_failed", details: qUpdErr.message }, 500);

      const journeyUrl = `https://www.occta.co.uk/quote/${token}`;
      const html = buildEmailHtml({
        firstName: firstNameOf(existingProfile.full_name ?? FULL_NAME),
        journeyUrl,
        accountNumber: existingProfile.account_number ?? "",
      });
      const sendRes = await sendResendEmail({ to: TARGET_EMAIL, subject: EMAIL_SUBJECT, html });
      await recordEmailCommunication(supabase, {
        template_name: "abhay_legacy_remediation_resend",
        recipient_email: TARGET_EMAIL,
        sendResult: sendRes,
        metadata: { quote_id: existingRemediation.id, customer_id: existingProfile.id, tag: REMEDIATION_TAG, resend: true },
        user_id: existingProfile.id,
      });
      if (!sendRes.ok) return jsonResponse({ error: "email_send_failed", details: sendRes.error }, 502);
      try {
        await supabase.rpc("log_event", {
          _actor_type: "admin",
          _event_type: "abhay_legacy_remediation_resent",
          _title: `Abhay legacy remediation resent (${existingRemediation.quote_number})`,
          _details: { customer_id: existingProfile.id, recipient: TARGET_EMAIL },
          _source_module: "quote",
          _quote_id: existingRemediation.id,
          _severity: "info",
        });
      } catch { /* ignore */ }
      return jsonResponse({
        ok: true,
        action: "resend_email",
        quote_id: existingRemediation.id,
        quote_number: existingRemediation.quote_number,
        journey_url: journeyUrl,
        service_id: existingService?.id ?? null,
        billing_blocked: true,
      });
    }

    // ---- SEND ------------------------------------------------------------
    if (!confirm) return jsonResponse({ error: "confirmation_required", message: "Preview first, then call send with confirm=true." }, 400);
    if (existingRemediation) {
      return jsonResponse({
        error: "already_remediated",
        message: `A remediation quote already exists (${existingRemediation.quote_number}, status=${existingRemediation.status}). Refusing to duplicate.`,
        existing: existingRemediation,
      }, 409);
    }

    // 0. Ensure profile exists (create auth user + backfill profile fields).
    let profileId = existingProfile?.id ?? null;
    let accountNumber = existingProfile?.account_number ?? null;
    if (!profileId) {
      const randomPassword = crypto.randomUUID() + crypto.randomUUID();
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: TARGET_EMAIL,
        password: randomPassword,
        email_confirm: true,
        user_metadata: { full_name: FULL_NAME, created_by_admin: auth.userId, source: REMEDIATION_TAG },
      });
      if (createErr || !newUser?.user) {
        return jsonResponse({ error: "user_create_failed", details: createErr?.message }, 500);
      }
      profileId = newUser.user.id;
      // Wait briefly for the profile-create trigger to run.
      await new Promise((r) => setTimeout(r, 600));
      const { error: updErr } = await supabase
        .from("profiles")
        .update({
          full_name: FULL_NAME,
          phone: PHONE,
          address_line1: ADDR_LINE1,
          city: CITY,
          postcode: POSTCODE,
          admin_notes: `[${REMEDIATION_TAG}] Legacy customer imported from paper/email records. Legacy monthly £${LEGACY_MONTHLY}. Latest payment £${LATEST_PAYMENT_AMOUNT} on ${LATEST_PAYMENT_DATE_ISO} (admin supplied — no system record).`,
        })
        .eq("id", profileId);
      if (updErr) return jsonResponse({ error: "profile_update_failed", details: updErr.message }, 500);
      const { data: fresh } = await supabase.from("profiles").select("account_number").eq("id", profileId).maybeSingle();
      accountNumber = fresh?.account_number ?? null;
    }

    // 1. Ensure a single active broadband service exists — reuse otherwise.
    let serviceId = existingService?.id ?? null;
    if (!serviceId) {
      const { data: newSvc, error: svcErr } = await supabase
        .from("services")
        .insert({
          user_id: profileId,
          service_type: "broadband",
          status: "active",
          plan_name: SERVICE_WORDING,
          price_monthly: LEGACY_MONTHLY,
          service_address: SERVICE_ADDRESS_TEXT,
          billing_enabled: false,
          billing_anchor_day: BILLING_ANCHOR_DAY,
          activation_notes: `[${REMEDIATION_TAG}] Legacy service imported. Billing paused pending new Contract Summary acceptance + DD mandate. Effective start ${EFFECTIVE_START_ISO}. Legacy monthly £${LEGACY_MONTHLY}. Latest payment £${LATEST_PAYMENT_AMOUNT} on ${LATEST_PAYMENT_DATE_ISO} (admin supplied).`,
          identifiers: { legacy: true, imported_from: REMEDIATION_TAG, service_wording: SERVICE_WORDING },
        })
        .select("id")
        .single();
      if (svcErr || !newSvc) return jsonResponse({ error: "service_create_failed", details: svcErr?.message }, 500);
      serviceId = newSvc.id;
    } else {
      // Existing service — block billing and align anchor.
      const { error: svcUpdErr } = await supabase
        .from("services")
        .update({
          billing_enabled: false,
          billing_anchor_day: BILLING_ANCHOR_DAY,
          activation_notes: `[${REMEDIATION_TAG}] Billing paused pending new Contract Summary acceptance + DD mandate. Effective start ${EFFECTIVE_START_ISO}.`,
        })
        .eq("id", serviceId);
      if (svcUpdErr) return jsonResponse({ error: "service_update_failed", details: svcUpdErr.message }, 500);
    }

    // 2. Create quote_request.
    const { data: qr, error: qrErr } = await supabase
      .from("quote_requests")
      .insert({
        customer_id: profileId,
        full_name: FULL_NAME,
        email: TARGET_EMAIL,
        phone: PHONE,
        postcode: POSTCODE,
        address_line_1: ADDR_LINE1,
        town: CITY,
        service_interest: "broadband",
        plan_preference: "contract_saver",
        customer_type: "residential",
        preferred_contact_method: "email",
        marketing_consent: false,
        status: "quoted",
        source: "admin_legacy_remediation",
        message: "Legacy broadband remediation — Contract Saver 24 renewal for existing FTTC 40/10 customer.",
      })
      .select("id")
      .single();
    if (qrErr || !qr) return jsonResponse({ error: "quote_request_failed", details: qrErr?.message }, 500);

    // 3. Create quote.
    const { raw: token, hash: tokenHash } = await generateTokenPair();
    const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString();
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .insert({
        quote_request_id: qr.id,
        customer_id: profileId,
        plan_name: PLAN_NAME,
        service_type: "broadband",
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
        admin_notes: `[${REMEDIATION_TAG}] Legacy broadband renewal — Contract Saver 24 (24-month minimum term). Existing/imported service ${serviceId}. Billing anchor day ${BILLING_ANCHOR_DAY}, effective start ${EFFECTIVE_START_ISO}. Legacy monthly £${LEGACY_MONTHLY}. Latest payment £${LATEST_PAYMENT_AMOUNT} on ${LATEST_PAYMENT_DATE_ISO} (admin supplied). Early termination charges may apply. Do not create invoice until CS accepted + DD mandate active.`,
        customer_notes: null,
        created_by: auth.userId,
      })
      .select("id, quote_number")
      .single();
    if (qErr || !quote) return jsonResponse({ error: "quote_create_failed", details: qErr?.message }, 500);

    // 4. Send email.
    const journeyUrl = `https://www.occta.co.uk/quote/${token}`;
    const html = buildEmailHtml({
      firstName: firstNameOf(FULL_NAME),
      journeyUrl,
      accountNumber: accountNumber ?? "",
    });
    const sendRes = await sendResendEmail({ to: TARGET_EMAIL, subject: EMAIL_SUBJECT, html });
    await recordEmailCommunication(supabase, {
      template_name: "abhay_legacy_remediation_agreement",
      recipient_email: TARGET_EMAIL,
      sendResult: sendRes,
      metadata: { quote_id: quote.id, customer_id: profileId, service_id: serviceId, tag: REMEDIATION_TAG },
      user_id: profileId,
    });
    if (!sendRes.ok) {
      return jsonResponse({
        error: "email_send_failed",
        message: "Quote was created and billing was blocked, but the email failed. Resend from the admin page.",
        quote_id: quote.id,
        quote_number: quote.quote_number,
        details: sendRes.error,
      }, 502);
    }

    // 5. Audit + admin task.
    await supabase.from("audit_logs").insert({
      actor_user_id: auth.userId,
      action: "send",
      entity: "quote",
      entity_id: quote.id,
      metadata: {
        flow: REMEDIATION_TAG,
        customer_id: profileId,
        account_number: accountNumber,
        service_id: serviceId,
        quote_number: quote.quote_number,
        recipient_email: TARGET_EMAIL,
        billing_blocked: true,
        effective_start: EFFECTIVE_START_ISO,
        legacy_monthly: LEGACY_MONTHLY,
        latest_payment_admin_supplied: { amount: LATEST_PAYMENT_AMOUNT, date: LATEST_PAYMENT_DATE_ISO },
      },
    });
    try {
      await supabase.rpc("log_event", {
        _actor_type: "admin",
        _event_type: "abhay_legacy_remediation_sent",
        _title: `Abhay legacy remediation sent (${quote.quote_number})`,
        _details: { customer_id: profileId, service_id: serviceId, recipient: TARGET_EMAIL },
        _source_module: "quote",
        _quote_id: quote.id,
        _severity: "info",
      });
    } catch { /* ignore */ }
    await supabase.from("admin_tasks").insert({
      title: `Legacy broadband remediation awaiting acceptance — ${FULL_NAME}`,
      description: `New 24-month agreement (${quote.quote_number}) sent to ${TARGET_EMAIL}. Billing on service ${serviceId} is paused until CS accepted + DD mandate active.`,
      priority: "high",
      status: "open",
      related_customer_id: profileId,
      related_account_number: accountNumber,
      related_quote_id: quote.id,
      created_by: auth.userId,
    });

    return jsonResponse({
      ok: true,
      action: "send",
      customer_id: profileId,
      account_number: accountNumber,
      customer_created: !existingProfile,
      service_id: serviceId,
      service_created: !existingService,
      quote_id: quote.id,
      quote_number: quote.quote_number,
      journey_url: journeyUrl,
      billing_blocked: true,
    });
  } catch (err) {
    console.error("[admin-abhay-remediation] uncaught", err);
    return jsonResponse({
      error: "uncaught",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }, 500);
  }
});

function firstNameOf(fullName: string | null | undefined): string {
  if (!fullName) return "there";
  return fullName.split(" ")[0] || "there";
}

function buildEmailHtml(opts: { firstName: string; journeyUrl: string; accountNumber: string }): string {
  const body = `
    <p>Dear Mr Singh,</p>
    <p>We are writing about your existing OCCTA broadband service at <strong>${escapeHtml(ADDR_LINE1)}, ${escapeHtml(POSTCODE)}</strong>${opts.accountNumber ? ` (account <strong>${escapeHtml(opts.accountNumber)}</strong>)` : ""}.</p>
    <p>Our records show that you are currently using an OCCTA broadband service delivered as <strong>BTW FTTC 40/10</strong>. You have been with OCCTA since before our new website and customer agreement system was introduced, so we are now updating your account into our current contract, billing and Direct Debit process.</p>
    <p>We understand your previous legacy monthly payment was <strong>£${LEGACY_MONTHLY.toFixed(2)}</strong>, and our admin note shows the latest payment of <strong>£${LATEST_PAYMENT_AMOUNT.toFixed(2)}</strong> was received on <strong>06 July 2026</strong>. We will use this to avoid double-charging the same billing period.</p>

    <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px 0;">Your new plan</h2>
    <p style="margin:0 0 6px 0;"><strong>${escapeHtml(PLAN_NAME)}</strong></p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 12px 0;font-size:13px;">
      <tr><td style="padding:4px 12px 4px 0;">Service</td><td style="padding:4px 0;">${escapeHtml(SERVICE_WORDING)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;">Monthly price</td><td style="padding:4px 0;"><strong>£${MONTHLY_GROSS.toFixed(2)} inc VAT</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;">Net</td><td style="padding:4px 0;">£${MONTHLY_NET.toFixed(2)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;">VAT @ ${VAT_RATE}%</td><td style="padding:4px 0;">£${MONTHLY_VAT.toFixed(2)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;">Contract</td><td style="padding:4px 0;"><strong>Contract Saver 24 — 24-month minimum term</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;">Billing date</td><td style="padding:4px 0;">1st of each month</td></tr>
      <tr><td style="padding:4px 12px 4px 0;">Starts</td><td style="padding:4px 0;">1 August 2026 (no back-billing)</td></tr>
    </table>
    <p>This is a renewal/regularisation of your existing OCCTA service and is not intended to create a duplicate service.</p>

    <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px 0;">Why the price is changing</h2>
    <p>Your previous legacy price is no longer sustainable because of increased supplier/network costs, support and billing platform costs, VAT compliance requirements, and wider UK telecom network changes. The new agreement gives you clear written terms, VAT invoices, online account records, and a fixed 24-month Contract Saver package for your existing FTTC 40/10 broadband service.</p>

    <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px 0;">UK telecom network changes</h2>
    <p>The UK's traditional analogue landline network is being retired and services are moving to digital technology. This national change affects many services delivered over the BT/Openreach network. As part of keeping customer accounts properly documented and ready for ongoing service, OCCTA is updating legacy customers onto clear current agreements. If any future migration or network change is required for your service, we will explain it before making the change.</p>

    <h2 style="font-size:15px;text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 8px 0;">Next steps</h2>
    <ol style="padding-left:18px;">
      <li>Review and accept the new 24-month agreement using the secure link below.</li>
      <li>Complete the Direct Debit mandate setup on the same secure page.</li>
      <li>Once the agreement and Direct Debit mandate are completed, we will confirm your next billing date.</li>
    </ol>
    <p style="font-size:12px;color:#555;">${escapeHtml(USAGE_WORDING)}</p>
    <p style="font-size:12px;color:#555;"><strong>Because this is a 24-month Contract Saver plan, early termination charges may apply if the service is cancelled before the end of the minimum term.</strong></p>

    <p style="font-size:11px;color:#777;margin-top:16px;">If you have any questions before signing, reply to this email or call 0800 260 6626 (Mon–Fri, 9am–6pm).</p>
    <p style="font-size:11px;color:#777;margin-top:8px;">OCCTA Limited · VAT No. 520 6072 30</p>
  `;
  return brutalistEmailShell(
    "Your OCCTA broadband — new 24-month agreement & Direct Debit",
    body,
    { label: "Review & accept agreement", url: opts.journeyUrl },
  );
}
// Admin-only legacy customer setup — Mrs Janet Banks (A00001).
//
// Live OCCTA customer. All correspondence goes to the authorised
// Court of Protection deputy (Debbie Syphas). Mrs Banks remains the
// account holder.
//
// Actions:
//   preview  → read-only. Reports what exists and what will be created.
//   prepare  → idempotently creates profile, landline service, quote
//              request, quote, Contract Summary (real signing token) and
//              a Direct Debit mandate setup link. Sends NOTHING.
//   send     → emails the deputy the branded confirmation containing the
//              real signing link and real DD mandate link. Requires the
//              links minted in this call (rotates tokens so the emailed
//              links are always live).
//
// Hard constraints:
//   * No duplicate profile / service / quote / Contract Summary / DD link.
//   * No bank details are ever collected, stored or displayed here.
//   * No email is sent unless action === "send" && confirm === true.

import {
  corsHeaders,
  jsonResponse,
  getServiceClient,
  requireStaff,
  generateTokenPair,
  sendResendEmail,
  escapeHtml,
  recordEmailCommunication,
} from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const TAG = "janet_banks_legacy_setup_v1";

const ACCOUNT_NUMBER = "A00001";
const HOLDER_NAME = "Mrs Janet Banks";
const CLI = "01903 213049";
const ADDR_LINE1 = "28 St. Wilfreds Road";
const CITY = "Worthing";
const POSTCODE = "BN14 8BA";
const SERVICE_ADDRESS_TEXT = `${ADDR_LINE1}, ${CITY}, ${POSTCODE}`;

const CONTACT_EMAIL = "debbie.syphas@hmrc.gov.uk";
const DEPUTY_NAME = "Debbie Syphas";
const DEPUTY_ROLE = "Joint Deputy for Property and Financial Affairs";
const CO_DEPUTY = "Gary Banks";
const SIGNATORY_NOTE =
  `${DEPUTY_NAME} — ${DEPUTY_ROLE} — is signing this agreement as authorised representative for ` +
  `${HOLDER_NAME} (account ${ACCOUNT_NUMBER}). Co-deputy: ${CO_DEPUTY}. ` +
  `${HOLDER_NAME} remains the account holder; her property and financial affairs are managed under ` +
  `Court of Protection deputyship.`;
const CARE_NOTE =
  `Mrs Banks' property and financial affairs are managed under Court of Protection deputyship. ` +
  `Correspond only with authorised deputy contacts (${DEPUTY_NAME}, ${CO_DEPUTY}). ` +
  `All contact should remain by email unless the deputy requests otherwise.`;

const PLAN_NAME = "OCCTA Talk Unlimited with Care Level 4";
const SERVICE_WORDING = "Landline / Telephone — OCCTA Talk Unlimited with Care Level 4";
const MONTHLY_GROSS = 57.0;
const MONTHLY_NET = 47.5;
const MONTHLY_VAT = 9.5;
const VAT_RATE = 20;
const INCLUDED = [
  "Unlimited UK 01, 02 and 03 calls",
  "Care Level 4",
  "Choose to Refuse",
  "1571 voicemail service",
];

const SALE_DATE = "12 February 2022";
const LIVE_DATE = "03 March 2022";
const WELCOME_PACK_DATE = "04 March 2022";
const ORIGINAL_TERM = "03 March 2022 to 02 March 2024";

const PAYMENT_AMOUNT = 719.66;
const PAYMENT_DATE = "10 August 2026";
const PAYMENT_DATE_ISO = "2026-08-10";
const PAYMENT_NOTE =
  `£${PAYMENT_AMOUNT.toFixed(2)} received on ${PAYMENT_DATE}, allocated to the outstanding balance calculated up to July 2026.`;

const DD_DAY = 1;
const DD_FIRST_DATE = "01 September 2026";
const DD_FIRST_DATE_ISO = "2026-09-01";
const DD_FIRST_AMOUNT = 114.0;
const DD_REGULAR_FROM = "01 October 2026";
const DD_REGULAR_FROM_ISO = "2026-10-01";

const NOTICE_TEXT = "30 days";
const CEASE_TEXT =
  "This telephone service is a rolling monthly arrangement with no minimum term and no early termination charge. " +
  "You may end it by giving 30 days' notice by email. Any charges for service already provided, and any unpaid " +
  "account balance, remain due. Where a network cease or engineering charge is unavoidable, OCCTA will confirm the " +
  "amount in writing before it is applied.";

const EMAIL_SUBJECT =
  `Mrs Janet Banks – Payment Received, Account Agreement and Direct Debit Setup / ${CLI}`;

const APP_BASE = Deno.env.get("APP_BASE_URL") || Deno.env.get("SITE_URL") || "https://www.occta.co.uk";

const Schema = z.object({
  action: z.enum(["preview", "prepare", "send"]),
  confirm: z.boolean().optional(),
});

type State = {
  profile: any | null;
  service: any | null;
  quote: any | null;
  contract_summary: any | null;
  dd_request: any | null;
};

async function loadState(supabase: any): Promise<State> {
  const { data: byAccount } = await supabase
    .from("profiles")
    .select("id, account_number, full_name, email, phone, address_line1, city, postcode, admin_notes, archived_at")
    .eq("account_number", ACCOUNT_NUMBER)
    .maybeSingle();
  let profile = byAccount ?? null;
  if (!profile) {
    const { data: byEmail } = await supabase
      .from("profiles")
      .select("id, account_number, full_name, email, phone, address_line1, city, postcode, admin_notes, archived_at")
      .ilike("email", CONTACT_EMAIL)
      .maybeSingle();
    profile = byEmail ?? null;
  }

  let service = null, quote = null, contract_summary = null, dd_request = null;
  if (profile) {
    const { data: svcs } = await supabase
      .from("services")
      .select("id, service_type, status, plan_name, price_monthly, billing_enabled, billing_anchor_day, identifiers, activation_notes")
      .eq("user_id", profile.id)
      .is("archived_at", null);
    service = (svcs ?? []).find((s: any) => String(s.identifiers?.setup_tag) === TAG)
      ?? (svcs ?? []).find((s: any) => s.service_type === "landline")
      ?? null;

    const { data: quotes } = await supabase
      .from("quotes")
      .select("id, quote_number, status, created_at, quote_request_id")
      .eq("customer_id", profile.id)
      .ilike("admin_notes", `%${TAG}%`)
      .order("created_at", { ascending: false })
      .limit(1);
    quote = quotes?.[0] ?? null;

    if (quote) {
      const { data: css } = await supabase
        .from("contract_summaries")
        .select("id, cs_number, status, version, token_expires_at, issued_at, accepted_at, is_information_update")
        .eq("quote_id", quote.id)
        .order("version", { ascending: false })
        .limit(1);
      contract_summary = css?.[0] ?? null;
    }

    const { data: dds } = await supabase
      .from("payment_requests")
      .select("id, payment_request_number, status, expires_at, created_at")
      .eq("user_id", profile.id)
      .eq("type", "dd_setup")
      .order("created_at", { ascending: false })
      .limit(1);
    dd_request = dds?.[0] ?? null;
  }
  return { profile, service, quote, contract_summary, dd_request };
}

function buildEmailHtml(opts: { signUrl: string; ddUrl: string }) {
  const li = INCLUDED.map((i) => `<li style="margin:4px 0;">${escapeHtml(i)}</li>`).join("");
  const btn = (label: string, url: string, primary: boolean) =>
    `<a href="${url}" style="display:inline-block;padding:14px 22px;border:2px solid #111;background:${primary ? "#111" : "#fff"};color:${primary ? "#fff" : "#111"};font-weight:700;text-decoration:none;font-size:14px;">${escapeHtml(label)}</a>`;
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111;">
  <div style="max-width:640px;margin:0 auto;padding:28px 24px;">
    <div style="border-bottom:3px solid #111;padding-bottom:12px;margin-bottom:22px;">
      <div style="font-size:22px;font-weight:800;letter-spacing:1px;">OCCTA</div>
      <div style="font-size:12px;color:#555;">Simple telecom. Clear terms.</div>
    </div>
    <h1 style="font-size:19px;margin:0 0 14px;">Payment received, account agreement and Direct Debit setup</h1>
    <p style="font-size:14px;line-height:1.6;">Dear ${escapeHtml(DEPUTY_NAME)},</p>
    <p style="font-size:14px;line-height:1.6;">Thank you for your payment of <strong>£${PAYMENT_AMOUNT.toFixed(2)}</strong>, received on <strong>${PAYMENT_DATE}</strong>. This has been allocated to the balance previously calculated up to <strong>July 2026</strong> for ${escapeHtml(HOLDER_NAME)}, account <strong>${ACCOUNT_NUMBER}</strong>, telephone number <strong>${escapeHtml(CLI)}</strong>.</p>

    <h2 style="font-size:15px;margin:24px 0 8px;border-bottom:2px solid #111;padding-bottom:6px;">Direct Debit — what happens next</h2>
    <p style="font-size:14px;line-height:1.6;">The next amount required by Direct Debit is <strong>£${DD_FIRST_AMOUNT.toFixed(2)}</strong>. This covers the August 2026 monthly service charge of £${MONTHLY_GROSS.toFixed(2)} and the September 2026 monthly service charge of £${MONTHLY_GROSS.toFixed(2)}.</p>
    <p style="font-size:14px;line-height:1.6;">The first Direct Debit collection will be taken on or after <strong>${DD_FIRST_DATE}</strong>. From <strong>${DD_REGULAR_FROM}</strong> onward, the regular Direct Debit will be <strong>£${MONTHLY_GROSS.toFixed(2)} per month</strong> while the service remains active, collected on the ${DD_DAY}st of each month.</p>

    <h2 style="font-size:15px;margin:24px 0 8px;border-bottom:2px solid #111;padding-bottom:6px;">Current package</h2>
    <p style="font-size:14px;line-height:1.6;margin:0 0 6px;"><strong>${escapeHtml(PLAN_NAME)}</strong><br/>£${MONTHLY_GROSS.toFixed(2)} per month inc VAT</p>
    <ul style="font-size:14px;line-height:1.6;padding-left:20px;">${li}</ul>

    <h2 style="font-size:15px;margin:24px 0 8px;border-bottom:2px solid #111;padding-bottom:6px;">Two things to complete online</h2>
    <p style="font-size:14px;line-height:1.6;">1. Read and sign the account agreement. You will be signing as authorised ${escapeHtml(DEPUTY_ROLE)} for ${escapeHtml(HOLDER_NAME)}.</p>
    <p style="margin:0 0 18px;">${btn("Read and sign the account agreement", opts.signUrl, true)}</p>
    <p style="font-size:14px;line-height:1.6;">2. Set up the Direct Debit securely online. Bank details are entered on our secure page only — please never send bank details by email.</p>
    <p style="margin:0 0 18px;">${btn("Set up the Direct Debit", opts.ddUrl, false)}</p>

    <h2 style="font-size:15px;margin:24px 0 8px;border-bottom:2px solid #111;padding-bottom:6px;">Contact</h2>
    <p style="font-size:14px;line-height:1.6;">All future communications will continue by email to this address. If anything needs clarifying, reply to this email or call us on 0800 260 6626.</p>
    <p style="font-size:14px;line-height:1.6;">Kind regards,<br/><strong>OCCTA Customer Care</strong></p>
    <div style="border-top:2px solid #111;margin-top:24px;padding-top:12px;font-size:11px;color:#555;line-height:1.6;">
      OCCTA LIMITED · hello@occta.co.uk · 0800 260 6626<br/>
      Both links above are private to this email address. Direct Debit payments are protected by the Direct Debit Guarantee.
    </div>
  </div></body></html>`;
}

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
    const nowIso = new Date().toISOString();
    let state = await loadState(supabase);

    const facts = {
      customer: {
        exists: !!state.profile,
        id: state.profile?.id ?? null,
        account_number: state.profile?.account_number ?? ACCOUNT_NUMBER,
        holder_name: HOLDER_NAME,
        cli: CLI,
        address: SERVICE_ADDRESS_TEXT,
        customer_type: "Residential / Consumer",
        account_status: "Active",
        contact_email: CONTACT_EMAIL,
        deputy: `${DEPUTY_NAME} — ${DEPUTY_ROLE}`,
        co_deputy: CO_DEPUTY,
        contact_preference: "Email only",
        care_note: CARE_NOTE,
        history: {
          telephone_sale_date: SALE_DATE,
          service_live_date: LIVE_DATE,
          welcome_pack_date: WELCOME_PACK_DATE,
          original_contract_period: ORIGINAL_TERM,
          service_status: "Active at supplier/account level",
          restriction: "Debt-management restriction to be reviewed/removed after payment and Direct Debit setup",
        },
      },
      service: {
        exists: !!state.service,
        id: state.service?.id ?? null,
        service_type: "Landline / Telephone",
        plan_name: PLAN_NAME,
        monthly_gross: MONTHLY_GROSS,
        monthly_net: MONTHLY_NET,
        monthly_vat: MONTHLY_VAT,
        vat_rate: VAT_RATE,
        vat_treatment: "inc VAT",
        billing_frequency: "Monthly",
        payment_method: "Direct Debit",
        dd_collection_day: DD_DAY,
        included: INCLUDED,
        notice_period: NOTICE_TEXT,
      },
      payment: { amount: PAYMENT_AMOUNT, date: PAYMENT_DATE, note: PAYMENT_NOTE },
      dd_schedule: {
        first_amount: DD_FIRST_AMOUNT,
        first_date: DD_FIRST_DATE,
        first_covers: `August 2026 £${MONTHLY_GROSS.toFixed(2)} + September 2026 £${MONTHLY_GROSS.toFixed(2)}`,
        regular_from: DD_REGULAR_FROM,
        regular_amount: MONTHLY_GROSS,
      },
      documents: {
        quote_number: state.quote?.quote_number ?? null,
        quote_status: state.quote?.status ?? null,
        cs_number: state.contract_summary?.cs_number ?? null,
        cs_status: state.contract_summary?.status ?? null,
        cs_version: state.contract_summary?.version ?? null,
        cs_accepted_at: state.contract_summary?.accepted_at ?? null,
        dd_request_number: state.dd_request?.payment_request_number ?? null,
        dd_request_status: state.dd_request?.status ?? null,
      },
      email_subject: EMAIL_SUBJECT,
      email_html_preview: buildEmailHtml({
        signUrl: `${APP_BASE}/quote/contract-summary/…`,
        ddUrl: `${APP_BASE}/dd/setup?token=…`,
      }),
      prepared: !!(state.contract_summary && state.dd_request),
    };

    if (action === "preview") {
      return jsonResponse({ ok: true, action: "preview", email_sent: false, preview: facts });
    }

    if (!confirm) {
      return jsonResponse({ error: "confirmation_required", message: "Preview first, then call again with confirm=true." }, 400);
    }

    // ---------------- PREPARE / SEND both need records + fresh links ----------
    // 1. Profile (idempotent).
    let profileId = state.profile?.id ?? null;
    let created = { profile: false, service: false, quote: false, contract_summary: false, dd_link: false };
    if (!profileId) {
      const { data: newUser, error: cErr } = await supabase.auth.admin.createUser({
        email: CONTACT_EMAIL,
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { full_name: HOLDER_NAME, created_by_admin: auth.userId, source: TAG },
      });
      if (cErr || !newUser?.user) return jsonResponse({ error: "user_create_failed", details: cErr?.message }, 500);
      profileId = newUser.user.id;
      created.profile = true;
      await new Promise((r) => setTimeout(r, 700));
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          full_name: HOLDER_NAME,
          account_number: ACCOUNT_NUMBER,
          phone: CLI,
          address_line1: ADDR_LINE1,
          city: CITY,
          postcode: POSTCODE,
          admin_notes:
            `[${TAG}] Account holder ${HOLDER_NAME} (${ACCOUNT_NUMBER}), CLI ${CLI}. ` +
            `Authorised representative: ${DEPUTY_NAME} — ${DEPUTY_ROLE}. Co-deputy: ${CO_DEPUTY}. ` +
            `Contact preference: email only. ${CARE_NOTE} ` +
            `History: telephone sale ${SALE_DATE}; service live ${LIVE_DATE}; welcome pack ${WELCOME_PACK_DATE}; ` +
            `original contract period ${ORIGINAL_TERM}. Payment: ${PAYMENT_NOTE} ` +
            `Debt-management restriction to be reviewed/removed after payment and Direct Debit setup.`,
        })
        .eq("id", profileId);
      if (pErr) return jsonResponse({ error: "profile_update_failed", details: pErr.message }, 500);
    }

    // 2. Landline service (idempotent).
    let serviceId = state.service?.id ?? null;
    const svcNotes =
      `[${TAG}] ${SERVICE_WORDING}. £${MONTHLY_GROSS.toFixed(2)}/month inc VAT, monthly billing by Direct Debit on the ${DD_DAY}st. ` +
      `Included: ${INCLUDED.join("; ")}. ${PAYMENT_NOTE} ` +
      `DD schedule: first collection £${DD_FIRST_AMOUNT.toFixed(2)} on or after ${DD_FIRST_DATE} (covers Aug 2026 £${MONTHLY_GROSS.toFixed(2)} + Sep 2026 £${MONTHLY_GROSS.toFixed(2)}); ` +
      `then £${MONTHLY_GROSS.toFixed(2)} per month from ${DD_REGULAR_FROM}. ` +
      `Recurring billing stays disabled until the agreement is signed and the Direct Debit mandate is active.`;
    const svcIdentifiers = {
      setup_tag: TAG,
      cli: CLI,
      legacy_account_number: ACCOUNT_NUMBER,
      service_wording: SERVICE_WORDING,
      dd_schedule: {
        first_collection_date: DD_FIRST_DATE_ISO,
        first_collection_amount: DD_FIRST_AMOUNT,
        first_collection_covers: ["2026-08", "2026-09"],
        regular_from: DD_REGULAR_FROM_ISO,
        regular_amount: MONTHLY_GROSS,
        collection_day: DD_DAY,
      },
      payment_history_note: { amount: PAYMENT_AMOUNT, received_on: PAYMENT_DATE_ISO, allocated_to: "balance up to July 2026" },
    };
    if (!serviceId) {
      const { data: svc, error: sErr } = await supabase
        .from("services")
        .insert({
          user_id: profileId,
          service_type: "landline",
          status: "active",
          plan_name: PLAN_NAME,
          price_monthly: MONTHLY_GROSS,
          service_address: SERVICE_ADDRESS_TEXT,
          billing_enabled: false,
          billing_anchor_day: DD_DAY,
          activation_notes: svcNotes,
          identifiers: svcIdentifiers,
        })
        .select("id")
        .single();
      if (sErr || !svc) return jsonResponse({ error: "service_create_failed", details: sErr?.message }, 500);
      serviceId = svc.id;
      created.service = true;
    } else {
      await supabase
        .from("services")
        .update({ billing_anchor_day: DD_DAY, activation_notes: svcNotes, identifiers: svcIdentifiers })
        .eq("id", serviceId);
    }

    // 3. Quote request + quote (idempotent, one per setup).
    let quoteId = state.quote?.id ?? null;
    let quoteNumber = state.quote?.quote_number ?? null;
    let quoteRequestId = state.quote?.quote_request_id ?? null;
    if (!quoteId) {
      const { data: qr, error: qrErr } = await supabase
        .from("quote_requests")
        .insert({
          customer_id: profileId,
          full_name: HOLDER_NAME,
          email: CONTACT_EMAIL,
          phone: CLI,
          postcode: POSTCODE,
          address_line_1: ADDR_LINE1,
          town: CITY,
          service_interest: "other",
          plan_preference: "flex",
          customer_type: "residential",
          preferred_contact_method: "email",
          marketing_consent: false,
          status: "final_quote_ready",
          source: "admin_legacy_setup",
          message: `Legacy telephone account setup — ${PLAN_NAME}. Authorised representative: ${DEPUTY_NAME} (${DEPUTY_ROLE}).`,
        })
        .select("id")
        .single();
      if (qrErr || !qr) return jsonResponse({ error: "quote_request_failed", details: qrErr?.message }, 500);
      quoteRequestId = qr.id;

      const { data: q, error: qErr } = await supabase
        .from("quotes")
        .insert({
          quote_request_id: qr.id,
          customer_id: profileId,
          plan_name: PLAN_NAME,
          service_type: "other",
          plan_type: "flex",
          plan_term: "flex_30",
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
          notice_period: NOTICE_TEXT,
          notice_period_days: 30,
          speed_notes: SERVICE_WORDING,
          expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
          status: "approved",
          approved_at: nowIso,
          locked_at: nowIso,
          admin_notes:
            `[${TAG}] Legacy telephone account agreement for ${HOLDER_NAME} (${ACCOUNT_NUMBER}), CLI ${CLI}. ` +
            `£${MONTHLY_GROSS.toFixed(2)}/month inc VAT, rolling monthly, 30 days' notice. Included: ${INCLUDED.join("; ")}. ` +
            `Signed by authorised deputy ${DEPUTY_NAME} (${DEPUTY_ROLE}). ${PAYMENT_NOTE} ` +
            `DD: £${DD_FIRST_AMOUNT.toFixed(2)} on/after ${DD_FIRST_DATE}, then £${MONTHLY_GROSS.toFixed(2)} monthly from ${DD_REGULAR_FROM}.`,
          created_by: auth.userId,
        })
        .select("id, quote_number")
        .single();
      if (qErr || !q) return jsonResponse({ error: "quote_create_failed", details: qErr?.message }, 500);
      quoteId = q.id;
      quoteNumber = q.quote_number;
      created.quote = true;

      await supabase
        .from("quote_requests")
        .update({ final_quote_id: quoteId, status: "final_quote_ready" })
        .eq("id", qr.id);
    }

    // 4. Contract Summary with a real signing token.
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let csId = state.contract_summary?.id ?? null;
    let csNumber = state.contract_summary?.cs_number ?? null;
    let csToken: string | null = null;

    if (state.contract_summary?.status === "accepted") {
      return jsonResponse({
        error: "already_accepted",
        message: `Contract Summary ${csNumber} has already been signed. Nothing further to issue.`,
      }, 409);
    }

    if (!csId) {
      const genRes = await fetch(`${projectUrl}/functions/v1/generate-contract-summary`, {
        method: "POST",
        headers: { Authorization: `Bearer ${svcKey}`, "Content-Type": "application/json", "x-internal-service": "1" },
        body: JSON.stringify({ quote_id: quoteId, internal: true, actor_id: auth.userId }),
      });
      const genBody = await genRes.json().catch(() => ({}));
      if (!genRes.ok || !genBody?.contract_summary_id) {
        return jsonResponse({ error: "contract_summary_failed", details: genBody?.error ?? genBody?.message ?? `HTTP ${genRes.status}` }, 502);
      }
      csId = genBody.contract_summary_id;
      csNumber = genBody.cs_number;
      csToken = genBody.public_token;
      created.contract_summary = true;
    } else {
      const { raw, hash } = await generateTokenPair();
      const { error: rotErr } = await supabase
        .from("contract_summaries")
        .update({
          public_token_hash: hash,
          token_expires_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
          status: "issued",
        })
        .eq("id", csId);
      if (rotErr) return jsonResponse({ error: "cs_token_rotate_failed", details: rotErr.message }, 500);
      csToken = raw;
    }

    // Deputy signing + care wording on the document, then refresh the PDF.
    const { data: csRow } = await supabase
      .from("contract_summaries")
      .select("vulnerable_customer_note")
      .eq("id", csId)
      .maybeSingle();
    const baseVulnerable = String(csRow?.vulnerable_customer_note ?? "").trim();
    const vulnerableNote = baseVulnerable.includes("Court of Protection")
      ? baseVulnerable
      : `${baseVulnerable}${baseVulnerable ? " " : ""}${CARE_NOTE}`;
    await supabase
      .from("contract_summaries")
      .update({
        authorised_signatory_note: SIGNATORY_NOTE,
        vulnerable_customer_note: vulnerableNote,
        cease_cancellation_charges: CEASE_TEXT,
        service_address: SERVICE_ADDRESS_TEXT,
        account_number: ACCOUNT_NUMBER,
        payment_schedule:
          `£${MONTHLY_GROSS.toFixed(2)} per month inc VAT by Direct Debit on the ${DD_DAY}st. ` +
          `First collection £${DD_FIRST_AMOUNT.toFixed(2)} on or after ${DD_FIRST_DATE} (August 2026 £${MONTHLY_GROSS.toFixed(2)} + September 2026 £${MONTHLY_GROSS.toFixed(2)}); ` +
          `then £${MONTHLY_GROSS.toFixed(2)} per month from ${DD_REGULAR_FROM} while the service remains active.`,
      })
      .eq("id", csId);

    await fetch(`${projectUrl}/functions/v1/generate-contract-summary-pdf`, {
      method: "POST",
      headers: { Authorization: `Bearer ${svcKey}`, "Content-Type": "application/json", "x-internal-service": "1" },
      body: JSON.stringify({ contract_summary_id: csId, internal: true, actor_id: auth.userId }),
    }).catch(() => {});

    // 5. Direct Debit mandate setup link (reuse the row, rotate the token).
    const { raw: ddRaw, hash: ddHash } = await generateTokenPair();
    const ddExpires = new Date(Date.now() + 30 * 86400_000).toISOString();
    const ddNotes =
      `[${TAG}] DD mandate for ${HOLDER_NAME} (${ACCOUNT_NUMBER}), CLI ${CLI}. Collection day ${DD_DAY}. ` +
      `First collection £${DD_FIRST_AMOUNT.toFixed(2)} on/after ${DD_FIRST_DATE}; then £${MONTHLY_GROSS.toFixed(2)} monthly from ${DD_REGULAR_FROM}. ` +
      `Signed by authorised deputy ${DEPUTY_NAME}.`;
    let ddId = state.dd_request?.id ?? null;
    let ddNumber = state.dd_request?.payment_request_number ?? null;
    if (!ddId) {
      const { data: pr, error: prErr } = await supabase
        .from("payment_requests")
        .insert({
          user_id: profileId,
          type: "dd_setup",
          status: "sent",
          amount: 0,
          currency: "GBP",
          customer_email: CONTACT_EMAIL,
          customer_name: HOLDER_NAME,
          account_number: ACCOUNT_NUMBER,
          notes: ddNotes,
          token_hash: ddHash,
          expires_at: ddExpires,
          created_by: auth.userId,
          metadata: {
            setup_tag: TAG,
            authorised_representative: { name: DEPUTY_NAME, role: DEPUTY_ROLE, co_deputy: CO_DEPUTY },
            schedule: {
              first_collection_date: DD_FIRST_DATE_ISO,
              first_collection_amount: DD_FIRST_AMOUNT,
              regular_from: DD_REGULAR_FROM_ISO,
              regular_amount: MONTHLY_GROSS,
              collection_day: DD_DAY,
            },
          },
        })
        .select("id, payment_request_number")
        .single();
      if (prErr || !pr) return jsonResponse({ error: "dd_link_failed", details: prErr?.message }, 500);
      ddId = pr.id;
      ddNumber = pr.payment_request_number;
      created.dd_link = true;
    } else {
      const { error: ddUpdErr } = await supabase
        .from("payment_requests")
        .update({ token_hash: ddHash, expires_at: ddExpires, status: "sent", notes: ddNotes })
        .eq("id", ddId);
      if (ddUpdErr) return jsonResponse({ error: "dd_link_rotate_failed", details: ddUpdErr.message }, 500);
    }

    const signUrl = `${APP_BASE}/quote/contract-summary/${csToken}`;
    const ddUrl = `${APP_BASE}/dd/setup?token=${encodeURIComponent(ddRaw)}`;

    // 6. Audit trail (no bank details, no tokens).
    await supabase.from("audit_logs").insert({
      actor_user_id: auth.userId,
      action: action === "send" ? "send" : "create",
      entity: "contract_summary",
      entity_id: csId,
      metadata: {
        setup_tag: TAG, account_number: ACCOUNT_NUMBER, quote_id: quoteId,
        dd_request_id: ddId, created, action,
      },
    }).then(undefined, () => {});

    await supabase.rpc("log_event", {
      _actor_type: "admin",
      _event_type: action === "send" ? "janet_banks_setup_email_sent" : "janet_banks_setup_prepared",
      _title: action === "send"
        ? `Janet Banks (${ACCOUNT_NUMBER}) setup email sent to authorised deputy`
        : `Janet Banks (${ACCOUNT_NUMBER}) setup prepared — no email sent`,
      _details: { created, cs_number: csNumber, quote_number: quoteNumber, dd_request_number: ddNumber, payment_note: PAYMENT_NOTE },
      _source_module: "contract_summary",
      _quote_id: quoteId,
      _contract_summary_id: csId,
      _customer_id: profileId,
    }).then(undefined, () => {});

    if (action === "prepare") {
      return jsonResponse({
        ok: true, action: "prepare", email_sent: false, created,
        customer_id: profileId, account_number: ACCOUNT_NUMBER, service_id: serviceId,
        quote_id: quoteId, quote_number: quoteNumber,
        contract_summary_id: csId, cs_number: csNumber,
        dd_request_id: ddId, dd_request_number: ddNumber,
        sign_url: signUrl, dd_url: ddUrl,
        email_subject: EMAIL_SUBJECT,
        email_html_preview: buildEmailHtml({ signUrl, ddUrl }),
      });
    }

    // ---------------- SEND ---------------------------------------------------
    const html = buildEmailHtml({ signUrl, ddUrl });
    const sendRes = await sendResendEmail({
      to: CONTACT_EMAIL,
      subject: EMAIL_SUBJECT,
      html,
      replyTo: "hello@occta.co.uk",
    });
    await recordEmailCommunication(supabase, {
      template_name: "janet_banks_agreement_and_dd_setup",
      recipient_email: CONTACT_EMAIL,
      sendResult: sendRes,
      metadata: {
        setup_tag: TAG, account_number: ACCOUNT_NUMBER, contract_summary_id: csId,
        cs_number: csNumber, dd_request_id: ddId, quote_id: quoteId, sent_by_admin: auth.userId,
      },
      user_id: profileId,
    });
    if (!sendRes.ok) {
      return jsonResponse({ error: "email_send_failed", details: (sendRes as { error?: string }).error }, 502);
    }
    await supabase.from("contract_summaries").update({ emailed_at: nowIso }).eq("id", csId);

    return jsonResponse({
      ok: true, action: "send", email_sent: true, recipient: CONTACT_EMAIL, created,
      customer_id: profileId, account_number: ACCOUNT_NUMBER, service_id: serviceId,
      quote_id: quoteId, quote_number: quoteNumber,
      contract_summary_id: csId, cs_number: csNumber,
      dd_request_id: ddId, dd_request_number: ddNumber,
      sign_url: signUrl, dd_url: ddUrl,
    });
  } catch (e) {
    return jsonResponse({ error: "unexpected", details: (e as Error)?.message }, 500);
  }
});

import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, getRequestIp, checkRateLimit, sendResendEmail, brutalistEmailShell, escapeHtml, maskEmail } from "../_shared/quoteHelpers.ts";
import { ACCEPTANCE_CHECKBOX_TEXT } from "../_shared/legalText.ts";
import { ensureCustomerFromAcceptedContract } from "../_shared/ensureCustomer.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { perfServe } from "../_shared/perfLog.ts";

// Phase C canonical four-checkbox wording. Stored verbatim + hashed into the
// acceptance evidence row.
export const JOURNEY_CHECKBOX_TEXTS = {
  received_read:
    "I confirm that I have received, read and had the opportunity to download my Contract Summary and Contract Information.",
  details_correct:
    "I confirm that my personal details and service address shown above are correct.",
  understand_charges:
    "I understand the monthly charges, one-off charges, contract duration, cancellation rights and payment arrangements.",
  consent:
    "I expressly consent to enter into the agreement with OCCTA LIMITED on the terms shown in my Contract Summary and Contract Information.",
} as const;

const Schema = z.object({
  token: z.string().min(16),
  accepted_by_name: z.string().trim().min(2).max(160),
  accepted_by_email: z.string().trim().toLowerCase().email().max(180),
  checkbox_confirmed: z.literal(true).optional(),
  // Phase C — unified-journey fields
  journey_mode: z.boolean().optional(),
  accepted_by_mobile: z.string().trim().min(7).max(32).optional(),
  address_confirmed: z.boolean().optional(),
  checkbox_received_read: z.boolean().optional(),
  checkbox_details_correct: z.boolean().optional(),
  checkbox_understand_charges: z.boolean().optional(),
  checkbox_consent: z.boolean().optional(),
  cs_version: z.number().int().optional(),
  source_route: z.string().max(200).optional(),
  session_id: z.string().max(120).optional(),
  // Phase 3 — date of birth captured at acceptance (18+ confirmation)
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Fraud / identity-theft prevention signals collected in the browser at the
  // moment of signing. Everything is optional and best-effort: a missing signal
  // must never stop a genuine customer signing.
  risk_signals: z.object({
    browser_timezone: z.string().max(80).optional(),
    browser_locale: z.string().max(40).optional(),
    screen_signature: z.string().max(60).optional(),
    platform: z.string().max(80).optional(),
    device_memory: z.union([z.string().max(20), z.number()]).optional(),
    hardware_concurrency: z.number().int().min(0).max(1024).optional(),
    touch_points: z.number().int().min(0).max(64).optional(),
    cookies_enabled: z.boolean().optional(),
    do_not_track: z.string().max(20).optional(),
    webdriver_flag: z.boolean().optional(),
    page_dwell_ms: z.number().int().min(0).max(86_400_000).optional(),
    geo_latitude: z.number().min(-90).max(90).optional(),
    geo_longitude: z.number().min(-180).max(180).optional(),
    geo_accuracy_m: z.number().min(0).max(10_000_000).optional(),
    geo_permission: z.string().max(20).optional(),
  }).partial().optional(),
});

function ageYears(dobIso: string): number {
  const dob = new Date(dobIso + "T00:00:00Z");
  if (isNaN(dob.getTime())) return -1;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

Deno.serve(perfServe("accept-contract-summary", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const i = parsed.data;

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "accept_cs", 10, 60))) return jsonResponse({ error: "rate_limited" }, 429);

  const supabase = getServiceClient();
  const hash = await sha256Hex(i.token);

  // Locate CS — journey-mode looks up via order_journeys; legacy via CS token.
  let cs: any = null;
  let journey: any = null;
  if (i.journey_mode) {
    const { data: j } = await supabase
      .from("order_journeys")
      .select("id, quote_id, contract_summary_id, contract_accepted_at, contract_acceptance_id, status, current_step")
      .eq("token_hash", hash)
      .neq("status", "cancelled")
      .maybeSingle();
    if (!j) return jsonResponse({ error: "no_journey" }, 404);
    if (!j.contract_summary_id) return jsonResponse({ error: "no_cs_for_journey" }, 409);
    journey = j;
    const { data } = await supabase.from("contract_summaries").select("*").eq("id", j.contract_summary_id).maybeSingle();
    cs = data;
  } else {
    const { data } = await supabase.from("contract_summaries").select("*").eq("public_token_hash", hash).maybeSingle();
    cs = data;
  }
  if (!cs) return jsonResponse({ error: "not_found" }, 404);

  // Phase C journey-mode strict validation
  if (i.journey_mode) {
    if (!i.accepted_by_mobile) return jsonResponse({ error: "mobile_required" }, 400);
    if (i.address_confirmed !== true) return jsonResponse({ error: "address_confirmation_required" }, 400);
    if (!i.date_of_birth) return jsonResponse({ error: "dob_required" }, 400);
    const age = ageYears(i.date_of_birth);
    if (age < 18) return jsonResponse({ error: "under_18", message: "You must be 18 or older to enter into this agreement." }, 400);
    if (age > 120) return jsonResponse({ error: "invalid_dob" }, 400);
    const allTicked =
      i.checkbox_received_read === true &&
      i.checkbox_details_correct === true &&
      i.checkbox_understand_charges === true &&
      i.checkbox_consent === true;
    if (!allTicked) return jsonResponse({ error: "all_checkboxes_required" }, 400);
    if (typeof i.cs_version === "number" && i.cs_version !== cs.version) {
      return jsonResponse({ error: "cs_version_stale", current_version: cs.version }, 409);
    }
  } else {
    if (i.checkbox_confirmed !== true) return jsonResponse({ error: "checkbox_required" }, 400);
  }

  // Idempotency: already accepted — return existing acceptance + cert ref.
  if (cs.status === "accepted") {
    const { data: existingAcc } = await supabase
      .from("contract_acceptances")
      .select("id")
      .eq("contract_summary_id", cs.id)
      .order("accepted_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    let certificate_number: string | null = null;
    if (existingAcc) {
      const { data: cert } = await supabase
        .from("acceptance_certificates")
        .select("certificate_number")
        .eq("contract_acceptance_id", existingAcc.id)
        .maybeSingle();
      certificate_number = cert?.certificate_number ?? null;
    }
    return jsonResponse({
      ok: true, already_accepted: true,
      quote_id: cs.quote_id,
      contract_summary_id: cs.id,
      contract_acceptance_id: existingAcc?.id ?? null,
      certificate_number,
    });
  }

  if (!["issued", "viewed", "draft"].includes(cs.status)) return jsonResponse({ error: "not_acceptable", status: cs.status }, 409);
  if (cs.token_expires_at && new Date(cs.token_expires_at) < new Date()) return jsonResponse({ error: "expired" }, 410);

  if (i.accepted_by_email.toLowerCase() !== cs.customer_email_snapshot.toLowerCase()) {
    return jsonResponse({ error: "email_mismatch" }, 400);
  }

  // Refuse to lock acceptance if the immutable PDF is missing.
  if (!cs.pdf_storage_key || !cs.pdf_sha256) {
    return jsonResponse({
      error: "missing_immutable_pdf",
      message: "This Contract Summary has no stored PDF yet. Please ask OCCTA to resend it before accepting.",
    }, 409);
  }

  const acceptedAt = new Date().toISOString();
  const acceptedAtLocal = new Date(acceptedAt).toLocaleString("en-GB", { timeZone: "Europe/London", hour12: false });
  const ua = req.headers.get("user-agent")?.slice(0, 400) ?? null;

  const acceptanceTextCombined = i.journey_mode
    ? [
        JOURNEY_CHECKBOX_TEXTS.received_read,
        JOURNEY_CHECKBOX_TEXTS.details_correct,
        JOURNEY_CHECKBOX_TEXTS.understand_charges,
        JOURNEY_CHECKBOX_TEXTS.consent,
      ].join("\n")
    : ACCEPTANCE_CHECKBOX_TEXT;
  const acceptanceTextHash = await sha256Hex(acceptanceTextCombined);

  const { data: accInsert, error: aErr } = await supabase.from("contract_acceptances").insert({
    contract_summary_id: cs.id,
    quote_id: cs.quote_id,
    quote_request_id: cs.quote_request_id,
    customer_id: cs.customer_id,
    accepted_by_name: i.accepted_by_name,
    accepted_by_email: i.accepted_by_email,
    accepted_by_user: cs.customer_id,
    accepted_at: acceptedAt,
    ip, user_agent: ua,
    acceptance_text: acceptanceTextCombined,
    acceptance_text_version: cs.terms_version,
    checkbox_confirmed: true,
    cs_version: cs.version,
    terms_version: cs.terms_version,
    privacy_version: cs.privacy_version,
    pdf_storage_key: cs.pdf_storage_key,
    pdf_sha256: cs.pdf_sha256,
    account_number: cs.account_number,
    // Phase C extras
    mobile_snapshot: i.accepted_by_mobile ?? null,
    address_confirmed: i.address_confirmed === true,
    checkbox_received_read: i.checkbox_received_read === true,
    checkbox_details_correct: i.checkbox_details_correct === true,
    checkbox_understand_charges: i.checkbox_understand_charges === true,
    checkbox_consent: i.checkbox_consent === true,
    journey_id: journey?.id ?? null,
    source_route: i.source_route ?? null,
    session_id: i.session_id ?? null,
    accepted_at_europe_london: acceptedAtLocal,
    acceptance_text_hash: acceptanceTextHash,
    date_of_birth: i.date_of_birth ?? null,
  }).select("id").single();
  if (aErr) return jsonResponse({ error: "accept_failed", details: aErr.message }, 500);
  const acceptanceId = accInsert?.id;

  const { error: csErr } = await supabase.from("contract_summaries").update({
    status: "accepted",
    accepted_at: acceptedAt,
    accepted_ip: ip,
    accepted_user_agent: ua,
  }).eq("id", cs.id);
  if (csErr) return jsonResponse({ error: "cs_update_failed", details: csErr.message }, 500);

  await supabase.from("quotes").update({ status: "contract_summary_accepted" }).eq("id", cs.quote_id);
  await supabase.from("quote_requests").update({ status: "contract_summary_accepted", updated_at: acceptedAt }).eq("id", cs.quote_request_id);

  if (journey) {
    // Best-effort: propagate DOB to the linked customer profile if not already set.
    if (i.date_of_birth && cs.customer_id) {
      try {
        await supabase
          .from("profiles")
          .update({ date_of_birth: i.date_of_birth })
          .eq("user_id", cs.customer_id)
          .is("date_of_birth", null);
      } catch { /* non-fatal */ }
    }
    // Compute cooling-off in Europe/London via the DB helper. Unified-journey-only —
    // legacy acceptances are never touched.
    const { data: coo } = await supabase.rpc("compute_cooling_off", { _accepted_at: acceptedAt });
    const coolingRow = Array.isArray(coo) ? coo[0] : coo;
    await supabase.from("order_journeys").update({
      contract_summary_id: cs.id,
      contract_acceptance_id: acceptanceId,
      contract_accepted_at: acceptedAt,
      cooling_off_ends_at: coolingRow?.cooling_off_ends_at ?? null,
      earliest_selectable_start_date: coolingRow?.earliest_selectable_start_date ?? null,
      current_step: "start_date",
    }).eq("id", journey.id);

    // Phase 2 — automatically create/reuse the customer account so that the
    // accepted Contract Summary, journey, payment method and quote become
    // visible in Customer 360 immediately. No email is sent here; the
    // consolidated onboarding email at final submission carries the secure
    // set-password link. Failures are logged but do not block acceptance.
    try {
      const ec = await ensureCustomerFromAcceptedContract(supabase, {
        journey_id: journey.id,
        contract_summary_id: cs.id,
        contract_acceptance_id: acceptanceId,
      });
      if (!ec.ok && !ec.conflict) {
        console.warn("[accept-contract-summary] ensureCustomer failed", ec.reason);
      }
    } catch (e) {
      console.warn("[accept-contract-summary] ensureCustomer exception", (e as Error).message);
    }
  }

  await supabase.rpc("log_event", {
    _actor_type: "anon", _event_type: "contract_summary_accepted",
    _title: `CS accepted ${cs.cs_number}`,
    _details: { contract_summary_id: cs.id, quote_id: cs.quote_id, email_masked: maskEmail(i.accepted_by_email), journey_mode: !!i.journey_mode },
    _source_module: "contract_summary", _quote_id: cs.quote_id, _contract_summary_id: cs.id,
  });
  await supabase.from("quote_events").insert({
    quote_id: cs.quote_id, quote_request_id: cs.quote_request_id, contract_summary_id: cs.id,
    event_type: "contract_summary_accepted", title: "Contract Summary accepted",
    details: { email_masked: maskEmail(i.accepted_by_email), journey_mode: !!i.journey_mode },
    actor_type: "anon",
  });

  // Generate immutable acceptance certificate (best-effort).
  let certificate_number: string | null = null;
  if (acceptanceId) {
    try {
      const projectUrl = Deno.env.get("SUPABASE_URL")!;
      const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const r = await fetch(`${projectUrl}/functions/v1/generate-acceptance-certificate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${svcKey}`,
          "Content-Type": "application/json",
          "x-internal-service": "1",
        },
        body: JSON.stringify({ contract_acceptance_id: acceptanceId }),
      });
      if (r.ok) {
        const j = await r.json();
        certificate_number = j?.certificate_number ?? null;
      }
    } catch { /* certificate gen is best-effort */ }
  }

  // Suppress legacy welcome email in journey-mode OR when the platform flag is on.
  const { data: ps } = await supabase
    .from("platform_settings")
    .select("legacy_onboarding_emails_suppressed")
    .limit(1)
    .maybeSingle();
  const suppressEmail = !!i.journey_mode || !!ps?.legacy_onboarding_emails_suppressed;
  if (!suppressEmail) {
    await sendAcceptanceWelcome(supabase, cs, i.accepted_by_email, i.accepted_by_name);
  }

  return jsonResponse({
    ok: true,
    quote_id: cs.quote_id,
    contract_summary_id: cs.id,
    contract_acceptance_id: acceptanceId,
    certificate_number,
    journey_advanced_to: journey ? "start_date" : null,
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// Legacy welcome email (only used when NOT in unified-journey mode).
// ─────────────────────────────────────────────────────────────────────────────
async function sendAcceptanceWelcome(
  supabase: ReturnType<typeof getServiceClient>,
  cs: any,
  recipient: string,
  acceptedByName: string,
) {
  try {
    const { data: existing } = await supabase
      .from("communications_log")
      .select("id")
      .eq("template_name", "contract_summary_accepted_welcome")
      .eq("status", "sent")
      .contains("metadata", { contract_summary_id: cs.id })
      .limit(1)
      .maybeSingle();
    if (existing) return;

    let signedUrl: string | null = null;
    try {
      const projectUrl = Deno.env.get("SUPABASE_URL")!;
      const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const r = await fetch(`${projectUrl}/functions/v1/generate-contract-summary-pdf`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${svcKey}`,
          "Content-Type": "application/json",
          "x-internal-service": "1",
        },
        body: JSON.stringify({ contract_summary_id: cs.id, internal: true }),
      });
      if (r.ok) {
        const j = await r.json();
        signedUrl = j?.signed_url ?? null;
      }
    } catch { /* signedUrl stays null */ }

    const firstName = (acceptedByName || "there").split(" ")[0];
    const priceLine = cs.customer_type === "business"
      ? `£${Number(cs.business_monthly_incl_vat ?? cs.monthly_price_incl_vat ?? 0).toFixed(2)}/mo incl. VAT`
      : `£${Number(cs.monthly_price_incl_vat ?? 0).toFixed(2)}/mo incl. VAT`;

    const html = brutalistEmailShell(
      "Welcome to OCCTA",
      `<p>Hi ${escapeHtml(firstName)},</p>
       <p>Welcome aboard — the paperwork is officially behaving itself. Your Contract Summary has been accepted and your copy is safely stored below.</p>
       <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:collapse;">
         <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Contract Summary</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(cs.cs_number)}</strong> (v${cs.version})</td></tr>
         <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Plan</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(cs.plan_name)}</strong></td></tr>
         <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Monthly price</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(priceLine)}</strong></td></tr>
         <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Accepted</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(new Date(cs.accepted_at ?? Date.now()).toLocaleString("en-GB"))}</td></tr>
       </table>
       <p><strong>What happens next?</strong> Our team will follow up with a secure payment link — we never take card details over email. After payment we'll arrange your install / activation.</p>
       <p>Your signed copy is below — keep it for your records. The link refreshes for 7 days; you can always download a fresh copy from your OCCTA dashboard.</p>
       <p style="font-size:12px;color:#555;">Questions? Reply to this email or contact <a href="mailto:hello@occta.co.uk" style="color:#555;">hello@occta.co.uk</a>.</p>`,
      signedUrl ? { label: "Download signed copy", url: signedUrl } : undefined,
    );

    const send = await sendResendEmail({
      to: recipient,
      subject: `Welcome to OCCTA — your Contract Summary is accepted`,
      html,
    });

    await supabase.from("communications_log").insert({
      user_id: cs.customer_id,
      template_name: "contract_summary_accepted_welcome",
      recipient_email: recipient,
      status: send.ok ? "sent" : "failed",
      sent_at: send.ok ? new Date().toISOString() : null,
      error_message: send.ok ? null : (send.error ?? "send_failed"),
      metadata: {
        contract_summary_id: cs.id,
        cs_number: cs.cs_number,
        cs_version: cs.version,
        pdf_sha256: cs.pdf_sha256,
        has_signed_url: !!signedUrl,
        accepted_via: "token",
      },
    });

    const adminEmail = Deno.env.get("ADMIN_NOTIFY_EMAIL") || Deno.env.get("RESEND_FROM_EMAIL") || "hello@occta.co.uk";
    void sendResendEmail({
      to: adminEmail,
      subject: `[CS accepted] ${cs.cs_number}`,
      html: brutalistEmailShell(
        "Contract Summary accepted",
        `<p>CS <strong>${escapeHtml(cs.cs_number)}</strong> accepted by ${escapeHtml(maskEmail(recipient))}.</p>
         <p>PDF SHA-256: <code style="font-size:11px;">${escapeHtml(String(cs.pdf_sha256))}</code></p>`,
        { label: "Open admin", url: `https://www.occta.co.uk/admin/quote-requests` },
      ),
    });
  } catch (e) {
    try {
      await supabase.from("communications_log").insert({
        user_id: cs.customer_id,
        template_name: "contract_summary_accepted_welcome",
        recipient_email: recipient,
        status: "failed",
        error_message: `exception: ${(e as Error).message?.slice(0, 200) ?? "unknown"}`,
        metadata: { contract_summary_id: cs.id, accepted_via: "token" },
      });
    } catch { /* swallow */ }
  }
}

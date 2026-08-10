import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, getRequestIp, checkRateLimit, sendResendEmail, brutalistEmailShell, escapeHtml, maskEmail } from "../_shared/quoteHelpers.ts";
import { ACCEPTANCE_CHECKBOX_TEXT } from "../_shared/legalText.ts";
import { ensureCustomerFromAcceptedContract } from "../_shared/ensureCustomer.ts";
import { requireVerifiedOtp, resolveJourneyContext, consumeOtpChallenge } from "../_shared/contractOtp.ts";
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
  let otpChallengeRowId: string | null = null;
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

    // Independent server-side SMS OTP gate. A verified, unconsumed challenge
    // must exist for this journey and the order's current mobile number —
    // frontend state is never trusted.
    const otpCtx = await resolveJourneyContext(hash);
    if (!otpCtx.ok) return jsonResponse({ error: otpCtx.error }, otpCtx.status);
    const otpGate = await requireVerifiedOtp({
      journeyId: otpCtx.journeyId,
      journeyType: otpCtx.journeyType,
      mobile: otpCtx.mobile,
    });
    if (!otpGate.ok) {
      return jsonResponse({
        error: otpGate.error,
        message: "Please verify your mobile number before signing.",
      }, 403);
    }
    otpChallengeRowId = (otpGate.challenge?.id as string | undefined) ?? null;
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

  // Mark the SMS verification as consumed so it can never be replayed, and link
  // it to the acceptance evidence. Never blocks the acceptance.
  if (otpChallengeRowId) {
    try {
      await consumeOtpChallenge(otpChallengeRowId, acceptanceId ?? null);
    } catch (e) {
      console.warn("[accept-contract-summary] otp consume failed", (e as Error).message);
    }
  }

  // Fraud / identity-theft evidence. Never blocks the acceptance.
  try {
    await recordAcceptanceRisk(supabase, req, {
      contract_acceptance_id: acceptanceId ?? null,
      contract_summary_id: cs.id,
      quote_id: cs.quote_id,
      journey_id: journey?.id ?? null,
      customer_id: cs.customer_id ?? null,
      accepted_by_email: i.accepted_by_email,
      ip,
      user_agent: ua,
      signals: (i.risk_signals ?? {}) as Record<string, unknown>,
    });
  } catch (e) {
    console.warn("[accept-contract-summary] risk capture failed", (e as Error).message);
  }

  const { error: csErr } = await supabase.from("contract_summaries").update({
    status: "accepted",
    accepted_at: acceptedAt,
    accepted_ip: ip,
    accepted_user_agent: ua,
  }).eq("id", cs.id);
  if (csErr) return jsonResponse({ error: "cs_update_failed", details: csErr.message }, 500);

  await supabase.from("quotes").update({ status: "contract_summary_accepted" }).eq("id", cs.quote_id);
  await supabase.from("quote_requests").update({ status: "contract_summary_accepted", updated_at: acceptedAt }).eq("id", cs.quote_request_id);

  // ── Superseding revision: the signed revision replaces the earlier version ──
  // The earlier accepted Contract Summary is legally immutable, so it is never
  // rewritten — it is archived with a reason and every live pointer (order,
  // journey) is moved to the newly signed version.
  if (cs.supersedes_id) {
    try {
      await supabase.from("contract_summaries").update({
        archived_at: acceptedAt,
        archived_reason: `Replaced by ${cs.cs_number} v${cs.version}, signed by the customer on ${acceptedAtLocal}.`,
      }).eq("id", cs.supersedes_id);

      await supabase.from("orders").update({
        contract_summary_id: cs.id,
        contract_acceptance_id: acceptanceId,
        plan_name: cs.plan_name,
        plan_price: cs.monthly_price_incl_vat,
      }).eq("contract_summary_id", cs.supersedes_id);

      await supabase.from("order_journeys").update({
        contract_summary_id: cs.id,
        contract_acceptance_id: acceptanceId,
      }).eq("contract_summary_id", cs.supersedes_id);

      await supabase.rpc("log_event", {
        _actor_type: "anon",
        _event_type: "contract_summary_superseded",
        _title: `CS ${cs.cs_number} v${cs.version} replaced the previous version`,
        _details: { contract_summary_id: cs.id, superseded_id: cs.supersedes_id },
        _source_module: "contract_summary",
        _quote_id: cs.quote_id,
        _contract_summary_id: cs.id,
        _customer_id: cs.customer_id,
      });
    } catch (e) {
      console.warn("[accept-contract-summary] supersede bookkeeping failed", (e as Error).message);
    }
  }

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
  // A signed revision never triggers the onboarding welcome again — the customer
  // is already onboarded; they get a short confirmation instead.
  const suppressEmail = !!i.journey_mode || !!ps?.legacy_onboarding_emails_suppressed || !!cs.supersedes_id;
  if (cs.supersedes_id) {
    try {
      await sendResendEmail({
        to: i.accepted_by_email,
        subject: `Signed — your revised OCCTA contract is now in place`,
        replyTo: "hello@occta.co.uk",
        html: brutalistEmailShell(
          "Revised contract signed",
          `<p>Hi ${escapeHtml(String(i.accepted_by_name).split(" ")[0])},</p>
           <p>Thank you — your revised Contract Summary <strong>${escapeHtml(cs.cs_number)}</strong> (v${cs.version}) was signed on ${escapeHtml(acceptedAtLocal)} and now replaces your previous version. Nothing else about your order has changed.</p>
           <p>Your plan: <strong>${escapeHtml(cs.plan_name)}</strong> — up to ${escapeHtml(String(cs.estimated_download_speed))}Mbps down / up to ${escapeHtml(String(cs.estimated_upload_speed))}Mbps up, £${Number(cs.monthly_price_incl_vat ?? 0).toFixed(2)}/mo incl. VAT.</p>
           <p>A copy is saved in your OCCTA account. If anything looks wrong, reply to this email or call 0800 260 6626 and we'll fix it.</p>`,
        ),
      });
    } catch (e) {
      console.warn("[accept-contract-summary] revision confirmation failed", (e as Error).message);
    }
  }
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

/**
 * Captures the network, device and (if the customer allowed it) location
 * evidence for a signature, scores it, and raises a fraud flag when the
 * pattern looks risky. Entirely best-effort: signing is never blocked.
 */
async function recordAcceptanceRisk(
  supabase: ReturnType<typeof getServiceClient>,
  req: Request,
  ctx: {
    contract_acceptance_id: string | null;
    contract_summary_id: string;
    quote_id: string | null;
    journey_id: string | null;
    customer_id: string | null;
    accepted_by_email: string;
    ip: string;
    user_agent: string | null;
    signals: Record<string, unknown>;
  },
) {
  const h = (name: string) => req.headers.get(name);
  const ipCountry = (h("cf-ipcountry") ?? h("x-vercel-ip-country") ?? h("x-country-code") ?? "").toUpperCase() || null;
  const ipRegion = h("cf-region") ?? h("x-vercel-ip-country-region") ?? null;
  const ipCity = h("cf-ipcity") ?? h("x-vercel-ip-city") ?? null;
  const ipTimezone = h("cf-timezone") ?? h("x-vercel-ip-timezone") ?? null;
  const forwardedFor = (h("x-forwarded-for") ?? "").slice(0, 200) || null;
  const acceptLanguage = (h("accept-language") ?? "").slice(0, 120) || null;

  const s = ctx.signals;
  const str = (k: string) => (typeof s[k] === "string" ? String(s[k]).slice(0, 120) : null);
  const num = (k: string) => (typeof s[k] === "number" ? Number(s[k]) : null);
  const bool = (k: string) => (typeof s[k] === "boolean" ? Boolean(s[k]) : null);

  const fingerprint = await sha256Hex([
    ctx.user_agent ?? "", str("platform") ?? "", str("screen_signature") ?? "",
    str("browser_timezone") ?? "", str("browser_locale") ?? "",
  ].join("|"));

  const reasons: string[] = [];
  let score = 0;

  if (ipCountry && ipCountry !== "GB") { score += 40; reasons.push(`signed_from_${ipCountry}`); }
  const tz = str("browser_timezone");
  if (tz && tz !== "Europe/London") { score += 15; reasons.push(`browser_timezone_${tz}`); }
  if (bool("webdriver_flag") === true) { score += 50; reasons.push("automation_detected"); }
  const dwell = num("page_dwell_ms");
  if (dwell !== null && dwell < 10_000) { score += 10; reasons.push("very_fast_signature"); }
  if (bool("cookies_enabled") === false) { score += 5; reasons.push("cookies_disabled"); }

  // Same device signing for a different email, and same IP across many emails.
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: sameDevice } = await supabase
    .from("acceptance_risk_signals")
    .select("accepted_by_email")
    .eq("device_fingerprint", fingerprint)
    .gte("created_at", since)
    .limit(50);
  const otherEmails = new Set(
    (sameDevice ?? [])
      .map((r: any) => String(r.accepted_by_email ?? "").toLowerCase())
      .filter((e: string) => e && e !== ctx.accepted_by_email.toLowerCase()),
  );
  if (otherEmails.size > 0) { score += 30; reasons.push(`device_used_by_${otherEmails.size}_other_emails`); }

  const { data: sameIp } = await supabase
    .from("acceptance_risk_signals")
    .select("accepted_by_email")
    .eq("ip", ctx.ip)
    .gte("created_at", since)
    .limit(50);
  const ipEmails = new Set(
    (sameIp ?? [])
      .map((r: any) => String(r.accepted_by_email ?? "").toLowerCase())
      .filter((e: string) => e && e !== ctx.accepted_by_email.toLowerCase()),
  );
  if (ipEmails.size >= 2) { score += 25; reasons.push(`ip_used_by_${ipEmails.size}_other_emails`); }

  await supabase.from("acceptance_risk_signals").insert({
    contract_acceptance_id: ctx.contract_acceptance_id,
    contract_summary_id: ctx.contract_summary_id,
    quote_id: ctx.quote_id,
    journey_id: ctx.journey_id,
    customer_id: ctx.customer_id,
    accepted_by_email: ctx.accepted_by_email,
    ip: ctx.ip,
    ip_country: ipCountry,
    ip_region: ipRegion,
    ip_city: ipCity,
    ip_timezone: ipTimezone,
    forwarded_for: forwardedFor,
    user_agent: ctx.user_agent,
    accept_language: acceptLanguage,
    browser_timezone: tz,
    browser_locale: str("browser_locale"),
    screen_signature: str("screen_signature"),
    platform: str("platform"),
    device_memory: typeof s.device_memory === "number" ? String(s.device_memory) : str("device_memory"),
    hardware_concurrency: num("hardware_concurrency"),
    touch_points: num("touch_points"),
    cookies_enabled: bool("cookies_enabled"),
    do_not_track: str("do_not_track"),
    webdriver_flag: bool("webdriver_flag"),
    page_dwell_ms: dwell,
    geo_latitude: num("geo_latitude"),
    geo_longitude: num("geo_longitude"),
    geo_accuracy_m: num("geo_accuracy_m"),
    geo_permission: str("geo_permission"),
    device_fingerprint: fingerprint,
    risk_score: score,
    risk_reasons: reasons,
    raw_signals: s,
  });

  if (score >= 40) {
    await supabase.from("fraud_flags").insert({
      customer_id: ctx.customer_id,
      flag_type: otherEmails.size > 0 ? "duplicate_email" : "suspicious_pattern",
      severity: score >= 70 ? "high" : "medium",
      status: "open",
      details: {
        source: "contract_acceptance",
        contract_acceptance_id: ctx.contract_acceptance_id,
        contract_summary_id: ctx.contract_summary_id,
        email_masked: maskEmail(ctx.accepted_by_email),
        risk_score: score,
        risk_reasons: reasons,
        ip_country: ipCountry,
      },
    });
  }
}

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

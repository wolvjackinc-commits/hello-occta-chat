// Public endpoint: customer submits Build Plan selections + contact details.
// Server re-resolves price (never trusts client numbers) and either:
//   - Creates a quote_request + customer-ready quote (token returned), or
//   - Creates a quote_request only (quote-only fallback) for manual quoting.
//
// NEVER returns supplier cost, supplier product IDs, margin numbers, internal notes.

import {
  corsHeaders, jsonResponse, getServiceClient, checkRateLimit, getRequestIp,
  maskEmail, sendResendEmail, brutalistEmailShell, escapeHtml, generateTokenPair,
  getAdminNotificationEmail, recordEmailCommunication,
} from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  resolveBuildPlanPrice, planTermLabel, speedBucketLabel,
  PRICE_LOCK_WORDING, FLEX_30_WORDING,
  loadGiacomCandidates,
} from "../_shared/buildPlanResolver.ts";

const Schema = z.object({
  // selections
  speed_bucket: z.enum(["essential","superfast","ultrafast","gigabit"]),
  plan_term: z.enum(["price_lock_24","flex_30"]),
  router_option: z.enum(["own","standard","premium","business"]),
  router_payment_type: z.enum(["none","one_off","monthly"]).default("none"),
  setup_option: z.enum(["remote","standard","engineer","complex"]),
  addons: z.array(z.enum(["priority_support","static_ip","digital_voice","paper_billing"])).default([]),
  customer_type: z.enum(["residential","business"]).default("residential"),
  max_download: z.number().int().min(0).max(100000).optional(),
  primary_technology: z.string().max(40).optional(),
  // Admin-only test fixture. Server verifies role.
  test_availability: z.object({
    max_download: z.number().int().min(0).max(100000),
    primary_technology: z.string().max(40).optional(),
  }).optional(),
  test_mode: z.boolean().optional(),
  // Fallback mode (availability API unavailable). Forces manual quote_request only.
  force_quote_only: z.boolean().optional(),
  availability_mode: z.enum(["live","fallback"]).optional(),
  // contact
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(180),
  phone: z.string().trim().min(7).max(30),
  date_of_birth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  postcode: z.string().trim().min(5).max(10),
  address_line_1: z.string().trim().max(160).optional().nullable(),
  address_line_2: z.string().trim().max(160).optional().nullable(),
  town: z.string().trim().max(80).optional().nullable(),
  county: z.string().trim().max(80).optional().nullable(),
  preferred_contact_method: z.enum(["email","phone","whatsapp"]).default("email"),
  marketing_consent: z.boolean().default(false),
  // Switcher context (optional)
  in_contract: z.enum(["yes","no","unsure"]).optional().nullable(),
  current_provider: z.string().trim().max(80).optional().nullable(),
  // Attribution
  gclid: z.string().trim().max(200).optional().nullable(),
  utm_source: z.string().trim().max(200).optional().nullable(),
  utm_campaign: z.string().trim().max(200).optional().nullable(),
  utm_term: z.string().trim().max(200).optional().nullable(),
  utm_medium: z.string().trim().max(200).optional().nullable(),
  landing_page: z.string().trim().max(500).optional().nullable(),
  conversion_page: z.string().trim().max(500).optional().nullable(),
});

function planNameFor(b: string, t: string) {
  return `${speedBucketLabel(b as any)} — ${planTermLabel(t as any)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const i = parsed.data;

  const ip = getRequestIp(req);
  if (!(await checkRateLimit(`${ip ?? "noip"}:${i.email}`, "submit_build_plan", 5, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const supabase = getServiceClient();

  // Link to logged-in user if present
  let customer_id: string | null = null;
  let isAdmin = false;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (data?.user) {
      customer_id = data.user.id;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    }
  }
  const inTestMode = !!(i.test_mode && isAdmin);
  const isFallback = !!(i.force_quote_only || i.availability_mode === "fallback");
  // Honour test_availability override only for admins
  const effectiveMaxDownload = (isAdmin && i.test_availability?.max_download != null)
    ? i.test_availability.max_download : i.max_download;
  const effectivePrimaryTech = (isAdmin && i.test_availability?.primary_technology)
    ? i.test_availability.primary_technology : i.primary_technology;

  // ── Always create a quote_request ──
  const { data: qr, error: qrErr } = await supabase.from("quote_requests").insert({
    customer_id,
    full_name: i.full_name,
    email: i.email,
    phone: i.phone,
    postcode: i.postcode.toUpperCase(),
    address_line_1: i.address_line_1 ?? null,
    address_line_2: i.address_line_2 ?? null,
    town: i.town ?? null,
    county: i.county ?? null,
    service_interest: "broadband",
    plan_preference: i.plan_term === "flex_30" ? "flex" : "contract_saver",
    customer_type: i.customer_type,
    preferred_contact_method: i.preferred_contact_method,
    message: `${inTestMode ? "[TEST] " : ""}${isFallback ? "[FALLBACK — availability unconfirmed] " : ""}Build Plan: ${speedBucketLabel(i.speed_bucket)} · ${planTermLabel(i.plan_term)} · router=${i.router_option}/${i.router_payment_type} · setup=${i.setup_option} · addons=${(i.addons ?? []).join(",") || "none"}${i.in_contract ? ` · in_contract=${i.in_contract}` : ""}${i.current_provider ? ` · current_provider=${i.current_provider}` : ""}${i.date_of_birth ? ` · dob=${i.date_of_birth}` : ""}`,
    marketing_consent: i.marketing_consent,
    source: inTestMode ? "build_plan_test" : (isFallback ? "build_plan_fallback" : "build_plan"),
    ip,
    user_agent: req.headers.get("user-agent")?.slice(0, 400) ?? null,
    gclid: i.gclid ?? null,
    utm_source: i.utm_source ?? null,
    utm_campaign: i.utm_campaign ?? null,
    utm_term: i.utm_term ?? null,
    utm_medium: i.utm_medium ?? null,
    landing_page: i.landing_page ?? null,
    conversion_page: i.conversion_page ?? null,
  }).select("id, reference").single();
  if (qrErr || !qr) return jsonResponse({ error: "create_failed" }, 500);

  // ── Re-resolve server-side ──
  const { data: settings } = await supabase
    .from("platform_settings").select("fair_pricing").eq("singleton", true).maybeSingle();
  let candidates;
  try {
    candidates = await loadGiacomCandidates(supabase, i.speed_bucket);
  } catch (_e) {
    candidates = null;
  }
  const resolved = isFallback
    ? { ok: true as const, quote_only: true as const, message: "Availability not confirmed online — we'll verify and send your final quote before order." }
    : candidates === null
    ? { ok: true as const, quote_only: true as const, message: "Final price needs manual confirmation for this address." }
    : resolveBuildPlanPrice({
    speed_bucket: i.speed_bucket,
    plan_term: i.plan_term,
    router_option: i.router_option,
    router_payment_type: i.router_payment_type,
    setup_option: i.setup_option,
    addons: i.addons as any,
    customer_type: i.customer_type,
    max_download: effectiveMaxDownload,
    primary_technology: effectivePrimaryTech,
  }, settings?.fair_pricing ?? {}, candidates);

  await supabase.rpc("log_event", {
    _actor_type: "public",
    _event_type: inTestMode ? "build_plan_submitted_test" : "build_plan_submitted",
    _title: `${inTestMode ? "[TEST] " : ""}Build Plan ${qr.reference}`,
    _details: {
      reference: qr.reference,
      speed_bucket: i.speed_bucket,
      plan_term: i.plan_term,
      quote_only: resolved.quote_only,
      email_masked: maskEmail(i.email),
      test_mode: inTestMode,
    },
    _source_module: "quote",
  });

  // Admin notification (suppressed in test mode unless tagged)
  const adminEmail = getAdminNotificationEmail();
  if (!inTestMode) {
    const adminSend = await sendResendEmail({
      to: adminEmail,
      subject: `[Build Plan] ${qr.reference} — ${i.speed_bucket}/${i.plan_term}${resolved.quote_only ? " (quote-only)" : ""}`,
      html: brutalistEmailShell(
        `New Build Plan: ${qr.reference}`,
        `<p><strong>Name:</strong> ${escapeHtml(i.full_name)}</p>
         <p><strong>Email:</strong> <a href="mailto:${escapeHtml(i.email)}" style="color:#111;">${escapeHtml(i.email)}</a></p>
         <p><strong>Phone:</strong> ${escapeHtml(i.phone)}</p>
         <p><strong>Speed:</strong> ${escapeHtml(speedBucketLabel(i.speed_bucket))}</p>
         <p><strong>Plan term:</strong> ${escapeHtml(planTermLabel(i.plan_term))}</p>
         <p><strong>Router:</strong> ${escapeHtml(i.router_option)} / ${escapeHtml(i.router_payment_type)}</p>
         <p><strong>Setup:</strong> ${escapeHtml(i.setup_option)}</p>
         <p><strong>Addons:</strong> ${escapeHtml((i.addons ?? []).join(", ") || "none")}</p>
         <p><strong>Postcode:</strong> ${escapeHtml(i.postcode.toUpperCase())}</p>
         <p><strong>Preferred contact:</strong> ${escapeHtml(i.preferred_contact_method)}</p>
         <p><strong>Outcome:</strong> ${resolved.quote_only ? "Quote-only — needs manual quote" : "Customer-ready quote auto-created"}</p>`,
        { label: "Open admin", url: "https://www.occta.co.uk/admin/quote-requests" },
      ),
    });
    await recordEmailCommunication(supabase, {
      template_name: "build_plan_admin_notification",
      recipient_email: adminEmail,
      sendResult: adminSend,
      metadata: { quote_request_id: qr.id, reference: qr.reference, customer_email_masked: maskEmail(i.email), quote_only: resolved.quote_only },
    });
  }

  // ── Quote-only path: just a request, manual quote will follow ──
  if (resolved.quote_only) {
    if (!inTestMode) {
      const customerSend = await sendResendEmail({
        to: i.email,
        subject: `We're preparing your quote — ${qr.reference}`,
        html: brutalistEmailShell(
          "Your address needs a manual quote",
          `<p>Hi ${escapeHtml(i.full_name.split(" ")[0])},</p>
           <p>Your reference is <strong>${escapeHtml(qr.reference)}</strong>.</p>
           <p>${escapeHtml(resolved.message)} We'll be in touch by your preferred method shortly to confirm the best available option, speed, price and any setup.</p>
           <p style="font-size:12px;color:#555;">If it is not shown in your Contract Summary, we do not add it without your agreement.</p>`,
        ),
      });
      await recordEmailCommunication(supabase, {
        template_name: "build_plan_quote_only_customer_acknowledgement",
        recipient_email: i.email,
        sendResult: customerSend,
        user_id: customer_id,
        metadata: { quote_request_id: qr.id, reference: qr.reference },
      });
    }
    return jsonResponse({
      ok: true,
      mode: "quote_only",
      test_mode: inTestMode,
      reference: qr.reference,
      quote_request_id: qr.id,
      message: resolved.message,
    });
  }

  // ── Test mode: do NOT create a quote, no emails, no payment link ──
  if (inTestMode) {
    return jsonResponse({
      ok: true,
      mode: "test",
      test_mode: true,
      reference: qr.reference,
      quote_request_id: qr.id,
      preview: {
        monthly_total_incl_vat: (resolved as any).monthly_total_incl_vat,
        first_bill_incl_vat: (resolved as any).first_bill_incl_vat,
        bumped: (resolved as any).bumped,
      },
    });
  }

  // ── Priced path: create customer-ready quote with re-resolved pricing ──
  const r = resolved; // ResolvedPriced
  const VAT = 0.20;
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const monthly_net   = r.internal.monthly_broadband_ex_vat + r.internal.router_monthly_ex_vat + r.internal.addons_monthly_ex_vat;
  const monthly_gross = r.monthly_total_incl_vat;
  const monthly_vat   = round2(monthly_gross - monthly_net);
  const router_net    = r.internal.router_one_off_ex_vat;
  const router_gross  = r.router.oneOff;
  const router_vat    = round2(router_gross - router_net);
  const setup_net     = r.internal.setup_one_off_ex_vat;
  const setup_gross   = r.setup.oneOff;
  const setup_vat     = round2(setup_gross - setup_net);
  const totalDueToday = round2(router_gross + setup_gross);

  const { raw: tokenRaw, hash: tokenHash } = await generateTokenPair();
  const expiresAt = new Date(Date.now() + 14 * 86400_000).toISOString();

  const { data: quote, error: qErr } = await supabase.from("quotes").insert({
    quote_request_id: qr.id,
    customer_id,
    plan_name: planNameFor(i.speed_bucket, i.plan_term),
    service_type: "broadband",
    plan_type: i.plan_term === "flex_30" ? "flex" : "contract_saver",
    customer_type: i.customer_type,
    contract_length_months: i.plan_term === "price_lock_24" ? 24 : null,
    monthly_net: round2(monthly_net),
    monthly_vat_rate: VAT * 100,
    monthly_vat_amount: monthly_vat,
    monthly_gross: monthly_gross,
    setup_net, setup_vat_amount: setup_vat, setup_gross,
    router_net, router_vat_amount: router_vat, router_gross,
    total_due_today_gross: totalDueToday,
    expires_at: expiresAt,
    token_expires_at: expiresAt,
    public_token_hash: tokenHash,
    status: "sent",
    speed_bucket: i.speed_bucket,
    plan_term: i.plan_term,
    router_option: { option: r.router.option, label: r.router.label, monthly: r.router.monthly, oneOff: r.router.oneOff, payment_type: r.router.payment_type },
    setup_option:  { option: r.setup.option,  label: r.setup.label,  oneOff: r.setup.oneOff },
    selected_addons: r.addons,
    customer_notes: r.bumped ? "Price adjusted based on availability at your address." : null,
  }).select("id, quote_number").single();

  if (qErr || !quote) {
    // Quote create failed — fall back to quote-only path so customer is still served
    return jsonResponse({
      ok: true, mode: "quote_only", reference: qr.reference, quote_request_id: qr.id,
      message: "Manual quote required.",
    });
  }

  await supabase.from("quote_requests").update({ status: "quoted" }).eq("id", qr.id);
  await supabase.from("quote_events").insert({
    quote_id: quote.id, quote_request_id: qr.id,
    event_type: "quote_created",
    title: `Quote ${quote.quote_number} auto-created from Build Plan`,
    actor_type: "public",
  });

  // Customer email with quote link
  const quoteUrl = `https://www.occta.co.uk/quote/${encodeURIComponent(tokenRaw)}`;
  const quoteSend = await sendResendEmail({
    to: i.email,
    subject: `Your OCCTA quote ${quote.quote_number}`,
    html: brutalistEmailShell(
      "Your quote is ready",
      `<p>Hi ${escapeHtml(i.full_name.split(" ")[0])},</p>
       <p>Your quote reference is <strong>${escapeHtml(quote.quote_number)}</strong>.</p>
       <p><strong>${escapeHtml(planNameFor(i.speed_bucket, i.plan_term))}</strong> — £${monthly_gross.toFixed(2)}/month (incl. VAT).</p>
       <p>${escapeHtml(i.plan_term === "price_lock_24" ? PRICE_LOCK_WORDING : FLEX_30_WORDING)}</p>
       <p style="font-size:12px;color:#555;">If it is not shown in your Contract Summary, we do not add it without your agreement.</p>`,
      { label: "View your quote", url: quoteUrl },
    ),
  });
  await recordEmailCommunication(supabase, {
    template_name: "build_plan_quote_ready_customer",
    recipient_email: i.email,
    sendResult: quoteSend,
    user_id: customer_id,
    metadata: { quote_request_id: qr.id, quote_id: quote.id, reference: qr.reference, quote_number: quote.quote_number },
  });

  return jsonResponse({
    ok: true,
    mode: "quoted",
    reference: qr.reference,
    quote_request_id: qr.id,
    quote_id: quote.id,
    quote_number: quote.quote_number,
    public_token: tokenRaw,
    bumped: r.bumped,
    monthly_total_incl_vat: r.monthly_total_incl_vat,
    first_bill_incl_vat: r.first_bill_incl_vat,
  });
});
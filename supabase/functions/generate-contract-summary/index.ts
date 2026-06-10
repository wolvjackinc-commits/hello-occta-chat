import { corsHeaders, jsonResponse, getServiceClient, requireStaff, generateTokenPair } from "../_shared/quoteHelpers.ts";
import {
  LEGAL_TEXT_VERSION, COMPLAINTS_ADR_INFO_TEXT, DIGITAL_VOICE_WARNING_TEXT,
  PRICE_RISE_POLICY_TEXT, PAYMENT_SCHEDULE_TEXT_MONTHLY, VULNERABLE_CUSTOMER_NOTE_TEXT,
} from "../_shared/legalText.ts";
import {
  resolveBuildPlanPrice, planTermLabel, speedBucketLabel,
  PRICE_LOCK_WORDING, FLEX_30_WORDING, FIRST_BILL_PROMISE,
  ETF_DISCONNECT_WORDING, SETUP_CONFIRMED_BEFORE_ORDER,
  loadGiacomCandidates,
} from "../_shared/buildPlanResolver.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const { quote_id } = await req.json().catch(() => ({} as { quote_id?: string }));
  if (!quote_id) return jsonResponse({ error: "missing_quote_id" }, 400);

  const supabase = getServiceClient();

  // Block CS issuance if VAT inactive (OCCTA is VAT registered)
  const { data: vatActiveData } = await supabase.rpc("is_vat_active");
  if (vatActiveData !== true) {
    return jsonResponse({
      error: "vat_inactive",
      message: "VAT settings incomplete. Enter VAT number and effective date before issuing Contract Summary or VAT invoice.",
    }, 409);
  }

  const { data: q, error: qErr } = await supabase.from("quotes").select("*").eq("id", quote_id).maybeSingle();
  if (qErr || !q) return jsonResponse({ error: "quote_not_found" }, 404);

  // ── Build Plan re-verify (if quote came from /build-plan) ──
  let bpAddendum = "";
  let bpFields: Record<string, unknown> = {};
  let extraOneOff: { label: string; amount: number }[] = [];
  if (q.speed_bucket && q.plan_term) {
    const ro = (q.router_option ?? {}) as any;
    const so = (q.setup_option  ?? {}) as any;
    const addons = Array.isArray(q.selected_addons) ? (q.selected_addons as any[]).map((a) => a.id).filter(Boolean) : [];
    const { data: settings } = await supabase
      .from("platform_settings").select("fair_pricing").eq("singleton", true).maybeSingle();
    let candidates;
    try {
      candidates = await loadGiacomCandidates(supabase, q.speed_bucket as any);
    } catch (_e) {
      return jsonResponse({
        error: "build_plan_unsafe",
        message: "Final price needs manual confirmation for this address.",
      }, 409);
    }
    const resolved = resolveBuildPlanPrice({
      speed_bucket: q.speed_bucket,
      plan_term: q.plan_term,
      router_option: ro.option ?? "own",
      router_payment_type: ro.payment_type ?? "none",
      setup_option: so.option ?? "remote",
      addons,
      customer_type: q.customer_type,
    }, settings?.fair_pricing ?? {}, candidates);
    if (resolved.quote_only) {
      return jsonResponse({
        error: "build_plan_unsafe",
        message: "This combination is no longer safe to issue — please re-quote from a fresh Build Plan.",
      }, 409);
    }
    const drift = Math.abs(Number(q.monthly_gross) - resolved.monthly_total_incl_vat);
    if (drift > 0.02) {
      return jsonResponse({
        error: "price_drift",
        message: `Stored monthly price (£${Number(q.monthly_gross).toFixed(2)}) no longer matches resolver (£${resolved.monthly_total_incl_vat.toFixed(2)}). Re-quote required.`,
      }, 409);
    }
    const termCopy = q.plan_term === "price_lock_24" ? PRICE_LOCK_WORDING : FLEX_30_WORDING;
    const etfNote = resolved.internal.etf_risk ? `\n\n${ETF_DISCONNECT_WORDING}` : "";
    const setupNote = resolved.internal.setup_unknown ? `\n\n${SETUP_CONFIRMED_BEFORE_ORDER}` : "";
    bpAddendum =
      `\n\nPlan: ${speedBucketLabel(q.speed_bucket as any)} — ${planTermLabel(q.plan_term as any)}.` +
      `\nRouter: ${resolved.router.label} (${resolved.router.payment_type === "monthly" ? `£${resolved.router.monthly.toFixed(2)}/mo` : resolved.router.oneOff > 0 ? `£${resolved.router.oneOff.toFixed(2)} one-off` : "£0"}).` +
      `\nSetup: ${resolved.setup.label}${resolved.setup.oneOff > 0 ? ` (£${resolved.setup.oneOff.toFixed(2)} one-off)` : " (£0)"}.` +
      (resolved.addons.length ? `\nAdd-ons: ${resolved.addons.map((a) => `${a.label} £${a.monthly.toFixed(2)}/mo`).join("; ")}.` : "") +
      `\n\n${termCopy}` +
      `\n\nEstimated first bill: £${resolved.first_bill_incl_vat.toFixed(2)} (incl. VAT).` +
      etfNote +
      setupNote +
      `\n\n${FIRST_BILL_PROMISE}`;
    bpFields = {
      speed_bucket: q.speed_bucket,
      plan_term: q.plan_term,
      router_option: q.router_option,
      setup_option: q.setup_option,
      selected_addons: q.selected_addons,
    };
    if (resolved.router.oneOff > 0) extraOneOff.push({ label: resolved.router.label, amount: resolved.router.oneOff });
    if (resolved.setup.oneOff  > 0) extraOneOff.push({ label: resolved.setup.label,  amount: resolved.setup.oneOff });
    // If ETF risk and no explicit cease fee set, append plain-English warning.
    if (resolved.internal.etf_risk && !q.cease_fee_gross) {
      // Note: customer-safe wording — no wholesale numbers exposed.
    }
  }

  const { data: qr } = await supabase
    .from("quote_requests")
    .select("full_name, email, postcode, address_line_1, address_line_2, town, county")
    .eq("id", q.quote_request_id).single();

  // Check for existing CS
  const { data: existing } = await supabase
    .from("contract_summaries")
    .select("id, status, version")
    .eq("quote_id", quote_id)
    .order("version", { ascending: false });

  const lastAccepted = (existing ?? []).find((c) => c.status === "accepted");
  if (lastAccepted) {
    return jsonResponse({
      error: "previous_accepted",
      message: "A previous Contract Summary for this quote was already accepted and is immutable. Create a new quote to change terms.",
    }, 409);
  }

  const nextVersion = (existing?.[0]?.version ?? 0) + 1;

  // Supersede prior non-accepted versions
  if (existing && existing.length > 0) {
    await supabase.from("contract_summaries")
      .update({ status: "superseded" })
      .eq("quote_id", quote_id)
      .neq("status", "accepted");
  }

  const { raw, hash } = await generateTokenPair();
  const tokenExpiresAt = q.expires_at;

  const oneOffJson = [
    { label: "Setup", amount: Number(q.setup_gross) },
    { label: "Router", amount: Number(q.router_gross) },
    { label: "Delivery", amount: Number(q.delivery_gross) },
    { label: "Installation", amount: Number(q.installation_gross) },
  ].filter((x) => x.amount > 0);
  // For Build Plan quotes, replace generic Setup/Router with the labelled lines.
  const finalOneOff = q.speed_bucket && q.plan_term && extraOneOff.length ? extraOneOff : oneOffJson;

  const addr = [qr?.address_line_1, qr?.address_line_2, qr?.town, qr?.county, qr?.postcode].filter(Boolean).join(", ");

  const isVoice = q.service_type === "digital_voice";

  const { data: cs, error: csErr } = await supabase.from("contract_summaries").insert({
    quote_id: q.id,
    quote_request_id: q.quote_request_id,
    customer_id: q.customer_id,
    version: nextVersion,
    status: "issued",
    customer_email_snapshot: qr!.email,
    customer_name_snapshot: qr!.full_name,
    service_address: addr || qr!.postcode,
    plan_name: q.plan_name,
    service_type: q.service_type,
    plan_type: q.plan_type,
    customer_type: q.customer_type,
    monthly_price_incl_vat: q.monthly_gross,
    business_monthly_ex_vat: q.customer_type === "business" ? q.monthly_net : null,
    business_monthly_incl_vat: q.customer_type === "business" ? q.monthly_gross : null,
    one_off_charges_json: finalOneOff,
    setup_charge: q.setup_gross,
    router_charge: q.router_gross,
    delivery_charge: q.delivery_gross,
    installation_charge: q.installation_gross,
    cease_cancellation_charges: q.cease_fee_gross
      ? `Cease/early termination charges (if applicable): £${Number(q.cease_fee_gross).toFixed(2)}.`
      : "No cease or early termination charges apply to this plan beyond statutory notice.",
    contract_length: q.plan_term === "price_lock_24"
      ? `Price Lock 24 — 24 months minimum term.`
      : q.plan_term === "flex_30"
        ? "Flex 30 — 30-day rolling. Cancel with 30 days' notice."
        : (q.plan_type === "flex"
            ? "30-day rolling. Cancel with 30 days' notice."
            : `${q.contract_length_months} months minimum term.`),
    notice_period: q.notice_period ?? "30 days",
    estimated_download_speed: q.estimated_download_speed,
    estimated_upload_speed: q.estimated_upload_speed,
    speed_notes: (q.speed_notes ?? "") + bpAddendum,
    price_rise_policy: q.price_rise_policy ?? PRICE_RISE_POLICY_TEXT,
    digital_voice_warning: isVoice ? DIGITAL_VOICE_WARNING_TEXT : null,
    vulnerable_customer_note: VULNERABLE_CUSTOMER_NOTE_TEXT,
    complaints_adr_info: COMPLAINTS_ADR_INFO_TEXT,
    payment_schedule: PAYMENT_SCHEDULE_TEXT_MONTHLY,
    terms_version: LEGAL_TEXT_VERSION,
    privacy_version: LEGAL_TEXT_VERSION,
    public_token_hash: hash,
    token_expires_at: tokenExpiresAt,
    issued_at: new Date().toISOString(),
    ...bpFields,
  }).select("id, cs_number").single();

  if (csErr || !cs) return jsonResponse({ error: "create_failed", details: csErr?.message }, 500);

  await supabase.rpc("log_event", {
    _actor_type: "admin", _event_type: "contract_summary_generated",
    _title: `CS ${cs.cs_number} v${nextVersion}`,
    _details: { contract_summary_id: cs.id, quote_id: q.id, version: nextVersion },
    _source_module: "contract_summary", _quote_id: q.id, _contract_summary_id: cs.id,
  });
  await supabase.from("quote_events").insert({
    quote_id: q.id, quote_request_id: q.quote_request_id, contract_summary_id: cs.id,
    event_type: "contract_summary_generated",
    title: `Contract Summary ${cs.cs_number} v${nextVersion} generated`,
    actor_type: "admin", actor_id: auth.userId,
  });

  return jsonResponse({ ok: true, contract_summary_id: cs.id, cs_number: cs.cs_number, public_token: raw, version: nextVersion });
});
/**
 * Journey 2 — materialise the session into the existing contractual pipeline.
 *
 * Idempotently creates the quote_request, the exactly-priced quote and the
 * order_journeys row, then triggers Contract Summary generation through the
 * existing `journey-generate-cs` service. The quote token it returns is what
 * drives the shared contract, start-date, Direct Debit, review and submission
 * steps, so Journey 2 never runs a second copy of that logic.
 *
 * Never sends a quote email, never creates invoices, payment requests,
 * Worldpay sessions, mandates or orders.
 */
import {
  corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit,
  getRequestIp, generateTokenPair,
} from "../_shared/quoteHelpers.ts";
import { loadJourneySettings, resolveJourney2Price, planNameFor, JOURNEY2_SETUP } from "../_shared/journey2.ts";
import { RESOLVER_VERSION } from "../_shared/buildPlanResolver.ts";
import { sha256Json } from "../_shared/ddCrypto.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({ token: z.string().min(16) });
const round2 = (n: number) => Math.round(n * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);

  const ip = getRequestIp(req) ?? "noip";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 400);
  if (!(await checkRateLimit(ip, "journey2_prepare_contract", 20, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const supabase = getServiceClient();
  const settings = await loadJourneySettings(supabase);
  // Authoritative VAT rate — never hard-coded.
  const vatPercent = Number((settings as any).vat_default_rate ?? 0);
  if (!(vatPercent > 0 && vatPercent <= 100)) {
    return jsonResponse({
      error: "vat_config_unavailable",
      message: "We couldn't confirm the VAT rate just now. Your order is saved — please try again in a moment.",
      retryable: true,
    }, 503);
  }
  const tokenHash = await sha256Hex(parsed.data.token);

  const { data: session } = await supabase
    .from("customer_journey_sessions")
    .select("*")
    .eq("public_token_hash", tokenHash)
    .maybeSingle();
  if (!session) return jsonResponse({ error: "session_not_found" }, 404);
  if (["cancelled", "expired"].includes(session.status)) {
    return jsonResponse({ error: "session_closed", status: session.status }, 409);
  }

  const details = session.customer_details as {
    full_name?: string; email?: string; phone?: string; date_of_birth?: string | null;
    current_provider?: string | null; marketing_consent?: boolean;
  } | null;
  const address = session.service_address as {
    address_line_1?: string; address_line_2?: string | null; town?: string; county?: string | null;
  } | null;

  if (!session.speed_bucket || !session.plan_term) return jsonResponse({ error: "plan_not_selected" }, 409);
  if (!details?.full_name || !details?.email || !details?.phone) return jsonResponse({ error: "details_incomplete" }, 409);
  if (!address?.address_line_1 || !address?.town || !session.postcode) return jsonResponse({ error: "address_incomplete" }, 409);
  // Contract documents are never generated before the start date and billing
  // selections exist — the documents must state both.
  if (!session.preferred_start_date || !session.cooling_off_acknowledged) {
    return jsonResponse({ error: "start_date_required", message: "Choose your preferred start date before we prepare your contract." }, 409);
  }
  if (!session.billing_anchor_day || !session.dd_masked) {
    return jsonResponse({ error: "billing_required", message: "Complete your billing day and Direct Debit details before we prepare your contract." }, 409);
  }

  // ── Idempotent replay: quote already materialised for this session ────────
  let quoteToken: string | null = null;
  let quoteId: string | null = session.quote_id ?? null;

  if (!quoteId) {
    // Re-resolve the price server-side. The client snapshot is never trusted.
    const priced = await resolveJourney2Price(supabase, settings, {
      speed_bucket: session.speed_bucket,
      plan_term: session.plan_term,
      router_option: (session.router_option as any)?.router_option ?? "own",
      router_payment_type: (session.router_option as any)?.router_payment_type ?? "none",
      addons: (session.selected_addons ?? []) as any,
      customer_type: "residential",
    });
    if (!priced) {
      // The session stays in Journey 2 and stays retryable — it is never
      // silently converted into a quote request.
      await supabase.from("customer_journey_sessions")
        .update({ last_error: "price_not_exact_at_contract", last_activity_at: new Date().toISOString() })
        .eq("id", session.id);
      await supabase.from("admin_tasks").insert({
        title: "Journey 2 price could not be resolved at contract stage",
        description: `Journey 2 session ${session.id} (${session.speed_bucket}/${session.plan_term}${session.test_session ? ", TEST" : ""}) has no exact price. The customer is still in Journey 2 and can retry.`,
        priority: "high",
        status: "open",
      }).then(() => {}).catch(() => {});
      await supabase.rpc("log_event", {
        _actor_type: "public",
        _event_type: "journey2_price_not_exact",
        _title: "Journey 2 exact price unavailable at contract stage",
        _details: { session_id: session.id },
        _source_module: "journey2",
        _severity: "error",
      }).then(() => {}).catch(() => {});
      return jsonResponse({
        error: "price_unavailable",
        message: "This option isn't priced right now. Your order is saved — please try again shortly or choose another option.",
        retryable: true,
      }, 409);
    }

    // quote_request — the intake record every downstream service reads from.
    let quoteRequestId: string | null = session.quote_request_id ?? null;
    if (!quoteRequestId) {
      const qrIns = await supabase.from("quote_requests").insert({
        full_name: details.full_name,
        email: details.email,
        phone: details.phone,
        date_of_birth: details.date_of_birth ?? null,
        postcode: String(session.postcode).toUpperCase(),
        address_line_1: address.address_line_1,
        address_line_2: address.address_line_2 ?? null,
        town: address.town,
        county: address.county ?? null,
        service_interest: "broadband",
        plan_preference: session.plan_term === "flex_30" ? "flex" : "contract_saver",
        customer_type: "residential",
        preferred_contact_method: "email",
        marketing_consent: !!details.marketing_consent,
        source: session.test_session ? "journey_v2_test" : "journey_v2",
        status: "quoted",
        message: `${session.test_session ? "[TEST] " : ""}Journey 2 order: ${session.speed_bucket} · ${session.plan_term} · router=${(session.router_option as any)?.router_option ?? "own"}/${(session.router_option as any)?.router_payment_type ?? "none"} · addons=${((session.selected_addons ?? []) as string[]).join(",") || "none"}`,
        ip,
        user_agent: ua,
      }).select("id, reference").single();
      if (qrIns.error) return jsonResponse({ error: "quote_request_failed", details: qrIns.error.message }, 500);
      quoteRequestId = qrIns.data.id;
      await supabase.from("customer_journey_sessions")
        .update({ quote_request_id: quoteRequestId }).eq("id", session.id);
    }

    const monthly_net = priced.internal.monthly_broadband_ex_vat + priced.internal.router_monthly_ex_vat + priced.internal.addons_monthly_ex_vat;
    const monthly_gross = priced.monthly_total_incl_vat;
    const monthly_vat = round2(monthly_gross - monthly_net);
    const router_net = priced.internal.router_one_off_ex_vat;
    const router_gross = priced.router.oneOff;
    const setup_net = priced.internal.setup_one_off_ex_vat;
    const setup_gross = priced.setup.oneOff;

    const { raw, hash } = await generateTokenPair();
    const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString();

    const qIns = await supabase.from("quotes").insert({
      quote_request_id: quoteRequestId,
      plan_name: planNameFor(session.speed_bucket as any, session.plan_term as any),
      service_type: "broadband",
      plan_type: session.plan_term === "flex_30" ? "flex" : "contract_saver",
      customer_type: "residential",
      contract_length_months: session.plan_term === "price_lock_24" ? 24 : null,
      monthly_net: round2(monthly_net),
      monthly_vat_rate: vatPercent,
      monthly_vat_amount: monthly_vat,
      monthly_gross,
      setup_net, setup_vat_amount: round2(setup_gross - setup_net), setup_gross,
      router_net, router_vat_amount: round2(router_gross - router_net), router_gross,
      // Journey 2 has no upfront payment step: one-off charges are billed on
      // the first invoice, never today.
      total_due_today_gross: 0,
      expires_at: expiresAt,
      token_expires_at: expiresAt,
      public_token_hash: hash,
      status: "approved",
      speed_bucket: session.speed_bucket,
      plan_term: session.plan_term,
      router_option: {
        option: priced.router.option, label: priced.router.label,
        monthly: priced.router.monthly, oneOff: priced.router.oneOff,
        payment_type: priced.router.payment_type,
      },
      setup_option: { option: JOURNEY2_SETUP, label: priced.setup.label, oneOff: priced.setup.oneOff },
      selected_addons: priced.addons,
      journey_version: "v2",
      checkout_session_id: session.checkout_session_id,
    }).select("id, quote_number").single();
    if (qIns.error) return jsonResponse({ error: "quote_failed", details: qIns.error.message }, 500);

    quoteId = qIns.data.id;
    quoteToken = raw;

    await supabase.from("quote_events").insert({
      quote_id: quoteId, quote_request_id: quoteRequestId,
      event_type: "quote_created",
      title: `Quote ${qIns.data.quote_number} created by Customer Journey 2`,
      actor_type: "public",
    });

    // order_journeys — the shared state machine for contract, start date,
    // Direct Debit, review and submission.
    const jIns = await supabase.from("order_journeys").insert({
      quote_id: quoteId,
      token_hash: hash,
      current_step: "agreement",
      status: "in_progress",
      journey_version: "v2",
      checkout_session_id: session.checkout_session_id,
      quote_continued_at: new Date().toISOString(),
      ip, ua,
    }).select("id").single();

    // ── Immutable final contractual snapshot ───────────────────────────────
    const snapshotBody = {
      customer: {
        full_name: details.full_name,
        email: details.email,
        phone: details.phone,
        date_of_birth: details.date_of_birth ?? null,
      },
      service_address: {
        address_line_1: address.address_line_1,
        address_line_2: address.address_line_2 ?? null,
        town: address.town,
        county: address.county ?? null,
        postcode: String(session.postcode).toUpperCase(),
      },
      billing_address: (details as any).billing_address_same === false
        ? (details as any).billing_address ?? null
        : "same_as_service_address",
      product: {
        plan_name: planNameFor(session.speed_bucket as any, session.plan_term as any),
        speed_bucket: session.speed_bucket,
        contract_term: session.plan_term,
        minimum_term_months: session.plan_term === "price_lock_24" ? 24 : 1,
      },
      router: priced.router,
      addons: priced.addons,
      pricing: {
        monthly_ex_vat: round2(monthly_net),
        monthly_vat: monthly_vat,
        monthly_incl_vat: monthly_gross,
        one_off_charges_incl_vat: round2(router_gross + setup_gross),
        amount_due_today: 0,
        estimated_first_bill_incl_vat: round2(monthly_gross + router_gross + setup_gross),
        vat_rate_percent: vatPercent,
      },
      schedule: {
        preferred_start_date: session.preferred_start_date,
        billing_day: session.billing_anchor_day,
        expected_first_collection_date: null,
        billing_commencement_rule: "Billing starts when the service goes live; the first Direct Debit is collected on the billing day at least 3 working days after advance notice, and only once the mandate is active.",
      },
      direct_debit: session.dd_masked,
      journey_version: "v2",
      checkout_session_id: session.checkout_session_id,
      pricing_version: RESOLVER_VERSION,
      test_session: !!session.test_session,
      created_at: new Date().toISOString(),
    };
    const snapshotHash = await sha256Json(snapshotBody);
    // Legal document versions come from the site copy registry the contract
    // documents themselves render from.
    const { data: legalRows } = await supabase
      .from("site_copy")
      .select("key, updated_at")
      .in("key", ["terms_of_service", "privacy_policy", "contract_summary", "direct_debit_guarantee"]);
    const legalVersions = Object.fromEntries((legalRows ?? []).map((r: any) => [r.key, r.updated_at]));
    const snapIns = await supabase.from("journey2_contract_snapshots").upsert({
      session_id: session.id,
      checkout_session_id: session.checkout_session_id,
      journey_version: "v2",
      test_session: !!session.test_session,
      pricing_version: RESOLVER_VERSION,
      legal_document_versions: legalVersions ?? {},
      snapshot: snapshotBody,
      snapshot_sha256: snapshotHash,
    }, { onConflict: "session_id", ignoreDuplicates: true }).select("id").maybeSingle();

    await supabase.from("customer_journey_sessions").update({
      contract_snapshot_id: snapIns.data?.id ?? null,
      quote_id: quoteId,
      quote_public_token_hash: hash,
      order_journey_id: jIns.data?.id ?? null,
      status: "contract_prepared",
      current_step: "contract",
      last_activity_at: new Date().toISOString(),
      price_snapshot: (() => { const { internal: _i, ...safe } = priced as any; return safe; })(),
    }).eq("id", session.id);

    await supabase.rpc("log_event", {
      _actor_type: "public",
      _event_type: "journey2_contract_prepared",
      _title: `Journey 2 contract prepared for ${qIns.data.quote_number}`,
      _details: { session_id: session.id, quote_id: quoteId, journey_id: jIns.data?.id ?? null, test_session: session.test_session },
      _source_module: "journey2",
      _quote_id: quoteId,
    }).then(() => {}).catch(() => {});
  }

  if (!quoteToken) {
    // Replay after a refresh: the raw quote token is only known to the browser
    // that received it, so rotate it onto the same quote and journey.
    const { raw, hash } = await generateTokenPair();
    await supabase.from("quotes").update({ public_token_hash: hash }).eq("id", quoteId);
    await supabase.from("order_journeys").update({ token_hash: hash }).eq("quote_id", quoteId);
    await supabase.from("customer_journey_sessions")
      .update({ quote_public_token_hash: hash, last_activity_at: new Date().toISOString() })
      .eq("id", session.id);
    quoteToken = raw;
  }

  // Prepare (or reuse) the Contract Summary through the existing service.
  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const csRes = await fetch(`${projectUrl}/functions/v1/journey-generate-cs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${svcKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ token: quoteToken }),
  });
  const csJson = await csRes.json().catch(() => ({}));
  if (!csRes.ok || (csJson as any).error) {
    return jsonResponse({
      ok: true,
      quote_token: quoteToken,
      contract_ready: false,
      contract_error: (csJson as any).error ?? "generation_failed",
    });
  }

  await supabase.from("customer_journey_sessions")
    .update({ contract_summary_id: (csJson as any).contract_summary_id ?? null })
    .eq("id", session.id);

  return jsonResponse({
    ok: true,
    quote_token: quoteToken,
    quote_id: quoteId,
    contract_ready: true,
    contract_summary_id: (csJson as any).contract_summary_id ?? null,
  });
});
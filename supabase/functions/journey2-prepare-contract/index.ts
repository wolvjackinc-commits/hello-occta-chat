/**
 * Journey 2 — prepare the contractual documents from one canonical snapshot.
 *
 * LIVE sessions materialise into the existing contractual pipeline (quote
 * request, exactly-priced quote, order journey, Contract Summary + Contract
 * Information) so nothing commercial is duplicated.
 *
 * TEST sessions are fully isolated from session creation onwards: they never
 * touch quote_requests, quotes, order_journeys, contract_summaries,
 * contract_information_packs, contract_acceptances, payment_methods, orders,
 * profiles, invoices, payment requests, the live email outbox or any provider.
 * Their contract documents are written to journey2_test_contract_summaries.
 *
 * Never sends an email, never creates invoices, payment requests, card
 * sessions, mandates or orders.
 */
import {
  corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit,
  getRequestIp, generateTokenPair,
} from "../_shared/quoteHelpers.ts";
import { loadJourneySettings, resolveJourney2Price, planNameFor, JOURNEY2_SETUP } from "../_shared/journey2.ts";
import { RESOLVER_VERSION } from "../_shared/buildPlanResolver.ts";
import {
  buildJourney2Snapshot, snapshotFingerprint, verifyStoredSnapshot,
  type Journey2Snapshot,
} from "../_shared/journey2Snapshot.ts";
import { buildJourney2DocumentPack } from "../_shared/journey2Docs.ts";
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

  const details = (session.customer_details ?? null) as Record<string, any> | null;
  const address = (session.service_address ?? null) as Record<string, any> | null;

  if (!session.speed_bucket || !session.plan_term) return jsonResponse({ error: "plan_not_selected" }, 409);
  if (!details?.full_name || !details?.email || !details?.phone) return jsonResponse({ error: "details_incomplete" }, 409);
  if (!address?.address_line_1 || !address?.town || !session.postcode) return jsonResponse({ error: "address_incomplete" }, 409);
  if (!session.preferred_start_date || !session.cooling_off_acknowledged) {
    return jsonResponse({ error: "start_date_required", message: "Choose your preferred start date before we prepare your contract." }, 409);
  }
  if (!session.billing_anchor_day || !session.dd_masked) {
    return jsonResponse({ error: "billing_required", message: "Complete your billing day and Direct Debit details before we prepare your contract." }, 409);
  }

  // ── One canonical snapshot per session ─────────────────────────────────────
  const { data: existingSnap } = await supabase
    .from("journey2_contract_snapshots")
    .select("id, snapshot, snapshot_sha256")
    .eq("session_id", session.id)
    .maybeSingle();

  let snapshot: Journey2Snapshot;
  let snapshotHash: string;
  let snapshotId: string | null = existingSnap?.id ?? null;

  if (existingSnap) {
    // An accepted snapshot is immutable; replay verifies it instead of rebuilding.
    const v = await verifyStoredSnapshot(existingSnap.snapshot, existingSnap.snapshot_sha256);
    if (!v.ok) {
      return jsonResponse({
        error: "snapshot_integrity_failed",
        detail: v.reason,
        message: "Your order details need to be re-confirmed before we can continue.",
      }, 409);
    }
    snapshot = existingSnap.snapshot as Journey2Snapshot;
    snapshotHash = existingSnap.snapshot_sha256 as string;
  } else {
    const priced = await resolveJourney2Price(supabase, settings, {
      speed_bucket: session.speed_bucket,
      plan_term: session.plan_term,
      router_option: (session.router_option as any)?.router_option ?? "own",
      router_payment_type: (session.router_option as any)?.router_payment_type ?? "none",
      addons: (session.selected_addons ?? []) as any,
      customer_type: "residential",
    });
    if (!priced) {
      await supabase.from("customer_journey_sessions")
        .update({ last_error: "price_not_exact_at_contract", last_activity_at: new Date().toISOString() })
        .eq("id", session.id);
      if (!session.test_session) {
        await supabase.from("admin_tasks").insert({
          title: "Journey 2 price could not be resolved at contract stage",
          description: `Journey 2 session ${session.id} (${session.speed_bucket}/${session.plan_term}) has no exact price. The customer is still in Journey 2 and can retry.`,
          priority: "high",
          status: "open",
        }).then(() => {}).catch(() => {});
      }
      return jsonResponse({
        error: "price_unavailable",
        message: "This option isn't priced right now. Your order is saved — please try again shortly or choose another option.",
        retryable: true,
      }, 409);
    }

    const { data: legalRows } = await supabase
      .from("site_copy")
      .select("key, updated_at")
      .in("key", ["terms_of_service", "privacy_policy", "contract_summary", "direct_debit_guarantee"]);
    const legalVersions = Object.fromEntries(
      (legalRows ?? []).map((r: any) => [String(r.key), String(r.updated_at)]).sort(),
    ) as Record<string, string>;

    snapshot = buildJourney2Snapshot({
      session,
      priced,
      vatPercent,
      pricingVersion: RESOLVER_VERSION,
      planName: planNameFor(session.speed_bucket as any, session.plan_term as any),
      legalVersions,
    });
    snapshotHash = await snapshotFingerprint(snapshot);

    const snapIns = await supabase.from("journey2_contract_snapshots").upsert({
      session_id: session.id,
      checkout_session_id: session.checkout_session_id,
      journey_version: "v2",
      test_session: !!session.test_session,
      pricing_version: RESOLVER_VERSION,
      legal_document_versions: legalVersions,
      snapshot,
      snapshot_sha256: snapshotHash,
    }, { onConflict: "session_id", ignoreDuplicates: true }).select("id").maybeSingle();
    snapshotId = snapIns.data?.id ?? null;
    if (!snapshotId) {
      const { data: again } = await supabase.from("journey2_contract_snapshots")
        .select("id, snapshot, snapshot_sha256").eq("session_id", session.id).maybeSingle();
      snapshotId = again?.id ?? null;
      if (again) { snapshot = again.snapshot as Journey2Snapshot; snapshotHash = again.snapshot_sha256 as string; }
    }

    // Keep the browser-visible price snapshot aligned with the agreed figures.
    await supabase.from("customer_journey_sessions").update({
      contract_snapshot_id: snapshotId,
      price_snapshot: {
        ...(() => { const { internal: _i, ...safe } = priced as any; return safe; })(),
        amount_due_today: 0,
        one_off_in_first_bill: snapshot.pricing.one_off_charges_incl_vat,
      },
      pricing_version: RESOLVER_VERSION,
      last_activity_at: new Date().toISOString(),
    }).eq("id", session.id);
  }

  // ── TEST path: contract documents live only in the test tables ─────────────
  if (session.test_session) {
    const pack = buildJourney2DocumentPack(snapshot, {
      order_number: "TEST — pending submission",
      snapshot_sha256: snapshotHash,
      dd_status: "suppressed_test",
      test: true,
    });
    const cs = pack.find((d) => d.doc_type === "contract_summary")!;
    const ci = pack.find((d) => d.doc_type === "contract_information")!;

    const ins = await supabase.from("journey2_test_contract_summaries").upsert({
      test_run_id: session.test_run_id ?? null,
      session_id: session.id,
      checkout_session_id: session.checkout_session_id,
      status: "issued",
      snapshot_sha256: snapshotHash,
      summary: cs.content,
      contract_information: ci.content,
    }, { onConflict: "session_id" }).select("id").single();
    if (ins.error) return jsonResponse({ error: "test_contract_failed", details: ins.error.message }, 500);

    await supabase.from("customer_journey_sessions").update({
      test_contract_summary_id: ins.data.id,
      status: "contract_prepared",
      current_step: "contract",
      last_activity_at: new Date().toISOString(),
      last_error: null,
    }).eq("id", session.id);

    return jsonResponse({
      ok: true,
      test_session: true,
      contract_ready: true,
      test_contract_summary_id: ins.data.id,
      snapshot_sha256: snapshotHash,
    });
  }

  // ── LIVE path ─────────────────────────────────────────────────────────────
  let quoteToken: string | null = null;
  let quoteId: string | null = session.quote_id ?? null;

  if (!quoteId) {
    const priced = await resolveJourney2Price(supabase, settings, {
      speed_bucket: session.speed_bucket,
      plan_term: session.plan_term,
      router_option: (session.router_option as any)?.router_option ?? "own",
      router_payment_type: (session.router_option as any)?.router_payment_type ?? "none",
      addons: (session.selected_addons ?? []) as any,
      customer_type: "residential",
    });
    if (!priced) return jsonResponse({ error: "price_unavailable", retryable: true }, 409);

    // The quote must carry exactly the agreed snapshot figures.
    if (Math.abs(round2(priced.monthly_total_incl_vat) - snapshot.pricing.monthly_incl_vat) > 0.005) {
      return jsonResponse({
        error: "price_changed_since_snapshot",
        message: "Our prices changed while you were ordering. Please review your order again so you agree the current price.",
      }, 409);
    }

    let quoteRequestId: string | null = session.quote_request_id ?? null;
    if (!quoteRequestId) {
      const qrIns = await supabase.from("quote_requests").insert({
        full_name: snapshot.customer.full_name,
        email: snapshot.customer.email,
        phone: snapshot.customer.phone,
        date_of_birth: snapshot.customer.date_of_birth,
        postcode: String(snapshot.service_address.postcode),
        address_line_1: snapshot.service_address.address_line_1,
        address_line_2: snapshot.service_address.address_line_2,
        town: snapshot.service_address.town,
        county: snapshot.service_address.county,
        service_interest: "broadband",
        plan_preference: session.plan_term === "flex_30" ? "flex" : "contract_saver",
        customer_type: "residential",
        preferred_contact_method: "email",
        marketing_consent: snapshot.customer.marketing_consent,
        source: "journey_v2",
        status: "quoted",
        message: `Journey 2 order: ${session.speed_bucket} · ${session.plan_term} · router=${snapshot.router.option}/${snapshot.router.payment_type} · addons=${snapshot.addons.map((a) => a.id).join(",") || "none"}`,
        ip,
        user_agent: ua,
      }).select("id, reference").single();
      if (qrIns.error) return jsonResponse({ error: "quote_request_failed", details: qrIns.error.message }, 500);
      quoteRequestId = qrIns.data.id;
      await supabase.from("customer_journey_sessions")
        .update({ quote_request_id: quoteRequestId }).eq("id", session.id);
    }

    const monthly_net = snapshot.pricing.monthly_ex_vat;
    const monthly_gross = snapshot.pricing.monthly_incl_vat;
    const router_net = priced.internal.router_one_off_ex_vat;
    const router_gross = round2(priced.router.oneOff);
    const setup_net = priced.internal.setup_one_off_ex_vat;
    const setup_gross = round2(priced.setup.oneOff);

    const { raw, hash } = await generateTokenPair();
    const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString();

    const qIns = await supabase.from("quotes").insert({
      quote_request_id: quoteRequestId,
      plan_name: snapshot.product.plan_name,
      service_type: "broadband",
      plan_type: session.plan_term === "flex_30" ? "flex" : "contract_saver",
      customer_type: "residential",
      contract_length_months: session.plan_term === "price_lock_24" ? 24 : null,
      monthly_net,
      monthly_vat_rate: vatPercent,
      monthly_vat_amount: snapshot.pricing.monthly_vat,
      monthly_gross,
      setup_net, setup_vat_amount: round2(setup_gross - setup_net), setup_gross,
      router_net, router_vat_amount: round2(router_gross - router_net), router_gross,
      total_due_today_gross: 0,
      expires_at: expiresAt,
      token_expires_at: expiresAt,
      public_token_hash: hash,
      status: "approved",
      speed_bucket: session.speed_bucket,
      plan_term: session.plan_term,
      router_option: snapshot.router,
      setup_option: { option: JOURNEY2_SETUP, label: snapshot.product.setup.label, oneOff: snapshot.product.setup.one_off_incl_vat },
      selected_addons: snapshot.addons,
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

    await supabase.from("customer_journey_sessions").update({
      quote_id: quoteId,
      quote_public_token_hash: hash,
      order_journey_id: jIns.data?.id ?? null,
      status: "contract_prepared",
      current_step: "contract",
      last_activity_at: new Date().toISOString(),
    }).eq("id", session.id);

    await supabase.rpc("log_event", {
      _actor_type: "public",
      _event_type: "journey2_contract_prepared",
      _title: `Journey 2 contract prepared for ${qIns.data.quote_number}`,
      _details: { session_id: session.id, quote_id: quoteId, snapshot_sha256: snapshotHash },
      _source_module: "journey2",
      _quote_id: quoteId,
    }).then(() => {}).catch(() => {});
  }

  if (!quoteToken) {
    const { raw, hash } = await generateTokenPair();
    await supabase.from("quotes").update({ public_token_hash: hash }).eq("id", quoteId);
    await supabase.from("order_journeys").update({ token_hash: hash }).eq("quote_id", quoteId);
    await supabase.from("customer_journey_sessions")
      .update({ quote_public_token_hash: hash, last_activity_at: new Date().toISOString() })
      .eq("id", session.id);
    quoteToken = raw;
  }

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
    test_session: false,
    quote_token: quoteToken,
    quote_id: quoteId,
    contract_ready: true,
    contract_summary_id: (csJson as any).contract_summary_id ?? null,
    snapshot_sha256: snapshotHash,
  });
});

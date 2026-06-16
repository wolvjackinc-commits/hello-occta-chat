import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";

/**
 * Public, tokenised endpoint that powers the unified `/quote/:token` journey shell.
 *
 * Modes (POST body):
 *   { token, action: "get" }      → fetch quote + journey + contract-summary status
 *   { token, action: "continue" } → transition `quote` step → `agreement`,
 *                                    creating the order_journeys row if missing
 *
 * Never creates supplier orders, payment requests, invoices or sends email.
 * Always returns a `unified_journey_enabled` flag so the client can fall back
 * to the legacy single-page flow when the feature is off.
 */

type Action = "get" | "continue";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let body: { token?: string; action?: Action } = {};
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }

  const token = (body.token ?? "").trim();
  const action: Action = body.action === "continue" ? "continue" : "get";
  if (!token || token.length < 16) return jsonResponse({ error: "invalid_token" }, 400);

  const ip = getRequestIp(req) ?? "noip";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 512);
  if (!(await checkRateLimit(ip, `journey_state_${action}`, 60, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const hash = await sha256Hex(token);
  const supabase = getServiceClient();

  // Feature flag — clients use this to decide whether to render the unified UI.
  const { data: settings } = await supabase
    .from("platform_settings")
    .select("unified_journey_enabled")
    .limit(1)
    .maybeSingle();
  const unified_journey_enabled = !!settings?.unified_journey_enabled;

  // Quote lookup (customer-safe fields only).
  const { data: q } = await supabase
    .from("quotes")
    .select(`
      id, quote_number, plan_name, service_type, plan_type, customer_type, contract_length_months,
      monthly_net, monthly_vat_amount, monthly_gross,
      setup_gross, router_gross, delivery_gross, installation_gross,
      total_due_today_gross, cease_fee_gross,
      estimated_download_speed, estimated_upload_speed, speed_notes,
      price_rise_policy, notice_period, status, expires_at, customer_notes,
      quote_request_id, customer_intent_proceeded_at, selected_addons,
      unified_journey_opt_in
    `)
    .eq("public_token_hash", hash)
    .maybeSingle();

  if (!q) return jsonResponse({ error: "not_found" }, 404);

  // Per-quote admin opt-in overrides the global feature flag so a single quote
  // can be tested on the unified journey before the global rollout.
  const unified_for_this_quote = unified_journey_enabled || !!(q as any).unified_journey_opt_in;

  const { data: qr } = await supabase
    .from("quote_requests")
    .select("full_name, email, postcode, service_interest")
    .eq("id", q.quote_request_id)
    .maybeSingle();

  const expired = q.expires_at ? new Date(q.expires_at).getTime() < Date.now() : false;
  const eligible = ["approved", "sent", "viewed"].includes(q.status) && !expired;

  // Existing journey (if any).
  const JOURNEY_COLS = "id, current_step, status, decline_reason, preferred_start_date, start_date_selected_at, payment_method, billing_anchor_day, contract_accepted_at, cooling_off_ends_at, earliest_selectable_start_date, cooling_off_acknowledged, cooling_off_acknowledged_at, completed_at, contract_summary_id, cancelled_at, cancellation_reason, linked_customer_id, linked_at, manual_review_required";
  let { data: journey } = await supabase
    .from("order_journeys")
    .select(JOURNEY_COLS)
    .eq("token_hash", hash)
    .maybeSingle();

  if (unified_for_this_quote && !journey && action === "get" && q.customer_intent_proceeded_at && eligible) {
    // Recovery for controlled test quotes that were viewed before the per-quote
    // unified flag was switched on: the legacy button may already have stamped
    // customer_intent_proceeded_at without creating an order_journeys row. Do not
    // leave those customers on the quote/legacy stop screen after refresh — resume
    // them directly at the in-page Agreement / Contract Summary step.
    const insert = await supabase
      .from("order_journeys")
      .insert({
        quote_id: q.id,
        token_hash: hash,
        current_step: "agreement",
        status: "in_progress",
        quote_continued_at: q.customer_intent_proceeded_at,
        ip, ua,
      })
      .select(JOURNEY_COLS)
      .single();
    if (!insert.error) journey = insert.data;
  }

  if (action === "continue") {
    if (!eligible) return jsonResponse({ error: "quote_not_eligible", reason: expired ? "expired" : q.status }, 409);
    if (journey?.status === "declined") return jsonResponse({ error: "journey_declined" }, 409);
    if (journey?.status === "cancelled") return jsonResponse({ error: "journey_cancelled" }, 409);

    if (!journey) {
      const insert = await supabase
        .from("order_journeys")
        .insert({
          quote_id: q.id,
          token_hash: hash,
          current_step: "agreement",
          status: "in_progress",
          quote_continued_at: new Date().toISOString(),
          ip, ua,
        })
        .select(JOURNEY_COLS)
        .single();
      if (insert.error) return jsonResponse({ error: "journey_create_failed", details: insert.error.message }, 500);
      journey = insert.data;
    } else if (journey.current_step === "quote") {
      const upd = await supabase
        .from("order_journeys")
        .update({ current_step: "agreement", quote_continued_at: new Date().toISOString() })
        .eq("id", journey.id)
        .select(JOURNEY_COLS)
        .single();
      if (upd.error) return jsonResponse({ error: "journey_update_failed", details: upd.error.message }, 500);
      journey = upd.data;
    }

    // Best-effort: mirror legacy intent timestamp so the existing pipeline stays consistent.
    // Skip the legacy proceed RPC in unified mode — the journey flow is the
    // source of truth and the legacy path triggers a separate admin-notify and
    // stamps `customer_intent_proceeded_at`, which competes with the in-page
    // Contract Summary transition. Keep it only when the quote is NOT unified.
    if (!unified_for_this_quote) {
      await supabase.rpc("customer_proceed_with_quote_by_token", {
        _token_hash: hash, _ip: ip, _ua: ua,
      }).then(() => {}).catch(() => {});
    }

    await supabase.rpc("log_event", {
      _actor_type: "public",
      _event_type: "journey_quote_continued",
      _title: `Journey continued for ${q.quote_number}`,
      _details: { quote_id: q.id, journey_id: journey?.id },
      _source_module: "journey",
    }).then(() => {}).catch(() => {});
  } else {
    // GET: best-effort mark quote viewed (idempotent).
    if (q.status === "sent") {
      await supabase.from("quotes").update({ status: "viewed" }).eq("id", q.id);
    }
  }

  const { data: cs } = await supabase
    .from("contract_summaries")
    .select("id, public_token_hash, status, version")
    .eq("quote_id", q.id)
    .neq("status", "superseded")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Active payment method snapshot (masked only) and DD provider config.
  let payment_method_summary: unknown = null;
  if (journey?.id) {
    const { data: pm } = await supabase
      .from("payment_methods")
      .select("id, method, billing_anchor_day, dd_setup_status, masked_account_last4, masked_sort_last2, bank_name, account_holder_name, consent_version, consent_at, active")
      .eq("journey_id", journey.id)
      .eq("active", true)
      .maybeSingle();
    payment_method_summary = pm ?? null;
  }
  const { data: ddCfg } = await supabase
    .from("dd_provider_config")
    .select("provider_name, ddi_template_version, guarantee_version, provider_approval_date, live_collection_enabled")
    .eq("singleton", true)
    .maybeSingle();
  const dd_provider_template_available = !!(
    ddCfg?.ddi_template_version && ddCfg?.guarantee_version && ddCfg?.provider_approval_date
  );

  // If the journey is completed, surface the linked guest_orders row (best-effort,
  // matched via the journey:<id> tag in admin_notes — see journey-submit-order).
  let submitted_order: { order_number: string; status: string; id: string } | null = null;
  if (journey?.id && (journey as any).status === "completed") {
    const { data: go } = await supabase
      .from("guest_orders")
      .select("id, order_number, status")
      .ilike("admin_notes", `%journey:${journey.id}%`)
      .maybeSingle();
    submitted_order = go ?? null;
  }

  // Cooling-off / cancellation window snapshot for the UI.
  let cancellation_window: {
    ends_at: string | null;
    cancellable: boolean;
    cancelled_at: string | null;
    cancellation_reason: string | null;
  } | null = null;
  if (journey?.id) {
    const endsAt = (journey as any).cooling_off_ends_at ?? null;
    const cancelledAt = (journey as any).cancelled_at ?? null;
    const reviewLock = !!(journey as any).manual_review_required;
    const within = endsAt ? new Date(endsAt).getTime() > Date.now() : false;
    cancellation_window = {
      ends_at: endsAt,
      cancellable: (journey as any).status === "completed" && within && !cancelledAt && !reviewLock,
      cancelled_at: cancelledAt,
      cancellation_reason: (journey as any).cancellation_reason ?? null,
    };
  }

  return jsonResponse({
    ok: true,
    unified_journey_enabled: unified_for_this_quote,
    quote: {
      ...q,
      customer_name: qr?.full_name ?? null,
      service_postcode: qr?.postcode ?? null,
    },
    journey: journey ?? null,
    contract_summary_available: !!cs,
    contract_summary_status: cs?.status ?? null,
    payment_method: payment_method_summary,
    dd_provider_template_available,
    submitted_order,
    cancellation_window,
  });
});

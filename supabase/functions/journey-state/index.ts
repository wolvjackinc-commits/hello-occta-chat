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
      quote_request_id, customer_intent_proceeded_at, selected_addons
    `)
    .eq("public_token_hash", hash)
    .maybeSingle();

  if (!q) return jsonResponse({ error: "not_found" }, 404);

  const { data: qr } = await supabase
    .from("quote_requests")
    .select("full_name, email, postcode, service_interest")
    .eq("id", q.quote_request_id)
    .maybeSingle();

  const expired = q.expires_at ? new Date(q.expires_at).getTime() < Date.now() : false;
  const eligible = ["approved", "sent", "viewed"].includes(q.status) && !expired;

  // Existing journey (if any).
  const JOURNEY_COLS = "id, current_step, status, decline_reason, preferred_start_date, start_date_selected_at, payment_method, billing_anchor_day, contract_accepted_at, cooling_off_ends_at, cooling_off_acknowledged, cooling_off_acknowledged_at, early_start_waived, early_start_waived_at, completed_at, contract_summary_id";
  let { data: journey } = await supabase
    .from("order_journeys")
    .select(JOURNEY_COLS)
    .eq("token_hash", hash)
    .neq("status", "cancelled")
    .maybeSingle();

  if (action === "continue") {
    if (!eligible) return jsonResponse({ error: "quote_not_eligible", reason: expired ? "expired" : q.status }, 409);
    if (journey?.status === "declined") return jsonResponse({ error: "journey_declined" }, 409);

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
    await supabase.rpc("customer_proceed_with_quote_by_token", {
      _token_hash: hash, _ip: ip, _ua: ua,
    }).then(() => {}).catch(() => {});

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

  return jsonResponse({
    ok: true,
    unified_journey_enabled,
    quote: {
      ...q,
      customer_name: qr?.full_name ?? null,
      service_postcode: qr?.postcode ?? null,
    },
    journey: journey ?? null,
    contract_summary_available: !!cs,
    contract_summary_status: cs?.status ?? null,
  });
});

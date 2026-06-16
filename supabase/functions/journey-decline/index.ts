import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";

/**
 * Customer declines a quote from inside the unified journey.
 * Public, tokenised. No payment, supplier, email side-effects beyond:
 *  - upserts order_journeys row → status='declined'
 *  - inserts journey_decline_events row
 *  - logs activity_log + admin task notification (best-effort)
 */

const ALLOWED_REASONS = new Set([
  "too_expensive", "found_alternative", "speed_too_slow", "address_not_ready",
  "changed_mind", "contract_concerns", "no_longer_needed", "other",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let body: { token?: string; reason_code?: string; reason_text?: string } = {};
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }

  const token = (body.token ?? "").trim();
  const reason_code = (body.reason_code ?? "").trim();
  const reason_text = (body.reason_text ?? "").trim().slice(0, 2000) || null;
  if (!token || token.length < 16) return jsonResponse({ error: "invalid_token" }, 400);
  if (!ALLOWED_REASONS.has(reason_code)) return jsonResponse({ error: "invalid_reason" }, 400);

  const ip = getRequestIp(req) ?? "noip";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 512);
  if (!(await checkRateLimit(ip, "journey_decline", 10, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const hash = await sha256Hex(token);
  const supabase = getServiceClient();

  const { data: q } = await supabase
    .from("quotes")
    .select("id, quote_number, status, expires_at, quote_request_id")
    .eq("public_token_hash", hash)
    .maybeSingle();
  if (!q) return jsonResponse({ error: "not_found" }, 404);

  const expired = q.expires_at ? new Date(q.expires_at).getTime() < Date.now() : false;
  if (expired) return jsonResponse({ error: "quote_expired" }, 409);

  // Find or create journey row.
  let { data: journey } = await supabase
    .from("order_journeys")
    .select("id, status")
    .eq("token_hash", hash)
    .neq("status", "cancelled")
    .maybeSingle();

  if (!journey) {
    const ins = await supabase
      .from("order_journeys")
      .insert({
        quote_id: q.id,
        token_hash: hash,
        current_step: "quote",
        status: "declined",
        decline_reason: reason_code,
        decline_notes: reason_text,
        declined_at: new Date().toISOString(),
        ip, ua,
      })
      .select("id, status")
      .single();
    if (ins.error) return jsonResponse({ error: "journey_create_failed", details: ins.error.message }, 500);
    journey = ins.data;
  } else if (journey.status !== "declined") {
    const upd = await supabase
      .from("order_journeys")
      .update({
        status: "declined",
        decline_reason: reason_code,
        decline_notes: reason_text,
        declined_at: new Date().toISOString(),
      })
      .eq("id", journey.id)
      .select("id, status")
      .single();
    if (upd.error) return jsonResponse({ error: "journey_update_failed", details: upd.error.message }, 500);
    journey = upd.data;
  } else {
    return jsonResponse({ ok: true, already: true });
  }

  await supabase.from("journey_decline_events").insert({
    journey_id: journey.id,
    reason_code,
    reason_text,
    ip, ua,
  });

  // Status flip on the quote so admins see it in their pipeline.
  await supabase.from("quotes").update({ status: "declined" }).eq("id", q.id);

  await supabase.from("quote_events").insert({
    quote_id: q.id,
    quote_request_id: q.quote_request_id,
    event_type: "quote_declined",
    title: `Customer declined quote (${reason_code})`,
    actor_type: "public",
    details: { reason_code, reason_text },
  }).then(() => {}).catch(() => {});

  await supabase.rpc("log_event", {
    _actor_type: "public",
    _event_type: "journey_declined",
    _title: `Quote declined: ${q.quote_number}`,
    _details: { quote_id: q.id, journey_id: journey.id, reason_code },
    _source_module: "journey",
  }).then(() => {}).catch(() => {});

  // Internal admin notification (best-effort, non-blocking).
  try {
    const { data: qr } = q.quote_request_id
      ? await supabase.from("quote_requests").select("full_name, email, postcode, reference").eq("id", q.quote_request_id).maybeSingle()
      : { data: null };
    await supabase.functions.invoke("admin-notify", {
      body: {
        type: "customer_declined_quote",
        data: {
          quote_number: q.quote_number,
          reason_code, reason_text,
          customer_name: qr?.full_name, customer_email: qr?.email,
          postcode: qr?.postcode, request_reference: qr?.reference,
          quote_id: q.id, journey_id: journey.id,
        },
      },
    });
  } catch (_) { /* swallow */ }

  return jsonResponse({ ok: true, journey_id: journey.id, status: "declined" });
});

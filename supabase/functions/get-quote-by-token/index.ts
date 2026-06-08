import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let body: { token?: string } = {};
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }
  const token = (body.token ?? "").trim();
  if (!token || token.length < 16) return jsonResponse({ error: "invalid_token" }, 400);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "get_quote_by_token", 60, 60))) return jsonResponse({ error: "rate_limited" }, 429);

  const hash = await sha256Hex(token);
  const supabase = getServiceClient();
  const { data: q, error } = await supabase
    .from("quotes")
    .select(`
      id, quote_number, plan_name, service_type, plan_type, customer_type, contract_length_months,
      monthly_net, monthly_vat_amount, monthly_gross,
      setup_gross, router_gross, delivery_gross, installation_gross,
      total_due_today_gross, cease_fee_gross,
      estimated_download_speed, estimated_upload_speed, speed_notes,
      price_rise_policy, notice_period, status, expires_at, customer_notes,
      quote_request_id
    `)
    .eq("public_token_hash", hash)
    .maybeSingle();

  if (error || !q) return jsonResponse({ error: "not_found" }, 404);

  // Mark viewed (idempotent: only if status sent)
  if (q.status === "sent") {
    await supabase.from("quotes").update({ status: "viewed" }).eq("id", q.id);
    await supabase.rpc("log_event", {
      _actor_type: "public", _event_type: "quote_viewed",
      _title: `Quote viewed ${q.quote_number}`,
      _details: { quote_id: q.id },
      _source_module: "quote",
    });
    await supabase.from("quote_events").insert({
      quote_id: q.id, quote_request_id: q.quote_request_id,
      event_type: "quote_viewed", title: "Quote viewed by customer", actor_type: "public",
    });
  }

  // Look up the latest non-superseded contract summary token for this quote (so the page can link to it)
  const { data: cs } = await supabase
    .from("contract_summaries")
    .select("public_token_hash, status, version")
    .eq("quote_id", q.id)
    .neq("status", "superseded")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return jsonResponse({
    ok: true,
    quote: q,
    contract_summary_available: !!cs,
    contract_summary_status: cs?.status ?? null,
  });
});
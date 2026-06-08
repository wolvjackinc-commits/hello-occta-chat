import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let body: { token?: string } = {};
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }
  const token = (body.token ?? "").trim();
  if (!token || token.length < 16) return jsonResponse({ error: "invalid_token" }, 400);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "get_cs_by_token", 60, 60))) return jsonResponse({ error: "rate_limited" }, 429);

  const hash = await sha256Hex(token);
  const supabase = getServiceClient();
  const { data: cs, error } = await supabase
    .from("contract_summaries")
    .select("*")
    .eq("public_token_hash", hash)
    .maybeSingle();

  if (error || !cs) return jsonResponse({ error: "not_found" }, 404);

  if (cs.status === "issued") {
    await supabase.from("contract_summaries").update({ status: "viewed" }).eq("id", cs.id);
    await supabase.rpc("log_event", {
      _actor_type: "public", _event_type: "contract_summary_viewed",
      _title: `CS viewed ${cs.cs_number}`,
      _details: { contract_summary_id: cs.id, quote_id: cs.quote_id },
      _source_module: "contract_summary",
    });
    await supabase.from("quote_events").insert({
      quote_id: cs.quote_id, quote_request_id: cs.quote_request_id, contract_summary_id: cs.id,
      event_type: "contract_summary_viewed", title: "Contract Summary viewed", actor_type: "public",
    });
  }

  // Never expose internal tokens
  const { public_token_hash: _h, ...safe } = cs;
  return jsonResponse({ ok: true, contract_summary: safe });
});
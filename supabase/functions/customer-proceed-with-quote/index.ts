import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";

/**
 * Records customer intent to proceed with a quote. Two modes:
 *   - { token }   → public/tokenised path (used by /quote/:token)
 *   - { quote_id }→ authenticated dashboard path; requires user JWT
 * No payment, contract summary, supplier order or service is created — only an
 * intent timestamp + audit log + optional internal admin email.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let body: { token?: string; quote_id?: string } = {};
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }

  const ip = getRequestIp(req) ?? "noip";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 512);
  const supabase = getServiceClient();

  let result: { ok: boolean; reason?: string; already?: boolean; proceeded_at?: string } | null = null;
  let quoteId: string | null = null;

  if (body.token && body.token.trim().length >= 16) {
    if (!(await checkRateLimit(ip, "customer_proceed_quote_token", 20, 60))) {
      return jsonResponse({ error: "rate_limited" }, 429);
    }
    const hash = await sha256Hex(body.token.trim());
    const { data, error } = await supabase.rpc("customer_proceed_with_quote_by_token", {
      _token_hash: hash, _ip: ip, _ua: ua,
    });
    if (error) return jsonResponse({ error: "rpc_failed", details: error.message }, 500);
    result = data as any;
    if (result?.ok) {
      const { data: q } = await supabase.from("quotes").select("id").eq("public_token_hash", hash).maybeSingle();
      quoteId = q?.id ?? null;
    }
  } else if (body.quote_id) {
    // Authenticated path — forward the user's JWT so auth.uid() resolves inside the RPC.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "missing_jwt" }, 401);
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await userClient.rpc("customer_proceed_with_quote_authed", { _quote_id: body.quote_id });
    if (error) return jsonResponse({ error: "rpc_failed", details: error.message }, 500);
    result = data as any;
    quoteId = result?.ok ? body.quote_id : null;
  } else {
    return jsonResponse({ error: "missing_token_or_quote_id" }, 400);
  }

  if (!result) return jsonResponse({ error: "unknown" }, 500);

  // Fire internal admin email on the first-time proceed event (best-effort, non-blocking).
  if (result.ok && !result.already && quoteId) {
    // Mark quote as completed (customer proceeded to Contract Summary stage).
    await supabase.from("quotes").update({ completed_at: new Date().toISOString() }).eq("id", quoteId);
    try {
      const { data: q } = await supabase
        .from("quotes")
        .select("quote_number, plan_name, monthly_gross, quote_request_id")
        .eq("id", quoteId).maybeSingle();
      const { data: qr } = q?.quote_request_id
        ? await supabase.from("quote_requests").select("full_name, email, postcode, reference").eq("id", q.quote_request_id).maybeSingle()
        : { data: null };
      await supabase.functions.invoke("admin-notify", {
        body: {
          type: "customer_proceeded_quote",
          data: {
            quote_number: q?.quote_number, plan_name: q?.plan_name,
            monthly_gross: q?.monthly_gross,
            customer_name: qr?.full_name, customer_email: qr?.email,
            postcode: qr?.postcode, request_reference: qr?.reference,
            quote_id: quoteId,
          },
        },
      });
    } catch (e) {
      console.warn("[customer-proceed-with-quote] admin-notify failed", e);
    }
  }

  return jsonResponse(result);
});
import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
import { perfServe } from "../_shared/perfLog.ts";

/**
 * Token-based wrapper around `generate-contract-summary` for the unified
 * `/quote/:token` journey. Reuses an existing non-superseded CS when one
 * already exists and is idempotent under refresh / double-click.
 *
 * Body: { token: string }                     -- quote public token
 * Returns: { ok, contract_summary_id, cs_public_token, version, status, pdf_ready }
 *
 * Never sends email, never creates orders, payment requests, invoices or services.
 */

Deno.serve(perfServe("journey-generate-cs", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({} as { token?: string }));
  const token = (body.token ?? "").trim();
  if (!token || token.length < 16) return jsonResponse({ error: "invalid_token" }, 400);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "journey_gen_cs", 20, 60))) return jsonResponse({ error: "rate_limited" }, 429);

  const hash = await sha256Hex(token);
  const supabase = getServiceClient();

  const { data: q } = await supabase
    .from("quotes")
    .select("id, status, expires_at, customer_id, quote_request_id")
    .eq("public_token_hash", hash)
    .maybeSingle();
  if (!q) return jsonResponse({ error: "quote_not_found" }, 404);

  // Locate the active journey for this token (must exist — journey-state creates it).
  let { data: journey } = await supabase
    .from("order_journeys")
    .select("id, current_step, status, contract_summary_id")
    .eq("token_hash", hash)
    .neq("status", "cancelled")
    .maybeSingle();

  if (!journey) {
    const existing = await supabase
      .from("order_journeys")
      .select("id, current_step, status, contract_summary_id")
      .eq("quote_id", q.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.data) {
      journey = existing.data;
      await supabase.from("order_journeys").update({ token_hash: hash }).eq("id", journey.id);
    }
  }
  if (!journey) return jsonResponse({ error: "no_journey", message: "Continue with the quote first." }, 409);
  if (journey.status === "declined") return jsonResponse({ error: "journey_declined" }, 409);

  // Idempotent reuse: existing non-superseded CS for the quote
  const { data: existing } = await supabase
    .from("contract_summaries")
    .select("id, status, version, pdf_storage_key, public_token_hash")
    .eq("quote_id", q.id)
    .neq("status", "superseded")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Link journey if not already linked
    if (!journey.contract_summary_id) {
      await supabase.from("order_journeys")
        .update({ contract_summary_id: existing.id })
        .eq("id", journey.id);
    }
    return jsonResponse({
      ok: true,
      reused: true,
      contract_summary_id: existing.id,
      version: existing.version,
      status: existing.status,
      pdf_ready: !!existing.pdf_storage_key,
    });
  }

  // Generate via the existing edge function using service-role + internal flag.
  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const r = await fetch(`${projectUrl}/functions/v1/generate-contract-summary`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${svcKey}`,
      "Content-Type": "application/json",
      "x-internal-service": "1",
    },
    body: JSON.stringify({ quote_id: q.id, actor_id: q.customer_id ?? null, journey_mode: true }),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    let detail: unknown = txt;
    try { detail = JSON.parse(txt); } catch { /* ignore */ }
    await supabase.rpc("log_event", {
      _actor_type: "system", _event_type: "journey_cs_generation_failed",
      _title: `CS generation failed for journey ${journey.id}`,
      _details: { quote_id: q.id, status: r.status, detail },
      _source_module: "journey", _severity: "error", _quote_id: q.id,
    }).then(() => {}).catch(() => {});
    return jsonResponse({ error: "generation_failed", details: detail, status: r.status }, 502);
  }

  const json = await r.json();

  // Link journey to the newly minted CS
  await supabase.from("order_journeys")
    .update({ contract_summary_id: json.contract_summary_id })
    .eq("id", journey.id);

  return jsonResponse({
    ok: true,
    reused: false,
    contract_summary_id: json.contract_summary_id,
    cs_number: json.cs_number,
    version: json.version,
    status: "issued",
    pdf_ready: !json.pdf_pending,
  });
}));
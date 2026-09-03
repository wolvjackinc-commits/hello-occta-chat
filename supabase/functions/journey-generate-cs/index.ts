import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
import { perfServe } from "../_shared/perfLog.ts";

/**
 * Token-based wrapper around the contract-document generators for the unified
 * `/quote/:token` journey. It guarantees that the immutable Contract Summary
 * and, when the two-document flow is enabled, the matching Contract Information
 * pack are both prepared before the customer can sign.
 */

async function ensureContractInformationPack(
  supabase: any,
  quoteId: string,
  contractSummaryId: string,
): Promise<{ required: boolean; ready: boolean; pack_id?: string; error?: string; details?: unknown }> {
  const { data: settings } = await supabase
    .from("platform_settings")
    .select("two_document_contract_flow_enabled")
    .eq("singleton", true)
    .maybeSingle();
  if (!settings?.two_document_contract_flow_enabled) return { required: false, ready: true };

  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const r = await fetch(`${projectUrl}/functions/v1/generate-contract-information-pack`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${svcKey}`,
      "Content-Type": "application/json",
      "x-internal-service": "1",
    },
    body: JSON.stringify({ quote_id: quoteId }),
  });
  const body = await r.json().catch(async () => ({ raw: await r.text().catch(() => "") }));
  if (!r.ok || !body?.pack_id) {
    return { required: true, ready: false, error: "contract_information_generation_failed", details: body };
  }

  const { data: pack, error: packErr } = await supabase
    .from("contract_information_packs")
    .select("id, contract_summary_id, document_status, pdf_storage_path")
    .eq("id", body.pack_id)
    .maybeSingle();
  if (packErr || !pack) {
    return { required: true, ready: false, error: "contract_information_missing_after_generation", details: packErr?.message };
  }

  // The generated information pack must be paired to the exact Contract Summary
  // version being shown. Reusing an already accepted pack for another CS is not
  // permitted; non-accepted/idempotently generated rows can be linked safely.
  if (pack.contract_summary_id && pack.contract_summary_id !== contractSummaryId && pack.document_status === "accepted") {
    return { required: true, ready: false, error: "contract_information_already_bound_to_other_summary" };
  }
  if (pack.contract_summary_id !== contractSummaryId) {
    const { error: linkErr } = await supabase
      .from("contract_information_packs")
      .update({ contract_summary_id: contractSummaryId })
      .eq("id", pack.id)
      .neq("document_status", "accepted");
    if (linkErr) {
      return { required: true, ready: false, error: "contract_information_link_failed", details: linkErr.message };
    }
  }

  return { required: true, ready: !!pack.pdf_storage_path, pack_id: pack.id };
}

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
    const existingJourney = await supabase
      .from("order_journeys")
      .select("id, current_step, status, contract_summary_id")
      .eq("quote_id", q.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingJourney.data) {
      journey = existingJourney.data;
      await supabase.from("order_journeys").update({ token_hash: hash }).eq("id", journey.id);
    }
  }
  if (!journey) return jsonResponse({ error: "no_journey", message: "Continue with the quote first." }, 409);
  if (journey.status === "declined") return jsonResponse({ error: "journey_declined" }, 409);

  // Idempotent reuse: existing non-superseded CS for the quote.
  const { data: existing } = await supabase
    .from("contract_summaries")
    .select("id, status, version, pdf_storage_key, public_token_hash")
    .eq("quote_id", q.id)
    .neq("status", "superseded")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (!journey.contract_summary_id) {
      await supabase.from("order_journeys")
        .update({ contract_summary_id: existing.id })
        .eq("id", journey.id);
    }
    const ci = await ensureContractInformationPack(supabase, q.id, existing.id);
    if (!ci.ready) {
      await supabase.rpc("log_event", {
        _actor_type: "system", _event_type: "journey_contract_information_generation_failed",
        _title: `Contract Information generation failed for journey ${journey.id}`,
        _details: { quote_id: q.id, contract_summary_id: existing.id, error: ci.error, details: ci.details ?? null },
        _source_module: "journey", _severity: "error", _quote_id: q.id,
      }).then(() => {}).catch(() => {});
      return jsonResponse({ error: ci.error ?? "contract_information_not_ready", details: ci.details }, 502);
    }
    return jsonResponse({
      ok: true,
      reused: true,
      contract_summary_id: existing.id,
      version: existing.version,
      status: existing.status,
      pdf_ready: !!existing.pdf_storage_key,
      contract_information_required: ci.required,
      contract_information_ready: ci.ready,
      contract_information_pack_id: ci.pack_id ?? null,
    });
  }

  // Generate the Contract Summary using service-role + internal flag.
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
  const csId = json.contract_summary_id as string | undefined;
  if (!csId) return jsonResponse({ error: "generation_failed", details: "Contract Summary generator returned no id." }, 502);

  // Link journey to the newly minted CS before preparing the paired document.
  await supabase.from("order_journeys")
    .update({ contract_summary_id: csId })
    .eq("id", journey.id);

  const ci = await ensureContractInformationPack(supabase, q.id, csId);
  if (!ci.ready) {
    await supabase.rpc("log_event", {
      _actor_type: "system", _event_type: "journey_contract_information_generation_failed",
      _title: `Contract Information generation failed for journey ${journey.id}`,
      _details: { quote_id: q.id, contract_summary_id: csId, error: ci.error, details: ci.details ?? null },
      _source_module: "journey", _severity: "error", _quote_id: q.id,
    }).then(() => {}).catch(() => {});
    return jsonResponse({ error: ci.error ?? "contract_information_not_ready", details: ci.details }, 502);
  }

  return jsonResponse({
    ok: true,
    reused: false,
    contract_summary_id: csId,
    cs_number: json.cs_number,
    version: json.version,
    status: "issued",
    pdf_ready: !json.pdf_pending,
    contract_information_required: ci.required,
    contract_information_ready: ci.ready,
    contract_information_pack_id: ci.pack_id ?? null,
  });
}));
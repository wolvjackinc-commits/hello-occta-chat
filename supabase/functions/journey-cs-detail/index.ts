import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
import { perfServe } from "../_shared/perfLog.ts";

/**
 * Returns the Contract Summary linked to a unified-journey token together with
 * short-lived signed download URLs for the complete two-document pack.
 */
Deno.serve(perfServe("journey-cs-detail", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({} as { token?: string }));
  const token = (body.token ?? "").trim();
  if (!token || token.length < 16) return jsonResponse({ error: "invalid_token" }, 400);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "journey_cs_detail", 120, 60))) return jsonResponse({ error: "rate_limited" }, 429);

  const hash = await sha256Hex(token);
  const supabase = getServiceClient();

  let { data: journey } = await supabase
    .from("order_journeys")
    .select("id, quote_id, contract_summary_id, contract_acceptance_id, contract_accepted_at, status, current_step")
    .eq("token_hash", hash)
    .neq("status", "cancelled")
    .maybeSingle();

  if (!journey) {
    const { data: q } = await supabase
      .from("quotes")
      .select("id")
      .eq("public_token_hash", hash)
      .maybeSingle();
    if (q?.id) {
      const existing = await supabase
        .from("order_journeys")
        .select("id, quote_id, contract_summary_id, contract_acceptance_id, contract_accepted_at, status, current_step")
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
  }
  if (!journey) return jsonResponse({ error: "no_journey" }, 404);
  if (!journey.contract_summary_id) return jsonResponse({ error: "no_cs_yet" }, 404);

  const { data: cs } = await supabase
    .from("contract_summaries")
    .select("*")
    .eq("id", journey.contract_summary_id)
    .maybeSingle();
  if (!cs) return jsonResponse({ error: "cs_missing" }, 404);

  // Mark "viewed" once (idempotent — service trigger allows this transition).
  if (cs.status === "issued") {
    await supabase.from("contract_summaries").update({ status: "viewed" }).eq("id", cs.id);
    await supabase.from("quote_events").insert({
      quote_id: cs.quote_id, quote_request_id: cs.quote_request_id, contract_summary_id: cs.id,
      event_type: "contract_summary_viewed", title: "Contract Summary viewed (journey)", actor_type: "public",
    }).then(() => {}).catch(() => {});
  }

  let signed_pdf_url: string | null = null;
  let pdf_ready = false;
  if (cs.pdf_storage_key) {
    const { data: signed } = await supabase.storage
      .from("contract-pdfs")
      .createSignedUrl(cs.pdf_storage_key, 60 * 60 * 24);
    signed_pdf_url = signed?.signedUrl ?? null;
    pdf_ready = !!signed_pdf_url;
  }

  const { data: settings } = await supabase
    .from("platform_settings")
    .select("two_document_contract_flow_enabled")
    .eq("singleton", true)
    .maybeSingle();
  const contract_information_required = !!settings?.two_document_contract_flow_enabled;

  let contract_information: { number: string; signed_url: string; version: number } | null = null;
  const { data: cip } = await supabase
    .from("contract_information_packs")
    .select("cip_number, version, document_status, pdf_storage_path")
    .eq("contract_summary_id", cs.id)
    .neq("document_status", "superseded")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cip?.pdf_storage_path && !["cancelled", "void_manual_review"].includes(String(cip.document_status))) {
    const { data: signed } = await supabase.storage
      .from("contract-documents")
      .createSignedUrl(cip.pdf_storage_path, 60 * 60 * 24);
    if (signed?.signedUrl) {
      contract_information = {
        number: cip.cip_number,
        signed_url: signed.signedUrl,
        version: cip.version,
      };
    }
  }

  // Optional: include certificate signed URL if acceptance already happened.
  let certificate: { number: string; signed_url: string; sha256: string } | null = null;
  if (journey.contract_acceptance_id) {
    const { data: cert } = await supabase
      .from("acceptance_certificates")
      .select("certificate_number, storage_key, sha256")
      .eq("contract_acceptance_id", journey.contract_acceptance_id)
      .maybeSingle();
    if (cert) {
      const { data: signed } = await supabase.storage
        .from("acceptance-certificates")
        .createSignedUrl(cert.storage_key, 60 * 60 * 24);
      certificate = {
        number: cert.certificate_number,
        signed_url: signed?.signedUrl ?? "",
        sha256: cert.sha256,
      };
    }
  }

  // Strip internal audit / storage / archival fields — never expose to token holders.
  const {
    public_token_hash: _h,
    accepted_ip: _ip,
    accepted_user_agent: _ua,
    pdf_storage_key: _psk,
    pdf_sha256: _psha,
    pdf_generated_by: _pgb,
    archived_reason: _ar,
    archived_at: _aa,
    ...safe
  } = cs as Record<string, unknown>;
  return jsonResponse({
    ok: true,
    contract_summary: safe,
    journey_step: journey.current_step,
    accepted_at: journey.contract_accepted_at,
    signed_pdf_url,
    pdf_ready,
    contract_information_required,
    contract_information_ready: !contract_information_required || !!contract_information?.signed_url,
    contract_information,
    certificate,
  });
}));
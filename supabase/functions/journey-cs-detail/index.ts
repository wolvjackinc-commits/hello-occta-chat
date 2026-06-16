import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";

/**
 * Returns the Contract Summary that is linked to a unified-journey token,
 * together with a short-lived signed download URL for the immutable PDF.
 *
 * The journey token authenticates access — no CS-specific token is required
 * because the journey row already binds the customer's journey to one CS.
 *
 * Body: { token: string }                  -- quote / journey token
 * Returns: { ok, contract_summary, signed_pdf_url, pdf_ready, certificate? }
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({} as { token?: string }));
  const token = (body.token ?? "").trim();
  if (!token || token.length < 16) return jsonResponse({ error: "invalid_token" }, 400);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "journey_cs_detail", 120, 60))) return jsonResponse({ error: "rate_limited" }, 429);

  const hash = await sha256Hex(token);
  const supabase = getServiceClient();

  const { data: journey } = await supabase
    .from("order_journeys")
    .select("id, quote_id, contract_summary_id, contract_acceptance_id, contract_accepted_at, status, current_step")
    .eq("token_hash", hash)
    .neq("status", "cancelled")
    .maybeSingle();
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

  // Sign the immutable PDF if it exists. Never generate from this endpoint —
  // the PDF must already be stored by generate-contract-summary-pdf.
  let signed_pdf_url: string | null = null;
  let pdf_ready = false;
  if (cs.pdf_storage_key) {
    pdf_ready = true;
    const { data: signed } = await supabase.storage
      .from("contract-pdfs")
      .createSignedUrl(cs.pdf_storage_key, 60 * 60 * 24);
    signed_pdf_url = signed?.signedUrl ?? null;
  }

  // Optional: include certificate signed URL if acceptance already happened
  let certificate: { number: string; signed_url: string; sha256: string } | null = null;
  if (journey.contract_acceptance_id) {
    const { data: cert } = await supabase
      .from("acceptance_certificates")
      .select("certificate_number, storage_key, sha256")
      .eq("contract_acceptance_id", journey.contract_acceptance_id)
      .maybeSingle();
    if (cert) {
      const { data: cs2 } = await supabase.storage
        .from("acceptance-certificates")
        .createSignedUrl(cert.storage_key, 60 * 60 * 24);
      certificate = {
        number: cert.certificate_number,
        signed_url: cs2?.signedUrl ?? "",
        sha256: cert.sha256,
      };
    }
  }

  const { public_token_hash: _h, ...safe } = cs;
  return jsonResponse({
    ok: true,
    contract_summary: safe,
    journey_step: journey.current_step,
    accepted_at: journey.contract_accepted_at,
    signed_pdf_url,
    pdf_ready,
    certificate,
  });
});
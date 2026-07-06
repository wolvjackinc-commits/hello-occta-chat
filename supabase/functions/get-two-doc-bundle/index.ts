// Phase B — token-based reader for the two-document bundle (CS + Pack + signed
// PDF URLs). Behind two_document_contract_flow_enabled. Never exposes internal
// audit metadata (IP, UA, session, security event IDs).

import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
import { isTwoDocEnabledFor, logPilotEvent, callerUserIdFromRequest } from "../_shared/twoDocFlowGate.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({ token: z.string().min(16).max(512) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation" }, 400);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "get_two_doc", 30, 60))) return jsonResponse({ error: "rate_limited" }, 429);

  const supabase = getServiceClient();

  const callerUserId = callerUserIdFromRequest(req);
  const gate = await isTwoDocEnabledFor(supabase, callerUserId);
  if (!gate.enabled) {
    await logPilotEvent(supabase, {
      event_type: "access_denied",
      user_id: callerUserId,
      metadata: { fn: "get-two-doc-bundle" },
    });
    return jsonResponse({ error: "feature_disabled" }, 409);
  }

  const hash = await sha256Hex(parsed.data.token);
  const { data: cs } = await supabase
    .from("contract_summaries")
    .select("*")
    .eq("public_token_hash", hash)
    .maybeSingle();
  if (!cs) return jsonResponse({ error: "not_found" }, 404);
  if (cs.token_expires_at && new Date(cs.token_expires_at) < new Date())
    return jsonResponse({ error: "expired" }, 410);

  const { data: pack } = await supabase
    .from("contract_information_packs")
    .select("id, cip_number, version, document_status, pdf_hash, pdf_storage_path, template_version, body_snapshot")
    .eq("quote_id", cs.quote_id)
    .neq("document_status", "superseded")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  let packSignedUrl: string | null = null;
  if (pack?.pdf_storage_path) {
    const { data: sig } = await supabase.storage.from("contract-documents")
      .createSignedUrl(pack.pdf_storage_path, 600);
    packSignedUrl = sig?.signedUrl ?? null;
  }

  let csSignedUrl: string | null = null;
  if (cs.pdf_storage_key) {
    // CS PDFs use whichever bucket the legacy generator wrote to.
    for (const bucket of ["contract-summaries", "contract-documents"]) {
      const { data: sig } = await supabase.storage.from(bucket).createSignedUrl(cs.pdf_storage_key, 600);
      if (sig?.signedUrl) { csSignedUrl = sig.signedUrl; break; }
    }
  }

  // Public-safe projection. Do NOT return accepted_ip, accepted_user_agent.
  const publicCs = {
    id: cs.id, cs_number: cs.cs_number, version: cs.version, status: cs.status,
    customer_name_snapshot: cs.customer_name_snapshot,
    customer_email_snapshot: cs.customer_email_snapshot,
    service_address: cs.service_address,
    plan_name: cs.plan_name, customer_type: cs.customer_type,
    monthly_price_incl_vat: cs.monthly_price_incl_vat,
    body_snapshot: (cs.one_off_charges_json as any)?.snapshot ?? null,
    terms_version: cs.terms_version, privacy_version: cs.privacy_version,
    accepted_at: cs.accepted_at, token_expires_at: cs.token_expires_at,
    pdf_ready: !!cs.pdf_storage_key,
  };

  return jsonResponse({
    ok: true,
    contract_summary: publicCs,
    contract_summary_signed_url: csSignedUrl,
    contract_information_pack: pack ? {
      id: pack.id, cip_number: pack.cip_number, version: pack.version, status: pack.document_status,
      template_version: pack.template_version, pdf_hash: pack.pdf_hash,
      body_snapshot: pack.body_snapshot,
    } : null,
    contract_information_pack_signed_url: packSignedUrl,
  });
});

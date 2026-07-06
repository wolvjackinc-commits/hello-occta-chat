// Admin-only sample-PDF generator.
//
// Produces one Contract Summary + one Contract Information Pack for each of
// the 6 canonical service configurations, plus (once accepted via the normal
// acceptance endpoint on a staging order) an Acceptance Certificate.
//
// All PDFs are written to the private `contract-documents` bucket under
// `samples/{yyyy-mm-dd}/`. Nothing here touches production quotes or
// accepted documents.
//
// Requires an admin JWT AND an existing test/staging quote_id for each
// scenario (the caller passes them in). This function will NOT synthesize
// live data — it will only generate against quote rows the admin has
// already prepared in staging.

import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";
import { callerUserIdFromRequest } from "../_shared/twoDocFlowGate.ts";

type ScenarioKey =
  | "flex_broadband_only"
  | "fixed_broadband_only"
  | "broadband_plus_digital_voice"
  | "sim_only"
  | "broadband_plus_sim_bundle"
  | "mixed_flex_fixed_bundle";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabase = getServiceClient();
  const callerId = callerUserIdFromRequest(req);
  if (!callerId) return jsonResponse({ error: "unauthorized" }, 401);
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: callerId, _role: "admin" });
  const { data: isSuper } = await supabase.rpc("has_role", { _user_id: callerId, _role: "super_admin" });
  if (!isAdmin && !isSuper) return jsonResponse({ error: "forbidden" }, 403);

  // The caller must be in the pilot allowlist so we don't need to flip the
  // global flag to test.
  const { data: pilot } = await supabase
    .from("two_doc_pilot_allowlist").select("id").eq("user_id", callerId).eq("active", true).maybeSingle();
  if (!pilot?.id) {
    return jsonResponse({
      error: "admin_not_in_pilot",
      message: "Add yourself to two_doc_pilot_allowlist first via two-doc-pilot-admin.",
    }, 409);
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const scenarios = body.scenarios as Record<ScenarioKey, string> | undefined;
  if (!scenarios || typeof scenarios !== "object") {
    return jsonResponse({
      error: "scenarios_required",
      hint: "Pass { scenarios: { flex_broadband_only: '<staging_quote_id>', ... } }. Prepare one staging quote per scenario first.",
    }, 400);
  }

  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? `Bearer ${svcKey}`;

  const results: Array<Record<string, unknown>> = [];

  for (const [scenario, quoteId] of Object.entries(scenarios)) {
    if (!quoteId) { results.push({ scenario, skipped: true }); continue; }

    // 1. Contract Summary
    const csRes = await fetch(`${projectUrl}/functions/v1/generate-service-aware-cs`, {
      method: "POST",
      headers: { "Authorization": authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ quote_id: quoteId }),
    });
    const csJson = await csRes.json().catch(() => ({}));

    // 2. Contract Information Pack (also triggered internally, but call
    // explicitly so we return the hash + doc id).
    const packRes = await fetch(`${projectUrl}/functions/v1/generate-contract-information-pack`, {
      method: "POST",
      headers: { "Authorization": authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ quote_id: quoteId }),
    });
    const packJson = await packRes.json().catch(() => ({}));

    // Signed URLs for review.
    let packSignedUrl: string | null = null;
    if (packJson?.pdf_storage_path) {
      const { data: sig } = await supabase.storage
        .from("contract-documents")
        .createSignedUrl(packJson.pdf_storage_path, 3600);
      packSignedUrl = sig?.signedUrl ?? null;
    }

    results.push({
      scenario,
      quote_id: quoteId,
      contract_summary: {
        id: csJson?.contract_summary_id ?? null,
        cs_number: csJson?.cs_number ?? null,
        version: csJson?.version ?? null,
        body_snapshot: csJson?.body_snapshot ?? null,
        error: csJson?.error ?? null,
      },
      contract_information_pack: {
        id: packJson?.pack_id ?? null,
        cip_number: packJson?.cip_number ?? null,
        version: packJson?.version ?? null,
        pdf_hash: packJson?.pdf_hash ?? null,
        pdf_storage_path: packJson?.pdf_storage_path ?? null,
        pdf_signed_url_1h: packSignedUrl,
        error: packJson?.error ?? null,
      },
    });
  }

  return jsonResponse({ ok: true, generated_at: new Date().toISOString(), scenarios: results });
});
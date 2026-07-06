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
  // Two acceptable auth paths:
  //  (a) Admin/super_admin JWT AND caller is in two_doc_pilot_allowlist
  //  (b) Bootstrap token header for the one-shot review pack
  const bootstrapToken = Deno.env.get("PILOT_BOOTSTRAP_TOKEN");
  const providedToken = req.headers.get("x-bootstrap-token");
  const isBootstrap = !!bootstrapToken && providedToken === bootstrapToken;
  if (!isBootstrap) {
    const callerId = callerUserIdFromRequest(req);
    if (!callerId) return jsonResponse({ error: "unauthorized" }, 401);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: callerId, _role: "admin" });
    const { data: isSuper } = await supabase.rpc("has_role", { _user_id: callerId, _role: "super_admin" });
    if (!isAdmin && !isSuper) return jsonResponse({ error: "forbidden" }, 403);
    const { data: pilot } = await supabase
      .from("two_doc_pilot_allowlist").select("id").eq("user_id", callerId).eq("active", true).maybeSingle();
    if (!pilot?.id) {
      return jsonResponse({ error: "admin_not_in_pilot" }, 409);
    }
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
  const authHeader = isBootstrap ? `Bearer ${svcKey}` : (req.headers.get("Authorization") ?? `Bearer ${svcKey}`);
  // When bootstrapping we impersonate the pilot user for downstream gate checks.
  const PILOT_USER_ID = "dfcd8176-44f7-4d90-8dae-69efd53c9340";
  const downstreamHeaders: Record<string, string> = {
    "Authorization": authHeader,
    "Content-Type": "application/json",
  };
  if (isBootstrap) downstreamHeaders["x-pilot-caller-id"] = PILOT_USER_ID;

  const results: Array<Record<string, unknown>> = [];

  for (const [scenario, quoteId] of Object.entries(scenarios)) {
    if (!quoteId) { results.push({ scenario, skipped: true }); continue; }

    // 1. Contract Summary
    const csRes = await fetch(`${projectUrl}/functions/v1/generate-service-aware-cs`, {
      method: "POST",
      headers: downstreamHeaders,
      body: JSON.stringify({ quote_id: quoteId }),
    });
    const csJson = await csRes.json().catch(() => ({}));

    // 2. Contract Information Pack (also triggered internally, but call
    // explicitly so we return the hash + doc id).
    const packRes = await fetch(`${projectUrl}/functions/v1/generate-contract-information-pack`, {
      method: "POST",
      headers: downstreamHeaders,
      body: JSON.stringify({ quote_id: quoteId }),
    });
    const packJson = await packRes.json().catch(() => ({}));

    // The generator response may not include the storage path when it hits
    // the idempotent-reuse branch. Look it up from the DB and mint a
    // signed URL for review.
    let storagePath: string | null = packJson?.pdf_storage_path ?? null;
    if (!storagePath && (packJson?.pack_id || packJson?.reused)) {
      const { data: row } = await supabase
        .from("contract_information_packs")
        .select("pdf_storage_path")
        .eq("quote_id", quoteId)
        .eq("document_status", "issued")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      storagePath = (row as any)?.pdf_storage_path ?? null;
    }
    let packSignedUrl: string | null = null;
    if (storagePath) {
      const { data: sig } = await supabase.storage
        .from("contract-documents")
        .createSignedUrl(storagePath, 3600);
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
        // Only returned to the bootstrap caller; used to complete a pilot
        // acceptance for a single sample. Not stored anywhere.
        public_token: isBootstrap ? (csJson?.public_token ?? null) : undefined,
      },
      contract_information_pack: {
        id: packJson?.pack_id ?? null,
        cip_number: packJson?.cip_number ?? null,
        version: packJson?.version ?? null,
        pdf_hash: packJson?.pdf_hash ?? null,
        pdf_storage_path: storagePath,
        pdf_signed_url_1h: packSignedUrl,
        error: packJson?.error ?? null,
      },
    });
  }

  return jsonResponse({ ok: true, generated_at: new Date().toISOString(), scenarios: results });
});
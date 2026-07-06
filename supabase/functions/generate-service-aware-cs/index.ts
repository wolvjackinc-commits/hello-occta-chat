// Phase B — issue-time generator for the service-aware short Contract Summary.
// Behind two_document_contract_flow_enabled. Does NOT touch existing
// generate-contract-summary / accept-contract-summary / journey-generate-cs
// codepaths — legacy customers continue on the old flow until an admin
// switches the flag on for their journey.
//
// Output shape mirrors the existing contract_summaries row plus an additional
// body_snapshot column in one_off_charges_json for backwards-compat display.

import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, generateTokenPair } from "../_shared/quoteHelpers.ts";
import {
  CONTRACT_SUMMARY_TITLE, TWO_DOC_TEMPLATE_VERSION,
  SIM_ONLY_HEADER_NOTE, PAYMENT_SCHEDULE_SAFE, COMPLAINTS_ADR_SAFE, SPEED_ESTIMATE_DISCLAIMER,
} from "../_shared/twoDocLegalText.ts";
import { buildServiceComponentsSnapshot, bundleTotalMonthly, hasComponent } from "../_shared/serviceComponents.ts";
import { validateTwoDocIssue } from "../_shared/twoDocValidators.ts";
import type { CustomerSegment } from "../_shared/twoDocValidators.ts";
import { isTwoDocEnabledFor, logPilotEvent, callerUserIdFromRequest } from "../_shared/twoDocFlowGate.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({} as { quote_id?: string; customer_segment?: CustomerSegment }));
  const quoteId = body.quote_id;
  if (!quoteId) return jsonResponse({ error: "missing_quote_id" }, 400);

  const supabase = getServiceClient();

  const callerUserId = callerUserIdFromRequest(req);
  const gate = await isTwoDocEnabledFor(supabase, callerUserId);
  if (!gate.enabled) {
    await logPilotEvent(supabase, {
      event_type: "access_denied",
      user_id: callerUserId,
      metadata: { fn: "generate-service-aware-cs", quote_id: quoteId },
    });
    return jsonResponse({ error: "feature_disabled" }, 409);
  }

  const { data: q } = await supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle();
  if (!q) return jsonResponse({ error: "quote_not_found" }, 404);

  const segment: CustomerSegment = (body.customer_segment ??
    ((q as any).customer_type === "business" ? "small_business" : "residential")) as CustomerSegment;

  const components = buildServiceComponentsSnapshot(q as any);
  const validation = validateTwoDocIssue({ customer_segment: segment, components });
  if (!validation.ok) {
    return jsonResponse({ error: "hard_block", blocks: validation.blocks }, 422);
  }

  // Never overwrite an accepted CS.
  const { data: existing } = await supabase
    .from("contract_summaries")
    .select("id, status, version")
    .eq("quote_id", quoteId)
    .order("version", { ascending: false });
  if ((existing ?? []).some((c) => c.status === "accepted")) {
    return jsonResponse({ error: "previous_accepted", message: "An accepted Contract Summary already exists — cannot regenerate." }, 409);
  }
  const nextVersion = (existing?.[0]?.version ?? 0) + 1;
  if (existing && existing.length) {
    await supabase.from("contract_summaries")
      .update({ status: "superseded" })
      .eq("quote_id", quoteId)
      .neq("status", "accepted");
  }

  const { data: qr } = await supabase
    .from("quote_requests")
    .select("full_name, email, postcode, address_line_1, address_line_2, town, county")
    .eq("id", (q as any).quote_request_id).single();

  const addr = [qr?.address_line_1, qr?.address_line_2, qr?.town, qr?.county, qr?.postcode].filter(Boolean).join(", ");
  const { raw, hash } = await generateTokenPair();
  const total = bundleTotalMonthly(components);
  const simOnly = components.length > 0 && components.every((c) => c.kind === "sim" || c.kind === "addon");

  const oneOff = components.flatMap((c) => c.kind === "addon" || c.monthly_price_incl_vat === 0 ? [] : []);

  // Service-aware body: itemised per component. Stored alongside legacy fields
  // so the existing dashboard still renders something sensible.
  const bodySnapshot = {
    template_version: TWO_DOC_TEMPLATE_VERSION,
    customer_segment: segment,
    components,
    total_monthly_incl_vat: total,
    sim_only: simOnly,
    header_note: simOnly ? SIM_ONLY_HEADER_NOTE : null,
    speed_disclaimer: hasComponent(components, "broadband") ? SPEED_ESTIMATE_DISCLAIMER : null,
    payment_schedule: PAYMENT_SCHEDULE_SAFE,
    complaints_adr: COMPLAINTS_ADR_SAFE,
  };

  const { data: cs, error: csErr } = await supabase.from("contract_summaries").insert({
    quote_id: (q as any).id,
    quote_request_id: (q as any).quote_request_id,
    customer_id: (q as any).customer_id,
    version: nextVersion,
    status: "issued",
    customer_email_snapshot: qr!.email,
    customer_name_snapshot: qr!.full_name,
    service_address: addr || qr!.postcode,
    plan_name: simOnly
      ? components.find((c) => c.kind === "sim")?.label ?? "SIM plan"
      : (q as any).plan_name,
    service_type: (q as any).service_type,
    plan_type: (q as any).plan_type,
    customer_type: (q as any).customer_type,
    monthly_price_incl_vat: total,
    one_off_charges_json: { two_doc: true, snapshot: bodySnapshot, legacy_one_off: oneOff },
    contract_length: components.every((c) => c.contract_kind === "flex_30_rolling")
      ? "Flex 30 — 30-day rolling on all components"
      : "Mixed — see per-component terms in the Contract Summary and Pack",
    notice_period: "30 days (per component — see snapshot)",
    price_rise_policy: "See per-component price-change wording. Restricted to 'no scheduled increase' or fixed pounds-and-pence.",
    payment_schedule: PAYMENT_SCHEDULE_SAFE,
    complaints_adr_info: COMPLAINTS_ADR_SAFE,
    vulnerable_customer_note: "OCCTA supports vulnerable customers — see Vulnerable Customers Policy.",
    terms_version: TWO_DOC_TEMPLATE_VERSION,
    privacy_version: TWO_DOC_TEMPLATE_VERSION,
    public_token_hash: hash,
    token_expires_at: (q as any).expires_at,
    issued_at: new Date().toISOString(),
  }).select("id, cs_number").single();

  if (csErr || !cs) return jsonResponse({ error: "create_failed", details: csErr?.message }, 500);

  await logPilotEvent(supabase, {
    event_type: "pdf_issued",
    user_id: callerUserId,
    document_id: cs.id,
    metadata: { doc_kind: "contract_summary", cs_number: cs.cs_number, gate: gate.reason },
  });

  // Trigger pack generation (best-effort — safe to retry).
  try {
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    await fetch(`${projectUrl}/functions/v1/generate-contract-information-pack`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${svcKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ quote_id: quoteId, customer_segment: segment }),
    });
  } catch { /* best-effort */ }

  return jsonResponse({
    ok: true,
    contract_summary_id: cs.id,
    cs_number: cs.cs_number,
    version: nextVersion,
    public_token: raw,
    body_snapshot: bodySnapshot,
    requires_dv_acknowledgement: hasComponent(components, "digital_voice"),
  });
});

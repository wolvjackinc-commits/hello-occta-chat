// Phase C — acceptance endpoint for the two-document flow. Behind
// two_document_contract_flow_enabled. Runs the full hard-block set (ETF,
// price-change, DV ack), splits customer-visible acceptance evidence from
// internal audit metadata (acceptance_audit_records), and marks BOTH the
// Contract Summary AND the Contract Information Pack as accepted.
//
// Legacy accept-contract-summary is not modified.

import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, getRequestIp, checkRateLimit, maskEmail } from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { validateTwoDocAcceptance } from "../_shared/twoDocValidators.ts";
import type { CustomerSegment, ServiceComponent } from "../_shared/twoDocValidators.ts";
import {
  DV_ACKNOWLEDGEMENT_CHECKBOX, TWO_DOC_TEMPLATE_VERSION,
} from "../_shared/twoDocLegalText.ts";

const CHECKBOXES = {
  received_read:
    "I confirm that I have received, reviewed and had the opportunity to download both my Contract Summary and my Contract Information & Customer Agreement Pack.",
  details_correct:
    "I confirm that my personal details and service address shown are correct.",
  understand_charges:
    "I understand the monthly charges, one-off charges, contract type per component, notice periods, cancellation rules and ETFs where they apply.",
  consent:
    "I expressly consent to enter into the agreement with OCCTA LIMITED on the terms shown in both documents.",
} as const;

const Schema = z.object({
  token: z.string().min(16),
  accepted_by_name: z.string().trim().min(2).max(160),
  accepted_by_email: z.string().trim().toLowerCase().email().max(180),
  accepted_by_mobile: z.string().trim().min(7).max(32),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  address_confirmed: z.literal(true),
  checkbox_received_read: z.literal(true),
  checkbox_details_correct: z.literal(true),
  checkbox_understand_charges: z.literal(true),
  checkbox_consent: z.literal(true),
  cs_version: z.number().int(),
  cip_version: z.number().int(),
  digital_voice: z.object({
    acknowledged_dependencies: z.boolean(),
    relies_on_emergency: z.boolean().optional(),
    uses_telecare: z.boolean().optional(),
    uses_medical_equipment: z.boolean().optional(),
    accessibility_needs: z.boolean().optional(),
    poor_mobile_coverage: z.boolean().optional(),
  }).optional(),
  source_route: z.string().max(200).optional(),
  session_id: z.string().max(120).optional(),
});

function ageYears(iso: string): number {
  const dob = new Date(iso + "T00:00:00Z");
  if (isNaN(dob.getTime())) return -1;
  const now = new Date();
  let a = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) a -= 1;
  return a;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const i = parsed.data;

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "accept_two_doc", 10, 60))) return jsonResponse({ error: "rate_limited" }, 429);

  const supabase = getServiceClient();

  const { data: ps } = await supabase
    .from("platform_settings")
    .select("two_document_contract_flow_enabled" as any)
    .limit(1)
    .maybeSingle();
  if (!(ps as any)?.two_document_contract_flow_enabled) return jsonResponse({ error: "feature_disabled" }, 409);

  const age = ageYears(i.date_of_birth);
  if (age < 18) return jsonResponse({ error: "under_18" }, 400);
  if (age > 120) return jsonResponse({ error: "invalid_dob" }, 400);

  const hash = await sha256Hex(i.token);
  const { data: cs } = await supabase.from("contract_summaries").select("*").eq("public_token_hash", hash).maybeSingle();
  if (!cs) return jsonResponse({ error: "not_found" }, 404);
  if (cs.token_expires_at && new Date(cs.token_expires_at) < new Date()) return jsonResponse({ error: "expired" }, 410);
  if (cs.status === "accepted") {
    return jsonResponse({ error: "already_accepted", contract_summary_id: cs.id }, 409);
  }
  if (!["issued", "viewed", "draft"].includes(cs.status as string))
    return jsonResponse({ error: "not_acceptable", status: cs.status }, 409);
  if (i.cs_version !== cs.version) return jsonResponse({ error: "cs_version_stale", current: cs.version }, 409);
  if (i.accepted_by_email.toLowerCase() !== (cs.customer_email_snapshot ?? "").toLowerCase())
    return jsonResponse({ error: "email_mismatch" }, 400);

  const snapshot = (cs.one_off_charges_json as any)?.snapshot;
  if (!snapshot || !Array.isArray(snapshot.components)) {
    return jsonResponse({ error: "not_two_doc_cs", message: "This Contract Summary was not issued via the two-document flow." }, 409);
  }
  const components = snapshot.components as ServiceComponent[];
  const segment = (snapshot.customer_segment ?? "residential") as CustomerSegment;

  const { data: pack } = await supabase
    .from("contract_information_packs")
    .select("id, cip_number, version, document_status, pdf_hash, pdf_storage_path, template_version")
    .eq("quote_id", cs.quote_id)
    .neq("document_status", "superseded")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pack) return jsonResponse({ error: "pack_missing", message: "Contract Information Pack is not available." }, 409);
  if (i.cip_version !== pack.version) return jsonResponse({ error: "cip_version_stale", current: pack.version }, 409);

  const dvPresent = components.some((c) => c.kind === "digital_voice");
  if (dvPresent && !i.digital_voice) return jsonResponse({ error: "dv_answers_required" }, 400);

  const validation = validateTwoDocAcceptance({
    customer_segment: segment,
    components,
    digital_voice_answers: i.digital_voice ?? null,
  });
  if (!validation.ok) return jsonResponse({ error: "hard_block", blocks: validation.blocks }, 422);

  // Kick off vulnerability admin task BEFORE recording acceptance so the task
  // exists the moment ops start reviewing.
  let vulnerability_task_id: string | null = null;
  if (dvPresent && validation.vulnerability_review_required) {
    try {
      const projectUrl = Deno.env.get("SUPABASE_URL")!;
      const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const r = await fetch(`${projectUrl}/functions/v1/dv-vulnerability-review`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${svcKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_id: cs.quote_id,
          contract_summary_id: cs.id,
          customer_id: cs.customer_id,
          answers: i.digital_voice,
        }),
      });
      if (r.ok) {
        const j = await r.json();
        vulnerability_task_id = j?.task_id ?? null;
      }
    } catch { /* logged inside task fn */ }
  }

  const acceptedAt = new Date().toISOString();
  const acceptedAtLocal = new Date(acceptedAt).toLocaleString("en-GB", { timeZone: "Europe/London", hour12: false });
  const ua = req.headers.get("user-agent")?.slice(0, 400) ?? null;

  const combinedText = [
    CHECKBOXES.received_read, CHECKBOXES.details_correct, CHECKBOXES.understand_charges, CHECKBOXES.consent,
    ...(dvPresent ? [DV_ACKNOWLEDGEMENT_CHECKBOX] : []),
  ].join("\n");
  const acceptanceTextHash = await sha256Hex(combinedText);

  // 1. Customer-facing acceptance row.
  const { data: acc, error: aErr } = await supabase.from("contract_acceptances").insert({
    contract_summary_id: cs.id, quote_id: cs.quote_id, quote_request_id: cs.quote_request_id,
    customer_id: cs.customer_id,
    accepted_by_name: i.accepted_by_name,
    accepted_by_email: i.accepted_by_email,
    accepted_by_user: cs.customer_id,
    accepted_at: acceptedAt,
    ip, user_agent: ua,
    acceptance_text: combinedText,
    acceptance_text_version: TWO_DOC_TEMPLATE_VERSION,
    acceptance_text_hash: acceptanceTextHash,
    checkbox_confirmed: true,
    cs_version: cs.version,
    terms_version: cs.terms_version,
    privacy_version: cs.privacy_version,
    pdf_storage_key: cs.pdf_storage_key,
    pdf_sha256: cs.pdf_sha256,
    account_number: cs.account_number,
    mobile_snapshot: i.accepted_by_mobile,
    address_confirmed: true,
    checkbox_received_read: true, checkbox_details_correct: true,
    checkbox_understand_charges: true, checkbox_consent: true,
    source_route: i.source_route ?? null,
    session_id: i.session_id ?? null,
    accepted_at_europe_london: acceptedAtLocal,
    date_of_birth: i.date_of_birth,
  }).select("id").single();
  if (aErr || !acc) return jsonResponse({ error: "accept_failed", details: aErr?.message }, 500);

  // 2. Immutability: mark CS + pack accepted. Phase 0 triggers will refuse any
  //    subsequent mutation.
  const csUpd = await supabase.from("contract_summaries").update({
    status: "accepted", accepted_at: acceptedAt, accepted_ip: ip, accepted_user_agent: ua,
  }).eq("id", cs.id);
  if (csUpd.error) return jsonResponse({ error: "cs_update_failed", details: csUpd.error.message }, 500);

  await supabase.from("contract_information_packs").update({
    document_status: "accepted", accepted_at_utc: acceptedAt, contract_summary_id: cs.id,
  }).eq("id", pack.id);

  // 3. Internal audit record — sensitive metadata kept OUT of customer PDF.
  await supabase.from("acceptance_audit_records").insert({
    contract_acceptance_id: acc.id,
    ip_address: ip === "noip" ? null : ip,
    user_agent: ua,
    session_id: i.session_id ?? null,
    acceptance_route: i.source_route ?? "two_doc",
    metadata: {
      cs_id: cs.id, cs_version: cs.version, cs_number: cs.cs_number,
      cip_id: pack.id, cip_version: pack.version, cip_number: pack.cip_number,
      cip_pdf_hash: pack.pdf_hash, cs_pdf_sha256: cs.pdf_sha256,
      template_version: TWO_DOC_TEMPLATE_VERSION,
      dv_present: dvPresent,
      dv_vulnerability_review_task_id: vulnerability_task_id,
      acceptance_text_hash: acceptanceTextHash,
    },
  });

  // 4. Generate customer-safe Acceptance Certificate (best-effort).
  let certificate_number: string | null = null;
  try {
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const r = await fetch(`${projectUrl}/functions/v1/generate-acceptance-certificate`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${svcKey}`, "Content-Type": "application/json", "x-internal-service": "1" },
      body: JSON.stringify({
        contract_acceptance_id: acc.id,
        // hints for the certificate to include the pack references
        contract_information_pack_id: pack.id,
        contract_information_pack_version: pack.version,
        contract_information_pack_pdf_hash: pack.pdf_hash,
        contract_information_pack_template_version: pack.template_version,
      }),
    });
    if (r.ok) { certificate_number = (await r.json())?.certificate_number ?? null; }
  } catch { /* best-effort */ }

  try {
    await supabase.rpc("log_event", {
      _actor_type: "anon", _event_type: "two_doc_contract_accepted",
      _title: `Two-doc CS accepted ${cs.cs_number}`,
      _details: {
        contract_summary_id: cs.id, contract_information_pack_id: pack.id,
        email_masked: maskEmail(i.accepted_by_email),
        dv_vulnerability_review_task_id: vulnerability_task_id,
      },
      _source_module: "two_doc_acceptance",
      _quote_id: cs.quote_id, _contract_summary_id: cs.id,
    });
  } catch { /* non-fatal */ }

  return jsonResponse({
    ok: true,
    contract_summary_id: cs.id,
    contract_information_pack_id: pack.id,
    contract_acceptance_id: acc.id,
    certificate_number,
    vulnerability_review_required: !!vulnerability_task_id,
    activation_blocked_pending_review: !!vulnerability_task_id,
  });
});

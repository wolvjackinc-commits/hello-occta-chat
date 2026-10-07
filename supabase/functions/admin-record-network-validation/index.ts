/**
 * Staff-only supplier-neutral broadband network validation.
 *
 * Records the exact-address speed evidence required before a consumer
 * broadband Contract Summary / Contract Information Pack can be issued.
 * No supplier API is called here and no historical accepted evidence is edited.
 */
import { z } from "https://esm.sh/zod@3.23.8";
import {
  corsHeaders,
  jsonResponse,
  getServiceClient,
  requireStaff,
} from "../_shared/quoteHelpers.ts";
import {
  evidenceSha256,
  type SpeedBucket,
  type VerifiedNetworkEvidence,
} from "../_shared/networkAvailability.ts";

const Matrix = z.object({
  minimum_download_mbps: z.number().positive(),
  normally_available_download_mbps: z.number().positive(),
  maximum_download_mbps: z.number().positive(),
  advertised_download_mbps: z.number().positive(),
  minimum_upload_mbps: z.number().positive(),
  normally_available_upload_mbps: z.number().positive(),
  maximum_upload_mbps: z.number().positive(),
  advertised_upload_mbps: z.number().positive(),
});

const Schema = z.object({
  session_id: z.string().uuid(),
  source_label: z.string().trim().min(2).max(120),
  source_reference: z.string().trim().min(2).max(240),
  address_reference: z.string().trim().max(240).optional().nullable(),
  technology: z.string().trim().min(2).max(80),
  speed_matrix: Matrix,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ["admin", "super_admin", "compliance_admin"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const i = parsed.data;

  if (/icuk|interdns/i.test(i.source_label) || /icuk|interdns/i.test(i.source_reference)) {
    return jsonResponse({
      error: "retired_supplier_not_allowed",
      message: "This supplier/source has been retired from OCCTA and cannot be used for new contract evidence.",
    }, 409);
  }

  const supabase = getServiceClient();

  const { data: activeSupplier } = await supabase
    .from("supplier_profiles")
    .select("id, supplier_name, status")
    .eq("supplier_name", i.source_label)
    .eq("status", "active")
    .maybeSingle();
  if (!activeSupplier) {
    return jsonResponse({
      error: "active_supplier_source_required",
      message: "Choose an active supplier configured in OCCTA before recording network evidence.",
    }, 409);
  }
  const { count: broadbandCount } = await supabase
    .from("supplier_products")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", activeSupplier.id)
    .eq("service_type", "broadband")
    .eq("active", true);
  if (!(Number(broadbandCount ?? 0) > 0)) {
    return jsonResponse({
      error: "supplier_has_no_active_broadband_products",
      message: "The selected supplier has no active broadband products configured in OCCTA.",
    }, 409);
  }

  const { data: session, error: sessionErr } = await supabase
    .from("customer_journey_sessions")
    .select("id, status, postcode, service_address, speed_bucket, plan_term, preferred_start_date, likely_service_date, contract_snapshot_id")
    .eq("id", i.session_id)
    .maybeSingle();

  if (sessionErr || !session) return jsonResponse({ error: "session_not_found" }, 404);
  if (session.contract_snapshot_id) {
    return jsonResponse({
      error: "contract_snapshot_already_exists",
      message: "Network evidence cannot be changed after the contractual snapshot has been created.",
    }, 409);
  }
  if (!session.speed_bucket) return jsonResponse({ error: "plan_not_selected" }, 409);
  if (!session.service_address || !session.postcode) return jsonResponse({ error: "service_address_missing" }, 409);

  const b = String(session.speed_bucket) as SpeedBucket;
  if (!["essential", "superfast", "ultrafast", "gigabit"].includes(b)) {
    return jsonResponse({ error: "invalid_speed_bucket" }, 409);
  }

  const m = i.speed_matrix;
  if (!(m.minimum_download_mbps <= m.normally_available_download_mbps &&
        m.normally_available_download_mbps <= m.maximum_download_mbps)) {
    return jsonResponse({ error: "download_speed_order_invalid" }, 400);
  }
  if (!(m.minimum_upload_mbps <= m.normally_available_upload_mbps &&
        m.normally_available_upload_mbps <= m.maximum_upload_mbps)) {
    return jsonResponse({ error: "upload_speed_order_invalid" }, 400);
  }

  const now = new Date().toISOString();
  const evidence: VerifiedNetworkEvidence = {
    evidence_version: "network-validation-v1",
    source: i.source_label,
    source_reference: i.source_reference,
    verified_exact_address: true,
    retrieved_at: now,
    postcode: String(session.postcode).toUpperCase(),
    address_reference: i.address_reference ?? null,
    primary_technology: i.technology,
    eligible_occta_plans: [b],
    plan_speed_matrices: { [b]: m },
    verified_by: auth.userId,
  };
  const hash = await evidenceSha256(evidence);

  const { error: upErr } = await supabase
    .from("customer_journey_sessions")
    .update({
      supplier_address_snapshot: session.service_address,
      supplier_availability_snapshot: evidence,
      supplier_availability_sha256: hash,
      supplier_availability_retrieved_at: now,
      supplier_availability_source: i.source_label,
      likely_service_date: session.likely_service_date ?? session.preferred_start_date,
      manual_review_reason: null,
      last_error: null,
      status: "active",
      current_step: "contract",
      last_activity_at: now,
    })
    .eq("id", session.id)
    .eq("contract_snapshot_id", null);

  if (upErr) return jsonResponse({ error: "session_update_failed", details: upErr.message }, 500);

  await supabase.from("network_validation_cases").upsert({
    session_id: session.id,
    status: "validated",
    address_snapshot: session.service_address,
    speed_bucket: b,
    plan_term: session.plan_term,
    source_label: i.source_label,
    source_reference: i.source_reference,
    evidence_snapshot: evidence,
    evidence_sha256: hash,
    validated_at: now,
    validated_by: auth.userId,
    updated_at: now,
  }, { onConflict: "session_id" });

  return jsonResponse({
    ok: true,
    session_id: session.id,
    evidence_sha256: hash,
    status: "validated",
    message: "Network validation recorded. The customer contract can now be prepared from this exact evidence.",
  });
});

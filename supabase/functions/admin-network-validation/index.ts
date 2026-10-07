// Staff-only supplier-neutral network validation.
// action "list": pending journey sessions. action "record": validate staff
// evidence server-side, hash it server-side, write it to the current
// UNACCEPTED session (and its unaccepted quote), audit it.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";
import {
  buildContractSpeedMatrix, evidenceSha256, NETWORK_EVIDENCE_SOURCE, NETWORK_EVIDENCE_VERSION,
  PLAN_CAPS, type NetworkEvidence,
} from "../_shared/networkEvidence.ts";
import { validateStaffEvidence } from "./validate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }),
  z.object({
    action: z.literal("record"),
    session_id: z.string().uuid(),
    evidence: z.object({
      technology: z.string().trim().min(2).max(40),
      eligible_plan: z.enum(Object.keys(PLAN_CAPS) as [string, ...string[]]),
      minimum_download_mbps: z.number(), normally_available_download_mbps: z.number(),
      maximum_download_mbps: z.number(), advertised_download_mbps: z.number(),
      minimum_upload_mbps: z.number(), normally_available_upload_mbps: z.number(),
      maximum_upload_mbps: z.number(), advertised_upload_mbps: z.number(),
      retrieved_at: z.string().min(10).max(40),
      provider_reference: z.string().trim().max(120).optional().nullable(),
      staff_note: z.string().trim().max(1000).optional().nullable(),
    }),
  }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(auth.slice(7));
  const actorId = claims?.claims?.sub as string | undefined;
  if (claimsErr || !actorId) return json({ error: "unauthorized" }, 401);

  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: isAdmin } = await db.rpc("has_any_admin_role", { _user_id: actorId });
  if (isAdmin !== true) return json({ error: "forbidden" }, 403);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_input", fields: parsed.error.flatten().fieldErrors }, 400);
  const body = parsed.data;

  if (body.action === "list") {
    const { data, error } = await db.from("customer_journey_sessions")
      .select("id, created_at, postcode, service_address, speed_bucket, plan_term, customer_details, customer_id, quote_id, status, manual_review_reason, test_session")
      .eq("network_validation_status", "pending")
      .gte("created_at", "2026-10-06T00:00:00Z")
      .is("contract_acceptance_id", null)
      .is("contract_snapshot_id", null)
      .not("status", "in", "(cancelled,expired,completed)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return json({ error: "list_failed" }, 500);
    const ids = [...new Set((data ?? []).map((r) => r.customer_id).filter(Boolean))] as string[];
    const accounts: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await db.from("profiles").select("id, account_number").in("id", ids);
      for (const p of profs ?? []) if (p.account_number) accounts[p.id] = p.account_number;
    }
    return json({
      sessions: (data ?? []).map((r: any) => ({
        id: r.id, created_at: r.created_at, postcode: r.postcode,
        address: [r.service_address?.address_line_1, r.service_address?.address_line_2, r.service_address?.town].filter(Boolean).join(", "),
        speed_bucket: r.speed_bucket, plan_term: r.plan_term,
        customer_name: r.customer_details?.full_name ?? null,
        account_number: r.customer_id ? accounts[r.customer_id] ?? null : null,
        reason: r.manual_review_reason, test_session: r.test_session === true,
      })),
    });
  }

  // ── record ────────────────────────────────────────────────────────────────
  const { data: s } = await db.from("customer_journey_sessions")
    .select("id, status, postcode, speed_bucket, quote_id, customer_id, contract_acceptance_id, contract_snapshot_id, network_validation_status, supplier_availability_sha256")
    .eq("id", body.session_id).maybeSingle();
  if (!s) return json({ error: "session_not_found" }, 404);
  if (s.contract_acceptance_id || s.contract_snapshot_id || ["cancelled", "expired", "completed", "submitted"].includes(s.status)) {
    return json({ error: "session_locked", message: "This order already has a contractual snapshot or acceptance; evidence cannot be changed." }, 409);
  }

  const check = validateStaffEvidence(body.evidence, s.speed_bucket, Date.now());
  if (!check.ok) return json({ error: check.error }, 422);

  const e = body.evidence;
  const evidence: NetworkEvidence = {
    evidence_version: NETWORK_EVIDENCE_VERSION,
    source: NETWORK_EVIDENCE_SOURCE,
    verified: true,
    retrieved_at: new Date(e.retrieved_at).toISOString(),
    postcode: String(s.postcode ?? "").toUpperCase(),
    technology: e.technology,
    eligible_occta_plans: [e.eligible_plan as any],
    provider_reference: e.provider_reference || null,
    speeds: {
      minimum_download_mbps: e.minimum_download_mbps,
      normally_available_download_mbps: e.normally_available_download_mbps,
      maximum_download_mbps: e.maximum_download_mbps,
      minimum_upload_mbps: e.minimum_upload_mbps,
      normally_available_upload_mbps: e.normally_available_upload_mbps,
      maximum_upload_mbps: e.maximum_upload_mbps,
    },
  };
  const gate = buildContractSpeedMatrix(evidence, s.speed_bucket);
  if (!gate.ok) return json({ error: gate.error }, 422);
  const sha = await evidenceSha256(evidence);
  const patch = {
    supplier_availability_snapshot: evidence,
    supplier_availability_sha256: sha,
    supplier_availability_retrieved_at: evidence.retrieved_at,
    supplier_availability_source: NETWORK_EVIDENCE_SOURCE,
  };

  // Quote: only if it exists and is not accepted/converted.
  if (s.quote_id) {
    const { data: q } = await db.from("quotes").select("id, status").eq("id", s.quote_id).maybeSingle();
    if (q && ["accepted", "converted", "contract_summary_accepted"].includes(String(q.status))) {
      return json({ error: "quote_locked" }, 409);
    }
    if (q) {
      const { error: qe } = await db.from("quotes").update(patch).eq("id", q.id);
      if (qe) return json({ error: "quote_update_failed" }, 500);
    }
  }

  const { error: ue } = await db.from("customer_journey_sessions").update({
    ...patch,
    network_validation_status: "verified",
    manual_review_reason: null,
    last_activity_at: new Date().toISOString(),
  }).eq("id", s.id).is("contract_acceptance_id", null).is("contract_snapshot_id", null);
  if (ue) return json({ error: "session_update_failed" }, 500);

  const advertised = { download: e.advertised_download_mbps, upload: e.advertised_upload_mbps };
  await db.from("audit_logs").insert({
    actor_user_id: actorId, action: "verify", entity: "network_evidence", entity_id: s.id,
    metadata: { evidence_sha256: sha, plan: s.speed_bucket, technology: e.technology, retrieved_at: evidence.retrieved_at,
      advertised_entered: advertised, provider_reference: evidence.provider_reference, staff_note: e.staff_note ?? null,
      recorded_at: new Date().toISOString() },
  });
  await db.from("admin_tasks").update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("title", `Network validation required — journey ${String(s.id).slice(0, 8)}`).in("status", ["open", "in_progress"]);

  return json({ ok: true, evidence_sha256: sha, matrix: gate.matrix });
});

/**
 * Journey 2 — TEST-only contract acceptance.
 *
 * Records acceptance evidence for an isolated admin test journey against the
 * dedicated test tables. It never writes to contract_summaries,
 * contract_acceptances, acceptance_certificates or any live table, and it never
 * calls a Direct Debit provider or a delivery provider.
 */
import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, getRequestIp } from "../_shared/quoteHelpers.ts";
import { verifyStoredSnapshot } from "../_shared/journey2Snapshot.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({
  token: z.string().min(16),
  accepted_name: z.string().trim().min(2).max(120),
  acknowledgements: z.object({
    contract_summary_read: z.literal(true),
    contract_information_read: z.literal(true),
    cooling_off_understood: z.literal(true),
    dd_authorised: z.literal(true),
  }),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);

  const supabase = getServiceClient();
  const tokenHash = await sha256Hex(parsed.data.token);

  const { data: session } = await supabase
    .from("customer_journey_sessions")
    .select("id, test_session, status, checkout_session_id")
    .eq("public_token_hash", tokenHash)
    .maybeSingle();
  if (!session) return jsonResponse({ error: "session_not_found" }, 404);
  if (!session.test_session) return jsonResponse({ error: "not_a_test_session" }, 403);

  const { data: snap } = await supabase
    .from("journey2_contract_snapshots")
    .select("snapshot, snapshot_sha256")
    .eq("session_id", session.id)
    .maybeSingle();
  const verified = await verifyStoredSnapshot(snap?.snapshot, snap?.snapshot_sha256);
  if (!verified.ok) return jsonResponse({ error: "snapshot_invalid", detail: verified.reason }, 409);

  const { data: cs } = await supabase
    .from("journey2_test_contract_summaries")
    .select("id, status, snapshot_sha256, accepted_at")
    .eq("session_id", session.id)
    .maybeSingle();
  if (!cs) return jsonResponse({ error: "test_contract_not_prepared" }, 409);
  if (cs.snapshot_sha256 !== snap!.snapshot_sha256) {
    return jsonResponse({ error: "test_contract_fingerprint_mismatch" }, 409);
  }

  if (!cs.accepted_at) {
    await supabase.from("journey2_test_contract_summaries")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", cs.id);
  }

  const acc = await supabase.from("journey2_test_acceptances").upsert({
    test_contract_summary_id: cs.id,
    session_id: session.id,
    snapshot_sha256: snap!.snapshot_sha256,
    accepted_name: parsed.data.accepted_name,
    acknowledgements: parsed.data.acknowledgements,
    evidence: {
      ip: getRequestIp(req) ?? "noip",
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
      recomputed_sha256: verified.recomputed,
    },
  }, { onConflict: "test_contract_summary_id" }).select("id").single();
  if (acc.error) return jsonResponse({ error: "test_acceptance_failed", details: acc.error.message }, 500);

  await supabase.from("customer_journey_sessions").update({
    status: "contract_accepted",
    current_step: "review",
    test_acceptance_id: acc.data.id,
    dd_status: "suppressed_test",
    last_activity_at: new Date().toISOString(),
  }).eq("id", session.id);

  return jsonResponse({
    ok: true,
    test_session: true,
    test_acceptance_id: acc.data.id,
    snapshot_sha256: snap!.snapshot_sha256,
  });
});

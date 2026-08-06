/**
 * Journey 2 — transactional final submission.
 *
 * LIVE sessions are committed by a single all-or-nothing database routine
 * (`journey2_commit_order`). Before that routine runs, the canonical SHA-256 is
 * recomputed from the stored snapshot and compared byte-for-byte with the stored
 * fingerprint, and every contractual field is compared with the session. The
 * routine creates exactly one order per checkout session, queues account
 * provisioning (the auth account is created only AFTER the order commits, so an
 * order failure can never leave an orphan customer) and queues the welcome pack
 * in the idempotent outbox. Documents are then generated from the same snapshot.
 *
 * TEST sessions never touch a live table: they are recorded in the isolated
 * journey2_test_* path only, with no customer, order, email, Direct Debit
 * submission, invoice, payment request or supplier action.
 */
import {
  corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp, maskEmail,
} from "../_shared/quoteHelpers.ts";
import { verifyStoredSnapshot, snapshotMatchesSession, type Journey2Snapshot } from "../_shared/journey2Snapshot.ts";
import { buildJourney2DocumentPack, REQUIRED_DOC_TYPES } from "../_shared/journey2Docs.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({ token: z.string().min(16), final_consent: z.literal(true) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "journey2_submit", 10, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const supabase = getServiceClient();
  const tokenHash = await sha256Hex(parsed.data.token);

  const { data: session } = await supabase
    .from("customer_journey_sessions")
    .select("*")
    .eq("public_token_hash", tokenHash)
    .maybeSingle();
  if (!session) return jsonResponse({ error: "session_not_found" }, 404);
  if (["cancelled", "expired"].includes(session.status)) {
    return jsonResponse({ error: "session_closed", status: session.status }, 409);
  }

  const { data: snapRow } = await supabase
    .from("journey2_contract_snapshots")
    .select("id, snapshot, snapshot_sha256")
    .eq("session_id", session.id)
    .maybeSingle();

  // ── Snapshot integrity: recomputed, byte-for-byte ────────────────────────
  const verified = await verifyStoredSnapshot(snapRow?.snapshot, snapRow?.snapshot_sha256);
  if (!verified.ok) {
    await supabase.from("customer_journey_sessions")
      .update({ last_error: `snapshot:${verified.reason}` }).eq("id", session.id);
    return jsonResponse({
      error: "snapshot_invalid",
      detail: verified.reason,
      message: "Your order details need to be re-confirmed before we can complete it.",
      retryable: true,
    }, 409);
  }
  const snapshot = snapRow!.snapshot as Journey2Snapshot;
  const storedHash = snapRow!.snapshot_sha256 as string;

  const drift = snapshotMatchesSession(snapshot, session);
  if (!drift.ok) {
    return jsonResponse({
      error: "snapshot_data_mismatch",
      field: drift.field,
      message: "Something changed since you agreed your order. Please review your order again before we complete it.",
    }, 409);
  }

  // ── Isolated test path ───────────────────────────────────────────────────
  if (session.test_session) {
    const { data: testCs } = await supabase
      .from("journey2_test_contract_summaries")
      .select("id, status, accepted_at, snapshot_sha256")
      .eq("session_id", session.id)
      .maybeSingle();
    if (!testCs || testCs.status !== "accepted" || !testCs.accepted_at) {
      return jsonResponse({ error: "test_contract_not_accepted" }, 409);
    }
    if (testCs.snapshot_sha256 !== storedHash) {
      return jsonResponse({ error: "test_contract_fingerprint_mismatch" }, 409);
    }
    const { data: testAcc } = await supabase
      .from("journey2_test_acceptances")
      .select("id")
      .eq("test_contract_summary_id", testCs.id)
      .maybeSingle();
    if (!testAcc) return jsonResponse({ error: "test_acceptance_evidence_missing" }, 409);

    let runId = session.test_run_id as string | null;
    if (!runId) {
      const run = await supabase.from("journey2_test_runs").insert({
        session_id: session.id,
        checkout_session_id: session.checkout_session_id,
        label: "TEST — Journey 2 isolated admin run",
        status: "running",
      }).select("id").single();
      if (run.error) return jsonResponse({ error: "test_run_failed", details: run.error.message }, 500);
      runId = run.data.id;
    }

    const existing = await supabase
      .from("journey2_test_orders")
      .select("id, test_order_number")
      .eq("session_id", session.id)
      .maybeSingle();

    const testOrderNumber = existing.data?.test_order_number
      ?? `TEST-J2-${String(session.id).slice(0, 8).toUpperCase()}`;

    const p = snapshot.pricing;
    const orderUp = await supabase.from("journey2_test_orders").upsert({
      test_run_id: runId,
      session_id: session.id,
      checkout_session_id: session.checkout_session_id,
      test_order_number: testOrderNumber,
      label: "TEST — not a customer order",
      plan_name: snapshot.product.plan_name,
      monthly_ex_vat: p.monthly_ex_vat,
      monthly_vat_amount: p.monthly_vat,
      monthly_incl_vat: p.monthly_incl_vat,
      one_off_incl_vat: p.one_off_charges_incl_vat,
      amount_due_today: 0,
      estimated_first_bill_incl_vat: p.estimated_first_bill_incl_vat,
      preferred_start_date: session.preferred_start_date,
      billing_anchor_day: session.billing_anchor_day,
      dd_masked: session.dd_masked,
      dd_status: "setup_requested_test",
      snapshot_sha256: storedHash,
      snapshot,
    }, { onConflict: "session_id" }).select("id").single();
    if (orderUp.error) return jsonResponse({ error: "test_order_failed", details: orderUp.error.message }, 500);

    // TEST document pack — test tables only, never contractual storage.
    const pack = buildJourney2DocumentPack(snapshot, {
      order_number: testOrderNumber,
      snapshot_sha256: storedHash,
      dd_status: "setup_requested_test",
      test: true,
    });
    for (const doc of pack) {
      await supabase.from("journey2_test_documents").upsert({
        test_order_id: orderUp.data.id,
        doc_type: doc.doc_type,
        title: doc.title,
        snapshot_sha256: storedHash,
        content: doc.content,
      }, { onConflict: "test_order_id,doc_type" });
    }

    // Suppressed email evidence only — no delivery provider is called.
    await supabase.from("journey2_test_email_outbox").upsert({
      test_order_id: orderUp.data.id,
      email_type: "journey2_welcome_pack",
      recipient_masked: maskEmail(String(snapshot.customer.email || "test@example.invalid")),
      subject: "TEST — suppressed welcome pack (never sent)",
      attachments: pack.map((d) => d.doc_type),
      status: "suppressed_test",
    }, { onConflict: "test_order_id,email_type" });

    await supabase.from("journey2_test_dd_intake")
      .update({ dd_status: "setup_requested_test" }).eq("session_id", session.id);

    await supabase.from("journey2_test_runs").update({
      status: "completed",
      finished_at: new Date().toISOString(),
      result: { submitted_via: "journey2-submit", test_order_number: testOrderNumber, snapshot_sha256: storedHash },
    }).eq("id", runId);

    await supabase.from("customer_journey_sessions").update({
      status: "completed",
      current_step: "complete",
      last_completed_step: "review",
      test_run_id: runId,
      test_order_id: orderUp.data.id,
      test_acceptance_id: testAcc.id,
      dd_status: "setup_requested_test",
      submitted_at: session.submitted_at ?? new Date().toISOString(),
      completed_at: session.completed_at ?? new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      last_error: null,
    }).eq("id", session.id);

    return jsonResponse({
      ok: true,
      test_session: true,
      order_number: testOrderNumber,
      snapshot_sha256: storedHash,
      documents: pack.length,
      replayed: !!existing.data,
    });
  }

  // ── Live path ────────────────────────────────────────────────────────────
  const { data: committed, error: rpcErr } = await supabase.rpc("journey2_commit_order", {
    _session_id: session.id,
    _recomputed_sha256: verified.recomputed,
    _guest_order_id: session.guest_order_id ?? null,
  });
  if (rpcErr) {
    await supabase.from("customer_journey_sessions")
      .update({ last_error: `submit:${rpcErr.message}`.slice(0, 500) }).eq("id", session.id);
    return jsonResponse({
      error: "submit_failed",
      message: "We couldn't complete your order just now. Nothing has been charged — please try again.",
      retryable: true,
    }, 503);
  }
  const result = committed as { ok: boolean; error?: string; order_id?: string; order_number?: string };
  if (!result?.ok) return jsonResponse({ error: result?.error ?? "submit_rejected", retryable: true }, 409);

  // ── Snapshot-driven document pack (idempotent) ───────────────────────────
  const pack = buildJourney2DocumentPack(snapshot, {
    order_number: result.order_number ?? "",
    snapshot_sha256: storedHash,
    dd_status: "setup_requested",
    test: false,
  });
  for (const doc of pack) {
    await supabase.from("journey2_documents").upsert({
      order_id: result.order_id,
      session_id: session.id,
      doc_type: doc.doc_type,
      title: doc.title,
      snapshot_sha256: storedHash,
      content: doc.content,
    }, { onConflict: "session_id,doc_type" });
  }
  const { count: docCount } = await supabase
    .from("journey2_documents")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id);
  const packReady = (docCount ?? 0) >= REQUIRED_DOC_TYPES.length;

  // Account provisioning and the welcome pack both happen strictly after the
  // commit, server-side. The browser never sends the welcome email.
  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const fire = (fn: string, body: Record<string, unknown>) =>
    fetch(`${projectUrl}/functions/v1/${fn}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${svcKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(() => {}).catch(() => {});

  await fire("journey2-provision-account", { order_id: result.order_id });
  if (packReady) await fire("journey2-welcome-send", { order_id: result.order_id });

  await supabase.rpc("log_event", {
    _actor_type: "public",
    _event_type: "journey2_order_submitted",
    _title: `Journey 2 order ${result.order_number ?? ""} submitted`,
    _details: {
      session_id: session.id, order_id: result.order_id,
      checkout_session_id: session.checkout_session_id,
      snapshot_sha256: storedHash, documents: docCount ?? 0,
    },
    _source_module: "journey2",
  }).then(() => {}).catch(() => {});

  return jsonResponse({
    ok: true,
    test_session: false,
    order_id: result.order_id,
    order_number: result.order_number,
    snapshot_sha256: storedHash,
    documents: docCount ?? 0,
    document_pack_ready: packReady,
  });
});

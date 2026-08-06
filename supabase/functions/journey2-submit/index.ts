/**
 * Journey 2 — transactional final submission.
 *
 * Live sessions are committed by a single all-or-nothing database routine
 * (`journey2_commit_order`) that validates the accepted contract, the immutable
 * snapshot hash, the start date and the billing selection, creates exactly one
 * order for the checkout session, links every related record and queues the
 * welcome pack in the idempotent outbox. Nothing is returned as successful
 * until that transaction has committed.
 *
 * Test sessions never touch production tables: they are recorded in the
 * isolated journey2_test_runs / journey2_test_orders path only, with no
 * customer, order, email, Direct Debit submission or supplier action.
 */
import {
  corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp,
} from "../_shared/quoteHelpers.ts";
import { ensureCustomerFromAcceptedContract } from "../_shared/ensureCustomer.ts";
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

  const { data: snapshot } = await supabase
    .from("journey2_contract_snapshots")
    .select("id, snapshot, snapshot_sha256")
    .eq("session_id", session.id)
    .maybeSingle();
  if (!snapshot?.snapshot_sha256 || snapshot.snapshot_sha256.length !== 64) {
    return jsonResponse({ error: "snapshot_invalid", message: "Your order details need to be re-confirmed before we can complete it.", retryable: true }, 409);
  }

  // ── Isolated test path ───────────────────────────────────────────────────
  if (session.test_session) {
    let runId = session.test_run_id as string | null;
    if (!runId) {
      const run = await supabase.from("journey2_test_runs").insert({
        session_id: session.id,
        checkout_session_id: session.checkout_session_id,
        label: "Journey 2 admin test run",
        status: "completed",
        finished_at: new Date().toISOString(),
        result: { submitted_via: "journey2-submit" },
      }).select("id").single();
      if (run.error) return jsonResponse({ error: "test_run_failed", details: run.error.message }, 500);
      runId = run.data.id;
    }

    const snap = snapshot.snapshot as Record<string, any>;
    const pricing = snap?.pricing ?? {};
    const existing = await supabase
      .from("journey2_test_orders")
      .select("test_order_number")
      .eq("session_id", session.id)
      .maybeSingle();

    const testOrderNumber = existing.data?.test_order_number
      ?? `TEST-J2-${String(session.id).slice(0, 8).toUpperCase()}`;

    await supabase.from("journey2_test_orders").upsert({
      test_run_id: runId,
      session_id: session.id,
      checkout_session_id: session.checkout_session_id,
      test_order_number: testOrderNumber,
      label: "TEST — not a customer order",
      plan_name: snap?.product?.plan_name ?? null,
      monthly_ex_vat: pricing.monthly_ex_vat ?? null,
      monthly_vat_amount: pricing.monthly_vat ?? null,
      monthly_incl_vat: pricing.monthly_incl_vat ?? null,
      one_off_incl_vat: pricing.one_off_charges_incl_vat ?? 0,
      amount_due_today: 0,
      estimated_first_bill_incl_vat: pricing.estimated_first_bill_incl_vat ?? null,
      preferred_start_date: session.preferred_start_date,
      billing_anchor_day: session.billing_anchor_day,
      dd_masked: session.dd_masked,
      dd_status: "setup_requested",
      snapshot_sha256: snapshot.snapshot_sha256,
      snapshot: snap,
    }, { onConflict: "session_id" });

    await supabase.from("customer_journey_sessions").update({
      status: "completed",
      current_step: "complete",
      last_completed_step: "review",
      test_run_id: runId,
      dd_status: "setup_requested",
      submitted_at: session.submitted_at ?? new Date().toISOString(),
      completed_at: session.completed_at ?? new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      last_error: null,
    }).eq("id", session.id);

    return jsonResponse({
      ok: true,
      test_session: true,
      order_number: testOrderNumber,
      snapshot_sha256: snapshot.snapshot_sha256,
    });
  }

  // ── Live path ────────────────────────────────────────────────────────────
  const { data: cs } = await supabase
    .from("contract_summaries")
    .select("id, status, accepted_at")
    .eq("quote_id", session.quote_id)
    .neq("status", "superseded")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!cs || cs.status !== "accepted" || !cs.accepted_at) {
    return jsonResponse({ error: "contract_summary_not_accepted" }, 409);
  }
  const { data: acc } = await supabase
    .from("contract_acceptances")
    .select("id")
    .eq("contract_summary_id", cs.id)
    .order("accepted_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const ec = await ensureCustomerFromAcceptedContract(supabase, {
    journey_id: session.order_journey_id,
    contract_summary_id: cs.id,
    contract_acceptance_id: acc?.id ?? null,
  });
  if (!ec.ok || !ec.customer_id) {
    return jsonResponse({ error: "customer_unavailable", message: "We couldn't finish setting up your account. Your order is saved — please try again.", retryable: true }, 503);
  }

  const { data: committed, error: rpcErr } = await supabase.rpc("journey2_commit_order", {
    _session_id: session.id,
    _customer_id: ec.customer_id,
    _guest_order_id: session.guest_order_id ?? null,
  });
  if (rpcErr) {
    await supabase.from("customer_journey_sessions")
      .update({ last_error: `submit:${rpcErr.message}`.slice(0, 500) }).eq("id", session.id);
    return jsonResponse({ error: "submit_failed", message: "We couldn't complete your order just now. Nothing has been charged — please try again.", retryable: true }, 503);
  }
  const result = committed as { ok: boolean; error?: string; order_id?: string; order_number?: string };
  if (!result?.ok) return jsonResponse({ error: result?.error ?? "submit_rejected", retryable: true }, 409);

  await supabase.rpc("log_event", {
    _actor_type: "public",
    _event_type: "journey2_order_submitted",
    _title: `Journey 2 order ${result.order_number ?? ""} submitted`,
    _details: { session_id: session.id, order_id: result.order_id, checkout_session_id: session.checkout_session_id },
    _source_module: "journey2",
  }).then(() => {}).catch(() => {});

  return jsonResponse({
    ok: true,
    test_session: false,
    order_id: result.order_id,
    order_number: result.order_number,
    snapshot_sha256: snapshot.snapshot_sha256,
  });
});

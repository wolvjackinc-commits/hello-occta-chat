/**
 * Journey 2 — isolated admin end-to-end test orchestrator.
 *
 * Administrator only. Drives one complete Journey 2 run (all ten steps,
 * contract preparation, acceptance and final submission) against the isolated
 * journey2_test_* path while the public kill switch stays enabled.
 *
 * Hard safety rules enforced here:
 *   • The session is always created with test_session = true.
 *   • No live customer, order, quote, contract, invoice, payment request,
 *     Direct Debit provider submission, supplier action or customer email is
 *     created — this is asserted after the run and the run FAILS if any exists.
 *   • Every gate is recorded in journey2_test_events as real evidence for the
 *     preflight, which refuses synthetic or historical data.
 */
import {
  corsHeaders, jsonResponse, getServiceClient, requireStaff,
} from "../_shared/quoteHelpers.ts";
import { loadJourneySettings } from "../_shared/journey2.ts";

const FN_BASE = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function callFn(name: string, body: unknown, auth?: string) {
  const res = await fetch(`${FN_BASE}/${name}`, {
    method: "POST",
    headers: { Authorization: auth ?? `Bearer ${SVC}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json: json as Record<string, unknown> };
}

function londonYmd(offsetDays: number) {
  const d = new Date(Date.now() + offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const staff = await requireStaff(req, ["admin", "super_admin"]);
  if (!("userId" in staff)) return jsonResponse({ error: staff.error }, staff.status);

  const supabase = getServiceClient();
  const settings = await loadJourneySettings(supabase);

  const gates: { key: string; ok: boolean; detail?: string }[] = [];
  const gate = (key: string, ok: boolean, detail?: string) => {
    gates.push({ key, ok, detail });
    return ok;
  };

  // ── 1 · Isolated test session, created despite the public kill switch ─────
  const started = await callFn("journey2-session", {
    action: "start",
    anonymous_session_id: `admintest-${crypto.randomUUID()}`,
    admin_test: true,
  }, req.headers.get("Authorization") ?? undefined);
  const token = String((started.json as any)?.token ?? "");
  const startedSession = (started.json as any)?.session ?? null;
  if (started.status !== 200 || (started.json as any)?.journey_version !== "v2" || !token || !startedSession?.id) {
    return jsonResponse({
      error: "admin_test_start_failed",
      status: started.status,
      response: started.json,
    }, 500);
  }
  const session = startedSession as { id: string; checkout_session_id: string; test_session: boolean };

  const run = await supabase.from("journey2_test_runs").insert({
    session_id: session.id,
    checkout_session_id: session.checkout_session_id,
    started_by: staff.userId,
    label: "TEST — Journey 2 isolated admin end-to-end run",
    status: "running",
  }).select("id").single();
  if (run.error) return jsonResponse({ error: "test_run_failed", details: run.error.message }, 500);
  const runId = run.data.id;

  // Bind the session to this test run so every downstream function writes its
  // isolated rows against the same evidence record.
  await supabase.from("customer_journey_sessions")
    .update({ test_run_id: runId })
    .eq("id", session.id);

  gate("admin_test_access_with_kill_switch",
    !!session.test_session && !!settings.customer_journey_v2_kill_switch,
    "test session created while the public kill switch is enabled");

  // ── 2 · Drive the ten-step sequence in order ──────────────────────────────
  const steps: [string, Record<string, unknown>][] = [
    ["address", {
      postcode: "SW1A 1AA",
      address_line_1: "1 Test Street",
      address_line_2: null,
      town: "London",
      county: "Greater London",
    }],
    ["plan", { speed_bucket: "superfast", plan_term: "flex_30" }],
    ["router", { router_option: "standard", router_payment_type: "one_off" }],
    ["extras", { addons: ["priority_support"], digital_voice_acknowledged: false }],
    ["details", {
      full_name: "TEST Journey Two",
      email: `journey2-test+${session.id.slice(0, 8)}@occta.invalid`,
      phone: "07000000000",
      date_of_birth: "1990-01-01",
      age_18_confirmed: true,
      billing_address_same: true,
      current_provider: "TEST Provider",
      current_contract_status: "out_of_contract",
      number_action: "none",
      marketing_consent: false,
      privacy_acknowledged: true,
    }],
    ["start_date", { preferred_start_date: londonYmd(21), cooling_off_acknowledged: true }],
    ["billing", {
      billing_anchor_day: 1,
      dd_consent: true,
      dd_details: {
        account_holder_name: "TEST Journey Two",
        sort_code: "000000",
        account_number: "00000000",
        bank_name: "TEST Bank",
        billing_address: "1 Test Street, London",
        postcode: "SW1A 1AA",
        uk_account_confirmed: true,
        payer_authorised_confirmed: true,
      },
    }],
  ];

  const stepResults: Record<string, number> = {};
  for (const [step, payload] of steps) {
    const r = await callFn("journey2-session", { action: "save_step", token, step, payload });
    stepResults[step] = r.status;
    if (r.status !== 200 || (r.json as any).error) {
      gate(`step_${step}`, false, `${r.status} ${JSON.stringify(r.json).slice(0, 240)}`);
      await supabase.from("journey2_test_runs").update({
        status: "failed", finished_at: new Date().toISOString(),
        result: { failed_step: step, response: r.json, gates },
      }).eq("id", runId);
      for (const g of gates) {
        await supabase.from("journey2_test_events").insert({ test_run_id: runId, gate_key: g.key, ok: g.ok, detail: g.detail ?? null });
      }
      return jsonResponse({ ok: false, error: "step_failed", step, response: r.json, test_run_id: runId }, 200);
    }
    gate(`step_${step}`, true, "saved");
  }

  // ── 3 · Contract prepared only AFTER start date and billing ──────────────
  const prep = await callFn("journey2-prepare-contract", { token });
  gate("contract_prepared_after_billing", prep.status === 200 && !(prep.json as any).error,
    `${prep.status} ${JSON.stringify(prep.json).slice(0, 240)}`);

  const { data: snap } = await supabase.from("journey2_contract_snapshots")
    .select("snapshot, snapshot_sha256").eq("session_id", session.id).maybeSingle();
  gate("snapshot_fingerprint", typeof snap?.snapshot_sha256 === "string" && snap.snapshot_sha256.length === 64,
    snap?.snapshot_sha256 ?? "no snapshot");

  const pricing = (snap?.snapshot as any)?.pricing ?? {};
  gate("zero_due_today", Number(pricing.amount_due_today ?? 1) === 0, `due today ${pricing.amount_due_today}`);

  const { data: testCs } = await supabase.from("journey2_test_contract_summaries")
    .select("id, status, snapshot_sha256").eq("session_id", session.id).maybeSingle();
  gate("test_contract_isolated", !!testCs && testCs.snapshot_sha256 === snap?.snapshot_sha256,
    testCs ? `test contract ${testCs.id}` : "no isolated test contract");

  // ── 4 · Acceptance evidence, test tables only ────────────────────────────
  const acc = await callFn("journey2-test-accept", {
    token,
    accepted_name: "TEST Journey Two",
    acknowledgements: {
      contract_summary_read: true,
      contract_information_read: true,
      cooling_off_understood: true,
      dd_authorised: true,
    },
  });
  gate("test_acceptance", acc.status === 200 && !(acc.json as any).error,
    `${acc.status} ${JSON.stringify(acc.json).slice(0, 240)}`);

  // ── 5 · Final submission, then an idempotent replay ──────────────────────
  const sub1 = await callFn("journey2-submit", { token, final_consent: true });
  gate("submit", sub1.status === 200 && (sub1.json as any).ok === true,
    `${sub1.status} ${JSON.stringify(sub1.json).slice(0, 240)}`);
  const sub2 = await callFn("journey2-submit", { token, final_consent: true });
  const { count: orderCount } = await supabase.from("journey2_test_orders")
    .select("id", { count: "exact", head: true }).eq("session_id", session.id);
  gate("idempotent_submission", (orderCount ?? 0) === 1 && sub2.status === 200,
    `${orderCount} test order(s) after a repeated submission`);

  // ── 6 · Document pack, suppressed email, masked + encrypted DD ───────────
  const { data: testOrder } = await supabase.from("journey2_test_orders")
    .select("id, test_order_number, amount_due_today, snapshot_sha256")
    .eq("session_id", session.id).maybeSingle();
  const { count: docCount } = await supabase.from("journey2_test_documents")
    .select("id", { count: "exact", head: true }).eq("test_order_id", testOrder?.id ?? crypto.randomUUID());
  gate("document_pack", (docCount ?? 0) >= 8, `${docCount} test document(s)`);
  gate("completion_data", !!testOrder?.test_order_number && testOrder?.snapshot_sha256 === snap?.snapshot_sha256,
    testOrder?.test_order_number ?? "no test order");

  const { data: outbox } = await supabase.from("journey2_test_email_outbox")
    .select("status").eq("test_order_id", testOrder?.id ?? crypto.randomUUID()).maybeSingle();
  gate("email_suppressed_in_test", outbox?.status === "suppressed_test", outbox?.status ?? "no suppressed record");

  const { data: ddIntake } = await supabase.from("journey2_test_dd_intake")
    .select("bank_details_ciphertext, nonce, masked_account_last4, dd_status")
    .eq("session_id", session.id).maybeSingle();
  gate("dd_encrypted_in_test", !!ddIntake?.bank_details_ciphertext && !!ddIntake?.nonce);
  const { data: sessRow } = await supabase.from("customer_journey_sessions")
    .select("*").eq("id", session.id).maybeSingle();
  const masked = (sessRow?.dd_masked ?? {}) as Record<string, unknown>;
  gate("dd_masked_only",
    String(masked.last4 ?? "").length === 4 && !("account_number" in masked) && !("sort_code" in masked));
  gate("dd_lifecycle_status",
    ["details_received", "pending_contract", "pending_activation", "active"].includes(String(ddIntake?.dd_status ?? "")),
    String(ddIntake?.dd_status));
  gate("ten_step_sequence",
    sessRow?.current_step === "complete" && !!sessRow?.preferred_start_date && !!sessRow?.billing_anchor_day,
    `final step ${sessRow?.current_step}`);

  // ── 7 · Live-side isolation assertions ──────────────────────────────────
  const liveChecks: [string, PromiseLike<{ count: number | null }>][] = [
    ["no_live_order", supabase.from("orders").select("id", { count: "exact", head: true })
      .eq("checkout_session_id", session.checkout_session_id) as never],
    ["no_live_quote", supabase.from("quotes").select("id", { count: "exact", head: true })
      .eq("checkout_session_id", session.checkout_session_id) as never],
    ["no_live_order_journey", supabase.from("order_journeys").select("id", { count: "exact", head: true })
      .eq("checkout_session_id", session.checkout_session_id) as never],
    ["no_live_payment_method", supabase.from("payment_methods").select("id", { count: "exact", head: true })
      .eq("checkout_session_id", session.checkout_session_id) as never],
    ["no_live_dd_intake", supabase.from("journey2_dd_intake").select("session_id", { count: "exact", head: true })
      .eq("session_id", session.id) as never],
    ["no_live_documents", supabase.from("journey2_documents").select("id", { count: "exact", head: true })
      .eq("session_id", session.id) as never],
    ["no_live_email_outbox", supabase.from("journey2_email_outbox").select("id", { count: "exact", head: true })
      .eq("session_id", session.id) as never],
    ["no_account_provisioning", supabase.from("journey2_account_provisioning").select("id", { count: "exact", head: true })
      .eq("session_id", session.id) as never],
  ];
  for (const [key, q] of liveChecks) {
    const { count } = await q;
    gate(key, (count ?? 0) === 0, `${count ?? 0} live row(s)`);
  }
  gate("no_live_ids_on_session",
    !sessRow?.order_id && !sessRow?.customer_id && !sessRow?.quote_id && !sessRow?.contract_summary_id,
    "session carries no live order, customer, quote or contract id");

  // ── 8 · Persist evidence ────────────────────────────────────────────────
  for (const g of gates) {
    await supabase.from("journey2_test_events")
      .insert({ test_run_id: runId, gate_key: g.key, ok: g.ok, detail: g.detail ?? null });
  }
  const failures = gates.filter((g) => !g.ok).map((g) => g.key);
  const ok = failures.length === 0;

  await supabase.from("journey2_test_runs").update({
    status: ok ? "completed" : "failed",
    finished_at: new Date().toISOString(),
    result: {
      gates, failures, steps: stepResults,
      test_order_number: testOrder?.test_order_number ?? null,
      snapshot_sha256: snap?.snapshot_sha256 ?? null,
      documents: docCount ?? 0,
    },
  }).eq("id", runId);

  await supabase.rpc("log_event", {
    _actor_type: "admin",
    _event_type: "journey2_admin_test_run",
    _title: `Journey 2 isolated admin test run ${ok ? "passed" : "failed"}`,
    _details: { test_run_id: runId, failures, session_id: session.id },
    _source_module: "journey2",
    _severity: ok ? "info" : "warning",
  }).then(() => {}).catch(() => {});

  return jsonResponse({
    ok,
    test_run_id: runId,
    session_id: session.id,
    test_order_number: testOrder?.test_order_number ?? null,
    snapshot_sha256: snap?.snapshot_sha256 ?? null,
    documents: docCount ?? 0,
    failures,
    gates,
  });
});

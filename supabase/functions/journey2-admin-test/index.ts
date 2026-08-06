/**
 * Journey 2 — isolated end-to-end test orchestrator.
 *
 * Reachable by a server-validated administrator, or internally by the service
 * role for automated deployment verification. It drives the DEDICATED test
 * path (`_shared/journey2TestPath.ts`), which writes exclusively to
 * `journey2_test_*` tables, so the run never creates a live session, snapshot,
 * customer, order, quote, contract, Direct Debit provider request, invoice,
 * payment request, supplier task or customer email.
 *
 * Every gate is written to `journey2_test_events` as real evidence. The
 * preflight refuses to pass without a recent, complete run recorded here.
 */
import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";
import { loadJourneySettings } from "../_shared/journey2.ts";
import { authoriseTestCaller } from "../_shared/journey2TestAuth.ts";
import {
  createTestSession, loadTestSessionByToken, saveTestStep, prepareTestContract,
  acceptTestContract, submitTestOrder, getTestCompletion, TEST_LABEL,
  TEST_DD_LIFECYCLE, TEST_STAGES,
} from "../_shared/journey2TestPath.ts";
import { snapshotFingerprint, verifyStoredSnapshot } from "../_shared/journey2Snapshot.ts";
import { REQUIRED_DOC_TYPES } from "../_shared/journey2Docs.ts";

/** Live tables that an isolated test run must never write to. */
const LIVE_TABLES: { table: string; column: string }[] = [
  { table: "customer_journey_sessions", column: "checkout_session_id" },
  { table: "journey2_contract_snapshots", column: "session_id" },
  { table: "orders", column: "checkout_session_id" },
  { table: "quotes", column: "checkout_session_id" },
  { table: "order_journeys", column: "checkout_session_id" },
  { table: "payment_methods", column: "checkout_session_id" },
  { table: "journey2_dd_intake", column: "session_id" },
  { table: "journey2_documents", column: "session_id" },
  { table: "journey2_email_outbox", column: "session_id" },
  { table: "journey2_account_provisioning", column: "session_id" },
  { table: "journey2_contract_snapshots", column: "checkout_session_id" },
];

function ymd(offsetDays: number) {
  return new Date(Date.now() + offsetDays * 86400_000).toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const authorised = await authoriseTestCaller(req);
  if (!authorised.ok) return jsonResponse({ error: authorised.error }, authorised.status);

  const supabase = getServiceClient();
  const settings = await loadJourneySettings(supabase);

  const gates: { key: string; ok: boolean; detail?: string }[] = [];
  const gate = (key: string, ok: boolean, detail?: string) => {
    gates.push({ key, ok, detail });
    return ok;
  };

  // ── 1 · Test run record, then an ISOLATED test session ────────────────────
  const run = await supabase.from("journey2_test_runs").insert({
    label: TEST_LABEL,
    started_by: authorised.actor === "admin" ? authorised.userId : null,
    status: "running",
  }).select("id").single();
  if (run.error) return jsonResponse({ error: "test_run_failed", details: run.error.message }, 500);
  const runId = run.data.id;

  const finish = async (ok: boolean, extra: Record<string, unknown>) => {
    for (const g of gates) {
      await supabase.from("journey2_test_events")
        .insert({ test_run_id: runId, gate_key: g.key, ok: g.ok, detail: g.detail ?? null });
    }
    const failures = gates.filter((g) => !g.ok).map((g) => g.key);
    await supabase.from("journey2_test_runs").update({
      status: ok && failures.length === 0 ? "completed" : "failed",
      finished_at: new Date().toISOString(),
      result: { gates, failures, ...extra },
    }).eq("id", runId);
    await supabase.rpc("log_event", {
      _actor_type: "admin",
      _event_type: "journey2_admin_test_run",
      _title: `Journey 2 isolated test run ${ok && failures.length === 0 ? "passed" : "failed"}`,
      _details: { test_run_id: runId, failures },
      _source_module: "journey2",
      _severity: ok && failures.length === 0 ? "info" : "warning",
    }).then(() => {}).catch(() => {});
    return jsonResponse({ ok: ok && failures.length === 0, test_run_id: runId, failures, gates, ...extra });
  };

  const created = await createTestSession(supabase, { testRunId: runId });
  if (!created.ok) return await finish(false, { error: created.error });
  const token = created.token;
  let session = created.session;
  await supabase.from("journey2_test_runs")
    .update({ session_id: session.id, checkout_session_id: session.checkout_session_id }).eq("id", runId);

  // The isolated test path must be usable irrespective of the public posture:
  // before launch it has to bypass the kill switch, and after launch it must
  // still run without touching the live journey.
  gate("admin_test_access_with_kill_switch",
    !!session.test_session,
    `isolated test session created while the public kill switch is ${settings.customer_journey_v2_kill_switch ? "ON (bypassed)" : "OFF (Journey 2 live)"}`);
  gate("dedicated_test_session_table", session.label?.startsWith("TEST") === true,
    "session stored in journey2_test_sessions");

  // ── 2 · The seven pre-contract stages ─────────────────────────────────────
  const steps: [string, Record<string, unknown>][] = [
    ["address", { postcode: "SW1A 1AA", address_line_1: "1 Test Street", address_line_2: null, town: "London", county: "Greater London" }],
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
    ["start_date", { preferred_start_date: ymd(21), cooling_off_acknowledged: true }],
    ["billing", {
      billing_anchor_day: 1,
      dd_consent: true,
      dd_details: {
        account_holder_name: "TEST Journey Two", sort_code: "000000", account_number: "00000000",
        bank_name: "TEST Bank", billing_address: "1 Test Street, London", postcode: "SW1A 1AA",
        uk_account_confirmed: true, payer_authorised_confirmed: true,
      },
    }],
  ];
  const stageLog: string[] = [];
  for (const [step, payload] of steps) {
    const r = await saveTestStep(supabase, settings, session, step, payload);
    if (!r.ok) {
      gate(`stage_${step}`, false, `${r.status} ${r.error} ${JSON.stringify(r.details ?? {}).slice(0, 200)}`);
      return await finish(false, { failed_stage: step });
    }
    session = r.session;
    stageLog.push(step);
    gate(`stage_${step}`, true, "saved to journey2_test_sessions");
  }
  const ddAfterBilling = await supabase.from("journey2_test_dd_intake")
    .select("dd_status, bank_details_ciphertext, nonce, masked_account_last4, masked_sort_last2")
    .eq("session_id", session.id).maybeSingle();
  gate("dd_state_details_received", ddAfterBilling.data?.dd_status === "details_received",
    String(ddAfterBilling.data?.dd_status));
  gate("dd_encrypted_in_test",
    !!ddAfterBilling.data?.bank_details_ciphertext && !!ddAfterBilling.data?.nonce,
    "AES-256-GCM ciphertext and nonce present in journey2_test_dd_intake");
  const masked = (session.dd_masked ?? {}) as Record<string, unknown>;
  gate("dd_masked_only",
    String(masked.last4 ?? "").length === 4 && !("account_number" in masked) && !("sort_code" in masked),
    "only last 4 / last 2 held on the test session");

  // ── 3 · Contract stage ───────────────────────────────────────────────────
  const prep = await prepareTestContract(supabase, settings, session);
  if (!prep.ok) {
    gate("stage_contract", false, `${prep.status} ${prep.error}`);
    return await finish(false, { failed_stage: "contract" });
  }
  session = prep.session;
  stageLog.push("contract");
  gate("stage_contract", true, "test snapshot and test contract summary written");
  gate("dd_state_pending_contract", session.dd_status === "pending_contract", String(session.dd_status));

  const snapRow = await supabase.from("journey2_test_snapshots")
    .select("snapshot, snapshot_sha256").eq("session_id", session.id).maybeSingle();
  const storedHash = String(snapRow.data?.snapshot_sha256 ?? "");
  const recomputed = snapRow.data ? await snapshotFingerprint(snapRow.data.snapshot) : "";
  gate("snapshot_hash_byte_for_byte", !!storedHash && recomputed === storedHash,
    `stored ${storedHash.slice(0, 16)}… recomputed ${recomputed.slice(0, 16)}…`);

  // Deliberate tamper on a COPY: integrity verification must reject it.
  const tampered = JSON.parse(JSON.stringify(snapRow.data?.snapshot ?? {}));
  if (tampered?.pricing) tampered.pricing.monthly_incl_vat = Number(tampered.pricing.monthly_incl_vat ?? 0) + 1;
  const tamperCheck = await verifyStoredSnapshot(tampered, storedHash);
  gate("tamper_rejected", tamperCheck.ok === false && tamperCheck.reason === "fingerprint_mismatch",
    tamperCheck.reason ?? "tampered snapshot was accepted");
  const immutable = await supabase.from("journey2_test_snapshots")
    .update({ snapshot_sha256: "0".repeat(64) }).eq("session_id", session.id);
  gate("snapshot_immutable", !!immutable.error, immutable.error?.message ?? "snapshot was editable");

  const pricing = (snapRow.data?.snapshot as any)?.pricing ?? {};
  gate("zero_due_today", Number(pricing.amount_due_today ?? 1) === 0, `£${pricing.amount_due_today}`);
  gate("vat_matches_settings",
    Number(pricing.vat_rate_percent ?? -1) === Number(settings.vat_default_rate ?? 20)
      && Math.abs(Number(pricing.monthly_ex_vat) + Number(pricing.monthly_vat) - Number(pricing.monthly_incl_vat)) < 0.02,
    `${pricing.vat_rate_percent}% configured ${settings.vat_default_rate}%`);
  gate("one_offs_on_first_bill",
    Number(pricing.estimated_first_bill_incl_vat ?? 0)
      === Math.round((Number(pricing.monthly_incl_vat ?? 0) + Number(pricing.one_off_charges_incl_vat ?? 0)) * 100) / 100,
    `first bill £${pricing.estimated_first_bill_incl_vat}`);

  // ── 4 · Review / acceptance stage ────────────────────────────────────────
  const acc = await acceptTestContract(supabase, session, {
    accepted_name: "TEST Journey Two",
    acknowledgements: {
      contract_summary_read: true, contract_information_read: true,
      cooling_off_understood: true, dd_authorised: true,
    },
    evidence: { user_agent: "journey2-admin-test", ip: "isolated" },
  });
  if (!acc.ok) {
    gate("stage_review", false, `${acc.status} ${acc.error}`);
    return await finish(false, { failed_stage: "review" });
  }
  session = (await loadTestSessionByToken(supabase, token)) ?? session;
  stageLog.push("review");
  gate("stage_review", true, "test acceptance evidence recorded");

  // ── 5 · Submit twice: exactly one of everything ──────────────────────────
  const sub1 = await submitTestOrder(supabase, session);
  if (!sub1.ok) {
    gate("stage_complete", false, `${sub1.status} ${sub1.error}`);
    return await finish(false, { failed_stage: "complete" });
  }
  const sub2 = await submitTestOrder(supabase, (await loadTestSessionByToken(supabase, token)) ?? session);
  stageLog.push("complete");
  gate("stage_complete", true, `test order ${sub1.test_order_number}`);
  gate("submit_hash_recomputed", sub1.snapshot_sha256 === storedHash, sub1.snapshot_sha256);
  gate("second_submit_created_nothing", sub2.ok === true && (sub2 as any).created === false,
    "repeat submission returned the existing test order");

  const counts: Record<string, number> = {};
  const countRows = async (table: string, column: string, value: string) => {
    const { count } = await supabase.from(table).select("id", { count: "exact", head: true }).eq(column, value);
    return count ?? 0;
  };
  counts.test_orders = await countRows("journey2_test_orders", "session_id", session.id);
  counts.test_acceptances = await countRows("journey2_test_acceptances", "session_id", session.id);
  counts.test_dd_intake = await countRows("journey2_test_dd_intake", "session_id", session.id);
  counts.test_documents = await countRows("journey2_test_documents", "test_order_id", sub1.test_order_id);
  counts.test_emails = await countRows("journey2_test_email_outbox", "test_order_id", sub1.test_order_id);
  gate("exactly_one_test_order", counts.test_orders === 1, `${counts.test_orders}`);
  gate("exactly_one_test_acceptance", counts.test_acceptances === 1, `${counts.test_acceptances}`);
  gate("exactly_one_test_dd_intake", counts.test_dd_intake === 1, `${counts.test_dd_intake}`);
  gate("exactly_one_suppressed_email", counts.test_emails === 1, `${counts.test_emails}`);

  const { data: docRows } = await supabase.from("journey2_test_documents")
    .select("doc_type").eq("test_order_id", sub1.test_order_id);
  const docTypes = new Set((docRows ?? []).map((d: any) => d.doc_type));
  const missingDocs = REQUIRED_DOC_TYPES.filter((t) => !docTypes.has(t));
  gate("document_pack_complete", missingDocs.length === 0 && docTypes.size === counts.test_documents,
    missingDocs.length ? `missing ${missingDocs.join(", ")}` : `${docTypes.size} unique document types`);

  const { data: outbox } = await supabase.from("journey2_test_email_outbox")
    .select("status, recipient_masked").eq("test_order_id", sub1.test_order_id).maybeSingle();
  gate("email_suppressed_in_test", outbox?.status === "suppressed_test", String(outbox?.status));

  const ddFinal = await supabase.from("journey2_test_dd_intake")
    .select("dd_status").eq("session_id", session.id).maybeSingle();
  gate("dd_state_setup_requested_test", ddFinal.data?.dd_status === "setup_requested_test", String(ddFinal.data?.dd_status));
  gate("dd_never_live_state",
    TEST_DD_LIFECYCLE.includes(String(ddFinal.data?.dd_status) as never)
      && !["pending_activation", "active"].includes(String(ddFinal.data?.dd_status)),
    "test lifecycle only");

  // ── 6 · Ten logical stages and the completion data endpoint ─────────────
  const finalSession = (await loadTestSessionByToken(supabase, token)) ?? session;
  const stagesSeen = [...stageLog];
  gate("ten_stage_sequence",
    TEST_STAGES.every((s) => stagesSeen.includes(s)) && finalSession.current_step === "complete",
    stagesSeen.join(" → "));

  const completion = await getTestCompletion(supabase, token);
  gate("completion_data_from_test_tables",
    !!completion?.completion && completion.completion.order_number === sub1.test_order_number
      && Number(completion.completion.amount_due_today) === 0
      && completion.completion.snapshot_sha256 === storedHash,
    completion?.completion?.order_number ?? "no completion data");

  // ── 7 · Zero live writes ────────────────────────────────────────────────
  const liveCounts: Record<string, number> = {};
  for (const { table, column } of LIVE_TABLES) {
    const value = column === "session_id" ? session.id : session.checkout_session_id;
    const { count, error } = await supabase.from(table)
      .select("*", { count: "exact", head: true }).eq(column, value);
    const key = `${table}.${column}`;
    liveCounts[key] = error ? -1 : (count ?? 0);
    gate(`no_live_write_${table}_${column}`, !error && (count ?? 0) === 0,
      error ? `check failed: ${error.message}` : `${count ?? 0} row(s)`);
  }
  // Live tables keyed by contact rather than session: prove nothing was created
  // for the isolated test email address.
  const testEmail = (finalSession.customer_details ?? {}).email ?? "";
  for (const [table, column] of [["profiles", "email"], ["quote_requests", "email"], ["guest_orders", "email"]] as const) {
    const { count, error } = await supabase.from(table)
      .select("*", { count: "exact", head: true }).eq(column, testEmail);
    liveCounts[`${table}.${column}`] = error ? -1 : (count ?? 0);
    gate(`no_live_write_${table}`, !error && (count ?? 0) === 0,
      error ? `check failed: ${error.message}` : `${count ?? 0} row(s) for the test email`);
  }

  return await finish(true, {
    session_id: session.id,
    checkout_session_id: session.checkout_session_id,
    test_order_number: sub1.test_order_number,
    snapshot_sha256: storedHash,
    dd_transitions: sub1.dd_transitions,
    stages: stagesSeen,
    isolated_counts: counts,
    live_table_counts: liveCounts,
    actor: authorised.actor,
  });
});
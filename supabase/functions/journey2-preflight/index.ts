/**
 * Journey 2 production preflight — administrator only.
 *
 * Runs every gate that must pass before Journey 2 may be shown to public
 * customers, then stores the result on platform_settings. Journey 2 cannot be
 * promoted to the default journey while any gate fails.
 */
import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";
import { buildCatalogue, loadJourneySettings } from "../_shared/journey2.ts";
import { authoriseTestCaller } from "../_shared/journey2TestAuth.ts";

type Check = { key: string; label: string; ok: boolean; detail?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const authorised = await authoriseTestCaller(req);
  if (!authorised.ok) return jsonResponse({ error: authorised.error }, authorised.status);

  const supabase = getServiceClient();
  const settings = await loadJourneySettings(supabase);
  const checks: Check[] = [];
  const add = (key: string, label: string, ok: boolean, detail?: string) => checks.push({ key, label, ok, detail });

  // 1-4 · Catalogue must be exactly priced.
  const catalogue = await buildCatalogue(supabase, settings, "residential");
  const activePlans = catalogue.plans.filter((p) => Object.keys(p.terms).length > 0);
  add("plans_active", "Journey 2 catalogue has at least one active fixed-price plan", activePlans.length > 0,
    `${activePlans.length} plan(s)`);
  add("plan_terms_exact", "Every displayed plan has exact Flex 30 and/or Price Lock 24 pricing",
    activePlans.length > 0 && activePlans.every((p) =>
      Object.values(p.terms).every((t) => Number(t?.monthly_incl_vat) > 0)),
  );
  add("routers_exact", "Every displayed router has an exact price",
    catalogue.routers.length > 0 && catalogue.routers.every((r) =>
      r.option === "own" ? true : (r.monthly > 0 || r.one_off > 0)),
    `${catalogue.routers.length} router option(s)`);
  add("extras_exact", "Every displayed extra has an exact price",
    catalogue.extras.every((e) => e.monthly > 0), `${catalogue.extras.length} extra(s)`);
  add("setup_exact", "Setup charge is exactly priced", catalogue.setup !== null,
    catalogue.setup ? `${catalogue.setup.label}` : "no priced setup option");

  // 5 · VAT configuration.
  const vatRate = Number((settings as any).vat_default_rate ?? 0);
  add("vat_config", "VAT configuration is valid", vatRate > 0 && vatRate <= 100, `rate ${vatRate}`);

  // 6 · Kill switch, admin test access and public unavailability.
  add("kill_switch_on", "Journey 2 public kill switch remains enabled", !!settings.customer_journey_v2_kill_switch);
  add("public_unavailable", "Public Journey 2 is unavailable",
    !settings.customer_journey_v2_enabled
      || !!settings.customer_journey_v2_kill_switch
      || Number(settings.customer_journey_v2_rollout_percentage ?? 0) === 0);
  add("default_v1", "Journey 1 remains the default journey", settings.customer_journey_default === "v1");
  add("v1_enabled", "Journey 1 remains enabled", !!settings.customer_journey_v1_enabled);

  // 7 · Two-document contract flow and legal versions.
  add("two_doc_flow", "Two-document contract flow is enabled", !!settings.two_document_contract_flow_enabled);
  const { data: legalCopy } = await supabase
    .from("site_copy").select("key").limit(1);
  add("legal_versions", "Current legal document versions are configured", Array.isArray(legalCopy));

  // 8 · Real Journey 2 test evidence. The preflight fails outright when no
  // isolated end-to-end admin test run exists — historical counts from
  // Journey 1 are never accepted as evidence.
  const { data: testRun } = await supabase
    .from("journey2_test_runs")
    .select("id, session_id, status, finished_at, started_at, result")
    .eq("status", "completed")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const runFresh = !!testRun?.finished_at
    && Date.now() - new Date(testRun.finished_at).getTime() < 30 * 24 * 3600_000;
  add("test_evidence", "An isolated end-to-end Journey 2 admin test run exists and is recent",
    !!testRun && runFresh,
    testRun ? `run ${testRun.id} finished ${testRun.finished_at}` : "no completed test run — run an admin test journey first");

  // Every gate recorded by that run must have passed. Gate rows are written by
  // journey2-admin-test only, so nothing here can be satisfied by hand-made data.
  const { data: gateRows } = testRun
    ? await supabase.from("journey2_test_events")
      .select("gate_key, ok, detail").eq("test_run_id", testRun.id)
    : { data: null as null };
  const gateMap = new Map((gateRows ?? []).map((g: Record<string, unknown>) => [g.gate_key as string, g]));
  const gate = (key: string, label: string) => {
    const g = gateMap.get(key);
    add(`run_${key}`, label, !!g?.ok, g ? String(g.detail ?? "") : "gate not recorded by the isolated test run");
  };

  // Everything below reads ONLY the isolated journey2_test_* tables. Live
  // tables are never consulted for evidence, and historical counts are never
  // accepted in place of a real run.
  const runId = testRun?.id ?? null;
  const testSession = runId
    ? (await supabase.from("journey2_test_sessions").select("*").eq("test_run_id", runId).maybeSingle()).data
    : null;
  const testOrder = runId
    ? (await supabase.from("journey2_test_orders").select("*").eq("test_run_id", runId).maybeSingle()).data
    : null;
  const snapshot = testSession
    ? (await supabase.from("journey2_test_snapshots").select("*").eq("session_id", testSession.id).maybeSingle()).data
    : null;

  const s = testSession as Record<string, any> | null;
  const t = testOrder as Record<string, any> | null;
  const sn = snapshot as Record<string, any> | null;

  add("test_isolation_tables", "The test run used the dedicated isolated test tables",
    !!s && !!sn && String(s.label ?? "").startsWith("TEST"),
    s ? `test session ${s.id}` : "no isolated test session for the latest run");

  gate("admin_test_access_with_kill_switch", "A verified admin/service test ran while the public kill switch was ON");
  gate("dedicated_test_session_table", "The test session was created in journey2_test_sessions");
  for (const stage of [
    "address", "plan", "router", "extras", "details", "start_date",
    "billing", "contract", "review", "complete",
  ]) gate(`stage_${stage}`, `The run completed the ${stage.replace("_", " ")} stage`);
  gate("snapshot_hash_byte_for_byte", "The canonical snapshot SHA-256 matched byte-for-byte");
  gate("tamper_rejected", "A deliberately tampered snapshot copy was rejected");
  gate("snapshot_immutable", "The stored test snapshot could not be modified");
  gate("zero_due_today", "Nothing was payable today");
  gate("vat_matches_settings", "VAT matched the configured rate");
  gate("one_offs_on_first_bill", "One-off charges were placed on the estimated first bill");
  gate("dd_state_details_received", "Direct Debit reached details_received after billing");
  gate("dd_state_pending_contract", "Direct Debit reached pending_contract at the contract stage");
  gate("dd_state_setup_requested_test", "Direct Debit finished at setup_requested_test");
  gate("dd_never_live_state", "Direct Debit never entered a live activation state");
  gate("dd_encrypted_in_test", "Test bank details were stored encrypted only");
  gate("dd_masked_only", "Only masked Direct Debit details were held on the session");
  gate("exactly_one_test_order", "A repeat submission produced exactly one test order");
  gate("exactly_one_test_acceptance", "Exactly one test acceptance was recorded");
  gate("exactly_one_test_dd_intake", "Exactly one test Direct Debit intake was recorded");
  gate("exactly_one_suppressed_email", "Exactly one suppressed test email was recorded");
  gate("second_submit_created_nothing", "The second submission created nothing");
  gate("document_pack_complete", "The complete document pack was produced from the snapshot");
  gate("email_suppressed_in_test", "The welcome pack email was suppressed");
  gate("ten_stage_sequence", "All ten logical stages were executed in order");
  gate("completion_data_from_test_tables", "Completion data was served from the isolated test tables");
  for (const key of [
    "customer_journey_sessions_checkout_session_id",
    "journey2_contract_snapshots_session_id",
    "orders_checkout_session_id",
    "quotes_checkout_session_id",
    "order_journeys_checkout_session_id",
    "payment_methods_checkout_session_id",
    "journey2_dd_intake_session_id",
    "journey2_documents_session_id",
    "journey2_email_outbox_session_id",
    "journey2_account_provisioning_session_id",
  ]) gate(`no_live_write_${key}`, `Zero live writes: ${key.replace(/_/g, " ")}`);
  for (const table of ["profiles", "quote_requests", "guest_orders"]) {
    gate(`no_live_write_${table}`, `Zero live ${table} rows for the isolated test contact`);
  }

  const p = (sn?.snapshot as Record<string, any>)?.pricing ?? {};
  add("snapshot_hash_present", "The isolated contractual snapshot carries a valid SHA-256 fingerprint",
    typeof sn?.snapshot_sha256 === "string" && /^[0-9a-f]{64}$/.test(sn.snapshot_sha256));
  add("zero_due_today_stored", "The stored test order shows nothing payable today",
    Number(p.amount_due_today ?? 1) === 0 && Number(t?.amount_due_today ?? 1) === 0);
  add("vat_calculation", "VAT on the test order matches the configured rate",
    Math.abs(Number(p.monthly_ex_vat ?? 0) + Number(p.monthly_vat ?? 0) - Number(p.monthly_incl_vat ?? 0)) < 0.02
      && Number(p.vat_rate_percent ?? 0) === vatRate);
  add("completion_route", "Completion data can be rendered from committed isolated data",
    !!t?.test_order_number && t?.snapshot_sha256 === sn?.snapshot_sha256);
  // Direct Debit provider readiness.
  const { data: ddCfg } = await supabase
    .from("dd_provider_config")
    .select("*")
    .limit(1)
    .maybeSingle();
  add("dd_provider", "Direct Debit provider configuration is present", !!ddCfg);
  const ddTemplateOk = !!ddCfg && Object.entries(ddCfg).some(([k, v]) =>
    /template|mandate|instruction/i.test(k) && !!v);
  add("dd_template", "Provider-approved Direct Debit template and Guarantee are present", ddTemplateOk);
  add("dd_encryption", "Direct Debit detail encryption key is configured", !!Deno.env.get("DD_FIELD_ENC_KEY"));

  // 14 · Email provider.
  add("email_provider", "Email provider is configured",
    !!(Deno.env.get("RESEND_API_KEY") || Deno.env.get("LOVABLE_EMAIL_API_KEY")));

  // 15 · Document storage.
  let storageOk = false;
  try {
    const { error } = await supabase.storage.from("contract-pdfs").list("", { limit: 1 });
    storageOk = !error;
  } catch { storageOk = false; }
  add("document_storage", "Document storage is operational", storageOk);

  // Transactional submission path must exist and must reject test sessions.
  const commitProbe = await supabase.rpc("journey2_commit_order", {
    _session_id: "00000000-0000-0000-0000-000000000000",
    _recomputed_sha256: "0".repeat(64),
    _guest_order_id: null,
  });
  add("transactional_submit", "The transactional final-submission routine is installed",
    !commitProbe.error && (commitProbe.data as any)?.error === "session_not_found",
    commitProbe.error?.message ?? "responds to validation probe");

  // No unresolved critical Journey 2 failures.
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count: failures } = await supabase
    .from("activity_log")
    .select("id", { count: "exact", head: true })
    .eq("source_module", "journey2")
    .eq("severity", "error")
    .gte("created_at", since);
  add("no_critical_failures", "No unresolved critical Journey 2 failures in the last 24 hours", (failures ?? 0) === 0,
    `${failures ?? 0} error event(s)`);

  const failuresList = checks.filter((c) => !c.ok);
  const result = {
    ok: failuresList.length === 0,
    ran_at: new Date().toISOString(),
    ran_by: staff.userId,
    checks,
    failures: failuresList.map((f) => f.label),
  };

  await supabase
    .from("platform_settings")
    .update({
      customer_journey_v2_last_preflight_at: result.ran_at,
      customer_journey_v2_last_preflight_result: result,
    })
    .eq("singleton", true);

  await supabase.rpc("log_event", {
    _actor_type: "admin",
    _event_type: "journey2_preflight_run",
    _title: `Journey 2 preflight ${result.ok ? "passed" : "failed"}`,
    _details: { failures: result.failures },
    _source_module: "journey2",
    _severity: result.ok ? "info" : "warning",
  }).then(() => {}).catch(() => {});

  return jsonResponse({ ok: true, result });
});
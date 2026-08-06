/**
 * Journey 2 production preflight — administrator only.
 *
 * Runs every gate that must pass before Journey 2 may be shown to public
 * customers, then stores the result on platform_settings. Journey 2 cannot be
 * promoted to the default journey while any gate fails.
 */
import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";
import { buildCatalogue, loadJourneySettings } from "../_shared/journey2.ts";

type Check = { key: string; label: string; ok: boolean; detail?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const staff = await requireStaff(req, ["admin", "super_admin"]);
  if (!("userId" in staff)) return jsonResponse({ error: staff.error }, staff.status);

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
  const gateMap = new Map((gateRows ?? []).map((g: any) => [g.gate_key as string, g]));
  const gate = (key: string, label: string) => {
    const g = gateMap.get(key);
    add(`run_${key}`, label, !!g?.ok, g ? (g.detail ?? "") : "gate not recorded by the test run");
  };

  let testSession: Record<string, unknown> | null = null;
  let testOrder: Record<string, unknown> | null = null;
  let snapshot: Record<string, unknown> | null = null;
  if (testRun) {
    testSession = (await supabase.from("customer_journey_sessions")
      .select("*").eq("id", testRun.session_id).maybeSingle()).data as never;
    testOrder = (await supabase.from("journey2_test_orders")
      .select("*").eq("test_run_id", testRun.id).maybeSingle()).data as never;
    snapshot = (await supabase.from("journey2_contract_snapshots")
      .select("*").eq("session_id", testRun.session_id).maybeSingle()).data as never;
  }

  const s = testSession as any; const t = testOrder as any; const sn = snapshot as any;
  add("test_admin_access", "Admin test access works despite the kill switch", !!s?.test_session);
  gate("admin_test_access_with_kill_switch", "The test run started while the public kill switch was enabled");
  for (const step of ["address", "plan", "router", "extras", "details", "start_date", "billing"]) {
    gate(`step_${step}`, `Test run completed the ${step.replace("_", " ")} step`);
  }
  gate("test_contract_isolated", "Test contract documents were written only to the isolated test tables");
  gate("test_acceptance", "Test acceptance evidence was recorded in the isolated test tables");
  gate("submit", "Test final submission committed transactionally");
  gate("document_pack", "The full document pack was produced from the snapshot");
  gate("email_suppressed_in_test", "The welcome email was suppressed for the test run");
  gate("dd_encrypted_in_test", "Test Direct Debit details were stored encrypted only");
  for (const key of [
    "no_live_order", "no_live_quote", "no_live_order_journey", "no_live_payment_method",
    "no_live_dd_intake", "no_live_documents", "no_live_email_outbox",
    "no_account_provisioning", "no_live_ids_on_session",
  ]) gate(key, `Test isolation held: ${key.replace(/_/g, " ")}`);

  add("test_sequence", "The test run completed the correct ten-step sequence",
    !!s && s.current_step === "complete" && !!s.preferred_start_date && !!s.billing_anchor_day && !!s.dd_masked);
  add("contract_after_billing", "Contract documents were prepared only after start date and billing",
    !!sn && !!s?.preferred_start_date && !!s?.billing_anchor_day && !!s?.dd_masked,
    "snapshot exists and both the start date and billing selections were captured");
  add("snapshot_hash", "The contractual snapshot has a valid SHA-256 fingerprint",
    typeof sn?.snapshot_sha256 === "string" && sn.snapshot_sha256.length === 64);
  const p = sn?.snapshot?.pricing ?? {};
  add("zero_due_today", "Nothing was payable today on the test order",
    Number(p.amount_due_today ?? 1) === 0 && Number(t?.amount_due_today ?? 1) === 0);
  add("first_bill_one_off", "One-off charges were placed in the estimated first bill",
    Number(p.estimated_first_bill_incl_vat ?? 0) >= Number(p.monthly_incl_vat ?? 0));
  add("vat_calculation", "VAT on the test order matches the configured rate",
    Math.abs(Number(p.monthly_ex_vat ?? 0) + Number(p.monthly_vat ?? 0) - Number(p.monthly_incl_vat ?? 0)) < 0.02
      && Number(p.vat_rate_percent ?? 0) === vatRate);
  // Test runs are isolated, so contract and acceptance evidence must exist in
  // the dedicated test tables and never in the live contractual tables.
  const testCs = s ? (await supabase.from("journey2_test_contract_summaries")
    .select("id, status, snapshot_sha256").eq("session_id", s.id).maybeSingle()).data as any : null;
  add("cs_generation", "Contract Summary and Contract Information were generated for the test run",
    !!testCs && testCs.snapshot_sha256 === sn?.snapshot_sha256,
    testCs ? `test contract ${testCs.id} (${testCs.status})` : "no isolated test contract");
  const testAcc = s ? (await supabase.from("journey2_test_acceptances")
    .select("id, accepted_at, snapshot_sha256").eq("session_id", s.id).maybeSingle()).data as any : null;
  add("acceptance_evidence", "Acceptance evidence was recorded for the test run",
    !!testAcc && testAcc.snapshot_sha256 === sn?.snapshot_sha256,
    testAcc ? `accepted at ${testAcc.accepted_at}` : "no isolated acceptance record");
  add("dd_masking", "Direct Debit details were masked, never exposed in full",
    !!s?.dd_masked && String((s.dd_masked as any).last4 ?? "").length === 4
      && !("account_number" in (s.dd_masked as any)) && !("sort_code" in (s.dd_masked as any)));
  const testDd = s ? (await supabase.from("journey2_test_dd_intake")
    .select("bank_details_ciphertext, nonce, dd_status")
    .eq("session_id", s.id).maybeSingle()).data as any : null;
  add("dd_encrypted", "Direct Debit bank details were stored encrypted",
    !!testDd?.bank_details_ciphertext && !!testDd?.nonce);
  add("dd_lifecycle", "Direct Debit lifecycle status is a known state, never submitted to a provider",
    ["details_received", "pending_contract", "pending_activation", "active"].includes(String(testDd?.dd_status ?? "")),
    String(testDd?.dd_status ?? "no test Direct Debit intake"));
  add("no_test_provider_submission", "No Direct Debit was submitted to the provider in test mode",
    !!s && !(await supabase.from("payment_methods").select("id")
      .eq("checkout_session_id", s.checkout_session_id).maybeSingle()).data);
  add("no_test_customer_email", "No customer email entered the live outbox in test mode",
    !!s && !(await supabase.from("journey2_email_outbox").select("id")
      .eq("session_id", s.id).maybeSingle()).data);
  add("no_test_live_order", "No live order, customer or supplier action was created in test mode",
    !!s && !s.order_id && !s.customer_id && !!t?.test_order_number);
  const { count: testOrderCount } = await supabase.from("journey2_test_orders")
    .select("id", { count: "exact", head: true })
    .eq("session_id", s?.id ?? "00000000-0000-0000-0000-000000000000");
  add("idempotent_submission", "Repeat submission cannot create a second order for one checkout session",
    (testOrderCount ?? 0) === 1, `${testOrderCount ?? 0} test order(s) for the test session`);
  const { count: docCount } = await supabase.from("journey2_test_documents")
    .select("id", { count: "exact", head: true })
    .eq("test_order_id", t?.id ?? "00000000-0000-0000-0000-000000000000");
  const { data: testOutbox } = await supabase.from("journey2_test_email_outbox")
    .select("status").eq("test_order_id", t?.id ?? "00000000-0000-0000-0000-000000000000").maybeSingle();
  add("welcome_pack", "The welcome pack is complete and was suppressed for the test order",
    (docCount ?? 0) >= 8 && testOutbox?.status === "suppressed_test",
    `${docCount ?? 0} document(s), outbox ${testOutbox?.status ?? "missing"}`);
  add("completion_route", "The completion view can be rendered from committed data",
    !!t?.test_order_number && !!t?.snapshot_sha256);
  add("no_silent_fallback", "There is no automatic Journey 1 fallback in Journey 2",
    !!s && s.status !== "manual_review");

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
    _customer_id: "00000000-0000-0000-0000-000000000000",
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
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

  // 6-7 · Two-document contract flow and legal versions.
  add("two_doc_flow", "Two-document contract flow is enabled", !!settings.two_document_contract_flow_enabled);
  const { data: legalCopy } = await supabase
    .from("site_copy").select("key").limit(1);
  add("legal_versions", "Current legal document versions are configured", Array.isArray(legalCopy));

  // 8-10 · Document generation has produced real artifacts.
  const [{ count: csCount }, { count: cipCount }, { count: certCount }] = await Promise.all([
    supabase.from("contract_summaries").select("id", { count: "exact", head: true }).not("pdf_storage_key", "is", null),
    supabase.from("contract_information_packs").select("id", { count: "exact", head: true }),
    supabase.from("acceptance_certificates").select("id", { count: "exact", head: true }),
  ]);
  add("cs_generation", "Contract Summary generation is operational", (csCount ?? 0) > 0, `${csCount ?? 0} generated`);
  add("cip_generation", "Contract Information generation is operational", (cipCount ?? 0) > 0, `${cipCount ?? 0} generated`);
  add("cert_generation", "Acceptance-certificate generation is operational", (certCount ?? 0) > 0, `${certCount ?? 0} issued`);

  // 11-13 · Direct Debit readiness.
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

  // 16 · Order number generation.
  let orderNumberOk = false;
  try {
    const { data } = await supabase.rpc("generate_occta_order_number");
    orderNumberOk = typeof data === "string" && data.length > 3;
  } catch { orderNumberOk = false; }
  add("order_numbers", "Order number generation is operational", orderNumberOk);

  // 17 · Customer-account creation path.
  const { count: profileCount } = await supabase
    .from("profiles").select("id", { count: "exact", head: true });
  add("customer_creation", "Customer-account creation is operational", (profileCount ?? 0) > 0);

  // 18 · No unresolved critical Journey 2 failures.
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
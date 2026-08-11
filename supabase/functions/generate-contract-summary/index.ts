import { corsHeaders, jsonResponse, getServiceClient, requireStaff, generateTokenPair } from "../_shared/quoteHelpers.ts";
import {
  LEGAL_TEXT_VERSION, COMPLAINTS_ADR_INFO_TEXT, DIGITAL_VOICE_WARNING_TEXT,
  PRICE_RISE_POLICY_TEXT, PAYMENT_SCHEDULE_TEXT_MONTHLY, VULNERABLE_CUSTOMER_NOTE_TEXT,
} from "../_shared/legalText.ts";
import {
  resolveBuildPlanPrice, planTermLabel, speedBucketLabel,
  PRICE_LOCK_WORDING, FLEX_30_WORDING, FIRST_BILL_PROMISE,
  loadGiacomCandidates,
} from "../_shared/buildPlanResolver.ts";
import { speedEstimatesFor, speedStatementFor } from "../_shared/journey2Snapshot.ts";
import { resolveNoticePeriod } from "../_shared/noticePeriod.ts";

const CONTRACT_TERMS_VERSION = "2026-08-10-v4";
const money = (n: number) => `£${Number(n).toFixed(2)}`;

function buildExitTerms(planTerm: string, in12: number, after12: number, noticeDays: number, noticeLabel: string) {
  const networkCharge = `A network cease/migration-away charge applies when the broadband service is ceased or transferred: ${money(in12)} incl. VAT if it ends within 12 months of going live, or ${money(after12)} incl. VAT after 12 months.`;
  const noticeSentence = noticeDays > 0
    ? `You can end the broadband service by giving ${noticeLabel} notice.`
    : `No notice period applies to ending the broadband service.`;
  if (planTerm === "flex_30") {
    return {
      text: `Flex 30 has no remaining-month early termination charge. ${noticeSentence} ${networkCharge} This is separate from any unpaid usage or account balance. It will not be charged where a statutory or regulatory penalty-free exit right applies, or where OCCTA confirms a waiver in writing.`,
      snapshot: {
        kind: "flex_30",
        minimum_term_months: 0,
        notice_period_days: noticeDays,
        early_termination_charge: "None — no remaining-month ETF on Flex 30",
        network_cease_migration_charge: { within_12_months_incl_vat: in12, after_12_months_incl_vat: after12 },
      },
    };
  }
  return {
    text: `Price Lock 24 has a 24-month minimum term. If you choose to end the broadband service during that minimum term and no penalty-free exit right applies, an Early Termination Charge may apply. It is calculated from the recurring broadband charges remaining to the end of the minimum term, less VAT that no longer becomes due and less costs OCCTA reasonably saves because the service ends early. It will never exceed the remaining contracted broadband charges. ${networkCharge} After the minimum term there is no remaining-month ETF; the stated notice period of ${noticeLabel} still applies.`,
    snapshot: {
      kind: "fixed_term_fair_loss",
      minimum_term_months: 24,
      notice_period_days: noticeDays,
      calculation_method: "Remaining recurring broadband charges to end of minimum term, less VAT no longer due and direct costs OCCTA reasonably saves because the service ends early",
      cap_or_formula: "Never more than the remaining contracted broadband charges; no double recovery of the same loss",
      network_cease_migration_charge: { within_12_months_incl_vat: in12, after_12_months_incl_vat: after12 },
      penalty_free_rights_preserved: true,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const isInternalService =
    req.headers.get("x-internal-service") === "1" &&
    (req.headers.get("Authorization") ?? "").includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "___no_key___");

  let actorUserId: string | null = null;
  if (!isInternalService) {
    const auth = await requireStaff(req);
    if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);
    actorUserId = auth.userId;
  }

  const body = await req.json().catch(() => ({} as { quote_id?: string; actor_id?: string; journey_mode?: boolean }));
  const { quote_id } = body;
  if (isInternalService && body.actor_id) actorUserId = body.actor_id;
  if (!quote_id) return jsonResponse({ error: "missing_quote_id" }, 400);

  const supabase = getServiceClient();
  const journeyMode = isInternalService && body.journey_mode === true;
  const { data: vatActiveData } = await supabase.rpc("is_vat_active");
  if (vatActiveData !== true) return jsonResponse({ error: "vat_inactive", message: "VAT settings incomplete. Enter VAT number and effective date before issuing Contract Summary or VAT invoice." }, 409);

  const { data: q, error: qErr } = await supabase.from("quotes").select("*").eq("id", quote_id).maybeSingle();
  if (qErr || !q) return jsonResponse({ error: "quote_not_found" }, 404);

  if (!journeyMode && q.status !== "approved" && q.status !== "contract_summary_generated") return jsonResponse({ error: "quote_not_approved", message: `Quote status is ${q.status}; must be approved.` }, 409);
  if (!journeyMode && !q.customer_id) return jsonResponse({ error: "no_customer", message: "Quote is not linked to a customer account." }, 409);

  const { data: qrGuard } = await supabase.from("quote_requests").select("id, status, final_quote_id").eq("id", q.quote_request_id).maybeSingle();
  if (!qrGuard) return jsonResponse({ error: "quote_request_not_found" }, 404);
  if (!journeyMode && !["final_quote_ready", "contract_summary_generated"].includes(qrGuard.status as string)) return jsonResponse({ error: "quote_request_not_final", message: `Quote request status is ${qrGuard.status}.` }, 409);
  if (!journeyMode && qrGuard.final_quote_id !== q.id) return jsonResponse({ error: "final_quote_mismatch", message: "This is not the active final quote for the request." }, 409);

  let bpAddendum = "";
  let bpFields: Record<string, unknown> = {};

  // Notice period is derived from the quote — never hardcoded. Legacy quotes with
  // unresolvable notice data go to manual review instead of assuming 30 days.
  const notice = resolveNoticePeriod(q as any);
  if (!notice) {
    return jsonResponse({
      error: "notice_period_unresolved",
      message: "This quote does not contain a resolvable notice period. Confirm the exact notice period on the final quote before issuing the Contract Summary (manual review required).",
    }, 409);
  }
  let exitText: string | null = null;
  let etfPolicySnapshot: Record<string, unknown> | null = null;
  let exactDown: number | null = q.estimated_download_speed ?? null;
  let exactUp: number | null = q.estimated_upload_speed ?? null;
  const extraOneOff: { label: string; amount: number }[] = [];

  if (q.speed_bucket && q.plan_term) {
    const ro = (q.router_option ?? {}) as any;
    const so = (q.setup_option ?? {}) as any;
    const addons = Array.isArray(q.selected_addons) ? (q.selected_addons as any[]).map((a) => a.id).filter(Boolean) : [];
    const { data: settings } = await supabase.from("platform_settings").select("fair_pricing").eq("singleton", true).maybeSingle();
    let candidates;
    try { candidates = await loadGiacomCandidates(supabase, q.speed_bucket as any); }
    catch (_e) { return jsonResponse({ error: "build_plan_unsafe", message: "Final price needs manual confirmation for this address." }, 409); }

    if (q.supplier_product_id) {
      const exact = candidates.filter((c: any) => c.id === q.supplier_product_id);
      if (!exact.length) return jsonResponse({ error: "supplier_product_drift", message: "The supplier product behind this quote has changed. Please re-quote before issuing a Contract Summary." }, 409);
      candidates = exact;
    }

    const resolved = resolveBuildPlanPrice({
      speed_bucket: q.speed_bucket,
      plan_term: q.plan_term,
      router_option: ro.option ?? "own",
      router_payment_type: ro.payment_type ?? "none",
      setup_option: so.option ?? "remote",
      addons,
      customer_type: q.customer_type,
      max_download: q.estimated_download_speed ?? undefined,
    }, settings?.fair_pricing ?? {}, candidates);

    if (resolved.quote_only) return jsonResponse({ error: "build_plan_unsafe", message: "This combination is no longer safe to issue — please re-quote from a fresh Build Plan." }, 409);
    const drift = Math.abs(Number(q.monthly_gross) - resolved.monthly_total_incl_vat);
    if (drift > 0.02) return jsonResponse({ error: "price_drift", message: `Stored monthly price (£${Number(q.monthly_gross).toFixed(2)}) no longer matches resolver (£${resolved.monthly_total_incl_vat.toFixed(2)}). Re-quote required.` }, 409);

    exactDown = resolved.estimated_download_mbps;
    exactUp = resolved.estimated_upload_mbps;
    const exit = buildExitTerms(q.plan_term, resolved.internal.disconnect_fee_in_12m_incl_vat, resolved.internal.disconnect_fee_after_12m_incl_vat, notice.days, notice.text);
    exitText = exit.text;
    etfPolicySnapshot = exit.snapshot;

    const termCopy = q.plan_term === "price_lock_24" ? PRICE_LOCK_WORDING : FLEX_30_WORDING;
    bpAddendum =
      `\n\nPlan: ${speedBucketLabel(q.speed_bucket as any)} — ${planTermLabel(q.plan_term as any)}.` +
      `\nContract speed used for this quote: up to ${exactDown} Mbps down / ${exactUp} Mbps up (estimate, not a guarantee).` +
      `\nRouter: ${resolved.router.label} (${resolved.router.payment_type === "monthly" ? `£${resolved.router.monthly.toFixed(2)}/mo` : resolved.router.oneOff > 0 ? `£${resolved.router.oneOff.toFixed(2)} one-off` : "£0"}).` +
      `\nSetup: ${resolved.setup.label}${resolved.setup.oneOff > 0 ? ` (£${resolved.setup.oneOff.toFixed(2)} one-off)` : " (£0)"}.` +
      (resolved.addons.length ? `\nAdd-ons: ${resolved.addons.map((a) => `${a.label} £${a.monthly.toFixed(2)}/mo`).join("; ")}.` : "") +
      `\n\n${termCopy}` +
      `\nEstimated first bill: £${resolved.first_bill_incl_vat.toFixed(2)} incl. VAT.` +
      `\n\n${FIRST_BILL_PROMISE}`;

    bpFields = { speed_bucket: q.speed_bucket, plan_term: q.plan_term, router_option: q.router_option, setup_option: q.setup_option, selected_addons: q.selected_addons };
    if (resolved.router.oneOff > 0) extraOneOff.push({ label: resolved.router.label, amount: resolved.router.oneOff });
    if (resolved.setup.oneOff > 0) extraOneOff.push({ label: resolved.setup.label, amount: resolved.setup.oneOff });
  } else if (q.service_type === "broadband") {
    if (q.cease_fee_gross == null) {
      return jsonResponse({
        error: "termination_charges_unresolved",
        message: "This broadband quote does not yet contain an approved cease/migration-away charge. Add the applicable charge before issuing the Contract Summary.",
      }, 409);
    }
    const cease = Number(q.cease_fee_gross);
    const fixed = q.plan_type !== "flex" && Number(q.contract_length_months ?? 0) > 0;
    exitText = fixed
      ? `If you end the broadband service during the minimum term and no penalty-free exit right applies, an Early Termination Charge may apply. It is based on the recurring broadband charges remaining to the end of the minimum term, less VAT that no longer becomes due and less costs OCCTA reasonably saves because the service ends early, and will never exceed the remaining contracted broadband charges. A separate network cease/migration-away charge of ${money(cease)} incl. VAT may also apply.`
      : `There is no remaining-month early termination charge on this rolling plan. A network cease/migration-away charge of ${money(cease)} incl. VAT may apply when the broadband service is ceased or transferred. Statutory and regulatory penalty-free exit rights are preserved.`;
    etfPolicySnapshot = { kind: fixed ? "fixed_term_fair_loss" : "rolling", network_cease_migration_charge_incl_vat: cease, penalty_free_rights_preserved: true };
  }

  const { data: qr } = await supabase.from("quote_requests").select("full_name, email, postcode, address_line_1, address_line_2, town, county").eq("id", q.quote_request_id).single();
  const { data: prof } = await supabase.from("profiles").select("account_number").eq("id", q.customer_id).maybeSingle();

  const { data: existing } = await supabase.from("contract_summaries").select("id, status, version").eq("quote_id", quote_id).order("version", { ascending: false });
  const lastAccepted = (existing ?? []).find((c) => c.status === "accepted");
  if (lastAccepted) return jsonResponse({ error: "previous_accepted", message: "A previous Contract Summary for this quote was already accepted and is immutable. Create a new quote to change terms." }, 409);
  const nextVersion = (existing?.[0]?.version ?? 0) + 1;
  if (existing?.length) await supabase.from("contract_summaries").update({ status: "superseded" }).eq("quote_id", quote_id).neq("status", "accepted");

  const { raw, hash } = await generateTokenPair();
  const oneOffJson = [
    { label: "Setup", amount: Number(q.setup_gross) },
    { label: "Router", amount: Number(q.router_gross) },
    { label: "Delivery", amount: Number(q.delivery_gross) },
    { label: "Installation", amount: Number(q.installation_gross) },
  ].filter((x) => x.amount > 0);
  const finalOneOff = q.speed_bucket && q.plan_term && extraOneOff.length ? extraOneOff : oneOffJson;
  const addr = [qr?.address_line_1, qr?.address_line_2, qr?.town, qr?.county, qr?.postcode].filter(Boolean).join(", ");
  const selectedAddonIds = Array.isArray(q.selected_addons) ? (q.selected_addons as any[]).map((a) => a.id) : [];
  const isVoice = q.service_type === "digital_voice" || selectedAddonIds.includes("digital_voice");

  const contractLength = q.plan_term === "price_lock_24"
    ? `Price Lock 24 — 24 months minimum term. Notice period: ${notice.text}.`
    : q.plan_term === "flex_30"
      ? `Flex 30 — rolling monthly. Cancel with ${notice.text} notice.`
      : q.plan_type === "flex" ? `Rolling monthly. Cancel with ${notice.text} notice.` : `${q.contract_length_months} months minimum term. Notice period: ${notice.text}.`;

  const { data: cs, error: csErr } = await supabase.from("contract_summaries").insert({
    quote_id: q.id,
    quote_request_id: q.quote_request_id,
    customer_id: q.customer_id,
    version: nextVersion,
    status: "issued",
    document_status: "issued",
    account_number: prof?.account_number ?? null,
    customer_email_snapshot: qr!.email,
    customer_name_snapshot: qr!.full_name,
    service_address: addr || qr!.postcode,
    plan_name: q.plan_name,
    service_type: q.service_type,
    plan_type: q.plan_type,
    customer_type: q.customer_type,
    monthly_price_incl_vat: q.monthly_gross,
    business_monthly_ex_vat: q.customer_type === "business" ? q.monthly_net : null,
    business_monthly_incl_vat: q.customer_type === "business" ? q.monthly_gross : null,
    one_off_charges_json: finalOneOff,
    setup_charge: q.setup_gross,
    router_charge: q.router_gross,
    delivery_charge: q.delivery_gross,
    installation_charge: q.installation_gross,
    cease_cancellation_charges: exitText ?? (q.service_type === "broadband" ? null : "See the service-specific terms for any cancellation charges."),
    contract_length: contractLength,
    minimum_term_months: q.plan_term === "price_lock_24" ? 24 : (q.plan_term === "flex_30" ? 0 : (q.contract_length_months ?? null)),
    notice_period: notice.text,
    notice_period_days: notice.days,
    etf_policy_snapshot: etfPolicySnapshot,
    estimated_download_speed: exactDown ?? speedEstimatesFor(q.speed_bucket)?.download ?? null,
    estimated_upload_speed: exactUp ?? speedEstimatesFor(q.speed_bucket)?.upload ?? null,
    speed_notes: (q.speed_notes ?? speedStatementFor(q.speed_bucket) ?? "") + bpAddendum,
    price_rise_policy: q.price_rise_policy ?? PRICE_RISE_POLICY_TEXT,
    digital_voice_warning: isVoice ? DIGITAL_VOICE_WARNING_TEXT : null,
    vulnerable_customer_note: VULNERABLE_CUSTOMER_NOTE_TEXT,
    complaints_adr_info: COMPLAINTS_ADR_INFO_TEXT,
    payment_schedule: PAYMENT_SCHEDULE_TEXT_MONTHLY,
    terms_version: CONTRACT_TERMS_VERSION,
    privacy_version: LEGAL_TEXT_VERSION,
    public_token_hash: hash,
    token_expires_at: q.expires_at,
    issued_at: new Date().toISOString(),
    legacy_compliance_status: "ok",
    is_information_update: false,
    ...bpFields,
  }).select("id, cs_number").single();

  if (csErr || !cs) return jsonResponse({ error: "create_failed", details: csErr?.message }, 500);
  await supabase.from("quotes").update({ status: "contract_summary_generated" }).eq("id", q.id);
  await supabase.from("quote_requests").update({ status: "contract_summary_generated", updated_at: new Date().toISOString() }).eq("id", q.quote_request_id);

  let pdfPending = false;
  try {
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const r = await fetch(`${projectUrl}/functions/v1/generate-contract-summary-pdf`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${svcKey}`, "Content-Type": "application/json", "x-internal-service": "1" },
      body: JSON.stringify({ contract_summary_id: cs.id, internal: true, actor_id: actorUserId }),
    });
    if (!r.ok) pdfPending = true;
  } catch { pdfPending = true; }

  await supabase.rpc("log_event", {
    _actor_type: "admin", _event_type: "contract_summary_generated",
    _title: `CS ${cs.cs_number} v${nextVersion}`,
    _details: { contract_summary_id: cs.id, quote_id: q.id, version: nextVersion, terms_version: CONTRACT_TERMS_VERSION },
    _source_module: "contract_summary", _quote_id: q.id, _contract_summary_id: cs.id,
  });
  await supabase.from("quote_events").insert({
    quote_id: q.id, quote_request_id: q.quote_request_id, contract_summary_id: cs.id,
    event_type: "contract_summary_generated",
    title: `Contract Summary ${cs.cs_number} v${nextVersion} generated`,
    actor_type: isInternalService ? "system" : "admin",
    actor_id: actorUserId,
  });

  return jsonResponse({ ok: true, contract_summary_id: cs.id, cs_number: cs.cs_number, public_token: raw, version: nextVersion, pdf_pending: pdfPending });
});

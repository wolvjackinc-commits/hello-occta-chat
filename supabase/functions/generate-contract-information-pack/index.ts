// Phase B — generates the OCCTA Contract Information & Customer Agreement Pack
// (long document). Service-aware. Behind two_document_contract_flow_enabled.
//
// Idempotent: if a non-superseded pack already exists for the quote at the
// same body hash, it is returned unchanged. Accepted packs are NEVER regenerated.

import { jsPDF } from "npm:jspdf@2.5.1";
import { corsHeaders, jsonResponse, getServiceClient, sha256Hex } from "../_shared/quoteHelpers.ts";
import {
  CONTRACT_INFORMATION_PACK_TITLE,
  TWO_DOC_TEMPLATE_VERSION,
  DV_DEPENDENCY_POINTS,
  PAYMENT_SCHEDULE_SAFE,
  COMPLAINTS_ADR_SAFE,
  SPEED_ESTIMATE_DISCLAIMER,
  SIM_ROAMING_DEFAULT,
  SIM_FAIR_USE_DEFAULT,
} from "../_shared/twoDocLegalText.ts";
import { buildServiceComponentsSnapshot, hasComponent } from "../_shared/serviceComponents.ts";
import { validateTwoDocIssue } from "../_shared/twoDocValidators.ts";
import type { CustomerSegment, ServiceComponent } from "../_shared/twoDocValidators.ts";
import { isTwoDocEnabledFor, logPilotEvent, callerUserIdFromRequest } from "../_shared/twoDocFlowGate.ts";
import { PRODUCTION_CONTRACT_SECTIONS, PRODUCTION_CONTRACT_VERSION } from "../_shared/productionConsumerContract.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({} as {
    quote_id?: string;
    customer_segment?: CustomerSegment;
    for_contract_summary_id?: string;
  }));
  const quoteId = body.quote_id;
  if (!quoteId) return jsonResponse({ error: "missing_quote_id" }, 400);
  // Optional: the exact Contract Summary version this pack must be paired to.
  // Used when OCCTA reissues a revised Contract Summary — the accepted pack for
  // the previous version stays immutable and a NEW pack version is issued and
  // bound to the revised summary, so acceptance can never mix versions.
  const forCsId = typeof body.for_contract_summary_id === "string" &&
    /^[0-9a-f-]{36}$/i.test(body.for_contract_summary_id)
    ? body.for_contract_summary_id
    : null;

  const supabase = getServiceClient();

  // Feature-flag OR staff pilot allowlist.
  const callerUserId = callerUserIdFromRequest(req);
  const gate = await isTwoDocEnabledFor(supabase, callerUserId);
  if (!gate.enabled) {
    await logPilotEvent(supabase, {
      event_type: "access_denied",
      user_id: callerUserId,
      metadata: { fn: "generate-contract-information-pack", quote_id: quoteId },
    });
    return jsonResponse({ error: "feature_disabled", message: "two_document_contract_flow_enabled is off and caller is not in pilot allowlist." }, 409);
  }

  const { data: q } = await supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle();
  if (!q) return jsonResponse({ error: "quote_not_found" }, 404);

  const segment: CustomerSegment = (body.customer_segment ?? (q.customer_type === "business" ? "small_business" : "residential")) as CustomerSegment;
  let components;
  try {
    components = buildServiceComponentsSnapshot(q as any);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("notice_period_unresolved")) {
      return jsonResponse({ error: "notice_period_unresolved", message: "This quote has no resolvable notice period. Confirm the exact notice period on the final quote before issuing (manual review required)." }, 409);
    }
    throw e;
  }

  // Hard-block issue-time checks (ETF, price-change).
  const check = validateTwoDocIssue({ customer_segment: segment, components });
  if (!check.ok) {
    return jsonResponse({ error: "hard_block", blocks: check.blocks }, 422);
  }

  // Promotion is part of the logical body. An accepted pack therefore cannot
  // silently gain or lose SWITCH50 after the customer accepts it.
  const promotion = ((q as any).campaign_snapshot ?? null) as Record<string, any> | null;
  const bodySnapshot = { components, segment, promotion, template_version: TWO_DOC_TEMPLATE_VERSION };
  const bodyHash = await sha256Hex(JSON.stringify(bodySnapshot));

  const { data: existingRows } = await supabase
    .from("contract_information_packs")
    .select("id, cip_number, version, document_status, pdf_hash, pdf_storage_path, contract_summary_id")
    .eq("quote_id", quoteId)
    .neq("document_status", "superseded")
    .order("version", { ascending: false });

  // A pack may only be reused for the requested Contract Summary version.
  const pairable = (r: { contract_summary_id?: string | null }) =>
    !forCsId || !r.contract_summary_id || r.contract_summary_id === forCsId;

  const accepted = (existingRows ?? []).find((r) => r.document_status === "accepted");
  if (accepted && pairable(accepted)) {
    return jsonResponse({
      ok: true, reused: true, immutable: true,
      pack_id: accepted.id, cip_number: accepted.cip_number, version: accepted.version,
      pdf_hash: accepted.pdf_hash,
    });
  }
  const sameBody = (existingRows ?? []).find((r) => r.pdf_hash === bodyHash && pairable(r));
  if (sameBody) {
    return jsonResponse({
      ok: true, reused: true,
      pack_id: sameBody.id, cip_number: sameBody.cip_number, version: sameBody.version, pdf_hash: sameBody.pdf_hash,
    });
  }

  const nextVersion = (existingRows?.[0]?.version ?? 0) + 1;
  const supersedesId = existingRows?.[0]?.id ?? null;
  if (existingRows && existingRows.length) {
    await supabase.from("contract_information_packs")
      .update({ document_status: "superseded", superseded_at_utc: new Date().toISOString() })
      .eq("quote_id", quoteId)
      .neq("document_status", "accepted");
  }

  // ── Render PDF ────────────────────────────────────────────────────────────
  const pdfBytes = renderPackPdf({ components, segment, quote: q as any });
  const pdfSha = await sha256Hex(new Uint8Array(pdfBytes));
  const storagePath = `contract-information-packs/${quoteId}/v${nextVersion}-${pdfSha.slice(0, 12)}.pdf`;

  const up = await supabase.storage.from("contract-documents").upload(storagePath, new Uint8Array(pdfBytes), {
    contentType: "application/pdf", upsert: false,
  });
  if (up.error && !/exists/i.test(up.error.message)) {
    return jsonResponse({ error: "storage_failed", details: up.error.message }, 500);
  }

  const { data: inserted, error: insErr } = await supabase
    .from("contract_information_packs")
    .insert({
      quote_id: quoteId,
      quote_request_id: (q as any).quote_request_id,
      customer_id: (q as any).customer_id,
      ...(forCsId ? { contract_summary_id: forCsId } : {}),
      ...(supersedesId ? { supersedes_id: supersedesId } : {}),
      version: nextVersion,
      document_status: "issued",
      template_version: TWO_DOC_TEMPLATE_VERSION,
      body_snapshot: bodySnapshot,
      pdf_hash: bodyHash,
      pdf_storage_path: storagePath,
      issued_at_utc: new Date().toISOString(),
      display_timezone: "Europe/London",
    })
    .select("id, cip_number, version")
    .single();

  if (insErr || !inserted) return jsonResponse({ error: "insert_failed", details: insErr?.message }, 500);

  return jsonResponse({
    ok: true, reused: false,
    pack_id: inserted.id, cip_number: inserted.cip_number, version: inserted.version,
    pdf_hash: bodyHash, pdf_sha256: pdfSha, storage_path: storagePath,
  });
});

// ─── PDF rendering ──────────────────────────────────────────────────────────
function renderPackPdf(opts: {
  components: ServiceComponent[];
  segment: CustomerSegment;
  quote: { id: string; plan_name?: string | null; monthly_gross?: number | null; campaign_snapshot?: Record<string, any> | null };
}): ArrayBuffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;

  const ensure = (needed = 18) => { if (y + needed > H - 48) { doc.addPage(); y = M; } };
  const line = (h = 14) => { y += h; if (y > H - 48) { doc.addPage(); y = M; } };
  const heading = (t: string) => {
    ensure(30);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(17, 17, 17); doc.text(t, M, y);
    line(18); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  };
  const para = (t: string) => {
    const wrapped = doc.splitTextToSize(t, W - M * 2) as string[];
    ensure(Math.max(18, wrapped.length * 13 + 6));
    for (const l of wrapped) { doc.text(l, M, y); line(13); }
    line(4);
  };

  doc.setFillColor(255, 226, 0); doc.rect(0, 0, W, 64, "F");
  doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(19); doc.text("OCCTA", M, 28);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  doc.text("OCCTA LIMITED · 22 Pavilion View, Huddersfield, HD3 3WU · 0800 260 6626 · hello@occta.co.uk", M, 46);
  y = 88;

  doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.text(CONTRACT_INFORMATION_PACK_TITLE, M, y); line(22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`Production v${PRODUCTION_CONTRACT_VERSION} · document template v${TWO_DOC_TEMPLATE_VERSION} · issued ${new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })}`, M, y);
  line(18); doc.setFontSize(10);

  heading("1. About this document");
  para("This Contract Information & Customer Agreement Pack contains the detailed consumer terms that apply to your OCCTA services. It must be read with the Contract Summary issued for your order. Both documents are provided before you are asked to accept the agreement. Customer-specific price, term, service, speed and charge information in your issued order documents takes priority over generic examples in this Pack, except where law requires otherwise.");

  heading("2. Your service components");
  for (const c of opts.components) {
    ensure(20);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(`${c.label} (${c.kind.replace("_", " ")})`, M, y); line(14);
    doc.setFont("helvetica", "normal");
    para(`Monthly price (incl. VAT where applicable): £${c.monthly_price_incl_vat.toFixed(2)}.`);
    para(`Contract type: ${c.contract_kind === "fixed_term" ? `Fixed term — ${c.minimum_term_months} months minimum` : "Flex 30 — 30-day rolling with no fixed minimum term"}.`);
    para(`Notice period: ${c.notice_period_days} days. Cancellation: ${c.cancellation_wording}`);
    if (c.contract_kind === "fixed_term" && c.etf) {
      para(`Early Termination Charge: ${c.etf.wording}`);
      para(`Calculation: ${c.etf.calculation_method}. Cap/formula: ${c.etf.cap_or_formula}. VAT: ${c.etf.vat_treatment}. Date basis: ${c.etf.date_basis}.`);
      para(`Worked example: ${c.etf.worked_example}`);
    }
    para(`Price-change policy: ${c.price_change.wording ?? "No scheduled price increase."}`);
  }

  if (hasComponent(opts.components, "digital_voice")) {
    heading("Digital Voice — essential warnings");
    for (const p of DV_DEPENDENCY_POINTS) para(`• ${p}`);
    para("999/112 calls are free when the service is operational. If you rely on the line because of vulnerability, medical needs, telecare or poor mobile coverage, tell OCCTA so we can assess and discuss available resilience or alternative communication arrangements.");
  }

  if (hasComponent(opts.components, "sim")) {
    heading("Mobile SIM — allowances and roaming");
    para("Data, minutes and text allowances are shown in your Contract Summary/order. Fair-use limits apply only where disclosed for the selected plan.");
    para(SIM_ROAMING_DEFAULT);
    para(SIM_FAIR_USE_DEFAULT);
  }

  heading("Broadband speed information");
  para(SPEED_ESTIMATE_DISCLAIMER);

  const promotion = opts.quote.campaign_snapshot;
  if (promotion?.eligible === true && promotion?.code === "SWITCH50") {
    heading("Promotion");
    para(`This order includes SWITCH50: £${Number(promotion.reward_amount ?? 50).toFixed(2)} cash reward. It is separate from the broadband subscription price.`);
    if (promotion.payout_rule) para(String(promotion.payout_rule));
    if (promotion.terms_text) para(`Promotion terms (${String(promotion.terms_version ?? "current")}): ${String(promotion.terms_text)}`);
  }

  heading("Billing");
  para(PAYMENT_SCHEDULE_SAFE);

  let n = 3;
  for (const s of PRODUCTION_CONTRACT_SECTIONS) {
    heading(`${n}. ${s.heading}`);
    n += 1;
    for (const p of s.paragraphs) para(p);
  }

  heading(`${n}. Complaints & ADR`);
  para(COMPLAINTS_ADR_SAFE);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(180); doc.line(M, H - 36, W - M, H - 36);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
    doc.text(`OCCTA Consumer Contract Information · Production v${PRODUCTION_CONTRACT_VERSION}`, M, H - 22);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 22, { align: "right" });
  }

  return doc.output("arraybuffer") as ArrayBuffer;
}

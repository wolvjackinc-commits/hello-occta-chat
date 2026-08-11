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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({} as { quote_id?: string; customer_segment?: CustomerSegment }));
  const quoteId = body.quote_id;
  if (!quoteId) return jsonResponse({ error: "missing_quote_id" }, 400);

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

  // Reuse if an accepted or issued pack already exists for the same body.
  const bodySnapshot = { components, segment, template_version: TWO_DOC_TEMPLATE_VERSION };
  const bodyHash = await sha256Hex(JSON.stringify(bodySnapshot));

  const { data: existingRows } = await supabase
    .from("contract_information_packs")
    .select("id, cip_number, version, document_status, pdf_hash, pdf_storage_path")
    .eq("quote_id", quoteId)
    .neq("document_status", "superseded")
    .order("version", { ascending: false });

  const accepted = (existingRows ?? []).find((r) => r.document_status === "accepted");
  if (accepted) {
    return jsonResponse({
      ok: true, reused: true, immutable: true,
      pack_id: accepted.id, cip_number: accepted.cip_number, version: accepted.version,
      pdf_hash: accepted.pdf_hash,
    });
  }
  const sameBody = (existingRows ?? []).find((r) => r.pdf_hash === bodyHash);
  if (sameBody) {
    return jsonResponse({
      ok: true, reused: true,
      pack_id: sameBody.id, cip_number: sameBody.cip_number, version: sameBody.version, pdf_hash: sameBody.pdf_hash,
    });
  }

  const nextVersion = (existingRows?.[0]?.version ?? 0) + 1;
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
      version: nextVersion,
      document_status: "issued",
      template_version: TWO_DOC_TEMPLATE_VERSION,
      body_snapshot: bodySnapshot,
      pdf_hash: bodyHash,             // logical body hash (idempotency)
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
  quote: { id: string; plan_name?: string | null };
}): ArrayBuffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = M;

  const line = (h = 14) => { y += h; if (y > 780) { doc.addPage(); y = M; } };
  const heading = (t: string) => { doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(t, M, y); line(20); doc.setFont("helvetica", "normal"); doc.setFontSize(10); };
  const para = (t: string) => {
    const wrapped = doc.splitTextToSize(t, W - M * 2);
    for (const l of wrapped) { doc.text(l, M, y); line(13); }
    line(4);
  };

  // Title
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text(CONTRACT_INFORMATION_PACK_TITLE, M, y); line(24);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`Template v${TWO_DOC_TEMPLATE_VERSION} — issued ${new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })}`, M, y); line(18);
  doc.setFontSize(10);

  heading("1. About this document");
  para("This Contract Information & Customer Agreement Pack sets out the full terms that apply to your OCCTA services. It sits alongside the short Contract Summary you have already reviewed. Both documents apply together.");

  heading("2. Your service components");
  for (const c of opts.components) {
    doc.setFont("helvetica", "bold"); doc.text(`${c.label} (${c.kind.replace("_", " ")})`, M, y); line(14);
    doc.setFont("helvetica", "normal");
    para(`Monthly price (incl. VAT where applicable): £${c.monthly_price_incl_vat.toFixed(2)}`);
    para(`Contract type: ${c.contract_kind === "fixed_term" ? `Fixed term — ${c.minimum_term_months} months minimum` : "Flex 30 — 30-day rolling"}`);
    para(`Notice period: ${c.notice_period_days} days.`);
    para(`Cancellation: ${c.cancellation_wording}`);
    if (c.contract_kind === "fixed_term" && c.etf) {
      para(`Early Termination Charge — customer wording: ${c.etf.wording}`);
      para(`ETF calculation method: ${c.etf.calculation_method}`);
      para(`ETF cap / formula: ${c.etf.cap_or_formula}`);
      para(`ETF worked example: ${c.etf.worked_example}`);
      para(`ETF VAT treatment: ${c.etf.vat_treatment}`);
      para(`ETF date basis: ${c.etf.date_basis}`);
    }
    para(`Price-change policy: ${c.price_change.wording ?? "None scheduled."}`);
    line(6);
  }

  if (hasComponent(opts.components, "digital_voice")) {
    heading("3. Digital Voice / Home Phone — essential warnings");
    for (const p of DV_DEPENDENCY_POINTS) para(`• ${p}`);
  }

  if (hasComponent(opts.components, "sim")) {
    heading("4. Mobile SIM — allowances & roaming");
    para("Data, minutes and text allowances are shown in your Contract Summary. Fair usage limits apply to unlimited allowances.");
    para(SIM_ROAMING_DEFAULT);
    para(SIM_FAIR_USE_DEFAULT);
    para("Out-of-bundle usage is charged at the rates in the OCCTA Mobile Price Guide, available at occta.co.uk/legal/price-guide.");
  }

  heading("5. Speeds");
  para(SPEED_ESTIMATE_DISCLAIMER);

  heading("6. Billing");
  para(PAYMENT_SCHEDULE_SAFE);

  heading("7. Complaints & ADR");
  para(COMPLAINTS_ADR_SAFE);

  heading("8. Data protection");
  para("OCCTA LIMITED is the data controller for your personal information. See our Privacy Policy at occta.co.uk/privacy for lawful bases, retention periods and your rights.");

  heading("9. Vulnerable customers");
  para("If you or someone in your household has additional needs — medical, accessibility, financial vulnerability, or reliance on the line for emergency contact — please tell us before accepting this pack so we can support you appropriately.");

  return doc.output("arraybuffer") as ArrayBuffer;
}

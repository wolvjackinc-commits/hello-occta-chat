// Backfill missing PDFs for accepted Contract Summary rows.
// Renders the PDF from the CS row (never mutates the CS row itself) and
// records the artifact in public.contract_document_artifacts.
// Storage: private "contract-pdfs" bucket at "artifacts/<cs_id>/v<version>.pdf".
// Auth: admin/super_admin/compliance_admin JWT required.

import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";
import { FULL_CONTRACT_SECTIONS, FULL_CONTRACT_INTRO, FULL_CONTRACT_TERMS_VERSION } from "../_shared/fullContractTerms.ts";
// @ts-ignore npm specifier resolved at runtime
import { jsPDF } from "npm:jspdf@2.5.1";

const BUCKET = "contract-pdfs";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;

function fmt(n: unknown): string { return `£${Number(n ?? 0).toFixed(2)}`; }

function renderPdf(cs: any): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;
  const line = (text: string, opts?: { bold?: boolean; size?: number; gap?: number }) => {
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.size ?? 10);
    const wrapped = doc.splitTextToSize(String(text ?? ""), W - M * 2) as string[];
    for (const ln of wrapped) {
      if (y > H - M) { doc.addPage(); y = M; }
      doc.text(ln, M, y);
      y += (opts?.size ?? 10) + (opts?.gap ?? 4);
    }
  };
  const heading = (t: string) => {
    y += 10;
    if (y > H - M - 30) { doc.addPage(); y = M; }
    doc.setFillColor(0, 0, 0);
    doc.rect(M, y - 11, 4, 14, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(String(t).toUpperCase(), M + 12, y);
    y += 6;
    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.line(M, y, W - M, y);
    y += 12;
  };
  const kv = (k: string, v: string) => {
    if (y > H - M) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(k, M, y);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(String(v ?? ""), W - M * 2 - 140) as string[];
    doc.text(wrapped, M + 140, y);
    y += 14 * Math.max(1, wrapped.length);
  };

  // Header banner
  doc.setFillColor(0, 0, 0); doc.rect(0, 0, W, 80, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text("OCCTA", M, 38);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Simple telecom. Clear terms.", M, 54);
  doc.text("www.occta.co.uk", M, 66);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("CONTRACT SUMMARY", W - M, 38, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(String(cs.cs_number ?? ""), W - M, 54, { align: "right" });
  doc.text(`Version ${cs.version} · ${String(cs.status).toUpperCase()} · BACKFILL`, W - M, 66, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y = 110;

  doc.setFont("helvetica", "italic"); doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Backfilled Contract Summary rendered from the accepted row snapshot. Provided under Ofcom General Conditions C1.3.", M, y);
  doc.setTextColor(0, 0, 0);
  y += 12;

  heading("Customer & Service");
  kv("Customer", `${cs.customer_name_snapshot ?? "—"} (${cs.customer_email_snapshot ?? "—"})`);
  if (cs.account_number) kv("Account number", String(cs.account_number));
  kv("Service address", String(cs.service_address ?? ""));
  kv("Plan", `${cs.plan_name} (${cs.plan_type}, ${cs.customer_type})`);
  kv("Contract length", String(cs.contract_length ?? ""));
  kv("Notice period", String(cs.notice_period ?? ""));

  heading("Pricing");
  if (cs.customer_type === "business") {
    kv("Monthly (ex VAT)", fmt(cs.business_monthly_ex_vat));
    kv("Monthly (incl VAT)", fmt(cs.business_monthly_incl_vat));
  } else {
    kv("Monthly (incl VAT)", fmt(cs.monthly_price_incl_vat));
  }
  const oneOff = (cs.one_off_charges_json as Array<{label:string;amount:number}> | null) ?? [];
  if (oneOff.length) {
    line("One-off charges:", { bold: true, gap: 2 });
    for (const c of oneOff) kv(c.label, fmt(c.amount));
  }

  heading("Speed Estimate");
  kv("Download", `${cs.estimated_download_speed ?? "—"} Mbps`);
  kv("Upload", `${cs.estimated_upload_speed ?? "—"} Mbps`);
  if (cs.speed_notes) line(String(cs.speed_notes));

  heading("Cease / Cancellation");
  line(String(cs.cease_cancellation_charges ?? ""));

  heading("Price Rises");
  line(String(cs.price_rise_policy ?? ""));

  if (cs.digital_voice_warning) {
    heading("Digital Voice — Important");
    line(String(cs.digital_voice_warning));
  }

  heading("Vulnerable Customers");
  line(String(cs.vulnerable_customer_note ?? ""));

  heading("Complaints & ADR");
  line(String(cs.complaints_adr_info ?? ""));

  heading("Payment Schedule");
  line(String(cs.payment_schedule ?? ""));

  heading("Versions");
  kv("Terms version", String(cs.terms_version ?? ""));
  kv("Privacy version", String(cs.privacy_version ?? ""));

  if (cs.accepted_at) {
    heading("Acceptance");
    kv("Accepted at", String(cs.accepted_at));
  }

  doc.addPage(); y = M;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("FULL CONTRACT SUMMARY", M, y);
  y += 18;
  doc.setFont("helvetica", "italic"); doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  for (const ln of doc.splitTextToSize(FULL_CONTRACT_INTRO, W - M * 2) as string[]) {
    if (y > H - M) { doc.addPage(); y = M; }
    doc.text(ln, M, y); y += 12;
  }
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(`Terms version ${FULL_CONTRACT_TERMS_VERSION}`, M, y); y += 14;
  for (const section of FULL_CONTRACT_SECTIONS) {
    heading(section.heading);
    for (const p of section.paragraphs) { line(p, { size: 10, gap: 4 }); y += 4; }
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.line(M, H - 40, W - M, H - 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100);
    doc.text(`OCCTA Ltd · www.occta.co.uk · ${cs.cs_number} v${cs.version} · backfill`, M, H - 26);
    doc.text("Simple telecom. Clear terms.", M, H - 14);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 26, { align: "right" });
  }
  return doc.output("arraybuffer") as unknown as Uint8Array;
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const staff = await requireStaff(req, ["admin", "super_admin", "compliance_admin"]);
  if ("error" in staff) return jsonResponse({ error: staff.error }, staff.status);

  const body = await req.json().catch(() => ({} as any));
  const csIds: string[] = Array.isArray(body.contract_summary_ids) ? body.contract_summary_ids : [];
  if (!csIds.length) return jsonResponse({ error: "missing_contract_summary_ids" }, 400);

  const supabase = getServiceClient();
  const results: Array<Record<string, unknown>> = [];

  for (const csId of csIds) {
    try {
      const { data: cs, error: csErr } = await supabase
        .from("contract_summaries").select("*").eq("id", csId).maybeSingle();
      if (csErr || !cs) { results.push({ id: csId, ok: false, reason: "cs_not_found" }); continue; }

      // Idempotency: skip if artifact already exists
      const { data: existing } = await supabase
        .from("contract_document_artifacts")
        .select("id, storage_bucket, storage_path, sha256_hash")
        .eq("document_type", "contract_summary")
        .eq("document_id", csId)
        .eq("document_version", cs.version)
        .eq("artifact_type", "pdf")
        .maybeSingle();
      if (existing) {
        const { data: signed } = await supabase.storage.from(existing.storage_bucket).createSignedUrl(existing.storage_path, SIGNED_URL_TTL);
        results.push({ id: csId, cs_number: cs.cs_number, ok: true, reused: true, signed_url: signed?.signedUrl, sha256: existing.sha256_hash });
        continue;
      }

      const bytes = renderPdf(cs);
      const sha = await sha256Bytes(bytes);
      const path = `artifacts/${csId}/v${cs.version}.pdf`;
      const up = await supabase.storage.from(BUCKET).upload(path, bytes, {
        contentType: "application/pdf", upsert: false,
      });
      if (up.error && !/already exists|duplicate/i.test(up.error.message)) {
        results.push({ id: csId, ok: false, reason: "upload_failed", details: up.error.message }); continue;
      }
      const { error: insErr } = await supabase.from("contract_document_artifacts").insert({
        document_type: "contract_summary",
        document_id: csId,
        document_number: cs.cs_number,
        document_version: cs.version,
        artifact_type: "pdf",
        storage_bucket: BUCKET,
        storage_path: path,
        sha256_hash: sha,
        created_by: staff.userId,
        is_customer_visible: true,
        metadata: { source: "backfill", cs_status: cs.status },
      });
      if (insErr) { results.push({ id: csId, ok: false, reason: "insert_failed", details: insErr.message }); continue; }

      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
      results.push({ id: csId, cs_number: cs.cs_number, ok: true, reused: false, signed_url: signed?.signedUrl, sha256: sha, storage_path: path });
    } catch (e) {
      results.push({ id: csId, ok: false, reason: "exception", details: String((e as Error).message) });
    }
  }

  return jsonResponse({ ok: true, results });
});
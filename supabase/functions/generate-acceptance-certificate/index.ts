import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";
// @ts-ignore - npm specifier resolved at runtime
import { jsPDF } from "npm:jspdf@2.5.1";
import { perfServe } from "../_shared/perfLog.ts";

/**
 * INTERNAL function — service-role only. Given a contract_acceptance row,
 * generates an immutable acceptance-certificate PDF, uploads to the private
 * `acceptance-certificates` bucket and inserts a one-per-acceptance row in
 * the append-only `acceptance_certificates` table.
 *
 * Body: { contract_acceptance_id: string, masked_ip?: boolean }
 * Returns: { ok, certificate_number, storage_key, sha256, signed_url? }
 *
 * Idempotent: if a certificate already exists for the acceptance, returns it.
 */

const BUCKET = "acceptance-certificates";
const SIGNED_TTL = 60 * 60 * 24 * 7;

function maskIp(ip: string | null | undefined): string {
  if (!ip) return "—";
  // IPv4: drop last octet. IPv6: drop last 4 segments.
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, Math.max(1, parts.length - 4)).join(":") + ":****";
  }
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
  return "***";
}

async function sha256HexFromBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function renderCertificatePdf(opts: {
  certificateNumber: string;
  csNumber: string;
  csVersion: number;
  quoteNumber: string;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  serviceAddress: string;
  acceptedAtUtc: string;
  acceptedAtLocal: string;
  termsVersion: string;
  acceptanceTextVersion: string;
  acceptanceTextHash: string;
  csPdfSha256: string;
  ipMasked: string;
  userAgentShort: string;
  sourceRoute: string;
  checkboxes: { label: string; ticked: boolean }[];
}): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;

  // Branded header
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, W, 80, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text("OCCTA", M, 38);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("No contracts. No pressure.", M, 54);
  doc.text("www.occta.co.uk", M, 66);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("ACCEPTANCE CERTIFICATE", W - M, 38, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(opts.certificateNumber, W - M, 54, { align: "right" });
  doc.text(`Issued ${new Date().toISOString().slice(0, 10)}`, W - M, 66, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y = 110;

  const heading = (t: string) => {
    y += 10;
    if (y > H - M - 30) { doc.addPage(); y = M; }
    doc.setFillColor(0, 0, 0); doc.rect(M, y - 11, 4, 14, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(t.toUpperCase(), M + 12, y);
    y += 6; doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); y += 12;
  };
  const kv = (k: string, v: string) => {
    if (y > H - M) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(k, M, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(v ?? "—", W - M * 2 - 160) as string[];
    doc.text(lines, M + 160, y);
    y += 12 * Math.max(1, lines.length);
  };

  doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(
    "This certificate is the immutable record of electronic acceptance of an OCCTA Contract Summary.",
    M, y,
  );
  doc.setTextColor(0, 0, 0); y += 12;

  heading("Customer");
  kv("Name (typed)", opts.customerName);
  kv("Email (confirmed)", opts.customerEmail);
  kv("Mobile (confirmed)", opts.customerMobile);
  kv("Service address", opts.serviceAddress);

  heading("Contract");
  kv("Quote reference", opts.quoteNumber);
  kv("Contract Summary reference", opts.csNumber);
  kv("Contract Summary version", String(opts.csVersion));
  kv("Contract Summary PDF (SHA-256)", opts.csPdfSha256);

  heading("Acceptance");
  kv("Accepted (UTC)", opts.acceptedAtUtc);
  kv("Accepted (Europe/London)", opts.acceptedAtLocal);
  kv("Acceptance wording version", opts.acceptanceTextVersion);
  kv("Terms version", opts.termsVersion);
  kv("Acceptance text (SHA-256)", opts.acceptanceTextHash);
  kv("IP address (masked)", opts.ipMasked);
  kv("Browser", opts.userAgentShort);
  kv("Source", opts.sourceRoute);

  heading("Consent statements ticked");
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  for (const cb of opts.checkboxes) {
    if (y > H - M - 20) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold");
    doc.text(cb.ticked ? "[X]" : "[ ]", M, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(cb.label, W - M * 2 - 24) as string[];
    doc.text(lines, M + 24, y);
    y += 11 * Math.max(1, lines.length) + 4;
  }

  // Footer
  doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(100, 100, 100);
  doc.text(
    "OCCTA Limited · Registered in England & Wales · Generated by OCCTA Acceptance Service · This document is hashed and cannot be altered.",
    M, H - 24,
  );

  return new Uint8Array(doc.output("arraybuffer"));
}

Deno.serve(perfServe("generate-acceptance-certificate", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  // Internal service only — must carry service-role JWT + header
  const isInternal =
    req.headers.get("x-internal-service") === "1" &&
    (req.headers.get("Authorization") ?? "").includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "___none___");
  if (!isInternal) return jsonResponse({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({} as { contract_acceptance_id?: string }));
  const accId = body.contract_acceptance_id;
  if (!accId) return jsonResponse({ error: "missing_acceptance_id" }, 400);

  const supabase = getServiceClient();

  // Idempotency: if certificate already exists, return it.
  const { data: existing } = await supabase
    .from("acceptance_certificates")
    .select("certificate_number, storage_key, sha256")
    .eq("contract_acceptance_id", accId)
    .maybeSingle();
  if (existing) {
    const { data: sig } = await supabase.storage.from(BUCKET).createSignedUrl(existing.storage_key, SIGNED_TTL);
    return jsonResponse({
      ok: true, reused: true,
      certificate_number: existing.certificate_number,
      storage_key: existing.storage_key,
      sha256: existing.sha256,
      signed_url: sig?.signedUrl ?? null,
    });
  }

  const { data: acc } = await supabase
    .from("contract_acceptances")
    .select("*")
    .eq("id", accId)
    .maybeSingle();
  if (!acc) return jsonResponse({ error: "acceptance_not_found" }, 404);

  const { data: cs } = await supabase
    .from("contract_summaries")
    .select("cs_number, version, plan_name, service_address, customer_email_snapshot, customer_name_snapshot, pdf_sha256, terms_version, quote_id")
    .eq("id", acc.contract_summary_id)
    .maybeSingle();
  if (!cs) return jsonResponse({ error: "cs_not_found" }, 404);

  const { data: q } = await supabase
    .from("quotes")
    .select("quote_number")
    .eq("id", acc.quote_id)
    .maybeSingle();

  const checkboxes = [
    { label: "I confirm that I have received, read and had the opportunity to download my Contract Summary and Contract Information.", ticked: !!acc.checkbox_received_read },
    { label: "I confirm that my personal details and service address shown above are correct.", ticked: !!acc.checkbox_details_correct },
    { label: "I understand the monthly charges, one-off charges, contract duration, cancellation rights and payment arrangements.", ticked: !!acc.checkbox_understand_charges },
    { label: "I expressly consent to enter into the agreement with OCCTA LIMITED on the terms shown in my Contract Summary and Contract Information.", ticked: !!acc.checkbox_consent },
  ];

  const bytes = renderCertificatePdf({
    certificateNumber: "PENDING", // overwritten — but stored value is taken from DB trigger
    csNumber: cs.cs_number ?? "—",
    csVersion: cs.version ?? 1,
    quoteNumber: q?.quote_number ?? "—",
    customerName: acc.accepted_by_name,
    customerEmail: acc.accepted_by_email,
    customerMobile: acc.mobile_snapshot ?? "—",
    serviceAddress: cs.service_address ?? "—",
    acceptedAtUtc: new Date(acc.accepted_at).toISOString(),
    acceptedAtLocal: acc.accepted_at_europe_london ?? new Date(acc.accepted_at).toLocaleString("en-GB", { timeZone: "Europe/London" }),
    termsVersion: acc.terms_version ?? "—",
    acceptanceTextVersion: acc.acceptance_text_version ?? "—",
    acceptanceTextHash: acc.acceptance_text_hash ?? "—",
    csPdfSha256: cs.pdf_sha256 ?? "—",
    ipMasked: maskIp(acc.ip),
    userAgentShort: (acc.user_agent ?? "—").slice(0, 120),
    sourceRoute: acc.source_route ?? "—",
    checkboxes,
  });

  const sha = await sha256HexFromBytes(bytes);
  const storageKey = `${acc.customer_id ?? "anon"}/${acc.id}.pdf`;

  const up = await supabase.storage.from(BUCKET).upload(storageKey, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (up.error && !/already exists|duplicate/i.test(up.error.message)) {
    return jsonResponse({ error: "upload_failed", details: up.error.message }, 500);
  }

  const insert = await supabase.from("acceptance_certificates").insert({
    contract_acceptance_id: acc.id,
    contract_summary_id: acc.contract_summary_id,
    quote_id: acc.quote_id,
    customer_id: acc.customer_id,
    journey_id: acc.journey_id,
    storage_key: storageKey,
    sha256: sha,
  }).select("certificate_number, storage_key, sha256").single();

  if (insert.error) return jsonResponse({ error: "cert_insert_failed", details: insert.error.message }, 500);

  const { data: sig } = await supabase.storage.from(BUCKET).createSignedUrl(storageKey, SIGNED_TTL);

  await supabase.rpc("log_event", {
    _actor_type: "system", _event_type: "acceptance_certificate_generated",
    _title: `Certificate ${insert.data.certificate_number} for CS ${cs.cs_number}`,
    _details: { acceptance_id: acc.id, sha256: sha },
    _source_module: "contract_acceptance", _quote_id: acc.quote_id, _contract_summary_id: acc.contract_summary_id,
  }).then(() => {}).catch(() => {});

  return jsonResponse({
    ok: true,
    reused: false,
    certificate_number: insert.data.certificate_number,
    storage_key: insert.data.storage_key,
    sha256: insert.data.sha256,
    signed_url: sig?.signedUrl ?? null,
  });
}));
import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, requireStaff, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
// @ts-expect-error - npm specifier resolved at runtime
import { jsPDF } from "npm:jspdf@2.5.1";

const BUCKET = "contract-pdfs";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;
const fmtMoney = (n: unknown) => `£${Number(n ?? 0).toFixed(2)}`;

// Statutory intro sentences — these three sentences must never be altered.
export const CS_STATUTORY_INTRO: readonly string[] = [
  "This contract summary provides the main elements of this service offer as required by EU law.",
  "It helps to make a comparison between service offers.",
  "Complete information about the service is provided in other documents.",
];

// Prescribed Ofcom contract-summary section order.
export const CS_SECTION_ORDER: readonly string[] = [
  "Services and equipment",
  "Speeds of the internet service and remedies",
  "Price",
  "Duration, renewal and termination",
  "Features for end-users with disabilities",
  "Other relevant information",
];

const BODY_PT = 10;      // normal body text — never below 10pt
const LABEL_PT = 10;
const HEADING_PT = 10.5;

function renderPdf(cs: any): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" }); // portrait A4
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const usable = W - M * 2;
  let y = 0;

  const setNormal = (size = BODY_PT) => { doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(17, 17, 17); };
  const setBold = (size = BODY_PT) => { doc.setFont("helvetica", "bold"); doc.setFontSize(size); doc.setTextColor(17, 17, 17); };
  const ensureSpace = (needed: number) => {
    if (y + needed > H - 58) { doc.addPage(); y = M + 8; }
  };
  const textBlock = (text: unknown, size = BODY_PT, gap = 2.2, indent = 0) => {
    const str = String(text ?? "").trim();
    if (!str) return;
    setNormal(size);
    const wrapped = doc.splitTextToSize(str, usable - indent) as string[];
    for (const ln of wrapped) { ensureSpace(size + gap); doc.text(ln, M + indent, y); y += size + gap; }
  };
  const row = (label: string, value: unknown) => {
    const str = String(value ?? "—");
    setNormal(BODY_PT);
    const lines = doc.splitTextToSize(str, usable - 150) as string[];
    ensureSpace(Math.max(1, lines.length) * (BODY_PT + 2.4));
    setBold(LABEL_PT); doc.text(label, M, y);
    setNormal(BODY_PT); doc.text(lines, M + 150, y);
    y += Math.max(1, lines.length) * (BODY_PT + 2.4);
  };
  const section = (index: number, title: string) => {
    y += 6;
    ensureSpace(26);
    doc.setFillColor(246, 246, 244);
    doc.rect(M, y - 10, usable, 18, "F");
    doc.setDrawColor(0); doc.setLineWidth(0.8);
    doc.line(M, y + 8, M + usable, y + 8);
    setBold(HEADING_PT);
    doc.text(`${index}. ${title}`, M + 6, y + 3);
    y += 20;
  };

  // OCCTA brand header — restrained, single band.
  doc.setFillColor(255, 226, 0);
  doc.rect(0, 0, W, 62, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold"); doc.setFontSize(19); doc.text("OCCTA", M, 26);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("OCCTA LIMITED  ·  www.occta.co.uk  ·  hello@occta.co.uk  ·  0800 260 6626", M, 44);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11.5);
  const title = cs.is_information_update ? "CURRENT CONTRACT INFORMATION" : "CONTRACT SUMMARY";
  doc.text(title, W - M, 26, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`${cs.cs_number ?? "—"} · v${cs.version ?? 1}`, W - M, 40, { align: "right" });
  doc.text(`Issued ${String(cs.issued_at ?? cs.created_at ?? "").slice(0, 10) || "—"}`, W - M, 53, { align: "right" });
  y = 82;

  if (cs.is_information_update) {
    const info = doc.splitTextToSize("This is a current-information refresh for your records only. No re-acceptance is required. It does not replace your original accepted agreement and does not change your price, service, billing, minimum term, notice period or cancellation rights.", usable - 16) as string[];
    const boxH = 22 + info.length * 12;
    doc.setDrawColor(0); doc.setLineWidth(1.2); doc.rect(M, y - 12, usable, boxH);
    setBold(10.5); doc.text("FOR YOUR RECORDS — NO RE-ACCEPTANCE REQUIRED", M + 8, y + 2);
    setNormal(BODY_PT);
    let iy = y + 18;
    for (const ln of info) { doc.text(ln, M + 8, iy); iy += 12; }
    y = y - 12 + boxH + 12;
  } else {
    // Statutory intro sentences — verbatim, unaltered.
    for (const s of CS_STATUTORY_INTRO) textBlock(s, BODY_PT, 2.2);
    y += 2;
  }

  setBold(BODY_PT); ensureSpace(16);
  doc.text(`${cs.customer_name_snapshot ?? "—"}${cs.account_number ? `  ·  Account ${cs.account_number}` : ""}`, M, y);
  y += 14;

  // 1. Services and equipment
  section(1, CS_SECTION_ORDER[0]);
  row("Service provider", "OCCTA LIMITED");
  row("Service", cs.plan_name);
  row("Service address", cs.service_address);
  const equipmentLines: string[] = [];
  const oneOff = Array.isArray(cs.one_off_charges_json) ? cs.one_off_charges_json : [];
  const routerCharge = Number(cs.router_charge ?? 0);
  equipmentLines.push(routerCharge > 0
    ? `Router supplied by OCCTA — one-off charge ${fmtMoney(routerCharge)} incl. VAT.`
    : "No router is included. You may use your own compatible router; we provide the connection settings needed.");
  row("Equipment", equipmentLines.join(" "));
  if (cs.digital_voice_warning) row("Digital Voice", String(cs.digital_voice_warning));

  // 2. Speeds of the internet service and remedies
  section(2, CS_SECTION_ORDER[1]);
  const isInternet = cs.service_type === "broadband" || cs.estimated_download_speed != null;
  if (!isInternet) {
    textBlock("Not applicable — this service is not an internet access service.");
  } else {
    row("Estimated speed", `Up to ${cs.estimated_download_speed ?? "—"} Mbps download / up to ${cs.estimated_upload_speed ?? "—"} Mbps upload (estimate, not a guarantee).`);
    const note = String(cs.speed_notes ?? "").split(/\n\n/)[0].trim();
    if (note) textBlock(note.slice(0, 700));
    textBlock("If your speed falls persistently below the estimate shown, contact OCCTA. We will investigate with the access network and set out the remedies available to you, including your statutory and regulatory rights.");
  }

  // 3. Price
  section(3, CS_SECTION_ORDER[2]);
  if (cs.customer_type === "business") {
    row("Recurring price", `${fmtMoney(cs.business_monthly_ex_vat)} per month excl. VAT (${fmtMoney(cs.business_monthly_incl_vat)} incl. VAT)`);
  } else {
    row("Recurring price", `${fmtMoney(cs.monthly_price_incl_vat)} per month (incl. VAT)`);
  }
  row("One-off charges", oneOff.length
    ? oneOff.map((c: any) => `${c.label}: ${fmtMoney(c.amount)}`).join("  ·  ")
    : "None");
  if (cs.price_rise_policy) row("Price changes", String(cs.price_rise_policy));
  if (cs.payment_schedule) row("Billing", String(cs.payment_schedule));

  // 4. Duration, renewal and termination
  section(4, CS_SECTION_ORDER[3]);
  row("Duration", cs.contract_length);
  row("Notice period", cs.notice_period);
  row("Ending or switching", cs.cease_cancellation_charges);

  // 5. Features for end-users with disabilities
  section(5, CS_SECTION_ORDER[4]);
  textBlock(String(cs.vulnerable_customer_note ?? "").trim() ||
    "If you or someone in your household has additional accessibility, medical or vulnerability needs, tell OCCTA and we will discuss the accessibility options and support arrangements available for your service.");

  // 6. Other relevant information
  section(6, CS_SECTION_ORDER[5]);
  textBlock(String(cs.complaints_adr_info ?? "").trim() ||
    "If you have a complaint, contact complaints@occta.co.uk. If we have not resolved it within 6 weeks, or we issue a deadlock letter sooner, you can refer it free of charge to an Alternative Dispute Resolution scheme.");
  textBlock("Complete information about the service, including the detailed terms, is provided in your OCCTA Contract Information & Customer Agreement Pack.");

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(M, H - 38, W - M, H - 38);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(70, 70, 70);
    doc.text(`OCCTA LIMITED · ${cs.cs_number} v${cs.version} · Terms ${cs.terms_version ?? "current"}`, M, H - 24);
    doc.text(cs.is_information_update ? "Information update — original accepted agreement retained" : "Keep this summary with your detailed Contract Information", M, H - 13);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 24, { align: "right" });
  }
  return doc.output("arraybuffer") as unknown as Uint8Array;
}

async function customerOwnsCs(supabase: ReturnType<typeof getServiceClient>, csId: string, userId: string) {
  const { data } = await supabase.from("contract_summaries").select("customer_id").eq("id", csId).maybeSingle();
  return !!data && data.customer_id === userId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({} as any));
  const supabase = getServiceClient();
  let cs: any = null;
  let actorId: string | null = null;
  let internal = false;

  if (body.internal === true && req.headers.get("x-internal-service") === "1") {
    internal = true;
    actorId = body.actor_id ?? null;
    if (!body.contract_summary_id) return jsonResponse({ error: "missing_identifier" }, 400);
    const { data } = await supabase.from("contract_summaries").select("*").eq("id", body.contract_summary_id).maybeSingle();
    cs = data;
  } else if (body.token) {
    const ip = getRequestIp(req) ?? "noip";
    if (!(await checkRateLimit(ip, "cs_pdf_token", 30, 60))) return jsonResponse({ error: "rate_limited" }, 429);
    const hash = await sha256Hex(String(body.token));
    const { data } = await supabase.from("contract_summaries").select("*").eq("public_token_hash", hash).maybeSingle();
    cs = data;
  } else if (body.contract_summary_id) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "missing_jwt" }, 401);
    const { data: u } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!u?.user) return jsonResponse({ error: "invalid_jwt" }, 401);
    actorId = u.user.id;
    const staff = await requireStaff(req);
    const isStaff = !("error" in staff);
    const owns = isStaff ? true : await customerOwnsCs(supabase, body.contract_summary_id, u.user.id);
    if (!owns) return jsonResponse({ error: "forbidden" }, 403);
    const { data } = await supabase.from("contract_summaries").select("*").eq("id", body.contract_summary_id).maybeSingle();
    cs = data;
  } else return jsonResponse({ error: "missing_identifier" }, 400);

  if (!cs) return jsonResponse({ error: "not_found" }, 404);

  // Immutable evidence: once a PDF exists it is never regenerated or replaced.
  let storageKey: string | null = cs.pdf_storage_key ?? null;
  let sha: string | null = cs.pdf_sha256 ?? null;
  let reused = false;

  if (storageKey) {
    reused = true;
    try {
      await supabase.rpc("log_event", {
        _actor_type: internal ? "system" : (actorId ? "user" : "anon"),
        _event_type: "contract_pdf_existing_reused",
        _title: "Existing Contract Summary PDF reused (no regeneration)",
        _details: { pdf_storage_key: storageKey, pdf_sha256: sha, cs_status: cs.status },
        _customer_id: cs.customer_id ?? null,
        _contract_summary_id: cs.id,
        _source_module: "contract_summaries",
        _severity: "info",
      });
    } catch (_) { /* noop */ }
  } else {
    if (cs.status === "accepted") {
      return jsonResponse({ error: "accepted_cs_missing_pdf", details: "Accepted Contract Summary has no stored PDF. Admin investigation required; refusing to generate replacement evidence.", contract_summary_id: cs.id }, 409);
    }
    const bytes = renderPdf(cs);
    sha = await sha256HexFromBytes(bytes);
    const customerId = cs.customer_id ?? "anon";
    storageKey = `${customerId}/${cs.id}/v${cs.version}.pdf`;
    const up = await supabase.storage.from(BUCKET).upload(storageKey, bytes, { contentType: "application/pdf", upsert: false });
    if (up.error) {
      if (/already exists|duplicate/i.test(up.error.message)) return jsonResponse({ error: "storage_object_exists_without_db_link", details: "Storage object already exists for this CS but pdf_storage_key is null. Refusing to overwrite. Admin investigation required.", contract_summary_id: cs.id }, 409);
      return jsonResponse({ error: "upload_failed", details: up.error.message }, 500);
    }
    await supabase.from("contract_summaries").update({ pdf_storage_key: storageKey, pdf_sha256: sha, pdf_generated_at: new Date().toISOString(), pdf_generated_by: actorId }).eq("id", cs.id);
    try {
      await supabase.rpc("log_event", {
        _actor_type: internal ? "system" : (actorId ? "user" : "anon"),
        _event_type: "contract_pdf_generated",
        _title: "Contract Summary PDF generated (first time)",
        _details: { pdf_storage_key: storageKey, pdf_sha256: sha, cs_status: cs.status, information_update: !!cs.is_information_update },
        _customer_id: cs.customer_id ?? null,
        _contract_summary_id: cs.id,
        _source_module: "contract_summaries",
        _severity: "info",
      });
    } catch (_) { /* noop */ }
  }

  const { data: signed, error: sErr } = await supabase.storage.from(BUCKET).createSignedUrl(storageKey!, SIGNED_URL_TTL);
  if (sErr || !signed) return jsonResponse({ error: "sign_failed", details: sErr?.message }, 500);
  return jsonResponse({ ok: true, reused, signed_url: signed.signedUrl, pdf_storage_key: storageKey, pdf_sha256: sha, expires_in: SIGNED_URL_TTL });
});

async function sha256HexFromBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

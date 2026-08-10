import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, requireStaff, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
// @ts-expect-error - npm specifier resolved at runtime
import { jsPDF } from "npm:jspdf@2.5.1";

const BUCKET = "contract-pdfs";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;
const fmtMoney = (n: unknown) => `£${Number(n ?? 0).toFixed(2)}`;

function renderPdf(cs: any): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 38;
  const usable = W - M * 2;
  let y = 32;

  const setNormal = (size = 8.4) => { doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(15, 15, 15); };
  const setBold = (size = 8.4) => { doc.setFont("helvetica", "bold"); doc.setFontSize(size); doc.setTextColor(15, 15, 15); };
  const textBlock = (text: unknown, width = usable, size = 8.4, gap = 2) => {
    setNormal(size);
    const wrapped = doc.splitTextToSize(String(text ?? ""), width) as string[];
    for (const ln of wrapped) { doc.text(ln, M, y); y += size + gap; }
  };
  const row = (label: string, value: unknown) => {
    setBold(8.2); doc.text(label, M, y);
    setNormal(8.2);
    const lines = doc.splitTextToSize(String(value ?? "—"), usable - 132) as string[];
    doc.text(lines, M + 132, y);
    y += Math.max(1, lines.length) * 10.1;
  };
  const section = (title: string) => {
    y += 4;
    doc.setFillColor(245, 245, 245);
    doc.rect(M, y - 9, usable, 16, "F");
    setBold(8.2);
    doc.text(title.toUpperCase(), M + 6, y + 2);
    y += 13;
  };

  // OCCTA brand header.
  doc.setFillColor(255, 226, 0);
  doc.rect(0, 0, W, 72, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold"); doc.setFontSize(21); doc.text("OCCTA", M, 30);
  doc.setFontSize(8.5); doc.text("SIMPLE TELECOM. CLEAR TERMS.", M, 45);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.text("www.occta.co.uk  ·  hello@occta.co.uk  ·  0800 260 6626", M, 58);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  const title = cs.is_information_update ? "CURRENT CONTRACT INFORMATION" : "CONTRACT SUMMARY";
  doc.text(title, W - M, 30, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(`${cs.cs_number}  ·  v${cs.version}`, W - M, 45, { align: "right" });
  doc.text(String(cs.issued_at ?? cs.created_at ?? "").slice(0, 10), W - M, 58, { align: "right" });
  y = 91;

  if (cs.is_information_update) {
    doc.setDrawColor(0); doc.setLineWidth(1.2); doc.rect(M, y - 10, usable, 43);
    setBold(9); doc.text("FOR YOUR RECORDS — NO RE-ACCEPTANCE REQUIRED", M + 8, y + 3);
    y += 15;
    setNormal(7.8);
    const info = doc.splitTextToSize("This is a current-information refresh. It does not replace your original accepted agreement, change your price, or remove any existing customer rights.", usable - 16) as string[];
    doc.text(info, M + 8, y);
    y += info.length * 9 + 9;
  } else {
    setNormal(7.7);
    textBlock("Provided before you agree to the service. It summarises the key price, service, duration and cancellation information. Detailed Contract Information is provided separately before acceptance.", usable, 7.7, 1.7);
    y += 3;
  }

  section("Customer & service");
  row("Customer", cs.customer_name_snapshot);
  if (cs.account_number) row("Account number", cs.account_number);
  row("Service address", cs.service_address);
  row("Plan", cs.plan_name);

  section("Price & one-off charges");
  if (cs.customer_type === "business") {
    row("Monthly ex VAT", fmtMoney(cs.business_monthly_ex_vat));
    row("Monthly incl VAT", fmtMoney(cs.business_monthly_incl_vat));
  } else row("Monthly incl VAT", fmtMoney(cs.monthly_price_incl_vat));
  const oneOff = Array.isArray(cs.one_off_charges_json) ? cs.one_off_charges_json : [];
  if (oneOff.length) {
    row("One-off charges", oneOff.map((c: any) => `${c.label}: ${fmtMoney(c.amount)}`).join("  ·  "));
  } else row("One-off charges", "£0.00");

  section("Service, speed & duration");
  row("Estimated speed", `${cs.estimated_download_speed ?? "—"} Mbps download / ${cs.estimated_upload_speed ?? "—"} Mbps upload`);
  row("Contract", cs.contract_length);
  row("Notice", cs.notice_period);
  if (cs.speed_notes) {
    const firstSentence = String(cs.speed_notes).split(/\n\n|\n/)[0].trim();
    if (firstSentence) row("Speed note", firstSentence.slice(0, 420));
  }

  section("Ending or switching the service");
  textBlock(cs.cease_cancellation_charges || "Any applicable ending charges are shown in your service-specific Contract Information.", usable, 7.9, 1.8);

  section("Price changes & payment");
  textBlock(cs.price_rise_policy || "Any price-change rights are set out in the Contract Information.", usable, 7.7, 1.6);
  y += 2;
  textBlock(cs.payment_schedule || "Billing and collection timing is confirmed before service starts.", usable, 7.7, 1.6);

  if (cs.digital_voice_warning) {
    section("Digital Voice — important");
    textBlock(cs.digital_voice_warning, usable, 7.4, 1.4);
  }

  section("Help, complaints & your rights");
  const complaint = String(cs.complaints_adr_info ?? "Contact OCCTA if you need help or wish to complain.");
  textBlock(complaint, usable, 7.3, 1.4);

  // Keep a normal single-service summary to one page. If exceptionally long
  // legacy text reaches the footer area, use compact continuation rather than
  // truncating contractual wording.
  if (y > H - 72) {
    doc.addPage();
    y = M;
    setBold(10); doc.text("CONTRACT SUMMARY — CONTINUED", M, y); y += 18;
    setNormal(8); doc.text("Continuation created only because the stored service information exceeded the standard summary layout.", M, y);
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(M, H - 38, W - M, H - 38);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.2); doc.setTextColor(80, 80, 80);
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

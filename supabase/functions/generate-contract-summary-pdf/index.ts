import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, requireStaff, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
// @ts-ignore - npm specifier resolved at runtime
import { jsPDF } from "npm:jspdf@2.5.1";

const BUCKET = "contract-pdfs";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

function fmtMoney(n: unknown): string { return `£${Number(n ?? 0).toFixed(2)}`; }

function renderPdf(cs: any): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;

  const line = (text: string, opts?: { bold?: boolean; size?: number; gap?: number }) => {
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.size ?? 10);
    const wrapped = doc.splitTextToSize(text, W - M * 2) as string[];
    for (const ln of wrapped) {
      if (y > H - M) { doc.addPage(); y = M; }
      doc.text(ln, M, y);
      y += (opts?.size ?? 10) + (opts?.gap ?? 4);
    }
  };
  const heading = (t: string) => {
    y += 6;
    line(t, { bold: true, size: 12, gap: 6 });
    doc.setDrawColor(0); doc.setLineWidth(1);
    doc.line(M, y - 2, W - M, y - 2);
    y += 6;
  };
  const kv = (k: string, v: string) => {
    if (y > H - M) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(k, M, y);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(v, W - M * 2 - 140) as string[];
    doc.text(wrapped, M + 140, y);
    y += 14 * Math.max(1, wrapped.length);
  };

  // Header
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text("OCCTA Ltd — Contract Summary", M, y); y += 22;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`${cs.cs_number} · Version ${cs.version} · Status: ${cs.status}`, M, y); y += 16;

  heading("Customer & Service");
  kv("Customer", `${cs.customer_name_snapshot} (${cs.customer_email_snapshot})`);
  if (cs.account_number) kv("Account number", String(cs.account_number));
  kv("Service address", String(cs.service_address ?? ""));
  kv("Plan", `${cs.plan_name} (${cs.plan_type}, ${cs.customer_type})`);
  kv("Contract length", String(cs.contract_length ?? ""));
  kv("Notice period", String(cs.notice_period ?? ""));

  heading("Pricing");
  if (cs.customer_type === "business") {
    kv("Monthly (ex VAT)", fmtMoney(cs.business_monthly_ex_vat));
    kv("Monthly (incl VAT)", fmtMoney(cs.business_monthly_incl_vat));
  } else {
    kv("Monthly (incl VAT)", fmtMoney(cs.monthly_price_incl_vat));
  }
  const oneOff = (cs.one_off_charges_json as Array<{label:string;amount:number}> | null) ?? [];
  if (oneOff.length) {
    line("One-off charges:", { bold: true, gap: 2 });
    for (const c of oneOff) kv(c.label, fmtMoney(c.amount));
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
    if (cs.accepted_ip) kv("IP", String(cs.accepted_ip));
  }

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`OCCTA Ltd · www.occta.co.uk · ${cs.cs_number} v${cs.version}`, M, H - 24);
    doc.text(`Page ${i} of ${pages}`, W - M - 60, H - 24);
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

  // Resolve target CS + access mode
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
    // Authed path: customer (owns it) OR staff
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
  } else {
    return jsonResponse({ error: "missing_identifier" }, 400);
  }

  if (!cs) return jsonResponse({ error: "not_found" }, 404);

  // If PDF already stored, just re-sign and return (immutability after acceptance, and avoid wasted work).
  let storageKey: string | null = cs.pdf_storage_key ?? null;
  let sha: string | null = cs.pdf_sha256 ?? null;

  if (!storageKey) {
    // Generate fresh
    const bytes = renderPdf(cs);
    sha = await sha256HexFromBytes(bytes);
    const customerId = cs.customer_id ?? "anon";
    storageKey = `${customerId}/${cs.id}/v${cs.version}.pdf`;
    const up = await supabase.storage.from(BUCKET).upload(storageKey, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (up.error && !/already exists/i.test(up.error.message)) {
      return jsonResponse({ error: "upload_failed", details: up.error.message }, 500);
    }
    await supabase.from("contract_summaries").update({
      pdf_storage_key: storageKey,
      pdf_sha256: sha,
      pdf_generated_at: new Date().toISOString(),
      pdf_generated_by: actorId,
    }).eq("id", cs.id);
  }

  const { data: signed, error: sErr } = await supabase.storage.from(BUCKET).createSignedUrl(storageKey!, SIGNED_URL_TTL);
  if (sErr || !signed) return jsonResponse({ error: "sign_failed", details: sErr?.message }, 500);

  return jsonResponse({
    ok: true,
    signed_url: signed.signedUrl,
    pdf_storage_key: storageKey,
    pdf_sha256: sha,
    expires_in: SIGNED_URL_TTL,
  });
});

async function sha256HexFromBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
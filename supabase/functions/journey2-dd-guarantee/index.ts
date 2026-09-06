import { jsPDF } from "npm:jspdf@2.5.1";
import { corsHeaders, getServiceClient, sha256Hex, jsonResponse } from "../_shared/quoteHelpers.ts";
import { DD_GUARANTEE_TEXT, providerGuaranteeText } from "../_shared/directDebitGuarantee.ts";

function safeFilePart(value: string | null | undefined): string {
  return String(value ?? "order").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "order";
}

function renderGuarantee(opts: {
  orderNumber: string | null;
  customerName: string;
  bankName: string | null;
  accountLast4: string | null;
  sortLast2: string | null;
  billingDay: number | null;
  ddStatus: string | null;
  providerName: string | null;
  serviceUserNumber: string | null;
  guaranteeText: string;
}): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const margin = 48;
  const bodyWidth = width - margin * 2;
  let y = 54;

  const ensure = (needed = 24) => {
    if (y + needed > 790) {
      doc.addPage();
      y = 54;
    }
  };
  const line = (label: string, value: string) => {
    ensure(18);
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 135, y);
    y += 17;
  };
  const para = (text: string) => {
    const lines = doc.splitTextToSize(text, bodyWidth);
    for (const l of lines) {
      ensure(14);
      doc.text(l, margin, y);
      y += 13;
    }
    y += 7;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("OCCTA DIRECT DEBIT GUARANTEE", margin, y);
  y += 28;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })} (Europe/London)`, margin, y);
  y += 25;

  doc.setDrawColor(0);
  doc.setLineWidth(1.5);
  doc.rect(margin, y - 10, bodyWidth, 118);
  y += 10;
  doc.setFontSize(10);
  line("Order", opts.orderNumber ?? "OCCTA order");
  line("Account holder", opts.customerName || "Customer");
  line("Bank", opts.bankName || "Recorded bank");
  line("Account", opts.accountLast4 ? `••••${opts.accountLast4}` : "Masked in OCCTA records");
  line("Sort code", opts.sortLast2 ? `••-••-${opts.sortLast2}` : "Masked in OCCTA records");
  line("Billing day", opts.billingDay ? `${opts.billingDay} of each month` : "As agreed in your order");
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("The Direct Debit Guarantee", margin, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const p of opts.guaranteeText.split(/\n\n+/)) para(p);

  if (opts.providerName || opts.serviceUserNumber) {
    ensure(50);
    doc.setFont("helvetica", "bold");
    doc.text("Collection details", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    if (opts.providerName) para(`Collection provider: ${opts.providerName}.`);
    if (opts.serviceUserNumber) para(`Service User Number: ${opts.serviceUserNumber}.`);
  }

  ensure(45);
  doc.setFontSize(8.5);
  doc.setTextColor(80);
  para("Security note: this downloadable copy deliberately shows only masked bank details. OCCTA does not expose the full account number or sort code in customer document links.");
  doc.setTextColor(0);

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return jsonResponse({ error: "method_not_allowed" }, 405);

  let token = "";
  if (req.method === "GET") {
    token = new URL(req.url).searchParams.get("token")?.trim() ?? "";
  } else {
    const body = await req.json().catch(() => ({} as { token?: string }));
    token = String(body?.token ?? "").trim();
  }
  if (token.length < 16) return jsonResponse({ error: "invalid_token" }, 400);

  const supabase = getServiceClient();
  const tokenHash = await sha256Hex(token);
  const { data: session } = await supabase
    .from("customer_journey_sessions")
    .select("id, order_id, status, completed_at, customer_details, dd_masked, billing_anchor_day, dd_status")
    .eq("public_token_hash", tokenHash)
    .maybeSingle();

  if (!session) return jsonResponse({ error: "session_not_found" }, 404);
  if (!session.order_id || !session.completed_at) return jsonResponse({ error: "order_not_completed" }, 409);

  const { data: order } = await supabase
    .from("orders")
    .select("occta_order_number")
    .eq("id", session.order_id)
    .maybeSingle();

  const { data: provider } = await supabase
    .from("dd_providers")
    .select("display_name, legal_collection_name, service_user_number, advance_notice_working_days")
    .eq("enabled", true)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();

  const details = (session.customer_details ?? {}) as Record<string, unknown>;
  const masked = (session.dd_masked ?? {}) as Record<string, unknown>;
  const guaranteeText = provider
    ? providerGuaranteeText({
        legal_collection_name: String(provider.legal_collection_name),
        service_user_number: String(provider.service_user_number),
        advance_notice_working_days: Number(provider.advance_notice_working_days),
      })
    : DD_GUARANTEE_TEXT;

  const orderNumber = order?.occta_order_number ?? null;
  const pdf = renderGuarantee({
    orderNumber,
    customerName: String(details.full_name ?? "Customer"),
    bankName: masked.bank_name ? String(masked.bank_name) : null,
    accountLast4: masked.last4 ? String(masked.last4) : null,
    sortLast2: masked.sort_last2 ? String(masked.sort_last2) : null,
    billingDay: session.billing_anchor_day ? Number(session.billing_anchor_day) : null,
    ddStatus: session.dd_status ? String(session.dd_status) : null,
    providerName: provider?.display_name ? String(provider.display_name) : provider?.legal_collection_name ? String(provider.legal_collection_name) : null,
    serviceUserNumber: provider?.service_user_number ? String(provider.service_user_number) : null,
    guaranteeText,
  });

  return new Response(pdf, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="OCCTA-${safeFilePart(orderNumber)}-Direct-Debit-Guarantee.pdf"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

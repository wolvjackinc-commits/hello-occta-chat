// OCCTA invoice and payment-receipt layout.
//
// One renderer for every bill we produce: the PDFs the billing workers store
// and email, admin re-generation, and the customer/admin "Download PDF"
// buttons in the web app. It takes a jsPDF document and draws on it, so the
// server (esm.sh jspdf) and browser (npm jspdf) render identical documents.
// Its only import is paymentOptions.ts, which is also runtime-neutral, so it
// stays loadable from both Deno and Vite.
//
// All money is in minor units (pence). Text sticks to WinAnsi characters so
// jsPDF's built-in Helvetica renders it (no arrows, ticks or emoji).

import { bankTransferLines, bankTransferReference, DD_NOT_COLLECTING_TEXT, paymentMethodLabel } from "./paymentOptions.ts";

/** The jsPDF methods this layout uses. */
export interface PdfDoc {
  internal: { pageSize: { getWidth(): number; getHeight(): number } };
  setFillColor(r: number, g: number, b: number): unknown;
  setDrawColor(r: number, g: number, b: number): unknown;
  setTextColor(r: number, g: number, b: number): unknown;
  setFont(name: string, style?: string): unknown;
  setFontSize(size: number): unknown;
  setLineWidth(width: number): unknown;
  text(text: string | string[], x: number, y: number, options?: Record<string, unknown>): unknown;
  rect(x: number, y: number, w: number, h: number, style?: string): unknown;
  roundedRect(x: number, y: number, w: number, h: number, rx: number, ry: number, style?: string): unknown;
  line(x1: number, y1: number, x2: number, y2: number): unknown;
  circle(x: number, y: number, r: number, style?: string): unknown;
  splitTextToSize(text: string, maxWidth: number): string[];
  getTextWidth(text: string): number;
  addPage(): unknown;
  getNumberOfPages(): number;
  setPage(page: number): unknown;
  setProperties(props: Record<string, string>): unknown;
}

// ── Company details (keep in step with src/lib/companyConfig.ts; a unit test checks) ──
export const OCCTA_COMPANY = {
  legalName: "OCCTA Limited",
  companyNumber: "13828933",
  vatNumber: "520 6072 30",
  vatEffectiveDate: "2026-07-01",
  addressOneLine: "22 Pavilion View, Huddersfield, HD3 3WU",
  phone: "0800 260 6626",
  phoneHours: "Mon–Fri, 8am–6pm",
  email: "hello@occta.co.uk",
  website: "www.occta.co.uk",
  dashboardUrl: "www.occta.co.uk/dashboard",
} as const;

export interface BillLine {
  description: string;
  /** Service period or charge basis shown under the description. */
  period?: string | null;
  qty?: number;
  netMinor: number;
  vatMinor: number;
  grossMinor: number;
  vatRate: number;
  kind?: "recurring" | "one_off" | "credit";
}

export interface InvoiceDocument {
  invoiceNumber: string;
  accountNumber?: string | null;
  issueDate: string;
  dueDate?: string | null;
  periodStart?: string | null;
  /** Exclusive end (next anchor date), as stored on invoices. */
  periodEndExclusive?: string | null;
  status?: string | null;
  customer: {
    name: string;
    email?: string | null;
    companyName?: string | null;
    vatNumber?: string | null;
    addressLines?: (string | null | undefined)[];
  };
  service?: { planName?: string | null; serviceAddress?: string | null } | null;
  lines: BillLine[];
  subtotalMinor: number;
  vatMinor: number;
  totalMinor: number;
  vatRate: number;
  /** Payments already received against this invoice. */
  amountPaidMinor?: number;
  payment?: {
    method?: "direct_debit" | "card" | "invoice_link" | "phone" | "other" | string | null;
    ddActive?: boolean;
    bankLast4?: string | null;
    mandateReference?: string | null;
  } | null;
  notes?: string | null;
}

export interface ReceiptDocument {
  receiptNumber: string;
  paidAt: string;
  amountMinor: number;
  method: string;
  transactionReference?: string | null;
  paymentReference?: string | null;
  invoiceNumber?: string | null;
  contractSummaryNumber?: string | null;
  planName?: string | null;
  customer: { name: string; email?: string | null; accountNumber?: string | null };
}

// ── Palette (brand: black / OCCTA yellow / paper) ──
type RGB = [number, number, number];
const INK: RGB = [13, 13, 13];
const YELLOW: RGB = [255, 222, 0];
const PAPER: RGB = [246, 246, 241];
const RULE: RGB = [222, 222, 214];
const MUTED: RGB = [96, 96, 96];
const SOFT: RGB = [150, 150, 150];
const WHITE: RGB = [255, 255, 255];
const GREEN: RGB = [21, 128, 61];
const GREEN_BG: RGB = [236, 248, 240];

const MARGIN = 16;
const FOOTER_SPACE = 26;

// ── Formatting ──
const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

export function fmtMoney(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minor));
  const pounds = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}£${pounds}.${String(abs % 100).padStart(2, "0")}`;
}

export function fmtLongDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00Z");
  if (isNaN(d.getTime())) return String(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  if (isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}

/** The stored exclusive period end as the last day actually covered. */
function inclusiveEnd(endExclusiveIso: string): string {
  const d = new Date(endExclusiveIso.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function fmtDateTimeLondon(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  try {
    const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" }).format(d);
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
    return `${date} at ${time}`;
  } catch {
    return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  }
}

export function isVatApplicable(issueDateIso: string | null | undefined): boolean {
  if (!issueDateIso) return false;
  return String(issueDateIso).slice(0, 10) >= OCCTA_COMPANY.vatEffectiveDate;
}

// OCCTA accepts Direct Debit or bank transfer only (see paymentOptions.ts).
// Retired card / invoice-link / phone values print as Bank transfer.
function methodLabel(method: string | null | undefined, ddActive?: boolean | null): string {
  return paymentMethodLabel(method, ddActive);
}

// A receipt records how money was actually received, so historic card and
// phone payments keep their real label.
function receiptMethodLabel(method: string | null | undefined): string {
  switch (method) {
    case "direct_debit": return "Direct Debit";
    case "bank_transfer": case "manual_bank_transfer": return "Bank transfer";
    case "card": case "invoice_link": case "worldpay": return "Card";
    case "phone": return "Card by phone";
    default: return method ? method.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Bank transfer";
  }
}

// ── Building lines from stored data ──

/**
 * Split "Plan — monthly service (1 Jun 2026 to 30 Jun 2026 (billed in advance))"
 * into description and period: the billing workers append the period in a
 * trailing bracket. Only a bracket that looks like a period/charge basis is
 * split off, so plan names such as "Superfast (FTTP)" stay whole.
 */
export function splitStoredDescription(s: string): { description: string; period: string | null } {
  const text = String(s ?? "").trim();
  if (!text.endsWith(")")) return { description: text, period: null };
  let depth = 0;
  for (let i = text.length - 1; i >= 0; i--) {
    const c = text[i];
    if (c === ")") depth++;
    else if (c === "(") {
      depth--;
      if (depth === 0) {
        const inner = text.slice(i + 1, -1).trim();
        const head = text.slice(0, i).trim();
        if (head && (/\d/.test(inner) || /one-off|billed in advance/i.test(inner))) {
          return { description: head, period: inner };
        }
        return { description: text, period: null };
      }
    }
  }
  return { description: text, period: null };
}

/** invoice_lines rows (gross line totals) → bill lines with VAT split out. */
export function billLinesFromStored(
  rows: Array<{ description?: string | null; qty?: number | null; line_total?: number | string | null; vat_rate?: number | string | null }>,
  opts: { vatEnabled: boolean; defaultVatRate: number },
): BillLine[] {
  return rows.map((r) => {
    const grossMinor = Math.round(Number(r.line_total ?? 0) * 100);
    const rawRate = r.vat_rate == null ? opts.defaultVatRate : Number(r.vat_rate);
    const rate = opts.vatEnabled ? (rawRate > 0 && rawRate <= 1 ? rawRate * 100 : rawRate) : 0;
    const netMinor = rate ? Math.round(grossMinor / (1 + rate / 100)) : grossMinor;
    const { description, period } = splitStoredDescription(r.description ?? "");
    return {
      description,
      period,
      qty: Number(r.qty ?? 1) || 1,
      netMinor,
      vatMinor: grossMinor - netMinor,
      grossMinor,
      vatRate: rate,
    };
  });
}

function lineKind(l: BillLine): "recurring" | "one_off" | "credit" {
  if (l.kind) return l.kind;
  if (l.grossMinor < 0) return "credit";
  if (l.period && /one-off/i.test(l.period)) return "one_off";
  if (l.period && /\d/.test(l.period)) return "recurring";
  return "one_off";
}

// ── Drawing primitives ──

function fill(doc: PdfDoc, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function stroke(doc: PdfDoc, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }
function ink(doc: PdfDoc, c: RGB) { doc.setTextColor(c[0], c[1], c[2]); }
function font(doc: PdfDoc, style: "normal" | "bold", size: number) {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
}

/** Brand mark (yellow tile, offset black shadow) + OCCTA wordmark. */
function drawLogo(doc: PdfDoc, x: number, y: number, size = 11) {
  fill(doc, INK);
  doc.rect(x + size * 0.12, y + size * 0.12, size, size, "F");
  fill(doc, YELLOW);
  stroke(doc, INK);
  doc.setLineWidth(0.5);
  doc.rect(x, y, size, size, "FD");
  ink(doc, INK);
  font(doc, "bold", size * 1.75);
  doc.text("O", x + size / 2, y + size * 0.72, { align: "center" });
  font(doc, "bold", size * 1.85);
  doc.text("OCCTA", x + size + 4.5, y + size * 0.62);
  font(doc, "bold", 6.5);
  ink(doc, MUTED);
  doc.text("TELECOM", x + size + 4.7, y + size * 1.02, { charSpace: 1.6 });
}

function label(doc: PdfDoc, text: string, x: number, y: number, color: RGB = MUTED, align: "left" | "right" | "center" = "left") {
  font(doc, "bold", 6.8);
  ink(doc, color);
  doc.text(text.toUpperCase(), x, y, { align, charSpace: 0.6 });
}

function sectionTitle(doc: PdfDoc, text: string, x: number, y: number) {
  fill(doc, YELLOW);
  doc.rect(x, y - 3.4, 2.2, 4.2, "F");
  font(doc, "bold", 11.5);
  ink(doc, INK);
  doc.text(text, x + 4.5, y);
}

function drawFooters(doc: PdfDoc, showVat: boolean) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    stroke(doc, RULE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, h - 17, w - MARGIN, h - 17);
    font(doc, "normal", 6.8);
    ink(doc, SOFT);
    const legal = `${OCCTA_COMPANY.legalName} · Registered in England & Wales, company no. ${OCCTA_COMPANY.companyNumber}` +
      (showVat ? ` · VAT reg. no. ${OCCTA_COMPANY.vatNumber}` : "");
    doc.text(legal, MARGIN, h - 12.5);
    doc.text(`Registered office: ${OCCTA_COMPANY.addressOneLine} · ${OCCTA_COMPANY.website}`, MARGIN, h - 9);
    font(doc, "bold", 6.8);
    ink(doc, MUTED);
    doc.text(`Page ${p} of ${pages}`, w - MARGIN, h - 12.5, { align: "right" });
  }
}

/** Cursor that starts a new page (with a slim header) when space runs out. */
class Flow {
  y: number;
  constructor(private doc: PdfDoc, y: number, private continuation: string) { this.y = y; }
  get bottom() { return this.doc.internal.pageSize.getHeight() - FOOTER_SPACE; }
  ensure(height: number): boolean {
    if (this.y + height <= this.bottom) return false;
    this.doc.addPage();
    drawLogo(this.doc, MARGIN, 12, 8);
    font(this.doc, "normal", 8.5);
    ink(this.doc, MUTED);
    this.doc.text(this.continuation, this.doc.internal.pageSize.getWidth() - MARGIN, 18, { align: "right" });
    fill(this.doc, YELLOW);
    this.doc.rect(MARGIN, 25, this.doc.internal.pageSize.getWidth() - 2 * MARGIN, 0.9, "F");
    this.y = 34;
    return true;
  }
}

// ── Invoice ──

export function drawInvoice(doc: PdfDoc, inv: InvoiceDocument): void {
  const W = doc.internal.pageSize.getWidth();
  const right = W - MARGIN;
  const showVat = isVatApplicable(inv.issueDate);
  const isCancelled = inv.status === "cancelled";
  const paidMinor = Math.max(0, Math.round(inv.amountPaidMinor ?? 0));
  const isPaid = inv.status === "paid" || (inv.totalMinor > 0 && paidMinor >= inv.totalMinor);
  const balanceMinor = isPaid || isCancelled ? 0 : Math.max(0, inv.totalMinor - paidMinor);
  const title = showVat && inv.vatMinor !== 0 ? "VAT INVOICE" : "INVOICE";
  const method = inv.payment?.method ?? null;
  const ddCollects = method === "direct_debit" && !!inv.payment?.ddActive;

  doc.setProperties({
    title: `OCCTA invoice ${inv.invoiceNumber}`,
    subject: `Invoice ${inv.invoiceNumber}`,
    author: OCCTA_COMPANY.legalName,
    creator: OCCTA_COMPANY.legalName,
  });

  // Header
  drawLogo(doc, MARGIN, 13);
  font(doc, "bold", 19);
  ink(doc, INK);
  doc.text(title, right, 20.5, { align: "right" });
  font(doc, "normal", 9);
  ink(doc, MUTED);
  doc.text(`No. ${inv.invoiceNumber}`, right, 26.5, { align: "right" });
  fill(doc, YELLOW);
  doc.rect(MARGIN, 32, W - 2 * MARGIN, 1.4, "F");

  // Bill-to (left) and key facts (right)
  let y = 43;
  label(doc, "Bill to", MARGIN, y);
  y += 5.5;
  font(doc, "bold", 11);
  ink(doc, INK);
  doc.text(inv.customer.name || "Customer", MARGIN, y);
  font(doc, "normal", 9);
  ink(doc, INK);
  const addr = [inv.customer.companyName, ...(inv.customer.addressLines ?? [])]
    .map((s) => (s ?? "").trim()).filter(Boolean);
  for (const a of addr.slice(0, 6)) { y += 4.6; doc.text(a, MARGIN, y); }
  if (inv.customer.vatNumber) { y += 4.6; ink(doc, MUTED); doc.text(`VAT no. ${inv.customer.vatNumber}`, MARGIN, y); }
  if (inv.customer.email) { y += 4.6; ink(doc, MUTED); doc.text(inv.customer.email, MARGIN, y); }
  const leftBottom = y;

  const facts: [string, string][] = [
    ["Account number", inv.accountNumber || "–"],
    ["Invoice number", inv.invoiceNumber],
    [showVat ? "Invoice date / tax point" : "Invoice date", fmtLongDate(inv.issueDate)],
  ];
  if (inv.periodStart && inv.periodEndExclusive) {
    facts.push(["Billing period", `${fmtShortDate(inv.periodStart)} – ${fmtShortDate(inclusiveEnd(inv.periodEndExclusive))}`]);
  }
  facts.push(["Payment due", inv.dueDate ? fmtLongDate(inv.dueDate) : "On receipt"]);
  facts.push(["Payment method", methodLabel(method, method === "direct_debit" ? !!inv.payment?.ddActive : null)]);
  const boxX = 112, boxW = right - boxX, rowH = 6.4;
  const boxH = facts.length * rowH + 5;
  fill(doc, PAPER);
  doc.roundedRect(boxX, 38.5, boxW, boxH, 2, 2, "F");
  facts.forEach(([k, v], i) => {
    const ry = 44.5 + i * rowH;
    font(doc, "normal", 8);
    ink(doc, MUTED);
    doc.text(k, boxX + 4, ry);
    font(doc, "bold", 8.5);
    ink(doc, INK);
    doc.text(v, boxX + boxW - 4, ry, { align: "right" });
    if (i < facts.length - 1) {
      stroke(doc, RULE);
      doc.setLineWidth(0.2);
      doc.line(boxX + 4, ry + 2.4, boxX + boxW - 4, ry + 2.4);
    }
  });
  y = Math.max(leftBottom, 38.5 + boxH) + 8;

  // Summary panel
  const panelH = 34;
  fill(doc, INK);
  doc.roundedRect(MARGIN, y, W - 2 * MARGIN, panelH, 2.5, 2.5, "F");
  fill(doc, YELLOW);
  doc.rect(MARGIN, y + 6, 1.6, panelH - 12, "F");
  const headline = isCancelled ? "INVOICE CANCELLED" : isPaid ? "PAID IN FULL" : paidMinor > 0 ? "BALANCE TO PAY" : "TOTAL TO PAY";
  label(doc, headline, MARGIN + 8, y + 9, YELLOW);
  font(doc, "bold", 26);
  ink(doc, WHITE);
  doc.text(fmtMoney(isPaid || isCancelled ? inv.totalMinor : balanceMinor), MARGIN + 8, y + 21);
  font(doc, "normal", 8.2);
  ink(doc, [210, 210, 210]);
  const due = inv.dueDate ? fmtLongDate(inv.dueDate) : "on receipt";
  const sub = isCancelled ? "This invoice has been cancelled. Nothing is due."
    : isPaid ? "Thank you, this invoice has been paid. Nothing more to pay."
    : ddCollects ? `Collected by Direct Debit on or after ${due}.`
    : `Please pay by ${due}.`;
  const bx = 120;
  const subLines = doc.splitTextToSize(sub, bx - 6 - (MARGIN + 8) - 4).slice(0, 2);
  doc.text(subLines, MARGIN + 8, subLines.length > 1 ? y + 26.6 : y + 28.5);

  // Breakdown on the right of the panel
  const groups = { recurring: 0, one_off: 0, credit: 0 };
  for (const l of inv.lines) groups[lineKind(l)] += l.grossMinor;
  const breakdown: [string, number][] = [];
  if (groups.recurring) breakdown.push(["Monthly charges", groups.recurring]);
  if (groups.one_off) breakdown.push(["One-off charges", groups.one_off]);
  if (groups.credit) breakdown.push(["Credits", groups.credit]);
  if (paidMinor > 0 && !isPaid) breakdown.push(["Already paid", -paidMinor]);
  if (inv.vatMinor) breakdown.push([`Includes VAT at ${inv.vatRate}%`, inv.vatMinor]);
  stroke(doc, [60, 60, 60]);
  doc.setLineWidth(0.3);
  doc.line(bx - 6, y + 6, bx - 6, y + panelH - 6);
  breakdown.slice(0, 4).forEach(([k, v], i) => {
    const by = y + 10 + i * 6;
    font(doc, "normal", 8.2);
    ink(doc, [190, 190, 190]);
    doc.text(k, bx, by);
    font(doc, "bold", 8.6);
    ink(doc, WHITE);
    doc.text(fmtMoney(v), right - 7, by, { align: "right" });
  });
  y += panelH + 7;

  // Service strip
  const svcBits = [
    inv.service?.planName ? `Plan: ${inv.service.planName}` : "",
    inv.service?.serviceAddress ? `Service address: ${inv.service.serviceAddress}` : "",
  ].filter(Boolean);
  if (svcBits.length) {
    font(doc, "normal", 8.2);
    const strip = doc.splitTextToSize(svcBits.join("   ·   "), W - 2 * MARGIN - 8);
    const sh = 4 + strip.length * 3.8;
    stroke(doc, RULE);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, W - 2 * MARGIN, sh, 1.5, 1.5, "D");
    ink(doc, INK);
    doc.text(strip, MARGIN + 4, y + 4.6);
    y += sh + 7;
  }

  // Charges table
  const flow = new Flow(doc, y, `Invoice ${inv.invoiceNumber} (continued)`);
  const col = { desc: MARGIN + 3, rate: 128, net: 150, vat: 170, total: right - 3 };
  const descWidth = col.rate - col.desc - 14;
  const drawTableHeader = () => {
    fill(doc, INK);
    doc.rect(MARGIN, flow.y, W - 2 * MARGIN, 7.5, "F");
    font(doc, "bold", 7.6);
    ink(doc, WHITE);
    const hy = flow.y + 4.9;
    doc.text("DESCRIPTION", col.desc, hy);
    doc.text("VAT RATE", col.rate, hy, { align: "right" });
    doc.text("NET", col.net, hy, { align: "right" });
    doc.text("VAT", col.vat, hy, { align: "right" });
    doc.text("TOTAL", col.total, hy, { align: "right" });
    flow.y += 7.5;
  };
  flow.ensure(30);
  sectionTitle(doc, "Your charges in detail", MARGIN, flow.y);
  flow.y += 5;
  drawTableHeader();

  inv.lines.forEach((l, i) => {
    font(doc, "bold", 8.6);
    const qty = l.qty && l.qty !== 1 ? `${l.qty} x ` : "";
    const descLines = doc.splitTextToSize(qty + l.description, descWidth);
    font(doc, "normal", 7.4);
    const periodLines = l.period ? doc.splitTextToSize(l.period, descWidth) : [];
    const rowH = 2.4 + descLines.length * 3.9 + periodLines.length * 3.3 + 1.8;
    if (flow.ensure(rowH)) drawTableHeader();
    if (i % 2 === 1) {
      fill(doc, PAPER);
      doc.rect(MARGIN, flow.y, W - 2 * MARGIN, rowH, "F");
    }
    let ty = flow.y + 4.8;
    font(doc, "bold", 8.6);
    ink(doc, l.grossMinor < 0 ? GREEN : INK);
    doc.text(descLines, col.desc, ty);
    font(doc, "normal", 8.6);
    ink(doc, INK);
    doc.text(`${l.vatRate}%`, col.rate, ty, { align: "right" });
    doc.text(fmtMoney(l.netMinor), col.net, ty, { align: "right" });
    doc.text(fmtMoney(l.vatMinor), col.vat, ty, { align: "right" });
    font(doc, "bold", 8.6);
    doc.text(fmtMoney(l.grossMinor), col.total, ty, { align: "right" });
    ty += descLines.length * 3.9 - 0.4;
    if (periodLines.length) {
      font(doc, "normal", 7.4);
      ink(doc, MUTED);
      doc.text(periodLines, col.desc, ty);
    }
    flow.y += rowH;
  });
  stroke(doc, INK);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, flow.y, right, flow.y);
  flow.y += 6;

  // VAT summary (left) and totals (right)
  const rates = new Map<number, { net: number; vat: number }>();
  for (const l of inv.lines) {
    const r = rates.get(l.vatRate) ?? { net: 0, vat: 0 };
    r.net += l.netMinor; r.vat += l.vatMinor;
    rates.set(l.vatRate, r);
  }
  // A single rate uses the invoice's own stored totals (exact to the penny).
  if (rates.size === 1) {
    const [only] = rates.keys();
    rates.set(only, { net: inv.subtotalMinor, vat: inv.vatMinor });
  }
  const totals: [string, number, boolean][] = [
    ["Total excluding VAT", inv.subtotalMinor, false],
    [`VAT${inv.vatRate ? ` at ${inv.vatRate}%` : ""}`, inv.vatMinor, false],
    ["Total including VAT", inv.totalMinor, true],
  ];
  if (paidMinor > 0) {
    totals.push(["Payments received", -Math.min(paidMinor, inv.totalMinor), false]);
    totals.push(["Balance to pay", balanceMinor, true]);
  }
  const blockH = Math.max(totals.length * 6.6 + 4, rates.size * 5.5 + 14);
  flow.ensure(blockH);
  const ty0 = flow.y;

  if (showVat) {
    label(doc, "VAT summary", MARGIN, ty0 + 2);
    font(doc, "bold", 7.4);
    ink(doc, MUTED);
    doc.text("Rate", MARGIN, ty0 + 8);
    doc.text("Net", MARGIN + 38, ty0 + 8, { align: "right" });
    doc.text("VAT", MARGIN + 62, ty0 + 8, { align: "right" });
    let ry = ty0 + 13;
    for (const [rate, v] of rates) {
      font(doc, "normal", 8.2);
      ink(doc, INK);
      doc.text(`${rate}%`, MARGIN, ry);
      doc.text(fmtMoney(v.net), MARGIN + 38, ry, { align: "right" });
      doc.text(fmtMoney(v.vat), MARGIN + 62, ry, { align: "right" });
      ry += 5.5;
    }
  }

  const tx = 118;
  totals.forEach(([k, v, strong], i) => {
    const ry = ty0 + 2 + i * 6.6;
    if (strong) {
      fill(doc, i === totals.length - 1 ? YELLOW : PAPER);
      doc.rect(tx - 3, ry - 4.4, right - tx + 3, 6.4, "F");
    }
    font(doc, strong ? "bold" : "normal", strong ? 9.4 : 8.6);
    ink(doc, INK);
    doc.text(k, tx, ry);
    doc.text(fmtMoney(v), right - 3, ry, { align: "right" });
  });
  flow.y = ty0 + blockH + 4;

  // How to pay + help, side by side
  const colW = (W - 2 * MARGIN - 6) / 2;
  const payText: string[] = [];
  let payTitle = "How to pay";
  if (isCancelled) {
    payTitle = "Nothing to pay";
    payText.push("This invoice has been cancelled, so no payment is due.");
  } else if (isPaid) {
    payTitle = "Payment received";
    payText.push("This invoice has been paid in full. Thank you.", "Your receipt is available in your online account.");
  } else if (ddCollects) {
    payTitle = "Direct Debit – no action needed";
    const acct = inv.payment?.bankLast4 ? ` from your account ending ${inv.payment.bankLast4}` : "";
    payText.push(`We'll collect ${fmtMoney(balanceMinor)} on or after ${due}${acct}.`);
    if (inv.payment?.mandateReference) payText.push(`Mandate reference: ${inv.payment.mandateReference}`);
    payText.push("Payments are protected by the Direct Debit Guarantee.");
  } else {
    payTitle = "Pay by bank transfer";
    payText.push(
      ...bankTransferLines(bankTransferReference(inv.accountNumber, inv.invoiceNumber)),
      method === "direct_debit"
        ? DD_NOT_COLLECTING_TEXT
        : "Or set up a Direct Debit from your online account.",
      "We do not take card or phone payments. Can't pay on time? Call us before the due date.",
    );
  }
  const helpText = [
    `Call ${OCCTA_COMPANY.phone} (${OCCTA_COMPANY.phoneHours})`,
    `Email ${OCCTA_COMPANY.email}`,
    `Manage your account at ${OCCTA_COMPANY.dashboardUrl}`,
    "Unhappy with our service? Our complaints code and free, independent ADR scheme are explained at www.occta.co.uk.",
  ];
  font(doc, "normal", 8);
  const payLines = payText.flatMap((t) => doc.splitTextToSize(t, colW - 10));
  const helpLines = helpText.flatMap((t) => doc.splitTextToSize(t, colW - 10));
  const cardH = 15 + Math.max(payLines.length, helpLines.length) * 3.35;
  flow.ensure(cardH);
  const cy = flow.y;
  const drawCard = (x: number, titleText: string, lines: string[], accent: RGB) => {
    fill(doc, PAPER);
    doc.roundedRect(x, cy, colW, cardH, 2, 2, "F");
    fill(doc, accent);
    doc.rect(x, cy + 4, 1.4, cardH - 8, "F");
    font(doc, "bold", 9.2);
    ink(doc, INK);
    doc.text(titleText, x + 5.5, cy + 7);
    font(doc, "normal", 8);
    ink(doc, [55, 55, 55]);
    doc.text(lines, x + 5.5, cy + 12.4);
  };
  drawCard(MARGIN, payTitle, payLines, isPaid ? GREEN : YELLOW);
  drawCard(MARGIN + colW + 6, "Need help?", helpLines, INK);
  flow.y = cy + cardH + 6;

  if (inv.notes && inv.notes.trim()) {
    font(doc, "normal", 7.8);
    const noteLines = doc.splitTextToSize(inv.notes.trim(), W - 2 * MARGIN);
    flow.ensure(6 + noteLines.length * 3.6);
    label(doc, "Notes", MARGIN, flow.y);
    font(doc, "normal", 7.8);
    ink(doc, MUTED);
    doc.text(noteLines, MARGIN, flow.y + 4.5);
    flow.y += 6 + noteLines.length * 3.6;
  }

  drawFooters(doc, showVat);
}

// ── Payment receipt ──

export function drawReceipt(doc: PdfDoc, r: ReceiptDocument): void {
  const W = doc.internal.pageSize.getWidth();
  const right = W - MARGIN;
  const showVat = isVatApplicable(r.paidAt);

  doc.setProperties({
    title: `OCCTA payment receipt ${r.receiptNumber}`,
    subject: `Payment receipt ${r.receiptNumber}`,
    author: OCCTA_COMPANY.legalName,
    creator: OCCTA_COMPANY.legalName,
  });

  drawLogo(doc, MARGIN, 13);
  font(doc, "bold", 19);
  ink(doc, INK);
  doc.text("PAYMENT RECEIPT", right, 20.5, { align: "right" });
  font(doc, "normal", 9);
  ink(doc, MUTED);
  doc.text(`No. ${r.receiptNumber}`, right, 26.5, { align: "right" });
  fill(doc, YELLOW);
  doc.rect(MARGIN, 32, W - 2 * MARGIN, 1.4, "F");

  // Confirmation panel
  let y = 42;
  const panelH = 36;
  fill(doc, GREEN_BG);
  doc.roundedRect(MARGIN, y, W - 2 * MARGIN, panelH, 2.5, 2.5, "F");
  fill(doc, GREEN);
  doc.circle(MARGIN + 15, y + panelH / 2, 7.5, "F");
  stroke(doc, WHITE);
  doc.setLineWidth(1.4);
  doc.line(MARGIN + 11.2, y + panelH / 2 + 0.3, MARGIN + 14, y + panelH / 2 + 3.2);
  doc.line(MARGIN + 14, y + panelH / 2 + 3.2, MARGIN + 19.2, y + panelH / 2 - 3);
  label(doc, "Payment received", MARGIN + 29, y + 11, GREEN);
  font(doc, "bold", 26);
  ink(doc, INK);
  doc.text(fmtMoney(r.amountMinor), MARGIN + 29, y + 23);
  font(doc, "normal", 8.6);
  ink(doc, MUTED);
  doc.text(`Paid on ${fmtDateTimeLondon(r.paidAt)} (UK time)`, MARGIN + 29, y + 30);
  y += panelH + 10;

  // Details + payer
  sectionTitle(doc, "Payment details", MARGIN, y);
  y += 5;
  const rows: [string, string][] = [
    ["Receipt number", r.receiptNumber],
    ["Amount paid", fmtMoney(r.amountMinor)],
    ["Date and time", fmtDateTimeLondon(r.paidAt)],
    ["Payment method", receiptMethodLabel(r.method)],
  ];
  if (r.transactionReference) rows.push(["Transaction reference", r.transactionReference]);
  if (r.paymentReference) rows.push(["Payment reference", r.paymentReference]);
  if (r.invoiceNumber) rows.push(["Paid against invoice", r.invoiceNumber]);
  if (r.contractSummaryNumber) rows.push(["Contract Summary", r.contractSummaryNumber]);
  if (r.planName) rows.push(["Plan", r.planName]);
  rows.forEach(([k, v], i) => {
    if (i % 2 === 0) {
      fill(doc, PAPER);
      doc.rect(MARGIN, y, W - 2 * MARGIN, 7.4, "F");
    }
    font(doc, "normal", 8.6);
    ink(doc, MUTED);
    doc.text(k, MARGIN + 4, y + 4.9);
    font(doc, "bold", 8.8);
    ink(doc, INK);
    doc.text(doc.splitTextToSize(v, 100)[0] ?? "", right - 4, y + 4.9, { align: "right" });
    y += 7.4;
  });
  y += 9;

  sectionTitle(doc, "Paid by", MARGIN, y);
  y += 6.5;
  font(doc, "bold", 10.5);
  ink(doc, INK);
  doc.text(r.customer.name || "Customer", MARGIN, y);
  font(doc, "normal", 8.8);
  ink(doc, MUTED);
  if (r.customer.accountNumber) { y += 5; doc.text(`Account ${r.customer.accountNumber}`, MARGIN, y); }
  if (r.customer.email) { y += 5; doc.text(r.customer.email, MARGIN, y); }
  y += 10;

  const note = r.invoiceNumber
    ? `This receipt confirms ${OCCTA_COMPANY.legalName} has received your payment. It is not a VAT invoice: your VAT invoice ${r.invoiceNumber} is in your online account at ${OCCTA_COMPANY.dashboardUrl}.`
    : `This receipt confirms ${OCCTA_COMPANY.legalName} has received your payment. It is not a VAT invoice. Your invoices are in your online account at ${OCCTA_COMPANY.dashboardUrl}.`;
  font(doc, "normal", 8.2);
  const noteLines = doc.splitTextToSize(note, W - 2 * MARGIN - 12);
  const helpLine = `Questions? Call ${OCCTA_COMPANY.phone} (${OCCTA_COMPANY.phoneHours}) or email ${OCCTA_COMPANY.email}.`;
  const helpLines = doc.splitTextToSize(helpLine, W - 2 * MARGIN - 12);
  const boxH = 9 + (noteLines.length + helpLines.length) * 3.9;
  fill(doc, PAPER);
  doc.roundedRect(MARGIN, y, W - 2 * MARGIN, boxH, 2, 2, "F");
  fill(doc, YELLOW);
  doc.rect(MARGIN, y + 3.5, 1.4, boxH - 7, "F");
  ink(doc, [55, 55, 55]);
  doc.text(noteLines, MARGIN + 6, y + 6.5);
  font(doc, "bold", 8.2);
  ink(doc, INK);
  doc.text(helpLines, MARGIN + 6, y + 6.5 + noteLines.length * 3.9 + 1);

  drawFooters(doc, showVat);
}

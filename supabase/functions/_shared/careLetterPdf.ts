// Renders OCCTA Care letters (and evidence packs) to PDF with jsPDF.
// Deno-only. Content always comes from careLetters.ts so the posted letter,
// the email copy and any print batch carry identical wording.
import { jsPDF } from "npm:jspdf@2.5.1";
import type { CareLetterContent } from "./careLetters.ts";
import { OCCTA_CONTACT } from "./careLetters.ts";
import { drawLogo, type PdfDoc } from "./billingDocument.ts";

// jsPDF's built-in fonts are WinAnsi: keep text inside that set.
export function pdfSafe(s: string): string {
  const swaps: Record<number, string> = {
    0x2018: "'", 0x2019: "'", 0x201c: '"', 0x201d: '"', 0x2013: "-", 0x2014: "-", 0x2192: "->", 0x2026: "...", 0x00a0: " ",
  };
  let out = "";
  for (const ch of String(s ?? "")) {
    const code = ch.codePointAt(0) ?? 0;
    if (swaps[code] !== undefined) out += swaps[code];
    // Keep tab/newline, printable ASCII and Latin-1 (which includes the pound sign).
    else if (code === 9 || code === 10 || code === 13 || (code >= 0x20 && code <= 0x7e) || (code >= 0xa1 && code <= 0xff)) out += ch;
  }
  return out;
}

const A4 = { w: 210, h: 297 };
const M = { left: 20, right: 20, top: 30, bottom: 22 };

interface Cursor { doc: jsPDF; y: number; size: number; large: boolean; gap?: number }

function lineH(size: number) { return size * 0.42; }

// Footers are drawn once per page at the end, so a page break only adds a page.
function ensure(c: Cursor, needed: number, _footer: () => void) {
  if (c.y + needed > A4.h - M.bottom) {
    c.doc.addPage();
    c.y = M.top + 6;
  }
}

// Same brand header as OCCTA invoices: logo, then a yellow rule.
function header(doc: jsPDF, reference: string) {
  drawLogo(doc as unknown as PdfDoc, M.left, 8, 10);
  doc.setTextColor(90, 90, 90);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("OCCTA CARE", A4.w - M.right, 12, { align: "right", charSpace: 0.6 });
  doc.setFont("helvetica", "normal");
  doc.text(pdfSafe(reference), A4.w - M.right, 16.5, { align: "right" });
  doc.setFillColor(255, 222, 0);
  doc.rect(M.left, 24, A4.w - M.left - M.right, 1.4, "F");
  doc.setTextColor(17, 17, 17);
}

function footerFor(doc: jsPDF, label: string) {
  return () => {
    const page = doc.getCurrentPageInfo().pageNumber;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text(pdfSafe(`${OCCTA_CONTACT.address}  |  ${OCCTA_CONTACT.phone}  |  ${OCCTA_CONTACT.email}  |  Registered in England & Wales`), A4.w / 2, A4.h - 10, { align: "center" });
    doc.text(pdfSafe(`${label}  |  Page ${page}`), A4.w - M.right, A4.h - 6, { align: "right" });
    doc.setTextColor(17, 17, 17);
  };
}

function para(c: Cursor, text: string, footer: () => void, opts: { bold?: boolean; size?: number; indent?: number } = {}) {
  const size = opts.size ?? c.size;
  c.doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  c.doc.setFontSize(size);
  const width = A4.w - M.left - M.right - (opts.indent ?? 0);
  const lines = c.doc.splitTextToSize(pdfSafe(text), width) as string[];
  // Short paragraphs and bullets stay in one piece across a page break.
  if (lines.length <= 4) ensure(c, lines.length * lineH(size), footer);
  for (const l of lines) {
    ensure(c, lineH(size), footer);
    c.doc.text(l, M.left + (opts.indent ?? 0), c.y);
    c.y += lineH(size);
  }
  c.y += lineH(size) * (c.gap ?? 0.45);
}

function bullet(c: Cursor, text: string, footer: () => void, indent: number) {
  c.doc.setFont("helvetica", "normal");
  c.doc.setFontSize(c.size);
  const x = M.left + indent;
  const lines = c.doc.splitTextToSize(pdfSafe(text), A4.w - M.right - x - 4.5) as string[];
  ensure(c, lines.length * lineH(c.size), footer);
  c.doc.setFillColor(17, 17, 17);
  c.doc.circle(x + 1.2, c.y - lineH(c.size) * 0.32, c.large ? 0.85 : 0.6, "F");
  for (const l of lines) { c.doc.text(l, x + 4.5, c.y); c.y += lineH(c.size); }
  c.y += lineH(c.size) * (c.gap ?? 0.45) * 0.6;
}

/** Draws one letter starting on the current page of `doc`. */
export function drawCareLetter(doc: jsPDF, content: CareLetterContent, opts: { largePrint?: boolean; copyFor?: string | null; compact?: boolean } = {}) {
  const large = !!opts.largePrint;
  // compact: slightly smaller type and spacing, used only when that keeps a letter to one page.
  const sc = opts.compact && !large ? 0.92 : 1;
  const c: Cursor = { doc, y: 0, size: (large ? 15 : 10.5) * sc, large, gap: opts.compact ? 0.3 : 0.45 };
  const label = `${content.reference} - ${content.type}`;
  const footer = footerFor(doc, label);
  const startPage = doc.getCurrentPageInfo().pageNumber;
  header(doc, content.reference);

  // Address block sits where a DL/C5 left-window envelope shows it.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(large ? 13 : 10.5);
  let ay = 48;
  if (opts.copyFor) {
    doc.setFont("helvetica", "bold");
    doc.text(pdfSafe(`COPY FOR ${opts.copyFor.toUpperCase()}`), M.left, 40);
    doc.setFont("helvetica", "normal");
  }
  for (const l of content.addressLines) { doc.text(pdfSafe(l), M.left, ay); ay += large ? 6 : 4.8; }

  doc.setFontSize(large ? 12 : 9.5);
  doc.text(pdfSafe(content.dateText), A4.w - M.right, 48, { align: "right" });
  doc.text(pdfSafe(`Care reference: ${content.reference}`), A4.w - M.right, 53, { align: "right" });
  if (content.accountNumber) doc.text(pdfSafe(`OCCTA account: ${content.accountNumber}`), A4.w - M.right, 58, { align: "right" });

  c.y = Math.max(ay + 8, 82);
  para(c, content.title, footer, { bold: true, size: (large ? 20 : 15) * sc });
  para(c, content.greeting, footer);
  for (const p of content.paragraphs) para(c, p, footer);

  if (content.facts?.length) {
    const size = (large ? 13 : 9.5) * sc;
    const keyW = large ? 62 : 52;
    for (const [k, v] of content.facts) {
      doc.setFontSize(size);
      const vLines = doc.splitTextToSize(pdfSafe(v), A4.w - M.left - M.right - keyW - 4) as string[];
      doc.setFont("helvetica", "bold");
      const kLines = doc.splitTextToSize(pdfSafe(k), keyW - 3) as string[];
      const h = Math.max(vLines.length, kLines.length) * lineH(size) + 2.2 * sc;
      ensure(c, h, footer);
      doc.setDrawColor(17, 17, 17);
      doc.setLineWidth(0.2);
      doc.line(M.left, c.y - lineH(size) + 0.6, A4.w - M.right, c.y - lineH(size) + 0.6);
      doc.setFont("helvetica", "bold");
      kLines.forEach((l, i) => doc.text(l, M.left, c.y + i * lineH(size)));
      doc.setFont("helvetica", "normal");
      vLines.forEach((l, i) => doc.text(l, M.left + keyW, c.y + i * lineH(size)));
      c.y += h;
    }
    c.y += 3;
  }

  for (const b of content.boxes ?? []) {
    ensure(c, large ? 26 : 18, footer);
    doc.setFillColor(255, 222, 0);
    doc.rect(M.left, c.y - 4, 2.2, 5, "F");
    para(c, b.heading.toUpperCase(), footer, { bold: true, size: (large ? 13 : 9.5) * sc, indent: 4 });
    for (const l of b.lines) bullet(c, l, footer, 4);
    c.y += lineH(c.size) * 0.3;
  }

  if (content.guarantee) {
    const size = (large ? 11.5 : 8) * sc;
    doc.setFontSize(size);
    const gl = doc.splitTextToSize(pdfSafe(content.guarantee), A4.w - M.left - M.right - 8) as string[];
    const boxH = gl.length * lineH(size) + 12;
    ensure(c, Math.min(boxH, 120), footer);
    const top = c.y;
    doc.setDrawColor(17, 17, 17);
    doc.setLineWidth(0.8);
    doc.rect(M.left, top - 4, A4.w - M.left - M.right, Math.min(boxH, A4.h - M.bottom - top + 4));
    c.y = top + 1.5;
    para(c, "THE DIRECT DEBIT GUARANTEE", footer, { bold: true, size: size + 1, indent: 4 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    for (const l of gl) { ensure(c, lineH(size), footer); doc.text(l, M.left + 4, c.y); c.y += lineH(size); }
    c.y += 6 * sc;
  }

  const closeSize = (large ? 13 : 9) * sc;
  // The closing lines and the sign-off move together, so "Yours sincerely" is never alone on a page.
  doc.setFontSize(closeSize);
  const closeH = content.closing.reduce((h, l) => h + ((doc.splitTextToSize(pdfSafe(l), A4.w - M.left - M.right) as string[]).length + 0.45) * lineH(closeSize), 0);
  ensure(c, closeH + lineH(c.size) * 1.6, footer);
  for (const l of content.closing) para(c, l, footer, { size: closeSize });
  para(c, "Yours sincerely, the OCCTA Care team", footer, { bold: true });

  // Footers for every page of this letter.
  const endPage = doc.getCurrentPageInfo().pageNumber;
  for (let p = startPage; p <= endPage; p++) {
    doc.setPage(p);
    if (p !== startPage) header(doc, content.reference);
    footerFor(doc, label)();
  }
  doc.setPage(endPage);
}

/** Normal letters use compact spacing only when that keeps them to a single page; otherwise they flow onto page 2. */
function fitsOnePageCompact(content: CareLetterContent, opts: { largePrint?: boolean; copyFor?: string | null }): boolean {
  if (opts.largePrint) return false;
  const probe = new jsPDF({ unit: "mm", format: "a4" });
  drawCareLetter(probe, content, opts);
  if (probe.getNumberOfPages() === 1) return false;
  const tight = new jsPDF({ unit: "mm", format: "a4" });
  drawCareLetter(tight, content, { ...opts, compact: true });
  return tight.getNumberOfPages() === 1;
}

export function renderCareLetterPdf(content: CareLetterContent, opts: { largePrint?: boolean; copyFor?: string | null } = {}): Uint8Array<ArrayBuffer> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: pdfSafe(`${content.title} - ${content.reference}`), author: "OCCTA LIMITED", creator: "OCCTA Care" });
  drawCareLetter(doc, content, { ...opts, compact: fitsOnePageCompact(content, opts) });
  return new Uint8Array(doc.output("arraybuffer"));
}

/** Several letters in one PDF, each starting on a new page (for printing). */
export function renderCareLetterBatch(items: { content: CareLetterContent; largePrint?: boolean; copyFor?: string | null }[]): Uint8Array<ArrayBuffer> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: "OCCTA Care print batch", author: "OCCTA LIMITED", creator: "OCCTA Care" });
  items.forEach((it, i) => {
    if (i > 0) doc.addPage();
    const o = { largePrint: it.largePrint, copyFor: it.copyFor };
    drawCareLetter(doc, it.content, { ...o, compact: fitsOnePageCompact(it.content, o) });
  });
  return new Uint8Array(doc.output("arraybuffer"));
}

/** Simple sectioned report (evidence packs). */
export function renderCareReportPdf(title: string, reference: string, sections: { heading: string; rows?: [string, string][]; lines?: string[] }[]): Uint8Array<ArrayBuffer> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: pdfSafe(`${title} - ${reference}`), author: "OCCTA LIMITED", creator: "OCCTA Care" });
  const c: Cursor = { doc, y: 26, size: 9, large: false };
  const footer = footerFor(doc, `${reference} - evidence`);
  header(doc, reference);
  para(c, title, footer, { bold: true, size: 15 });
  for (const s of sections) {
    ensure(c, 14, footer);
    doc.setFillColor(255, 222, 0);
    doc.rect(M.left, c.y - 4, 2.2, 5, "F");
    para(c, s.heading.toUpperCase(), footer, { bold: true, size: 10, indent: 4 });
    for (const [k, v] of s.rows ?? []) {
      doc.setFontSize(8.5);
      const vLines = doc.splitTextToSize(pdfSafe(v || "-"), A4.w - M.left - M.right - 58) as string[];
      const h = vLines.length * lineH(8.5) + 1.4;
      ensure(c, h, footer);
      doc.setFont("helvetica", "bold");
      doc.text(pdfSafe(k), M.left, c.y);
      doc.setFont("helvetica", "normal");
      vLines.forEach((l, i) => doc.text(l, M.left + 56, c.y + i * lineH(8.5)));
      c.y += h;
    }
    for (const l of s.lines ?? []) para(c, l, footer, { size: 8.5 });
    c.y += 2;
  }
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) { doc.setPage(p); if (p > 1) header(doc, reference); footer(); }
  return new Uint8Array(doc.output("arraybuffer"));
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

export async function sha256Bytes(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

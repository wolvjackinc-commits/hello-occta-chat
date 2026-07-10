// Shared helpers for OCCTA billing workers.
//
// Used by:
//   - process-first-billing (first invoice for a newly-live service)
//   - process-recurring-billing (monthly forward invoices)
//
// All money is handled in minor units (pence). VAT is itemised.
// Amounts stored on the accepted Contract Summary are the source of truth;
// these helpers never invent a charge.

import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

export type VatMode = "inclusive" | "exclusive";

export interface RawLine {
  description: string;
  /** Amount in minor units, expressed in the same VAT basis as `vatMode`. */
  amount_minor: number;
  /** Optional period label rendered under the description. */
  period_label?: string | null;
}

export interface ComputedLine {
  description: string;
  period_label: string | null;
  net_minor: number;
  vat_minor: number;
  gross_minor: number;
  vat_rate: number;
}

export interface ComputedTotals {
  lines: ComputedLine[];
  subtotal_net_minor: number;
  vat_total_minor: number;
  total_gross_minor: number;
  vat_mode: VatMode;
  vat_rate: number;
}

/** Convert minor units to a £x.xx display string. */
export function fmtPounds(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minor));
  const pounds = Math.floor(abs / 100);
  const pence = String(abs % 100).padStart(2, "0");
  return `${sign}£${pounds}.${pence}`;
}

/** Format a stored ISO date (YYYY-MM-DD) in en-GB display. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(iso);
  }
}

/**
 * `period_end` is stored exclusive (next anchor date). For customer display,
 * subtract one day so the range reads as an inclusive human window
 * (e.g. 1 June to 30 June instead of 1 June to 1 July).
 */
export function toDisplayPeriodEndIso(periodEndExclusiveIso: string): string {
  const d = new Date(periodEndExclusiveIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c],
  );
}

/**
 * Compute pro-rata amount in minor units.
 * `monthly_minor` is expressed in the same VAT basis as vat_mode.
 * Returns 0 if `full_cycle_days <= 0`.
 */
export function computeProRataMinor(
  monthly_minor: number,
  billable_days: number,
  full_cycle_days: number,
  is_pro_rata: boolean,
): number {
  if (!monthly_minor || monthly_minor <= 0) return 0;
  if (!is_pro_rata) return monthly_minor;
  if (!full_cycle_days || full_cycle_days <= 0) return monthly_minor;
  return Math.round((monthly_minor * (billable_days || 0)) / full_cycle_days);
}

/**
 * Split a set of gross/net input lines into itemised net + VAT + gross.
 * For `inclusive`, input amounts already contain VAT and get split downward.
 * For `exclusive`, input amounts are net and VAT is added on top.
 */
export function itemiseInvoice(
  lines: RawLine[],
  vatMode: VatMode,
  vatRate: number,
): ComputedTotals {
  const rate = Number(vatRate) || 0;
  const factor = 1 + rate / 100;
  const computed: ComputedLine[] = lines
    .filter((l) => (l.amount_minor ?? 0) !== 0)
    .map((l) => {
      const amt = Math.round(l.amount_minor);
      let net_minor: number;
      let gross_minor: number;
      if (vatMode === "inclusive") {
        gross_minor = amt;
        net_minor = rate === 0 ? amt : Math.round(amt / factor);
      } else {
        net_minor = amt;
        gross_minor = rate === 0 ? amt : Math.round(amt * factor);
      }
      return {
        description: l.description,
        period_label: l.period_label ?? null,
        net_minor,
        vat_minor: gross_minor - net_minor,
        gross_minor,
        vat_rate: rate,
      };
    });

  const subtotal_net_minor = computed.reduce((s, l) => s + l.net_minor, 0);
  const vat_total_minor = computed.reduce((s, l) => s + l.vat_minor, 0);
  const total_gross_minor = subtotal_net_minor + vat_total_minor;

  return {
    lines: computed,
    subtotal_net_minor,
    vat_total_minor,
    total_gross_minor,
    vat_mode: vatMode,
    vat_rate: rate,
  };
}

/**
 * Build a branded, VAT-itemised invoice PDF.
 * Returns raw bytes; the caller uploads them.
 */
export function buildInvoicePdfBytes(args: {
  invoiceNumber: string;
  accountNumber: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  periodStart: string;
  periodEndExclusive: string;
  totals: ComputedTotals;
  isFirstInvoice: boolean;
}): Uint8Array {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const displayEnd = toDisplayPeriodEndIso(args.periodEndExclusive);

  // Header
  doc.setFillColor(13, 13, 13);
  doc.rect(0, 0, w, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("OCCTA", 14, 20);
  doc.setFillColor(250, 204, 21);
  doc.rect(44, 11, 38, 13, "F");
  doc.setTextColor(13, 13, 13);
  doc.setFontSize(11);
  doc.text("TELECOM", 47, 20);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("INVOICE", w - 14, 20, { align: "right" });

  // Meta
  let y = 46;
  doc.setTextColor(13, 13, 13);
  doc.setFontSize(9);
  doc.text(`Invoice #: ${args.invoiceNumber}`, 14, y);
  doc.text(`Account: ${args.accountNumber || ""}`, 14, y + 6);
  doc.text(`Issue date: ${fmtDate(args.issueDate)}`, w - 14, y, { align: "right" });
  doc.text(`Due date: ${fmtDate(args.dueDate)}`, w - 14, y + 6, { align: "right" });

  y += 22;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Bill to", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(args.customerName || "Customer", 14, y + 6);
  doc.text(`Billing period: ${fmtDate(args.periodStart)} – ${fmtDate(displayEnd)}`, 14, y + 12);

  // Table header
  y += 22;
  doc.setFillColor(245, 245, 240);
  doc.rect(14, y, w - 28, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Description", 18, y + 5);
  doc.text("Net", w - 82, y + 5, { align: "right" });
  doc.text("VAT", w - 50, y + 5, { align: "right" });
  doc.text("Total", w - 18, y + 5, { align: "right" });

  // Lines
  y += 12;
  doc.setFont("helvetica", "normal");
  for (const line of args.totals.lines) {
    doc.text(line.description, 18, y);
    if (line.period_label) {
      doc.setFontSize(8);
      doc.setTextColor(102, 102, 102);
      doc.text(line.period_label, 18, y + 4);
      doc.setFontSize(9);
      doc.setTextColor(13, 13, 13);
    }
    doc.text(fmtPounds(line.net_minor), w - 82, y, { align: "right" });
    doc.text(fmtPounds(line.vat_minor), w - 50, y, { align: "right" });
    doc.text(fmtPounds(line.gross_minor), w - 18, y, { align: "right" });
    y += line.period_label ? 10 : 6;
  }

  // Totals block
  y += 6;
  doc.setDrawColor(13, 13, 13);
  doc.setLineWidth(0.3);
  doc.line(w - 90, y, w - 14, y);
  y += 5;
  doc.text("Subtotal (net)", w - 82, y, { align: "left" });
  doc.text(fmtPounds(args.totals.subtotal_net_minor), w - 18, y, { align: "right" });
  y += 6;
  doc.text(`VAT (${args.totals.vat_rate}%)`, w - 82, y, { align: "left" });
  doc.text(fmtPounds(args.totals.vat_total_minor), w - 18, y, { align: "right" });
  y += 4;

  y += 4;
  doc.setFillColor(13, 13, 13);
  doc.rect(14, y, w - 28, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL DUE (inc. VAT)", 18, y + 7);
  doc.text(fmtPounds(args.totals.total_gross_minor), w - 18, y + 7, { align: "right" });

  // Footer note
  doc.setTextColor(102, 102, 102);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const note = args.isFirstInvoice
    ? "Billing starts only once your service is confirmed live. Your first invoice may include your activation fee and a pro-rata charge from your live date to your chosen billing date. After that, your monthly service is billed in advance on your selected billing date."
    : "Monthly service is billed in advance on your selected billing date.";
  doc.text(doc.splitTextToSize(note, w - 28), 14, 270);
  doc.text(
    "OCCTA Limited · Company No. 13828933 · VAT No. 520 6072 30 · 22 Pavilion View, Huddersfield, HD3 3WU",
    w / 2,
    288,
    { align: "center" },
  );

  return doc.output("arraybuffer") as unknown as Uint8Array;
}

/** VAT-itemised invoice email HTML. */
export function buildInvoiceEmailHtml(args: {
  customerName: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  periodStart: string;
  periodEndExclusive: string;
  totals: ComputedTotals;
  payNowUrl: string | null;
  pdfUrl: string | null;
  dashboardUrl: string;
  isFirstInvoice: boolean;
}): string {
  const displayEnd = toDisplayPeriodEndIso(args.periodEndExclusive);
  const lineRows = args.totals.lines
    .map(
      (l) => `
      <tr>
        <td style="padding:6px 0;color:#111">${escapeHtml(l.description)}${
        l.period_label
          ? `<div style="color:#555;font-size:12px">${escapeHtml(l.period_label)}</div>`
          : ""
      }</td>
        <td style="padding:6px 0;text-align:right">${fmtPounds(l.net_minor)}</td>
        <td style="padding:6px 0;text-align:right">${fmtPounds(l.vat_minor)}</td>
        <td style="padding:6px 0;text-align:right"><b>${fmtPounds(l.gross_minor)}</b></td>
      </tr>`,
    )
    .join("");

  const note = args.isFirstInvoice
    ? "Billing starts only once your service is confirmed live. Your first invoice may include your activation fee and a pro-rata charge from your live date to your chosen billing date. After that, your monthly service is billed in advance on your selected billing date."
    : "Monthly service is billed in advance on your selected billing date.";

  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111;background:#fff">
  <div style="max-width:640px;margin:0 auto;padding:24px;border:4px solid #111">
    <h1 style="font-size:22px;margin:0 0 12px">Your OCCTA invoice ${escapeHtml(args.invoiceNumber)}</h1>
    <p>Hi ${escapeHtml(args.customerName || "there")},</p>
    <p>Your ${args.isFirstInvoice ? "first" : "latest"} invoice is ready.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
      <tr><td colspan="4" style="padding-bottom:8px;color:#555">
        Billing period: <b>${escapeHtml(fmtDate(args.periodStart))}</b> – <b>${escapeHtml(fmtDate(displayEnd))}</b><br/>
        Invoice number: <b>${escapeHtml(args.invoiceNumber)}</b><br/>
        Issue date: ${escapeHtml(fmtDate(args.issueDate))} · Due date: ${escapeHtml(fmtDate(args.dueDate))}
      </td></tr>
      <tr style="border-top:2px solid #111;border-bottom:1px solid #ccc">
        <th style="text-align:left;padding:6px 0">Description</th>
        <th style="text-align:right;padding:6px 0">Net</th>
        <th style="text-align:right;padding:6px 0">VAT</th>
        <th style="text-align:right;padding:6px 0">Total</th>
      </tr>
      ${lineRows}
      <tr style="border-top:1px solid #ccc"><td colspan="3" style="padding:6px 0;text-align:right">Subtotal (net)</td><td style="text-align:right">${fmtPounds(args.totals.subtotal_net_minor)}</td></tr>
      <tr><td colspan="3" style="padding:6px 0;text-align:right">VAT (${args.totals.vat_rate}%)</td><td style="text-align:right">${fmtPounds(args.totals.vat_total_minor)}</td></tr>
      <tr style="border-top:2px solid #111"><td colspan="3" style="padding:10px 0;text-align:right"><b>Total due (inc. VAT)</b></td><td style="text-align:right"><b>${fmtPounds(args.totals.total_gross_minor)}</b></td></tr>
    </table>
    ${args.payNowUrl ? `<p style="text-align:center"><a href="${args.payNowUrl}" style="display:inline-block;background:#facc15;color:#111;padding:12px 24px;text-decoration:none;border:3px solid #111;font-weight:bold">Pay now</a></p>` : ""}
    <p>
      ${args.pdfUrl ? `<a href="${args.pdfUrl}">Download PDF</a> · ` : ""}
      <a href="${args.dashboardUrl}">Open dashboard</a>
    </p>
    <p style="font-size:12px;color:#666;margin-top:24px">${escapeHtml(note)}</p>
    <p style="font-size:12px;color:#666">Need help? Reply to this email or visit our Support page.</p>
  </div></body></html>`;
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const data =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Roll `_from` forward to the next occurrence of `_anchor_day`, clamped
 * to the last valid day of the target month (mirrors the SQL helper).
 * Handles billing days 29/30/31 in short months.
 */
export function nextAnchorBillingDate(fromIso: string, anchorDay: number): string {
  const from = new Date(fromIso + "T00:00:00Z");
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const day = Math.min(Math.max(anchorDay || 1, 1), 31);

  function lastDay(y: number, m: number): number {
    return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  }

  let cy = year;
  let cm = month;
  let candidate = new Date(Date.UTC(cy, cm, Math.min(day, lastDay(cy, cm))));
  if (candidate < from) {
    cm += 1;
    if (cm > 11) { cm = 0; cy += 1; }
    candidate = new Date(Date.UTC(cy, cm, Math.min(day, lastDay(cy, cm))));
  }
  return candidate.toISOString().slice(0, 10);
}

/**
 * Convert a pounds decimal (numeric) to integer pence. Returns 0 for null/NaN.
 */
export function poundsToMinor(x: number | string | null | undefined): number {
  if (x == null) return 0;
  const n = typeof x === "string" ? Number(x) : x;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

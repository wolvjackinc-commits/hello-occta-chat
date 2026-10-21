// "Your bill is ready" email (send-email type `invoice_sent`).
//
// Table-based with inline styles so it renders the same in Gmail, Outlook and
// Apple Mail, and mirrors the PDF bill from billingDocument.ts.

import { OCCTA_COMPANY, splitStoredDescription } from "./billingDocument.ts";

export interface InvoiceEmailData {
  customer_name?: unknown;
  account_number?: unknown;
  invoice_number?: unknown;
  invoice_id?: unknown;
  issue_date?: unknown;
  due_date?: unknown;
  billing_period?: unknown;
  lines?: unknown;
  subtotal?: unknown;
  vat_total?: unknown;
  vat_rate?: unknown;
  total?: unknown;
  pay_now_url?: unknown;
  invoice_pdf_url?: unknown;
  dashboard_url?: unknown;
  payment_method?: unknown;
  dd_active?: unknown;
  plan_name?: unknown;
}

const esc = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

const money = (v: unknown): string => {
  const n = Number(v);
  const minor = Math.round((Number.isFinite(n) ? n : 0) * 100);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}£${Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${String(abs % 100).padStart(2, "0")}`;
};

/** Only http(s) links are placed in href attributes. */
const safeUrl = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return /^https?:\/\//i.test(s) ? s : null;
};

export function isDirectDebitCollection(data: InvoiceEmailData): boolean {
  return data.payment_method === "direct_debit" && data.dd_active === true;
}

export function invoiceEmailSubject(data: InvoiceEmailData): string {
  const num = String(data.invoice_number ?? "");
  const total = money(data.total);
  if (isDirectDebitCollection(data)) return `Your OCCTA bill ${num}: ${total} by Direct Debit`;
  return data.due_date
    ? `Your OCCTA bill ${num}: ${total} due by ${data.due_date}`
    : `Your OCCTA bill ${num}: ${total}`;
}

const FONT = "font-family:Helvetica,Arial,sans-serif;";

export function buildInvoiceSentEmailHtml(data: InvoiceEmailData, opts: { siteUrl: string; footerHtml: string }): string {
  const dd = isDirectDebitCollection(data);
  const vatRate = Number(data.vat_rate ?? 20) || 20;
  // Invoices recorded without VAT (vat_total 0) show a single total line.
  const showVat = Number(data.vat_total ?? 0) !== 0;
  const lines = Array.isArray(data.lines) ? data.lines as Array<{ description?: unknown; qty?: unknown; line_total?: unknown }> : [];
  const dashboardUrl = safeUrl(data.dashboard_url) ?? `${opts.siteUrl}/dashboard`;
  const payUrl = safeUrl(data.pay_now_url) ?? `${opts.siteUrl}/pay-invoice?id=${encodeURIComponent(String(data.invoice_id ?? ""))}`;
  const pdfUrl = safeUrl(data.invoice_pdf_url);
  const due = data.due_date ? esc(data.due_date) : "on receipt";
  const firstName = esc(String(data.customer_name ?? "").trim().split(/\s+/)[0] || "there");

  const lineRows = lines.map((l, i) => {
    const { description, period } = splitStoredDescription(String(l.description ?? ""));
    const qty = Number(l.qty ?? 1);
    return `
      <tr>
        <td style="${FONT}padding:12px 16px;border-top:1px solid #e6e6df;${i % 2 ? "background:#f6f6f1;" : ""}">
          <div style="font-size:14px;font-weight:bold;color:#0d0d0d;">${qty > 1 ? `${qty} x ` : ""}${esc(description)}</div>
          ${period ? `<div style="font-size:12px;color:#666666;padding-top:3px;">${esc(period)}</div>` : ""}
        </td>
        <td align="right" valign="top" style="${FONT}padding:12px 16px;border-top:1px solid #e6e6df;font-size:14px;font-weight:bold;color:#0d0d0d;white-space:nowrap;${i % 2 ? "background:#f6f6f1;" : ""}">${money(l.line_total)}</td>
      </tr>`;
  }).join("");

  const factRow = (k: string, v: string) => v ? `
      <tr>
        <td style="${FONT}padding:9px 16px;font-size:13px;color:#666666;border-top:1px solid #e6e6df;">${k}</td>
        <td align="right" style="${FONT}padding:9px 16px;font-size:13px;font-weight:bold;color:#0d0d0d;border-top:1px solid #e6e6df;">${v}</td>
      </tr>` : "";

  const methodText = dd ? "Direct Debit" : data.payment_method === "direct_debit" ? "Direct Debit (not yet active)" : "Card (pay online)";
  const headline = dd ? "Amount we'll collect" : "Total to pay";
  const subline = dd
    ? `Collected by Direct Debit on or after <strong style="color:#ffffff;">${due}</strong>. No action needed.`
    : `Please pay by <strong style="color:#ffffff;">${due}</strong>.`;

  const button = (href: string, label: string, primary: boolean) => `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:6px 4px;">
        <tr><td style="background:${primary ? "#ffde00" : "#ffffff"};border:2px solid #0d0d0d;border-radius:6px;">
          <a href="${esc(href)}" style="${FONT}display:inline-block;padding:13px 26px;font-size:15px;font-weight:bold;color:#0d0d0d;text-decoration:none;">${label}</a>
        </td></tr>
      </table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Your OCCTA bill ${esc(data.invoice_number)}</title>
</head>
<body style="margin:0;padding:0;background:#efefea;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your OCCTA bill ${esc(data.invoice_number)}: ${money(data.total)}${dd ? ` will be collected by Direct Debit on or after ${due}.` : ` due by ${due}.`}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#efefea;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;">

  <tr><td style="background:#0d0d0d;padding:22px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="middle">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="34" height="34" align="center" valign="middle" style="background:#ffde00;border-radius:3px;${FONT}font-size:20px;font-weight:bold;color:#0d0d0d;">O</td>
          <td style="padding-left:12px;${FONT}font-size:24px;font-weight:bold;color:#ffffff;letter-spacing:1px;">OCCTA</td>
        </tr></table>
      </td>
      <td align="right" valign="middle" style="${FONT}font-size:13px;color:#bbbbbb;">Bill ${esc(data.invoice_number)}</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#ffde00;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>

  <tr><td style="padding:28px 28px 8px;${FONT}">
    <div style="font-size:20px;font-weight:bold;color:#0d0d0d;">Hi ${firstName}, your bill is ready</div>
    <div style="font-size:15px;line-height:22px;color:#444444;padding-top:8px;">
      ${data.billing_period ? `Here's your OCCTA bill for <strong>${esc(data.billing_period)}</strong>.` : "Here's your latest OCCTA bill."}
      ${pdfUrl ? "You can download the full PDF bill below." : "You can view the full bill in your online account."}
    </div>
  </td></tr>

  <tr><td style="padding:16px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border-radius:8px;">
      <tr><td style="padding:22px 24px;border-left:5px solid #ffde00;border-radius:8px;${FONT}">
        <div style="font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#ffde00;">${headline}</div>
        <div style="font-size:38px;font-weight:bold;color:#ffffff;padding-top:6px;">${money(data.total)}</div>
        <div style="font-size:14px;color:#cccccc;padding-top:6px;">${subline}</div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td align="center" style="padding:6px 22px 14px;">
    ${dd ? "" : button(payUrl, "Pay now", true)}
    ${pdfUrl ? button(pdfUrl, "Download PDF bill", dd) : ""}
    ${button(dashboardUrl, "View my account", false)}
  </td></tr>

  <tr><td style="padding:10px 28px;">
    <div style="${FONT}font-size:15px;font-weight:bold;color:#0d0d0d;padding-bottom:8px;">Bill summary</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e6e6df;border-radius:6px;border-collapse:separate;">
      ${factRow("Invoice number", esc(data.invoice_number))}
      ${factRow("Account number", esc(data.account_number))}
      ${factRow("Invoice date", esc(data.issue_date))}
      ${factRow("Billing period", esc(data.billing_period))}
      ${factRow("Payment due", due)}
      ${factRow("Payment method", methodText)}
      ${data.plan_name ? factRow("Plan", esc(data.plan_name)) : ""}
    </table>
  </td></tr>

  ${lines.length ? `
  <tr><td style="padding:18px 28px 6px;">
    <div style="${FONT}font-size:15px;font-weight:bold;color:#0d0d0d;padding-bottom:8px;">Your charges</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e6e6df;border-radius:6px;border-collapse:separate;">
      <tr>
        <td style="${FONT}background:#0d0d0d;color:#ffffff;font-size:11px;font-weight:bold;letter-spacing:1px;padding:9px 16px;border-radius:5px 0 0 0;">DESCRIPTION</td>
        <td align="right" style="${FONT}background:#0d0d0d;color:#ffffff;font-size:11px;font-weight:bold;letter-spacing:1px;padding:9px 16px;border-radius:0 5px 0 0;">AMOUNT</td>
      </tr>
      ${lineRows}
    </table>
  </td></tr>` : ""}

  <tr><td style="padding:8px 28px 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${showVat ? `<tr><td style="${FONT}font-size:14px;color:#444444;padding:6px 16px;">Total excluding VAT</td><td align="right" style="${FONT}font-size:14px;color:#0d0d0d;padding:6px 16px;">${money(data.subtotal)}</td></tr>
      <tr><td style="${FONT}font-size:14px;color:#444444;padding:6px 16px;">VAT at ${vatRate}%</td><td align="right" style="${FONT}font-size:14px;color:#0d0d0d;padding:6px 16px;">${money(data.vat_total)}</td></tr>` : ""}
      <tr><td style="${FONT}font-size:15px;font-weight:bold;color:#0d0d0d;padding:10px 16px;background:#ffde00;border-radius:5px 0 0 5px;">${showVat ? "Total including VAT" : "Total"}</td><td align="right" style="${FONT}font-size:15px;font-weight:bold;color:#0d0d0d;padding:10px 16px;background:#ffde00;border-radius:0 5px 5px 0;">${money(data.total)}</td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 28px 26px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f6f1;border-radius:6px;">
      <tr><td style="padding:16px 18px;border-left:4px solid ${dd ? "#ffde00" : "#0d0d0d"};${FONT}font-size:13px;line-height:20px;color:#444444;">
        ${dd
          ? `<strong style="color:#0d0d0d;">Paying by Direct Debit</strong><br>There's nothing you need to do. Payments are protected by the Direct Debit Guarantee.`
          : `<strong style="color:#0d0d0d;">Ways to pay</strong><br>Online with the Pay now button or in <a href="${esc(dashboardUrl)}" style="color:#0d0d0d;">your account</a>, or by card on ${OCCTA_COMPANY.phone}. Can't pay on time? Call us before the due date and we'll help.`}
        <br><br><strong style="color:#0d0d0d;">Questions about your bill?</strong> Call ${OCCTA_COMPANY.phone} (${OCCTA_COMPANY.phoneHours}) or email <a href="mailto:${OCCTA_COMPANY.email}" style="color:#0d0d0d;">${OCCTA_COMPANY.email}</a>.
      </td></tr>
    </table>
  </td></tr>

  <tr><td>${opts.footerHtml}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

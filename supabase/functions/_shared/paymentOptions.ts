// How OCCTA invoices can be paid. Single source of truth for every invoice,
// email, reminder, dashboard screen and chat answer.
//
// OCCTA takes payment in exactly two ways:
//   1. Direct Debit (collected by AccessPay once the mandate is active)
//   2. Bank transfer to the OCCTA account below
// There is no card payment, no pay-by-phone and no online "Pay now" checkout.
// Do not offer any other way to pay anywhere in the product.
//
// Imported by edge functions (Deno) and by the web app (Vite), so keep this
// file free of runtime-specific imports.

export const OCCTA_BANK_DETAILS = {
  accountName: "OCCTA LIMITED",
  bankName: "Lloyds Bank",
  sortCode: "30-98-97",
  accountNumber: "61499362",
} as const;

export const PAYMENT_METHODS = ["direct_debit", "bank_transfer"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

/**
 * Map any stored payment method (including retired card / invoice-link /
 * phone values on older orders) to one of the two methods OCCTA accepts.
 */
export function normalisePaymentMethod(method: string | null | undefined): PaymentMethod {
  return method === "direct_debit" ? "direct_debit" : "bank_transfer";
}

/** Customer-facing label for a stored payment method. */
export function paymentMethodLabel(method: string | null | undefined, ddActive?: boolean | null): string {
  if (normalisePaymentMethod(method) === "direct_debit") {
    // A Direct Debit customer whose mandate is not active yet, or whose
    // collection failed, pays this bill by bank transfer.
    return ddActive === false ? "Bank transfer" : "Direct Debit";
  }
  return "Bank transfer";
}

/** The reference a customer should quote on a bank transfer. */
export function bankTransferReference(accountNumber: string | null | undefined, invoiceNumber?: string | null): string {
  const acct = String(accountNumber ?? "").trim();
  const inv = String(invoiceNumber ?? "").trim();
  if (acct) return acct;
  return inv || "your OCCTA account number";
}

/** Plain-text lines (PDF, SMS, chat). */
export function bankTransferLines(reference: string): string[] {
  const b = OCCTA_BANK_DETAILS;
  return [
    `Account name: ${b.accountName}`,
    `Bank: ${b.bankName}`,
    `Sort code: ${b.sortCode}`,
    `Account number: ${b.accountNumber}`,
    `Reference: ${reference}`,
  ];
}

/** Shown when a Direct Debit customer's bill is not being collected by DD. */
export const DD_NOT_COLLECTING_TEXT =
  "This bill will not be collected by Direct Debit, so please pay it by bank transfer.";

/** One-sentence summary of the accepted ways to pay. */
export const HOW_TO_PAY_SUMMARY =
  "You can pay OCCTA invoices by Direct Debit or by bank transfer. We do not take card payments or payments over the phone.";

const escHtml = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

/**
 * Email-safe (table + inline style) bank-transfer box.
 * `amount` is a display string such as "£108.73"; omit it to leave the row out.
 */
export function bankTransferBoxHtml(opts: { reference: string; amount?: string | null; title?: string; note?: string | null }): string {
  const b = OCCTA_BANK_DETAILS;
  const F = "font-family:Helvetica,Arial,sans-serif;";
  const row = (k: string, v: string) => `
        <tr>
          <td style="${F}padding:6px 16px;font-size:13px;color:#666666;">${k}</td>
          <td align="right" style="${F}padding:6px 16px;font-size:14px;font-weight:bold;color:#0d0d0d;">${v}</td>
        </tr>`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f6f1;border:2px solid #0d0d0d;border-radius:6px;border-collapse:separate;">
      <tr><td colspan="2" style="${F}padding:12px 16px 6px;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#0d0d0d;">${escHtml(opts.title ?? "Pay by bank transfer")}</td></tr>
      ${row("Account name", escHtml(b.accountName))}
      ${row("Bank", escHtml(b.bankName))}
      ${row("Sort code", escHtml(b.sortCode))}
      ${row("Account number", escHtml(b.accountNumber))}
      ${row("Reference", escHtml(opts.reference))}
      ${opts.amount ? row("Amount", escHtml(opts.amount)) : ""}
      <tr><td colspan="2" style="${F}padding:6px 16px 12px;font-size:12px;line-height:18px;color:#444444;">${escHtml(opts.note ?? "Please quote the reference so we can match your payment. We do not take card payments or payments over the phone.")}</td></tr>
    </table>`;
}

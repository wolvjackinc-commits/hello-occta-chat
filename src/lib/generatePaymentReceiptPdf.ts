// Customer "Download receipt" — branded payment receipt PDF using the shared
// billing layout (supabase/functions/_shared/billingDocument.ts).

import { drawReceipt, type PdfDoc } from "../../supabase/functions/_shared/billingDocument";

export type PaymentReceiptData = {
  receipt_ref: string;
  payment_request_number: string;
  amount: number;
  currency: string;
  paid_at: string;
  provider: string;
  provider_payment_id: string | null;
  customer_name: string;
  customer_email: string;
  account_number: string | null;
  invoice_number?: string | null;
  contract_summary: {
    cs_number: string;
    plan_name: string;
    monthly_price_incl_vat: number;
  } | null;
};

/** Build the receipt PDF and download it as OCCTA-receipt-<ref>.pdf. */
export async function generatePaymentReceiptPdf(r: PaymentReceiptData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  drawReceipt(doc as unknown as PdfDoc, {
    receiptNumber: r.receipt_ref,
    paidAt: r.paid_at,
    amountMinor: Math.round(Number(r.amount || 0) * 100),
    method: "card",
    transactionReference: r.provider_payment_id,
    paymentReference: r.payment_request_number,
    invoiceNumber: r.invoice_number ?? null,
    contractSummaryNumber: r.contract_summary?.cs_number ?? null,
    planName: r.contract_summary?.plan_name ?? null,
    customer: { name: r.customer_name, email: r.customer_email, accountNumber: r.account_number },
  });
  doc.save(`OCCTA-receipt-${r.receipt_ref}.pdf`);
}

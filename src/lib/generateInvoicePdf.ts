// Customer/admin "Download invoice" — builds the same PDF the billing workers
// store and email (shared layout in supabase/functions/_shared/billingDocument.ts).

import {
  billLinesFromStored,
  drawInvoice,
  type PdfDoc,
} from "../../supabase/functions/_shared/billingDocument";

interface InvoiceLineData {
  description: string;
  qty: number;
  unit_price: number;
  line_total: number;
  vat_rate?: number;
}

interface InvoiceData {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  accountNumber: string;
  address?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  companyName?: string | null;
  customerVatNumber?: string | null;
  issueDate: string;
  dueDate?: string;
  /** invoices.billing_period_start */
  periodStart?: string | null;
  /** invoices.billing_period_end (exclusive, as stored) */
  periodEnd?: string | null;
  status: string;
  lines: InvoiceLineData[];
  subtotal: number;
  vatTotal: number;
  total: number;
  /** Payments already received against this invoice, in pounds. */
  amountPaid?: number;
  notes?: string;
  vatEnabled?: boolean;
  vatRate?: number;
  paymentMethod?: string | null;
  planName?: string | null;
  serviceAddress?: string | null;
  /** Kept for existing callers; payment links are never printed on a PDF. */
  paymentUrl?: string;
}

const toMinor = (pounds: number | null | undefined) => Math.round(Number(pounds ?? 0) * 100);

// Internal bookkeeping notes the billing workers write; the bill already
// shows the period and pro-rata basis, so these never print.
const AUTO_NOTE = /^(Monthly invoice for billing period|First \(pro-rata\) invoice|First monthly invoice|SIM monthly|SIM first live period)/;

/** Build the invoice PDF and download it as OCCTA-invoice-<number>.pdf. */
export async function generateInvoicePdf(invoice: InvoiceData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const vatEnabled = invoice.vatEnabled !== false;
  const rawRate = Number(invoice.vatRate ?? 20);
  const vatRate = vatEnabled ? (rawRate > 0 && rawRate <= 1 ? rawRate * 100 : rawRate) : 0;

  const doc = new jsPDF();
  drawInvoice(doc as unknown as PdfDoc, {
    invoiceNumber: invoice.invoiceNumber,
    accountNumber: invoice.accountNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate ?? null,
    periodStart: invoice.periodStart ?? null,
    periodEndExclusive: invoice.periodEnd ?? null,
    status: invoice.status,
    customer: {
      name: invoice.customerName,
      email: invoice.customerEmail,
      companyName: invoice.companyName,
      vatNumber: invoice.customerVatNumber,
      addressLines: [invoice.address, invoice.addressLine2, invoice.city, invoice.postcode],
    },
    service: { planName: invoice.planName, serviceAddress: invoice.serviceAddress },
    lines: billLinesFromStored(invoice.lines, { vatEnabled, defaultVatRate: vatRate }),
    subtotalMinor: toMinor(invoice.subtotal),
    vatMinor: vatEnabled ? toMinor(invoice.vatTotal) : 0,
    totalMinor: toMinor(invoice.total),
    vatRate,
    amountPaidMinor: toMinor(invoice.amountPaid),
    payment: { method: invoice.paymentMethod ?? null },
    notes: invoice.notes && !AUTO_NOTE.test(invoice.notes.trim()) ? invoice.notes : null,
  });
  doc.save(`OCCTA-invoice-${invoice.invoiceNumber}.pdf`);
}

/* eslint-disable @typescript-eslint/no-explicit-any -- untyped Supabase rows */
/**
 * Map an invoices row, its invoice_lines and the customer's profile row onto
 * InvoiceData, so every "Download PDF" button prints the same details.
 */
export function invoiceDataFromRows(inv: any, lines: any[], profile: any): InvoiceData {
  return {
    invoiceNumber: inv.invoice_number,
    customerName: profile?.full_name || profile?.business_company_name || "Customer",
    customerEmail: profile?.email || "",
    accountNumber: profile?.account_number || "",
    address: profile?.address_line1 || "",
    addressLine2: profile?.address_line2 || "",
    city: profile?.city || "",
    postcode: profile?.postcode || "",
    companyName: profile?.business_company_name || null,
    customerVatNumber: profile?.business_vat_number || null,
    issueDate: inv.issue_date,
    dueDate: inv.due_date ?? undefined,
    periodStart: inv.billing_period_start ?? null,
    periodEnd: inv.billing_period_end ?? null,
    status: inv.status,
    lines: (lines ?? []).map((l) => ({
      description: l.description ?? "",
      qty: Number(l.qty ?? 1),
      unit_price: Number(l.unit_price ?? 0),
      line_total: Number(l.line_total ?? 0),
      vat_rate: l.vat_rate != null ? Number(l.vat_rate) : undefined,
    })),
    subtotal: Number(inv.subtotal ?? 0),
    vatTotal: Number(inv.vat_total ?? 0),
    total: Number(inv.total ?? 0),
    notes: inv.notes ?? undefined,
    vatEnabled: inv.vat_enabled !== false,
    vatRate: inv.vat_rate != null ? Number(inv.vat_rate) : 20,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export type { InvoiceData, InvoiceLineData };

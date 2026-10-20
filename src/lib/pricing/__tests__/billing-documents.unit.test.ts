import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { companyConfig } from "@/lib/companyConfig";
import {
  OCCTA_COMPANY,
  billLinesFromStored,
  drawInvoice,
  drawReceipt,
  fmtMoney,
  isVatApplicable,
  splitStoredDescription,
  type InvoiceDocument,
  type PdfDoc,
} from "../../../../supabase/functions/_shared/billingDocument";
import {
  buildInvoiceSentEmailHtml,
  invoiceEmailSubject,
} from "../../../../supabase/functions/_shared/invoiceEmail";

const pdfText = (doc: jsPDF) => {
  // jsPDF writes text as literal strings in the content stream.
  const raw = doc.output();
  // Helvetica text is WinAnsi-encoded: map its en/em dash bytes back.
  return Array.from(raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g), (m) => m[1].replace(/\\(.)/g, "$1")).join("\n")
    .replace(/\u0096/g, "–").replace(/\u0097/g, "—");
};

describe("company details on bills", () => {
  it("match companyConfig", () => {
    expect(OCCTA_COMPANY.companyNumber).toBe(companyConfig.companyNumber);
    expect(OCCTA_COMPANY.vatNumber).toBe(companyConfig.vatNumber);
    expect(OCCTA_COMPANY.vatEffectiveDate).toBe(companyConfig.vatEffectiveDate);
    expect(OCCTA_COMPANY.addressOneLine).toBe(companyConfig.address.oneLine);
    expect(OCCTA_COMPANY.phone).toBe(companyConfig.phone.display);
    expect(OCCTA_COMPANY.email).toBe(companyConfig.email.support);
    expect(OCCTA_COMPANY.phoneHours).toBe(companyConfig.supportHours.phone);
  });

  it("only show the VAT number from the registration date", () => {
    expect(isVatApplicable("2026-06-30")).toBe(false);
    expect(isVatApplicable("2026-07-01")).toBe(true);
  });
});

describe("stored invoice lines", () => {
  it("split the period the billing workers append", () => {
    expect(splitStoredDescription("Superfast 150 — monthly service (1 Nov 2026 to 30 Nov 2026 (billed in advance))"))
      .toEqual({ description: "Superfast 150 — monthly service", period: "1 Nov 2026 to 30 Nov 2026 (billed in advance)" });
    expect(splitStoredDescription("Setup (One-off (per accepted Contract Summary))"))
      .toEqual({ description: "Setup", period: "One-off (per accepted Contract Summary)" });
  });

  it("keep brackets that are part of a plan name", () => {
    expect(splitStoredDescription("Superfast (FTTP)")).toEqual({ description: "Superfast (FTTP)", period: null });
    expect(splitStoredDescription("Business Fibre (Static IP) (1 Nov 2026 to 30 Nov 2026)"))
      .toEqual({ description: "Business Fibre (Static IP)", period: "1 Nov 2026 to 30 Nov 2026" });
  });

  it("split VAT out of gross line totals", () => {
    const [line] = billLinesFromStored([{ description: "Broadband", line_total: 45.59, vat_rate: 20 }], { vatEnabled: true, defaultVatRate: 20 });
    expect(line).toMatchObject({ grossMinor: 4559, netMinor: 3799, vatMinor: 760, vatRate: 20 });
    const [sim] = billLinesFromStored([{ description: "SIM", line_total: 10, vat_rate: 0.2 }], { vatEnabled: true, defaultVatRate: 20 });
    expect(sim.vatRate).toBe(20);
  });

  it("format money with thousands separators", () => {
    expect(fmtMoney(100298)).toBe("£1,002.98");
    expect(fmtMoney(-20000)).toBe("-£200.00");
  });
});

const invoice: InvoiceDocument = {
  invoiceNumber: "INV-2026-004512",
  accountNumber: "OCC-104233",
  issueDate: "2026-10-15",
  dueDate: "2026-10-29",
  periodStart: "2026-10-15",
  periodEndExclusive: "2026-11-01",
  status: "sent",
  customer: { name: "Jordan Patel", email: "jordan@example.com", addressLines: ["14 Larch Close", null, "Huddersfield", "HD3 3AB"] },
  service: { planName: "Superfast 150", serviceAddress: "14 Larch Close, Huddersfield HD3 3AB" },
  lines: billLinesFromStored([
    { description: "Superfast 150 — pro-rata service (15 Oct 2026 to 31 Oct 2026 · 17 of 31 days)", line_total: 21.07, vat_rate: 20 },
    { description: "Setup (One-off (per accepted Contract Summary))", line_total: 49.99, vat_rate: 20 },
  ], { vatEnabled: true, defaultVatRate: 20 }),
  subtotalMinor: 5922,
  vatMinor: 1184,
  totalMinor: 7106,
  vatRate: 20,
  payment: { method: "direct_debit", ddActive: true, bankLast4: "4421", mandateReference: "OCCTA-DD-1" },
};

describe("invoice PDF", () => {
  it("carries the legally required and customer details on one page", () => {
    const doc = new jsPDF();
    drawInvoice(doc as unknown as PdfDoc, invoice);
    const text = pdfText(doc);
    expect(doc.getNumberOfPages()).toBe(1);
    for (const s of ["VAT INVOICE", "INV-2026-004512", "OCC-104233", "Jordan Patel", "14 Larch Close", "HD3 3AB",
      "15 October 2026", "15 Oct 2026 – 31 Oct 2026", "29 October 2026", "£71.06", "£59.22", "£11.84",
      "account ending 4421", "OCCTA-DD-1", "VAT reg. no. 520 6072 30", "company no. 13828933", "Page 1 of 1"]) {
      expect(text).toContain(s);
    }
  });

  it("tells a Direct Debit customer there is nothing to do, and a card customer how to pay", () => {
    const dd = new jsPDF();
    drawInvoice(dd as unknown as PdfDoc, invoice);
    expect(pdfText(dd)).toContain("Direct Debit – no action needed");
    const card = new jsPDF();
    drawInvoice(card as unknown as PdfDoc, { ...invoice, payment: { method: "invoice_link" } });
    expect(pdfText(card)).toContain("How to pay");
    expect(pdfText(card)).toContain("TOTAL TO PAY");
  });

  it("shows part payments and the remaining balance", () => {
    const doc = new jsPDF();
    drawInvoice(doc as unknown as PdfDoc, { ...invoice, payment: { method: "invoice_link" }, amountPaidMinor: 2000 });
    const text = pdfText(doc);
    expect(text).toContain("BALANCE TO PAY");
    expect(text).toContain("£51.06");
  });

  it("marks paid invoices and runs long bills over several pages with page numbers", () => {
    const paid = new jsPDF();
    drawInvoice(paid as unknown as PdfDoc, { ...invoice, status: "paid" });
    expect(pdfText(paid)).toContain("PAID IN FULL");

    const many = new jsPDF();
    drawInvoice(many as unknown as PdfDoc, { ...invoice, lines: Array(30).fill(invoice.lines[0]) });
    const pages = many.getNumberOfPages();
    expect(pages).toBeGreaterThan(1);
    expect(pdfText(many)).toContain(`Page ${pages} of ${pages}`);
  });
});

describe("payment receipt PDF", () => {
  it("confirms the payment and what it paid", () => {
    const doc = new jsPDF();
    drawReceipt(doc as unknown as PdfDoc, {
      receiptNumber: "RCPT-PRN-1", paidAt: "2026-10-20T13:32:00Z", amountMinor: 7106, method: "card",
      transactionReference: "TX-1", paymentReference: "PRN-1", invoiceNumber: "INV-2026-004512",
      customer: { name: "Jordan Patel", email: "jordan@example.com", accountNumber: "OCC-104233" },
    });
    const text = pdfText(doc);
    for (const s of ["PAYMENT RECEIPT", "RCPT-PRN-1", "£71.06", "20 October 2026 at 14:32", "INV-2026-004512", "It is not a VAT invoice"]) {
      expect(text).toContain(s);
    }
  });
});

describe("invoice email", () => {
  const base = {
    customer_name: "Jordan <b>Patel</b>", invoice_number: "INV-1", invoice_id: "id-1", total: 71.06, subtotal: 59.22,
    vat_total: 11.84, due_date: "29 Oct 2026", pay_now_url: "https://www.occta.co.uk/pay?token=t",
    lines: [{ description: "Setup (One-off (per accepted Contract Summary))", qty: 1, line_total: 49.99 }],
  };
  const opts = { siteUrl: "https://www.occta.co.uk", footerHtml: "" };

  it("never asks a Direct Debit customer to pay", () => {
    const html = buildInvoiceSentEmailHtml({ ...base, payment_method: "direct_debit", dd_active: true }, opts);
    expect(html).not.toContain(">Pay now<");
    expect(html).toContain("Collected by Direct Debit");
    expect(invoiceEmailSubject({ ...base, payment_method: "direct_debit", dd_active: true })).toBe("Your OCCTA bill INV-1: £71.06 by Direct Debit");
  });

  it("gives card customers a Pay now button and escapes customer text", () => {
    const html = buildInvoiceSentEmailHtml({ ...base, payment_method: "invoice_link" }, opts);
    expect(html).toContain(">Pay now<");
    expect(html).toContain("https://www.occta.co.uk/pay?token=t");
    expect(html).not.toContain("<b>Patel</b>");
    expect(invoiceEmailSubject({ ...base, payment_method: "invoice_link" })).toBe("Your OCCTA bill INV-1: £71.06 due by 29 Oct 2026");
  });

  it("drops links that aren't http(s)", () => {
    const html = buildInvoiceSentEmailHtml({ ...base, pay_now_url: "javascript:alert(1)" }, opts);
    expect(html).not.toContain("javascript:");
    expect(html).toContain("https://www.occta.co.uk/pay-invoice?id=id-1");
  });
});

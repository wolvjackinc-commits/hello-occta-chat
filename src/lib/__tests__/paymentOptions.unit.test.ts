import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  OCCTA_BANK_DETAILS,
  bankTransferBoxHtml,
  bankTransferLines,
  bankTransferReference,
  normalisePaymentMethod,
  paymentMethodLabel,
} from "../../../supabase/functions/_shared/paymentOptions.ts";

describe("OCCTA payment options", () => {
  it("has the OCCTA bank account", () => {
    expect(OCCTA_BANK_DETAILS).toEqual({
      accountName: "OCCTA LIMITED",
      bankName: "Lloyds Bank",
      sortCode: "30-98-97",
      accountNumber: "61499362",
    });
  });

  it("maps every stored method to Direct Debit or bank transfer", () => {
    expect(normalisePaymentMethod("direct_debit")).toBe("direct_debit");
    for (const m of ["card", "invoice_link", "phone", "bank_transfer", "worldpay", null, undefined, ""]) {
      expect(normalisePaymentMethod(m)).toBe("bank_transfer");
    }
    expect(paymentMethodLabel("direct_debit", true)).toBe("Direct Debit");
    expect(paymentMethodLabel("direct_debit", false)).toBe("Bank transfer");
    expect(paymentMethodLabel("invoice_link")).toBe("Bank transfer");
    expect(paymentMethodLabel("card")).toBe("Bank transfer");
  });

  it("uses the account number as the transfer reference", () => {
    expect(bankTransferReference("OCC35614656", "INV-1")).toBe("OCC35614656");
    expect(bankTransferReference("", "INV-1")).toBe("INV-1");
    expect(bankTransferLines("OCC1")).toContain("Sort code: 30-98-97");
    const html = bankTransferBoxHtml({ reference: "<x>", amount: "£1.00" });
    expect(html).toContain("61499362");
    expect(html).toContain("&lt;x&gt;");
  });
});

// Customer-facing billing code must never offer card, phone or "Pay now"
// payment again: OCCTA takes Direct Debit or bank transfer only.
describe("no card or phone payment offers in billing paths", () => {
  const root = resolve(__dirname, "../../..");
  const files = [
    "supabase/functions/_shared/billingDocument.ts",
    "supabase/functions/_shared/invoiceEmail.ts",
    "supabase/functions/payment-reminders/index.ts",
    "supabase/functions/process-first-billing/index.ts",
    "supabase/functions/process-recurring-billing/index.ts",
    "supabase/functions/process-sim-recurring-billing/index.ts",
    "supabase/functions/admin-resend-invoice-email/index.ts",
    "supabase/functions/process-activation-outbox/index.ts",
    "src/components/dashboard/tabs/InvoicesTab.tsx",
    "src/components/dashboard/tabs/OverviewTab.tsx",
    "src/components/app/AppDashboard.tsx",
    "src/pages/PayInvoice.tsx",
    "src/data/helpArticles.ts",
    "src/data/faqs.ts",
  ];
  for (const f of files) {
    it(f, () => {
      const src = readFileSync(resolve(root, f), "utf8");
      expect(src).not.toMatch(/>\s*Pay now\s*</i);
      expect(src).not.toMatch(/Card \(pay online\)/);
      expect(src).not.toMatch(/type:\s*["']card_payment["']/);
      expect(src).not.toMatch(/by card on \$\{|pay by card in your account|By phone: call/i);
    });
  }
});

import SeoContentLayout from "@/components/seo/SeoContentLayout";
import { OCCTA_BANK_DETAILS } from "../../../supabase/functions/_shared/paymentOptions.ts";

// Kept at /pay-by-card so existing links and search results still land here,
// but OCCTA does not take card payments: invoices are paid by Direct Debit or
// bank transfer only (supabase/functions/_shared/paymentOptions.ts).
export default function PayByCardPage() {
  const b = OCCTA_BANK_DETAILS;
  return (
    <SeoContentLayout
      title="How to Pay Your OCCTA Bill — Direct Debit or Bank Transfer | OCCTA"
      metaDescription="OCCTA invoices are paid by Direct Debit or by bank transfer. We do not take card payments or payments over the phone. Here are our bank details and how to quote your reference."
      canonical="/pay-by-card"
      h1="How to pay your OCCTA bill"
      shortAnswer="OCCTA invoices are paid in one of two ways: by Direct Debit, collected automatically once your mandate is active, or by bank transfer to OCCTA's bank account. We do not take card payments or payments over the phone."
      intro={
        <p>If you're looking to pay by card: we don't offer card payments. Please pay by bank transfer using the details below, or set up a Direct Debit so your bills are collected automatically.</p>
      }
      sections={[
        {
          heading: "Pay by bank transfer",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li>Account name: <strong>{b.accountName}</strong></li>
              <li>Bank: <strong>{b.bankName}</strong></li>
              <li>Sort code: <strong>{b.sortCode}</strong></li>
              <li>Account number: <strong>{b.accountNumber}</strong></li>
              <li>Reference: <strong>your OCCTA account number</strong> (it starts with OCC and is shown on every invoice)</li>
            </ul>
          ),
        },
        {
          heading: "Pay by Direct Debit",
          body: (
            <p>Set up a Direct Debit and each invoice is collected automatically on or after its due date. Nothing is collected until the mandate is confirmed, and payments are protected by the Direct Debit Guarantee. Until your Direct Debit is active, please pay by bank transfer.</p>
          ),
        },
      ]}
      aeo={[
        { question: "Can I pay my OCCTA bill by card?", answer: "No. OCCTA does not take card payments. Please pay by bank transfer or set up a Direct Debit." },
        { question: "Can I pay over the phone?", answer: "No. We do not take payments over the phone. You can call us about your bill, but payment is by bank transfer or Direct Debit only." },
      ]}
      faqs={[
        { question: "What reference should I use for a bank transfer?", answer: "Your OCCTA account number (starting OCC). It's shown on every invoice and in your dashboard, and lets us match your payment straight away." },
        { question: "How long does a bank transfer take to show?", answer: "Most UK bank transfers arrive the same day; allow up to 1–2 working days before we mark the invoice paid." },
        { question: "My Direct Debit failed. What now?", answer: "We'll let you know. Please pay that invoice by bank transfer using the details on this page." },
      ]}
      relatedLinks={[
        { label: "Direct Debit setup", to: "/direct-debit-setup" },
        { label: "Billing explained", to: "/billing-explained" },
        { label: "First invoice explained", to: "/first-invoice-explained" },
        { label: "Contact support", to: "/contact" },
      ]}
      primaryCta={{ label: "Open my dashboard", to: "/dashboard" }}
      secondaryCta={{ label: "Contact support", to: "/contact" }}
      compliance={
        <p>OCCTA takes payment by Direct Debit or bank transfer only. We will never ask for your card details by email, text or phone.</p>
      }
    />
  );
}

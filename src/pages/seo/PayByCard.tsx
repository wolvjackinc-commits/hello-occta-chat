import SeoContentLayout from "@/components/seo/SeoContentLayout";

export default function PayByCardPage() {
  return (
    <SeoContentLayout
      title="Pay by Card — Secure Worldpay Payment Links | OCCTA"
      metaDescription="Pay your OCCTA invoice by card using a secure Worldpay-hosted payment link. No card details are stored by OCCTA. Clear receipts and instant confirmation."
      canonical="/pay-by-card"
      h1="Pay by card"
      shortAnswer="OCCTA invoices can be paid by card using a secure Worldpay-hosted payment link. We don't store card details ourselves — your card goes straight to Worldpay, and you get a confirmation and receipt as soon as the payment is taken."
      intro={
        <p>This page explains how OCCTA's card payment works in general. To pay a specific invoice, sign in to your dashboard and use the Pay by card link on the invoice itself.</p>
      }
      sections={[
        {
          heading: "How card payments work",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li>You open the secure Worldpay-hosted payment page from the invoice link.</li>
              <li>You enter your card details directly with Worldpay — OCCTA never sees or stores them.</li>
              <li>Worldpay returns a success or failure result and we update your invoice and email a receipt.</li>
              <li>3-D Secure may prompt your bank to confirm the transaction.</li>
            </ul>
          ),
        },
        {
          heading: "Security",
          body: (
            <p>Worldpay is a PCI-DSS-compliant payment provider. OCCTA does not handle raw card numbers. The link you use to pay is a one-time secure URL tied to your invoice.</p>
          ),
        },
      ]}
      aeo={[
        { question: "Does OCCTA store my card details?", answer: "No. Card data is handled by Worldpay, our PCI-DSS-compliant payment provider." },
        { question: "Can I pay every invoice by card?", answer: "Yes. Direct Debit is offered as a convenient alternative but is not required." },
      ]}
      faqs={[
        { question: "What card types are accepted?", answer: "Major UK debit and credit cards (Visa and Mastercard). Some other schemes may also work via Worldpay." },
        { question: "Why was I asked to authenticate with my bank?", answer: "That's 3-D Secure (e.g. Verified by Visa, Mastercard Identity Check), a standard UK fraud prevention step." },
        { question: "How long does payment take to clear?", answer: "Card payments are confirmed within seconds. We update your invoice and send a receipt to your registered email." },
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
        <p>Card payments are processed by Worldpay. OCCTA does not store full card details. Your bank may apply additional 3-D Secure checks.</p>
      }
    />
  );
}
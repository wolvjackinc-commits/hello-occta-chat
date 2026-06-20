import SeoContentLayout from "@/components/seo/SeoContentLayout";

export default function DirectDebitSetupPage() {
  return (
    <SeoContentLayout
      title="Direct Debit Setup — How It Works at OCCTA"
      metaDescription="How to set up a Direct Debit at OCCTA. We don't auto-collect anything until you've confirmed the mandate. Protected by the Direct Debit Guarantee."
      canonical="/direct-debit-setup"
      h1="Direct Debit setup"
      shortAnswer="Direct Debit is the easiest way to pay OCCTA invoices automatically. We only start collecting once you've confirmed the mandate — setup alone does not authorise a collection."
      intro={
        <p>This page explains how Direct Debit works at OCCTA, what we collect and when. It is general information — the binding details are in the mandate you confirm and the Direct Debit Guarantee from your bank.</p>
      }
      sections={[
        {
          heading: "How OCCTA Direct Debit works",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li>You provide your bank details through the Direct Debit setup link we send you (or from your dashboard).</li>
              <li>You confirm the mandate. Until confirmation, nothing is collected.</li>
              <li>Once confirmed and an invoice is due, we collect the invoice amount on the scheduled date and you'll see it on your statement as OCCTA.</li>
              <li>We'll always show your upcoming charge on your invoice before collection.</li>
            </ul>
          ),
        },
        {
          heading: "The Direct Debit Guarantee",
          body: (
            <p>Direct Debits in the UK are covered by the Direct Debit Guarantee. You're entitled to an immediate refund from your bank for any payment taken in error, and you can cancel a Direct Debit at any time directly with your bank — please also let us know so your account stays in sync.</p>
          ),
        },
      ]}
      aeo={[
        { question: "Will setting up Direct Debit charge me straight away?", answer: "No. Setup only authorises future collections of OCCTA invoices. Nothing is collected until an invoice is due." },
        { question: "Is Direct Debit required?", answer: "No — you can pay each invoice by card instead via a secure Worldpay payment link. Direct Debit is offered because most customers prefer the convenience." },
      ]}
      faqs={[
        { question: "Can I cancel the Direct Debit later?", answer: "Yes, at any time. Cancel via your bank (under the Direct Debit Guarantee) and also tell us so we can update your account and arrange an alternative payment method." },
        { question: "What if a Direct Debit fails?", answer: "We'll notify you. You can settle the invoice by card. Repeated failures may attract a late fee per the agreed billing terms." },
        { question: "Is my bank data secure?", answer: "We use a regulated payment partner to process Direct Debit setup — we don't store your full bank details ourselves." },
      ]}
      relatedLinks={[
        { label: "Pay by card", to: "/pay-by-card" },
        { label: "Billing explained", to: "/billing-explained" },
        { label: "First invoice explained", to: "/first-invoice-explained" },
        { label: "Cancellation", to: "/cancellation" },
        { label: "Contact support", to: "/contact" },
      ]}
      primaryCta={{ label: "Open my dashboard", to: "/dashboard" }}
      secondaryCta={{ label: "Contact support", to: "/contact" }}
      compliance={
        <p>Direct Debit collections are covered by the Direct Debit Guarantee provided by your bank. See the mandate you sign and your bank's terms for full details.</p>
      }
    />
  );
}
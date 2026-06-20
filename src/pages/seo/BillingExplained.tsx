import SeoContentLayout from "@/components/seo/SeoContentLayout";

export default function BillingExplainedPage() {
  return (
    <SeoContentLayout
      title="Billing Explained — How OCCTA Invoices Work"
      metaDescription="How OCCTA billing works: billing starts only after activation, your invoice shows monthly charges, VAT and any pro-rata, and you can pay by Direct Debit or secure Worldpay card link."
      canonical="/billing-explained"
      h1="Billing explained"
      shortAnswer="OCCTA bills you only after your service activation is confirmed. Each invoice shows your monthly plan, any one-off charges, pro-rata for the partial first month, and VAT. You can pay by Direct Debit (once you've confirmed the mandate) or by card via a secure Worldpay payment link."
      intro={
        <p>This page explains how OCCTA invoices work end-to-end — when billing starts, what's on each invoice, and how to pay. For the first bill specifically, see <a href="/first-invoice-explained" className="underline">First invoice explained</a>.</p>
      }
      sections={[
        {
          heading: "When billing starts",
          body: (
            <p>Billing starts only after we confirm your service is activated. Ordering does not start billing — confirmation of activation does.</p>
          ),
        },
        {
          heading: "What's on each invoice",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Monthly plan charge</strong> for the billing cycle.</li>
              <li><strong>Pro-rata</strong> for any part-month between activation and the start of your normal cycle (usually only on the first invoice).</li>
              <li><strong>One-off charges</strong> — e.g. activation fees on the first invoice, equipment if applicable.</li>
              <li><strong>VAT</strong> — included in residential prices, shown separately on business invoices.</li>
              <li><strong>Adjustments</strong> — any credits, refunds or corrections.</li>
            </ul>
          ),
        },
        {
          heading: "How to pay",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Direct Debit:</strong> set up a mandate so future invoices collect automatically. Collection only happens after you've confirmed the mandate.</li>
              <li><strong>Card:</strong> pay each invoice from your dashboard using a secure Worldpay payment link.</li>
            </ul>
          ),
        },
      ]}
      aeo={[
        { question: "Does ordering start my bill?", answer: "No. Billing begins only after we confirm your service is activated." },
        { question: "Will Direct Debit collect automatically straight away?", answer: "Only once you've confirmed the Direct Debit mandate. We don't collect a Direct Debit without a confirmed mandate." },
        { question: "How can I pay if I haven't set up Direct Debit?", answer: "You can pay any invoice from your dashboard by card via a secure Worldpay payment link." },
      ]}
      faqs={[
        { question: "Where do I see my invoices?", answer: "Sign in to your dashboard. Every invoice has a downloadable PDF and a pay-by-card link if it's outstanding." },
        { question: "What happens if a Direct Debit fails?", answer: "We'll let you know and you can settle the invoice by card. A late fee may apply per the agreed billing terms." },
        { question: "Can I change my billing day?", answer: "Some accounts support a billing day change from your billing settings. If you can't see the option, contact support." },
      ]}
      relatedLinks={[
        { label: "First invoice explained", to: "/first-invoice-explained" },
        { label: "Direct Debit setup", to: "/direct-debit-setup" },
        { label: "Pay by card", to: "/pay-by-card" },
        { label: "Pricing", to: "/pricing" },
        { label: "Cancellation", to: "/cancellation" },
      ]}
      primaryCta={{ label: "Contact support", to: "/support" }}
      secondaryCta={{ label: "Get a quote", to: "/quote/start" }}
      compliance={
        <p>Your accepted agreement and the Price Transparency page contain the binding details of charges, late fees and notice periods. See <a href="/legal/price-transparency" className="underline">Price Transparency</a>.</p>
      }
    />
  );
}
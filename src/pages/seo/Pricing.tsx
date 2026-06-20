import SeoContentLayout from "@/components/seo/SeoContentLayout";

export default function PricingPage() {
  return (
    <SeoContentLayout
      title="OCCTA Pricing — Broadband, Digital Voice, SIM & Business"
      metaDescription="See how OCCTA prices its UK broadband, Digital Voice / Home Phone, SIM-only and business telecom plans. Final price depends on your address and chosen plan — check availability for a confirmed quote."
      canonical="/pricing"
      h1="OCCTA pricing"
      shortAnswer="Your final price depends on the line type available at your address and the plan you choose. We don't quote a single headline figure on this page because every address gets a clean, itemised quote before you order."
      intro={
        <>
          <p>OCCTA provides UK broadband, Digital Voice / Home Phone (which requires broadband), SIM-only and business telecom services. We don't believe in hidden bundle gimmicks — every quote shows the monthly cost, any setup or activation fee, VAT treatment and your billing cycle in one place before you commit.</p>
        </>
      }
      sections={[
        {
          heading: "How OCCTA pricing works",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Address-led:</strong> the line technology available at your address (full fibre, FTTC or copper alternative) sets which plans we can sell you.</li>
              <li><strong>Itemised quote:</strong> monthly recurring price, one-off setup/activation if any, and pro-rata for any part-month at the start.</li>
              <li><strong>VAT:</strong> residential pricing is shown VAT-included. Business pricing is shown VAT-excluded with VAT added at checkout.</li>
              <li><strong>Billing trigger:</strong> billing only starts once your service activation is confirmed — not on order.</li>
              <li><strong>Payment:</strong> Direct Debit setup is available; otherwise pay each invoice by card via a secure Worldpay payment link.</li>
            </ul>
          ),
        },
        {
          heading: "What you'll see on your quote",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li>Monthly plan price and term (e.g. rolling monthly where applicable).</li>
              <li>One-off setup or activation fee, if the line type requires one.</li>
              <li>Pro-rata charges for the days between activation and your first full billing cycle.</li>
              <li>Any optional extras you've selected (e.g. Digital Voice add-on, call bundles).</li>
              <li>VAT line and the total to pay.</li>
            </ul>
          ),
        },
      ]}
      aeo={[
        { question: "Does OCCTA lock me into a long contract?", answer: "Where a flexible monthly option is available for your line type, we offer it. Some plans have a minimum term — your accepted agreement is the binding source of truth on term and cancellation." },
        { question: "When does billing start?", answer: "Billing starts only after your service activation is confirmed. Your first invoice may include the activation fee (if any) and pro-rata charges for the part-month." },
      ]}
      faqs={[
        { question: "Why don't you show one fixed price?", answer: "Available speeds, line technology and setup costs vary by address, so a single headline figure would be misleading. We show your real numbers before you order." },
        { question: "Can I pay by card instead of Direct Debit?", answer: "Yes. Each invoice can be paid via a secure Worldpay-hosted payment link. Direct Debit setup is also available if you prefer automatic collection — and only collects once you've confirmed the mandate." },
        { question: "Do prices include VAT?", answer: "Residential prices include VAT. Business prices are shown excluding VAT, with VAT added at checkout." },
      ]}
      relatedLinks={[
        { label: "Check availability", to: "/coverage" },
        { label: "Broadband plans", to: "/broadband" },
        { label: "Digital Voice / Home Phone", to: "/landline" },
        { label: "Small business telecom", to: "/small-business-telecom" },
        { label: "Billing explained", to: "/billing-explained" },
        { label: "First invoice explained", to: "/first-invoice-explained" },
      ]}
      compliance={
        <p>Prices, speeds and availability depend on your address and the underlying network. Your accepted agreement contains the binding terms including any minimum term, cancellation and notice periods.</p>
      }
    />
  );
}
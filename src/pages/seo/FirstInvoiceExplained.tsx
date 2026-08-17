import SeoContentLayout from "@/components/seo/SeoContentLayout";

export default function FirstInvoiceExplainedPage() {
  return (
    <SeoContentLayout
      title="First Invoice Explained — Activation & Pro-Rata | OCCTA"
      metaDescription="Your first OCCTA invoice may include an activation fee and pro-rata charges for the part-month after activation. Here's exactly what to expect and how to pay."
      canonical="/first-invoice-explained"
      h1="Your first invoice"
      shortAnswer="Your first OCCTA invoice arrives after your service activation is confirmed. It can include three things: your monthly plan charge, any activation fee for your line type, and pro-rata for the days between activation and the start of your regular billing cycle."
      intro={
        <p>This page is about the first invoice specifically. For ongoing billing, see <a href="/billing-explained" className="underline">Billing explained</a>.</p>
      }
      sections={[
        {
          heading: "What can appear on the first invoice",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Activation fee</strong> if your line type requires one. This is shown on your quote before you order.</li>
              <li><strong>Pro-rata charge</strong> for the partial month between activation and your normal billing day.</li>
              <li><strong>First month's plan charge</strong> for the upcoming cycle.</li>
              <li><strong>VAT</strong> — included for residential, shown separately for business.</li>
            </ul>
          ),
        },
        {
          heading: "When it arrives",
          body: (
            <p>Only after we confirm your service is activated — never on order. You'll see it in your dashboard and we'll email you a copy.</p>
          ),
        },
        {
          heading: "How to pay",
          body: (
            <p>By Direct Debit (if your mandate is confirmed) or by card via a secure Worldpay payment link from your dashboard.</p>
          ),
        },
      ]}
      aeo={[
        { question: "Why is my first invoice higher than my monthly price?", answer: "Because it can include a one-off activation fee and pro-rata for the part-month after activation, in addition to your monthly plan charge." },
        { question: "What is pro-rata?", answer: "A charge for the days between activation and the start of your regular monthly billing cycle, so you only pay for the time you've actually had the service." },
      ]}
      faqs={[
        { question: "Will the activation fee come as a surprise?", answer: "No. If an activation fee applies to your line type, it's shown on your itemised quote before you order." },
        { question: "Can I see a breakdown?", answer: "Yes — every invoice shows the line items: plan, pro-rata, activation, VAT and any adjustments." },
        { question: "What if I think the first invoice is wrong?", answer: "Contact support with your invoice number — we'll review it and explain or correct it as needed." },
      ]}
      relatedLinks={[
        { label: "Billing explained", to: "/billing-explained" },
        { label: "Direct Debit setup", to: "/direct-debit-setup" },
        { label: "Pay by card", to: "/pay-by-card" },
        { label: "Pricing", to: "/pricing" },
        { label: "Contact support", to: "/contact" },
      ]}
      primaryCta={{ label: "Check Availability", to: "/broadband" }}
      secondaryCta={{ label: "Contact support", to: "/contact" }}
    />
  );
}
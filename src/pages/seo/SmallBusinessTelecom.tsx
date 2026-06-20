import SeoContentLayout from "@/components/seo/SeoContentLayout";

export default function SmallBusinessTelecomPage() {
  return (
    <SeoContentLayout
      title="Small Business Telecom — Broadband, Voice & SIM | OCCTA"
      metaDescription="OCCTA small business telecom: business broadband, Digital Voice, SIM-only and number management. Honest itemised quotes, VAT shown separately, billing starts on activation."
      canonical="/small-business-telecom"
      h1="Small business telecom"
      shortAnswer="OCCTA provides UK small businesses with broadband, Digital Voice / Home Phone, SIM-only and business telecom services. Business pricing is shown excluding VAT, with a clear itemised quote before you order."
      intro={
        <p>We sell to UK small businesses the same way we sell to residential customers: with an itemised quote, no hidden bundle uplifts, and billing that starts only after the service activation is confirmed.</p>
      }
      sections={[
        {
          heading: "What we offer",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li>Business broadband on the line technology available at your premises.</li>
              <li>Digital Voice / Home Phone for business handsets (requires an active OCCTA broadband line).</li>
              <li>SIM-only mobile plans for your team.</li>
              <li>Number porting where the donating provider supports it.</li>
            </ul>
          ),
        },
        {
          heading: "How business billing differs",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li>Business prices are shown VAT-excluded; VAT is added on the invoice.</li>
              <li>Direct Debit setup is available; you can also pay each invoice by card via a secure Worldpay payment link.</li>
              <li>Cancellation depends on the agreement you accepted — your business contract is the binding source of truth.</li>
            </ul>
          ),
        },
      ]}
      aeo={[
        { question: "Do you tie businesses into long contracts?", answer: "Where a flexible monthly option is applicable to the product, yes — and where the product needs a minimum term, we say so on the quote. Your accepted agreement is the binding source of truth." },
        { question: "Is the SIM-only product separate from broadband?", answer: "Yes — SIM-only can be bought as a standalone product. Digital Voice still requires an active OCCTA broadband line." },
      ]}
      faqs={[
        { question: "Do you support multi-site businesses?", answer: "Yes — we quote each site individually based on what's available at that address." },
        { question: "How do I move my existing business number?", answer: "We start the number port during onboarding once your replacement service is ready. Timing depends on the donating provider's process." },
        { question: "Can I get a VAT invoice?", answer: "Yes — business invoices show VAT as a separate line and meet UK VAT invoice requirements." },
      ]}
      relatedLinks={[
        { label: "Business overview", to: "/business" },
        { label: "Coverage check", to: "/coverage" },
        { label: "Pricing", to: "/pricing" },
        { label: "Direct Debit setup", to: "/direct-debit-setup" },
        { label: "Pay by card", to: "/pay-by-card" },
      ]}
      primaryCta={{ label: "Check business availability", to: "/business" }}
      secondaryCta={{ label: "Talk to business sales", to: "/business-sales" }}
      compliance={
        <p>OCCTA LIMITED is a UK telecom provider. Business prices exclude VAT. Cancellation and notice depend on the business agreement you accept.</p>
      }
    />
  );
}
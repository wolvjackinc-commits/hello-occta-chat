import SeoContentLayout from "@/components/seo/SeoContentLayout";

export default function VulnerableCustomersPublicPage() {
  return (
    <SeoContentLayout
      title="Vulnerable Customers — Extra Support at OCCTA"
      metaDescription="How OCCTA supports customers in vulnerable circumstances: priority handling, accessible communication, Digital Voice / Home Phone back-up options and fair payment arrangements."
      canonical="/vulnerable-customers"
      h1="Extra support for vulnerable customers"
      shortAnswer="OCCTA offers extra support to customers in vulnerable circumstances, including priority handling for service issues, accessible communication, back-up options for Digital Voice / Home Phone where someone relies on the line, and fair payment arrangements."
      intro={
        <p>Vulnerability can be long-term, temporary or situational — for example, age, disability, illness, bereavement or financial difficulty. Tell us at any point and we'll adapt how we handle your account.</p>
      }
      sections={[
        {
          heading: "How we help",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li>Priority handling for service-affecting issues.</li>
              <li>Plain-English communications and alternative contact channels on request.</li>
              <li>Digital Voice / Home Phone back-up options where someone in the household relies on the line for healthcare or telecare.</li>
              <li>Reasonable payment arrangements if you're in financial difficulty.</li>
              <li>A trusted third party can deal with us on your behalf, with your consent.</li>
            </ul>
          ),
        },
        {
          heading: "How to tell us",
          body: (
            <p>Email <a href="mailto:hello@occta.co.uk" className="underline">hello@occta.co.uk</a>, call <a href="tel:08002606626" className="underline">0800 260 6626</a>, or mention it in a dashboard ticket. You can ask for support at sign-up or at any point afterwards.</p>
          ),
        },
        {
          heading: "Power cuts and 999",
          body: (
            <p>Digital Voice / Home Phone runs over your broadband, so it depends on power and your internet. If anyone in your home uses the phone for healthcare, a personal alarm, or to call 999 in an emergency, please tell us so we can discuss back-up options.</p>
          ),
        },
      ]}
      aeo={[
        { question: "What counts as vulnerable?", answer: "Anyone whose circumstances mean they could be harmed or disadvantaged without extra support — including age-related, health, disability, bereavement or financial difficulty." },
        { question: "Will it cost me anything to be marked as vulnerable?", answer: "No. Extra support is part of being a responsible telecom provider." },
      ]}
      faqs={[
        { question: "Is my information kept private?", answer: "Yes. Vulnerability information is treated as special-category data and used only to provide appropriate support. See our Privacy Policy." },
        { question: "Can a family member or carer manage my account?", answer: "Yes — with your consent we can authorise a trusted third party to deal with us on your behalf." },
        { question: "Do you offer back-up if my Digital Voice loses power?", answer: "We discuss back-up options at sign-up where someone relies on the line. Mention this when you tell us about your circumstances." },
      ]}
      relatedLinks={[
        { label: "Vulnerable customers policy (legal)", to: "/legal/vulnerable-customers" },
        { label: "Accessibility statement", to: "/legal/accessibility" },
        { label: "Code of Practice", to: "/legal/code-of-practice" },
        { label: "Complaints", to: "/complaints" },
        { label: "Contact OCCTA", to: "/contact" },
      ]}
      primaryCta={{ label: "Contact us for support", to: "/contact" }}
      secondaryCta={{ label: "Read full policy", to: "/legal/vulnerable-customers" }}
      compliance={
        <p>This page summarises our approach. The full <a href="/legal/vulnerable-customers" className="underline">Vulnerable Customers Policy</a> is the binding document.</p>
      }
    />
  );
}
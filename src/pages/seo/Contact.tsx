import SeoContentLayout from "@/components/seo/SeoContentLayout";
import { JsonLd } from "@/components/seo";
import { companyConfig } from "@/lib/companyConfig";

export default function ContactPage() {
  const contactSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: companyConfig.name,
    url: "https://www.occta.co.uk/",
    email: companyConfig.email.general,
    telephone: companyConfig.phone.display,
    address: {
      "@type": "PostalAddress",
      streetAddress: companyConfig.address.street,
      addressLocality: companyConfig.address.city,
      postalCode: companyConfig.address.postcode,
      addressCountry: companyConfig.address.countryCode,
      addressRegion: companyConfig.address.region,
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        telephone: companyConfig.phone.display,
        email: companyConfig.email.general,
        areaServed: "GB",
        availableLanguage: ["en"],
      },
    ],
  };
  return (
    <>
      <JsonLd data={contactSchema} />
      <SeoContentLayout
        title="Contact OCCTA — Phone, Email and Address"
        metaDescription="Contact OCCTA: 0800 260 6626, hello@occta.co.uk, or write to OCCTA LIMITED, 22 Pavilion View, Huddersfield, HD3 3WU. UK telecom support for broadband, Digital Voice and SIM."
        canonical="/contact"
        h1="Contact OCCTA"
        shortAnswer="Phone 0800 260 6626, email hello@occta.co.uk, or write to OCCTA LIMITED, 22 Pavilion View, Huddersfield, West Yorkshire, HD3 3WU. We don't operate a public shop or branch."
        intro={
          <p>OCCTA is a UK telecom provider. Use any of the channels below — Ollie, our AI assistant in the bottom-right of every page, can also help with most account, billing and order questions.</p>
        }
        sections={[
          {
            heading: "Ways to contact us",
            body: (
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Phone:</strong> <a href="tel:08002606626" className="underline">0800 260 6626</a></li>
                <li><strong>Email:</strong> <a href="mailto:hello@occta.co.uk" className="underline">hello@occta.co.uk</a></li>
                <li><strong>Ollie:</strong> the chat icon in the bottom-right of every page.</li>
                <li><strong>Support tickets:</strong> raise one from your dashboard for account-specific issues.</li>
              </ul>
            ),
          },
          {
            heading: "Registered office",
            body: (
              <address className="not-italic">
                OCCTA LIMITED<br />
                22 Pavilion View<br />
                Huddersfield<br />
                West Yorkshire<br />
                HD3 3WU<br />
                United Kingdom
              </address>
            ),
          },
          {
            heading: "What we can help with",
            body: (
              <ul className="list-disc pl-5 space-y-2">
                <li>Availability and quotes for broadband, Digital Voice / Home Phone and SIM.</li>
                <li>Order, activation and switching questions.</li>
                <li>Billing, Direct Debit and pay-by-card queries.</li>
                <li>Faults, service status and complaints.</li>
              </ul>
            ),
          },
        ]}
        aeo={[
          { question: "Does OCCTA have a shop or branch I can visit?", answer: "No. OCCTA operates online and by phone — the address above is our registered office, not a public shop." },
          { question: "What's the fastest way to get help?", answer: "Phone for service-affecting issues. Use Ollie or a dashboard ticket for account or billing questions where written history helps." },
        ]}
        relatedLinks={[
          { label: "Support hub", to: "/support" },
          { label: "Complaints", to: "/complaints" },
          { label: "Service status", to: "/status" },
          { label: "Billing explained", to: "/billing-explained" },
          { label: "Vulnerable customers", to: "/vulnerable-customers" },
        ]}
        primaryCta={{ label: "Open support hub", to: "/support" }}
        secondaryCta={{ label: "Raise a complaint", to: "/complaints" }}
      />
    </>
  );
}
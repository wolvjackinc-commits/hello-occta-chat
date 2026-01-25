import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { companyConfig } from "@/lib/companyConfig";

const sections = [
  {
    title: "1. Who We Are",
    content: [
      `${companyConfig.name} is the data controller responsible for your personal data.`,
      `Name: ${companyConfig.name}`,
      `Registered address: ${companyConfig.address.full}`,
      `Website: ${companyConfig.website.url}`,
      `Email: ${companyConfig.email.support}`,
    ],
  },
  {
    title: "2. What Personal Data We Collect",
    content: [
      "Information You Provide",
      "• Name, address, contact details",
      "• Account login credentials",
      "• Billing and service information",
      "• Support communications",
      "",
      "Automatically Collected Data",
      "• IP address",
      "• Device & browser details",
      "• Website interaction and cookies",
      "• Service usage logs",
      "",
      "Payment Information",
      "Full payment card/bank details are not stored by us; these are handled securely by authorised third parties.",
    ],
  },
  {
    title: "3. How We Use Your Data",
    content: [
      "We use your data to:",
      "• Provide, operate, and manage our services",
      "• Create/support customer accounts",
      "• Process payments",
      "• Improve website and services",
      "• Communicate service changes, billing notices, or important messages",
      "• Comply with legal obligations",
      "",
      "We process personal data only where we have a lawful basis under UK GDPR — such as contractual necessity, legal compliance, legitimate interests, or consent.",
    ],
  },
  {
    title: "4. Cookies and Tracking Technologies",
    content: [
      `${companyConfig.website.domain} uses cookies and similar technologies.`,
      "We follow PECR rules, which require consent for storage and access to information on devices. You can manage cookie consent via our cookie banner and browser settings.",
    ],
  },
  {
    title: "5. Marketing and Communications",
    content: [
      "We will only send marketing communications where you have opted in, and all direct marketing complies with UK GDPR and PECR. You can opt out at any time.",
    ],
  },
  {
    title: "6. Security and Protection",
    content: [
      "We implement reasonable technical & organisational measures to protect your data and services, including encryption, secure servers, access controls, and monitoring to prevent unauthorised access.",
    ],
  },
  {
    title: "7. Sharing Your Data",
    content: [
      "We do not sell personal data. We may share data with:",
      "• Payment providers",
      "• IT, hosting & cloud services",
      "• Customer support partners",
      "• Legal authorities if required",
      "",
      "We ensure third parties protect your data to UK GDPR standards.",
    ],
  },
  {
    title: "8. International Transfers",
    content: [
      "Transfers outside the UK will be secured with appropriate safeguards (e.g., UK adequacy decisions or standard contractual clauses).",
    ],
  },
  {
    title: "9. Your Rights",
    content: [
      "Under UK GDPR, you have the right to:",
      "• Access and correct your data",
      "• Request erasure or restriction of processing",
      "• Object to processing",
      "• Data portability",
      "• Withdraw consent",
      "• Lodge a complaint with the Information Commissioner's Office (ICO)",
      "",
      "ICO: https://www.ico.org.uk",
    ],
  },
  {
    title: "10. Retention",
    content: [
      "We retain data only as long as necessary for service fulfilment or legal requirements, then securely delete or anonymise it.",
    ],
  },
  {
    title: "11. Children",
    content: [
      "Our services are not for under-18s. We do not intentionally collect data from minors.",
    ],
  },
  {
    title: "12. Changes to This Policy",
    content: [
      `We may update this policy. The latest version will always be at ${companyConfig.website.domain}/privacy-policy with the date updated.`,
    ],
  },
  {
    title: "13. Contact Us",
    content: [
      companyConfig.name,
      companyConfig.address.street,
      `${companyConfig.address.city}, ${companyConfig.address.postcode}`,
      `📧 ${companyConfig.email.support}`,
    ],
  },
];

const PrivacyPolicy = () => {
  return (
    <Layout>
      <SEO 
        title="Privacy Policy"
        description="OCCTA's Privacy Policy. Learn how we collect, use, and protect your personal data in compliance with UK GDPR and Data Protection Act 2018."
        canonical="/privacy"
      />
      <section className="min-h-[calc(100vh-80px)] py-12 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-10 card-brutal bg-card p-8">
              <p className="font-display uppercase text-primary text-sm">Privacy Policy</p>
              <h1 className="text-display-md mt-2">{companyConfig.name}</h1>
              <p className="text-muted-foreground mt-2">Last updated: 18 January 2026</p>
              <p className="text-muted-foreground mt-4">
                {companyConfig.name} ("{companyConfig.tradingName}", "we", "us", or "our") is committed to protecting and
                respecting your privacy. This Privacy Policy explains how we collect, use,
                store, share, and protect your personal data when you visit or use our website {companyConfig.website.url}, our services, or communicate with us.
              </p>
              <p className="text-muted-foreground mt-4">
                This policy is designed to comply with UK General Data Protection Regulation
                (UK GDPR), the Data Protection Act 2018, the Privacy and Electronic
                Communications Regulations (PECR), and all other applicable UK data protection
                and telecoms regulations.
              </p>
            </div>

            <div className="space-y-6">
              {sections.map((section) => (
                <div key={section.title} className="card-brutal bg-card p-6">
                  <h2 className="text-display-sm mb-4">{section.title}</h2>
                  <div className="space-y-2 text-muted-foreground text-sm">
                    {section.content.map((line, index) => (
                      <p key={`${section.title}-${index}`}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default PrivacyPolicy;

import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { companyConfig } from "@/lib/companyConfig";

const sections = [
  {
    title: "1. What This Policy Covers",
    content: [
      `This Cookie Policy explains how ${companyConfig.name} ("${companyConfig.tradingName}", "we", "us", or "our") uses cookies and similar technologies on ${companyConfig.website.url}.`,
      "It sits alongside our Privacy Policy and applies to visitors, customers, and business users of our services.",
    ],
  },
  {
    title: "2. What Cookies Are",
    content: [
      "Cookies are small text files placed on your device by a website.",
      "They help the site work, remember your choices, and measure how the site is used.",
      "Similar technologies include local storage, pixels, and SDKs used in apps or embedded tools.",
    ],
  },
  {
    title: "3. The Rules We Follow",
    content: [
      "We comply with UK GDPR, the Privacy and Electronic Communications Regulations (PECR), and ICO cookie guidance.",
      "PECR requires consent for non-essential cookies and for storing or accessing information on your device.",
      "We also align with bank and payment-provider expectations, including minimising data, using secure processing, and protecting payment journeys.",
    ],
  },
  {
    title: "4. Types of Cookies We Use",
    content: [
      "Essential cookies",
      "• Required for core site functionality and security (e.g., page navigation, fraud prevention, load balancing).",
      "• These do not require consent, but you can block them in your browser at the risk of breaking the site.",
      "",
      "Functional cookies",
      "• Remember your preferences (e.g., language, region, and accessibility choices).",
      "• We only use these with your consent.",
      "",
      "Analytics cookies",
      "• Help us understand how the site is used and how we can improve it.",
      "• We only use these with your consent and aim to use privacy-friendly settings.",
      "",
      "Marketing cookies",
      "• Used to show relevant offers and measure marketing effectiveness.",
      "• We only use these with your consent, and we do not sell your data.",
    ],
  },
  {
    title: "5. Our Legal Basis for Cookies",
    content: [
      "Essential cookies are used on the basis of legitimate interests to provide a secure, working service.",
      "All other cookies are used only when you have given explicit consent via our cookie banner or settings.",
      "You can withdraw consent at any time.",
    ],
  },
  {
    title: "6. How to Manage Cookies",
    content: [
      "Cookie banner: You can accept, reject, or customise non-essential cookies when you first visit.",
      "Cookie settings: You can change your preferences at any time using the cookie settings link (if available on the site).",
      "Browser controls: Most browsers let you block or delete cookies. Doing so may affect how the site works.",
    ],
  },
  {
    title: "7. Third-Party Cookies",
    content: [
      "Some cookies are set by third parties when we use their services, such as analytics, payment processing, or embedded content.",
      "These providers must meet our security and data protection requirements and are bound by contracts that reflect UK GDPR standards.",
      "Payment pages and checkout processes are protected to banking standards, and full payment details are handled securely by authorised payment providers.",
    ],
  },
  {
    title: "8. How Long Cookies Last",
    content: [
      "Session cookies: deleted when you close your browser.",
      "Persistent cookies: stay for a set period or until you delete them.",
      "We set cookies for the shortest time needed for their purpose and review them regularly.",
    ],
  },
  {
    title: "9. Do Not Track and Global Privacy Controls",
    content: [
      "Some browsers offer 'Do Not Track' or global privacy signals.",
      "We consider these signals as part of our consent tools, but they may not replace a specific opt-in or opt-out choice.",
    ],
  },
  {
    title: "10. Updates to This Policy",
    content: [
      "We may update this Cookie Policy from time to time.",
      `The latest version will always be available at ${companyConfig.website.url}/cookies with the date updated.`,
    ],
  },
  {
    title: "11. Contact Us",
    content: [
      companyConfig.name,
      companyConfig.address.street,
      `${companyConfig.address.city}, ${companyConfig.address.postcode}`,
      `📧 ${companyConfig.email.support}`,
    ],
  },
];

const CookiePolicy = () => {
  return (
    <Layout>
      <SEO 
        title="Cookie Policy"
        description="OCCTA Cookie Policy. How we use cookies on our website. Compliant with UK GDPR and PECR regulations."
        canonical="/cookies"
      />
      <section className="min-h-[calc(100vh-80px)] py-12 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-10 card-brutal bg-card p-8">
              <p className="font-display uppercase text-primary text-sm">Cookie Policy</p>
              <h1 className="text-display-md mt-2">{companyConfig.name}</h1>
              <p className="text-muted-foreground mt-2">Last updated: 18 January 2026</p>
              <p className="text-muted-foreground mt-4">
                This Cookie Policy explains how we use cookies and similar technologies to make
                our website work, to keep it secure, and (with your consent) to measure and
                improve it. It is written in clear, plain English and follows UK GDPR, PECR,
                and ICO guidance.
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

export default CookiePolicy;

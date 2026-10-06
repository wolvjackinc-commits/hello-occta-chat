import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { companyConfig } from "@/lib/companyConfig";
import {
  CONTRACT_INFORMATION_INTRO,
  CONTRACT_INFORMATION_SECTIONS,
  CONTRACT_INFORMATION_VERSION,
} from "@/lib/legal/contractInformation";

const TermsOfService = () => {
  return (
    <Layout>
      <SEO
        title="Consumer Terms & Contract Information"
        description="OCCTA consumer contract information and customer agreement terms for broadband and optional Digital Voice."
        canonical="/terms"
      />
      <section className="min-h-[calc(100vh-80px)] py-12 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-10 card-brutal bg-card p-8">
              <p className="font-display uppercase text-primary text-sm">Consumer contract terms</p>
              <h1 className="text-display-md mt-2">{companyConfig.name} — Contract Information & Customer Agreement</h1>
              <p className="text-muted-foreground mt-2">Production version {CONTRACT_INFORMATION_VERSION} · effective for new consumer contracts from 6 October 2026</p>
              <p className="text-muted-foreground mt-4">{CONTRACT_INFORMATION_INTRO}</p>
              <p className="text-muted-foreground mt-4">
                Your customer-specific Contract Summary and issued Contract Information Pack remain the authoritative record of the price, service, term and charges you accepted. Historic accepted contracts retain the version originally agreed.
              </p>
            </div>
            <div className="space-y-6">
              {CONTRACT_INFORMATION_SECTIONS.map((section) => (
                <div key={section.heading} className="card-brutal bg-card p-6">
                  <h2 className="text-display-sm mb-4">{section.heading}</h2>
                  <div className="space-y-2 text-muted-foreground text-sm">
                    {section.paragraphs.map((line, index) => (
                      <p key={`${section.heading}-${index}`}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 card-brutal bg-card p-6 text-sm text-muted-foreground">
              <p><strong className="text-foreground">Company:</strong> {companyConfig.name} · Company No. {companyConfig.companyNumber}</p>
              <p><strong className="text-foreground">Registered office:</strong> {companyConfig.address.full}</p>
              <p><strong className="text-foreground">Contact:</strong> {companyConfig.phone.display} · {companyConfig.email.support} · {companyConfig.website.url}</p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};
export default TermsOfService;

import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import PolicyDocument from "@/components/brand/PolicyDocument";
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
      <PolicyDocument
        kicker="Consumer contract terms"
        title={<>{companyConfig.name} — Contract Information & Customer Agreement</>}
        meta={<>Production version {CONTRACT_INFORMATION_VERSION} · effective for new consumer contracts from 6 October 2026</>}
        intro={
          <>
            <p>{CONTRACT_INFORMATION_INTRO}</p>
            <p>
              Your customer-specific Contract Summary and issued Contract Information Pack remain the authoritative record of the price, service, term and charges you accepted. Historic accepted contracts retain the version originally agreed.
            </p>
          </>
        }
        sections={CONTRACT_INFORMATION_SECTIONS.map((s) => ({ heading: s.heading, lines: s.paragraphs }))}
        footer={
          <>
            <p><strong className="text-foreground">Company:</strong> {companyConfig.name} · Company No. {companyConfig.companyNumber}</p>
            <p><strong className="text-foreground">Registered office:</strong> {companyConfig.address.full}</p>
            <p><strong className="text-foreground">Contact:</strong> {companyConfig.phone.display} · {companyConfig.email.support} · {companyConfig.website.url}</p>
          </>
        }
      />
    </Layout>
  );
};
export default TermsOfService;

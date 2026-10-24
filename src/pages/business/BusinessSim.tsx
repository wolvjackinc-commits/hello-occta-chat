import { Link } from "react-router-dom";
import CategoryLinks from "@/components/seo/CategoryLinks";
import PageExplainer from "@/components/seo/PageExplainer";
import { MotionConfig } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { businessSim } from "@/lib/business/catalogue";
import VatExPrice from "@/components/business/VatExPrice";
import BusinessTrustBar from "@/components/business/BusinessTrustBar";
import { BusinessLeadBand, BusinessProductCard, LeadForm } from "@/components/business/BusinessKit";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, TicketSlab } from "@/components/brand/kit";
import { SimArt } from "@/components/brand/illustrations";

const BusinessSimPage = () => (
  <Layout>
    <SEO
      title="Business SIMs — Pooled Data, 5G, EU Roaming"
      description="Business SIMs from £7.50/line + VAT. Pooled data, 5G where available, EU roaming, unlimited UK minutes and one consolidated invoice."
      canonical="/business/sim"
      keywords="business SIM UK, pooled data SIM, 5G business SIM, multi-line SIM UK"
    />
    <MotionConfig reducedMotion="user">
      <PosterStage ghost="5G">
        <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Business", to: "/business" }, { label: "Business SIMs" }]} />
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_400px] xl:gap-20">
          <div>
            <HeroKicker>Business SIMs</HeroKicker>
            <HeroTitle size="md">
              One SIM plan. Whole team.
              {" "}<span className="block text-primary">One bill.</span>
            </HeroTitle>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">Pooled data means big users share with light users. Add and remove lines any month, no renegotiation.</p>
            <Link to="/business/contact-sales" className="mt-8 inline-block">
              <Button variant="hero" size="lg">Get a quote <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
          </div>
          <TicketSlab className="mr-3 mb-3">
            <div className="border-[3px] border-white bg-white p-8">
              <SimArt className="mx-auto h-auto w-full max-w-[300px]" />
            </div>
          </TicketSlab>
        </div>
      </PosterStage>
      <BusinessTrustBar />
      <BrandSection tone="paper">
        <Reveal>
          <SectionEyebrow index="01" label="Plans" />
          <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Lines for every team</h2>
        </Reveal>
        <Reveal stagger className="mt-10 grid gap-6 md:grid-cols-3">
          {businessSim.map((p, i) => (
            <BusinessProductCard
              key={p.id}
              name={p.name}
              summary={p.summary}
              price={<VatExPrice amount={p.priceExVat} unit={p.unit} size="lg" />}
              features={p.features}
              ctaTo="/business/contact-sales"
              ctaLabel="Get a quote"
              featured={i === 1}
            />
          ))}
        </Reveal>
      </BrandSection>
      <BusinessLeadBand index="02" title="Rolling out 5+ SIMs?">
        <LeadForm interest="sim" source="business_sim" heading="Rolling out 5+ SIMs?" />
      </BusinessLeadBand>
      <PageExplainer
        title="Business SIMs, explained"
        paragraphs={[
          "Business SIM plans give each member of your team a mobile line with UK calls, texts and data, billed to the company on one VAT invoice. OCCTA business SIMs are available on the O2, Vodafone and EE networks, so you can choose the coverage that works best where your team works.",
          "Choose a 30-day rolling plan for flexibility or a 24-month plan for a lower monthly price. eSIM is available on compatible phones, data-only SIMs are available for tablets, laptops and 4G/5G routers, and existing business numbers can usually be ported with a PAC code.",
        ]}
        faqs={[
          { question: "Which networks do OCCTA business SIMs use?", answer: "OCCTA business SIM plans are available on O2, Vodafone and EE, with data-only plans on O2 and Vodafone." },
          { question: "Can we keep our existing mobile numbers?", answer: "Yes. Request a PAC for each number from your current provider and we'll port them across." },
          { question: "Are business SIM prices shown with VAT?", answer: "Business prices are shown excluding VAT, and you receive a VAT invoice." },
          { question: "Can I add or remove lines?", answer: "Yes. Talk to our business team about adding lines. Each line's term, and any charge for ending it early, is set out when you order." },
          { question: "Do you offer data-only SIMs for routers and tablets?", answer: "Yes. Business mobile broadband SIMs are available on the O2 and Vodafone networks." },
        ]}
        schema={[
          { "@type": "Service", name: "OCCTA business SIMs", serviceType: "Business mobile", url: "https://www.occta.co.uk/business/sim", provider: { "@id": "https://www.occta.co.uk/#organization" }, areaServed: { "@type": "Country", name: "United Kingdom" } },
          { "@type": "BreadcrumbList", itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://www.occta.co.uk/" },
            { "@type": "ListItem", position: 2, name: "Business", item: "https://www.occta.co.uk/business" },
            { "@type": "ListItem", position: 3, name: "Business SIMs", item: "https://www.occta.co.uk/business/sim" },
          ] },
        ]}
      />
      <CategoryLinks family="business" exclude="/business/sim" />
    </MotionConfig>
  </Layout>
);

export default BusinessSimPage;

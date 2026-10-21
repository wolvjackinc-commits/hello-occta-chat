import { Link } from "react-router-dom";
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
    </MotionConfig>
  </Layout>
);

export default BusinessSimPage;

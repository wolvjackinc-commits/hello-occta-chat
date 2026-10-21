import { Link } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { businessVoice } from "@/lib/business/catalogue";
import VatExPrice from "@/components/business/VatExPrice";
import BusinessTrustBar from "@/components/business/BusinessTrustBar";
import { BusinessLeadBand, BusinessProductCard, LeadForm } from "@/components/business/BusinessKit";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, TicketSlab } from "@/components/brand/kit";
import { VoiceArt } from "@/components/brand/illustrations";

const BusinessVoicePage = () => (
  <Layout>
    <SEO
      title="Hosted VoIP & SIP Trunks for Business — UK"
      description="Hosted VoIP from £6.95/seat + VAT. SIP trunks from £5.95 + VAT. UK numbers, call queues, softphones, TLS, and free number porting."
      canonical="/business/voice"
      keywords="hosted VoIP UK, business phone system, SIP trunks UK, cloud PBX, number porting"
    />
    <MotionConfig reducedMotion="user">
      <PosterStage ghost="VOIP">
        <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Business", to: "/business" }, { label: "Hosted VoIP & SIP" }]} />
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_400px] xl:gap-20">
          <div>
            <HeroKicker>Hosted VoIP &amp; SIP</HeroKicker>
            <HeroTitle size="md">
              Cloud phone system.
              {" "}<span className="block text-primary">Zero on-prem headache.</span>
            </HeroTitle>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">Softphones, desk phones, auto attendants, call queues, recording. Port your existing numbers with no downtime.</p>
            <Link to="/business/contact-sales" className="mt-8 inline-block">
              <Button variant="hero" size="lg">Get a quote <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
          </div>
          <TicketSlab className="mr-3 mb-3">
            <div className="border-[3px] border-white bg-primary p-8">
              <VoiceArt className="mx-auto h-auto w-full max-w-[300px]" />
            </div>
          </TicketSlab>
        </div>
      </PosterStage>
      <BusinessTrustBar />
      <BrandSection tone="paper">
        <Reveal>
          <SectionEyebrow index="01" label="Plans" />
          <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Pick your phone system</h2>
        </Reveal>
        <Reveal stagger className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-2">
          {businessVoice.map((p, i) => (
            <BusinessProductCard
              key={p.id}
              name={p.name}
              summary={p.summary}
              price={<VatExPrice amount={p.priceExVat} unit={p.unit} size="lg" />}
              features={p.features}
              ctaTo="/business/contact-sales"
              ctaLabel="Get a quote"
              featured={i === 0}
            />
          ))}
        </Reveal>
      </BrandSection>
      <BusinessLeadBand index="02" title="Need help sizing seats?">
        <LeadForm interest="voice" source="business_voice" heading="Need help sizing seats?" />
      </BusinessLeadBand>
    </MotionConfig>
  </Layout>
);

export default BusinessVoicePage;

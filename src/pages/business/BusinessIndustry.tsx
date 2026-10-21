import { Link, useParams, Navigate } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { businessIndustries, businessBundles, type BusinessIndustrySlug } from "@/lib/business/catalogue";
import VatExPrice from "@/components/business/VatExPrice";
import BusinessTrustBar from "@/components/business/BusinessTrustBar";
import { BusinessLeadBand, LeadForm } from "@/components/business/BusinessKit";
import { AlertCircle, ArrowRight, Check } from "lucide-react";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, TicketSlab } from "@/components/brand/kit";
import { BuildingArt } from "@/components/brand/illustrations";

const BusinessIndustryPage = () => {
  const { slug } = useParams<{ slug: BusinessIndustrySlug }>();
  const industry = slug ? businessIndustries[slug as BusinessIndustrySlug] : undefined;
  if (!industry) return <Navigate to="/business" replace />;
  const bundle = businessBundles.find((b) => b.id === industry.bundle);

  return (
    <Layout>
      <SEO
        title={`Business Broadband & Phones for ${industry.name} — UK`}
        description={`${industry.hero} OCCTA designs business broadband, VoIP and mobile options around the exact site, with transparent VAT and service terms confirmed before order.`}
        canonical={`/business/industries/${industry.slug}`}
        keywords={`business broadband for ${industry.name.toLowerCase()}, ${industry.name.toLowerCase()} phone system, business wifi ${industry.name.toLowerCase()}`}
      />
      <MotionConfig reducedMotion="user">
        <PosterStage>
          <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Business", to: "/business" }, { label: industry.name }]} />
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-20">
            <div>
              <HeroKicker>For {industry.name}</HeroKicker>
              <HeroTitle size="sm">{industry.hero}</HeroTitle>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">A practical telecom design for {industry.name.toLowerCase()} teams, with availability, care level and resilience options checked against the actual site.</p>
            </div>
            <div className="hidden border-[3px] border-white bg-white p-6 lg:block">
              <BuildingArt className="h-auto w-full" />
            </div>
          </div>
        </PosterStage>
        <BusinessTrustBar />
        <BrandSection tone="paper">
          <div className="grid gap-6 lg:grid-cols-2">
            <Reveal className="border-[3px] border-foreground bg-[hsl(0_0%_5%)] p-7 text-white">
              <SectionEyebrow index="01" label="The problem" tone="dark" />
              <AlertCircle className="mt-6 h-8 w-8 text-primary" />
              <h2 className="mt-3 font-display text-4xl uppercase leading-none">Sound familiar?</h2>
              <p className="mt-4 text-lg leading-relaxed text-white/75">{industry.pain}</p>
            </Reveal>
            <Reveal className="border-[3px] border-foreground bg-card p-7">
              <SectionEyebrow index="02" label="The fix" />
              <h2 className="mt-6 font-display text-4xl uppercase leading-none">What we recommend checking</h2>
              <ul className="mt-5 space-y-3">
                {industry.solution.map((s) => (
                  <li key={s} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center bg-primary text-black" aria-hidden><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                    {s}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </BrandSection>
        {bundle && (
          <BrandSection tone="dark">
            <div className="grid items-center gap-10 md:grid-cols-2 lg:gap-20">
              <Reveal>
                <SectionEyebrow index="03" label="Recommended bundle design" tone="dark" />
                <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">{bundle.name}</h2>
                <p className="mt-4 text-lg text-white/70">{bundle.tagline}</p>
                <div className="mt-6">
                  {bundle.priceExVat != null ? (
                    <VatExPrice amount={bundle.priceExVat} size="xl" />
                  ) : (
                    <div className="font-display text-4xl uppercase text-primary">Tailored to your site</div>
                  )}
                </div>
              </Reveal>
              <TicketSlab className="mr-3 mb-3">
                <div className="border-[3px] border-white bg-white p-6 text-black">
                  <ul className="space-y-2.5">
                    {bundle.includes.map((f) => (
                      <li key={f} className="flex gap-2.5 text-sm">
                        <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center bg-black text-primary" aria-hidden><Check className="h-3 w-3" strokeWidth={3} /></span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to={`/business/quote?service=bundle&bundle=${encodeURIComponent(bundle.id)}`} className="mt-6 block">
                    <Button className="w-full border-[3px] border-black bg-black text-primary hover:bg-primary hover:text-black">Build this quote <ArrowRight className="ml-1 h-4 w-4" /></Button>
                  </Link>
                </div>
              </TicketSlab>
            </div>
          </BrandSection>
        )}
        <BusinessLeadBand index={bundle ? "04" : "03"} title={`Talk to a ${industry.name} specialist`}>
          <LeadForm source={`industry_${industry.slug}`} heading={`Talk to a ${industry.name} specialist`} />
        </BusinessLeadBand>
      </MotionConfig>
    </Layout>
  );
};

export default BusinessIndustryPage;

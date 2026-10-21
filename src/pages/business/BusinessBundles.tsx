import { MotionConfig } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { businessBundles } from "@/lib/business/catalogue";
import VatExPrice from "@/components/business/VatExPrice";
import BusinessTrustBar from "@/components/business/BusinessTrustBar";
import { BusinessProductCard, QuoteBlock } from "@/components/business/BusinessKit";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow } from "@/components/brand/kit";
import { BuildingArt } from "@/components/brand/illustrations";

const BusinessBundlesPage = () => (
  <Layout>
    <SEO
      title="Business Bundles — Broadband + VoIP + SIM"
      description="Build a business telecom bundle around your real sites, users and resilience needs. Broadband, VoIP and SIM pricing is checked against the selected service route before contract."
      canonical="/business/bundles"
      keywords="business broadband bundle, business phone and internet bundle, small business telecom package UK"
    />
    <MotionConfig reducedMotion="user">
      <PosterStage>
        <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Business", to: "/business" }, { label: "Bundles" }]} />
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_380px] xl:gap-20">
          <div>
            <HeroKicker>Broadband + VoIP + SIM</HeroKicker>
            <HeroTitle size="md">
              One bundle.
              {" "}<span className="block text-primary">Priced from the real requirement.</span>
            </HeroTitle>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/70">Choose a bundle design, then OCCTA prices the exact broadband route, voice seats, SIMs, equipment and care options. That keeps the quote commercially sustainable and avoids hidden substitutions later.</p>
          </div>
          <div className="hidden border-[3px] border-white bg-white p-6 lg:block">
            <BuildingArt className="h-auto w-full" />
          </div>
        </div>
      </PosterStage>
      <BusinessTrustBar />
      <BrandSection tone="paper">
        <Reveal>
          <SectionEyebrow index="01" label="Bundle designs" />
          <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Pick a starting point</h2>
        </Reveal>
        <Reveal stagger className="mt-12 grid gap-6 md:grid-cols-3">
          {businessBundles.map((b, i) => (
            <BusinessProductCard
              key={b.id}
              eyebrow={b.bestFor}
              name={b.name}
              summary={b.tagline}
              price={
                b.priceExVat != null ? (
                  <VatExPrice amount={b.priceExVat} size="xl" />
                ) : (
                  <QuoteBlock title="Tailored quote" note="No loss-leading bundle price: each underlying service is costed first." />
                )
              }
              features={b.includes}
              ctaTo={`/business/quote?service=bundle&bundle=${encodeURIComponent(b.id)}`}
              ctaLabel={b.cta ?? `Build ${b.name} quote`}
              featured={i === 1}
              badge={i === 1 ? "Popular design" : undefined}
            />
          ))}
        </Reveal>
        <p className="text-xs text-muted-foreground mt-10 max-w-4xl leading-relaxed">Any broadband installation, router, static IP, enhanced care, mobile roaming or number-porting charges are shown separately where applicable. The final contractual price and minimum term are confirmed before acceptance.</p>
      </BrandSection>
    </MotionConfig>
  </Layout>
);

export default BusinessBundlesPage;

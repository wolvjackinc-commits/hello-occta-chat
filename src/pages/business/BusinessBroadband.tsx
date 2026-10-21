import { Link } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { businessBroadband } from "@/lib/business/catalogue";
import VatExPrice from "@/components/business/VatExPrice";
import BusinessTrustBar from "@/components/business/BusinessTrustBar";
import { BusinessLeadBand, BusinessProductCard, LeadForm, QuoteBlock } from "@/components/business/BusinessKit";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, TicketSlab } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";

const steps = [
  ["01", "Address check", "Select the exact service address and the capacity you want."],
  ["02", "Commercial qualification", "OCCTA checks available speed, current supplier economics and any non-standard requirements."],
  ["03", "Quote & contract", "You receive a clear VAT breakdown, service terms, setup and care information before acceptance."],
  ["04", "Provisioning", "Only an accepted, payment-ready order moves to supplier provisioning; manual supplier steps are tracked rather than falsely marked complete."],
];

const BusinessBroadbandPage = () => (
  <Layout>
    <SEO
      title="Business broadband for UK companies"
      description="Business broadband from £34.99/mo ex VAT (£41.99 inc VAT). Address-led quotes for SoGEA and full fibre, with network, setup and care confirmed before order."
      canonical="/business/broadband"
      keywords="business broadband UK, business fibre broadband, sogea business, gigabit business broadband, leased line UK, static IP broadband"
    />

    <MotionConfig reducedMotion="user">
      <PosterStage ghost="B2B">
        <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Business", to: "/business" }, { label: "Business broadband" }]} />
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_420px] xl:gap-20">
          <div>
            <HeroKicker>Business pricing protected by supplier-cost checks</HeroKicker>
            <HeroTitle size="md">
              Business broadband
              {" "}<span className="block text-primary">without a loss-leading surprise.</span>
            </HeroTitle>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/70">
              Choose the capacity you need, check the service address and let OCCTA match the safest available network route. We show both ex-VAT and inc-VAT pricing and confirm setup, router, care level and any cease or migration charges before you accept a contract.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/business/quote?service=broadband"><Button variant="hero" size="lg">Check address & build quote <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
              <Link to="/business/contact-sales"><Button variant="outline" size="lg">Complex or multi-site?</Button></Link>
            </div>
          </div>
          <TicketSlab className="mr-3 mb-3">
            <div className="border-[3px] border-white bg-[hsl(0_0%_8%)]">
              <div className="flex items-center gap-2 border-b-[3px] border-white bg-primary px-5 py-3 text-black">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-display text-2xl uppercase leading-none">Business Switch Pack</span>
              </div>
              <div className="p-5 sm:p-6">
                <p className="text-sm text-white/65">Designed to remove avoidable upfront friction without hiding network costs.</p>
                <ul className="mt-4 space-y-3 text-sm text-white/85">
                  {[
                    "£0 standard network connection where the selected supplier/term genuinely waives it.",
                    "No automatic substitution to a different plan, network price or term.",
                    "Router, static IP, enhanced care and continuity are optional and itemised.",
                  ].map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center bg-primary text-black" aria-hidden><Check className="h-3 w-3" strokeWidth={3} /></span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </TicketSlab>
        </div>
      </PosterStage>

      <BusinessTrustBar />

      <BrandSection tone="paper">
        <Reveal className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:items-end">
          <div>
            <SectionEyebrow index="01" label="Capacity" />
            <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Choose a capacity band</h2>
          </div>
          <p className="text-base leading-relaxed text-foreground/70">These are OCCTA marketing anchors, not a promise that every carrier is available at every address. The quote engine and final contract use the current supplier catalogue.</p>
        </Reveal>
        <Reveal stagger className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {businessBroadband.map((p) => (
            <BusinessProductCard
              key={p.id}
              eyebrow={p.speed}
              name={p.name}
              summary={p.summary}
              price={
                p.priceExVat != null ? (
                  <>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">From</div>
                    <VatExPrice amount={p.priceExVat} unit={p.unit} size="lg" />
                  </>
                ) : (
                  <QuoteBlock title="Site-specific quote" note={p.quoteReason} />
                )
              }
              features={p.features}
              ctaTo={`/business/quote?service=broadband&tier=${encodeURIComponent(p.id)}`}
              ctaLabel={p.pricingMode === "quote" ? "Request site quote" : "Check availability & quote"}
            />
          ))}
        </Reveal>
        <p className="text-xs text-muted-foreground mt-8 max-w-5xl leading-relaxed">
          <strong>Pricing note:</strong> monthly figures above are base broadband prices ex VAT with the inc-VAT equivalent shown alongside. Exact speeds, network, minimum term, activation/installation, router, optional care and other charges depend on the service address and selected route. Network cease or migration-away charges and early termination charges can apply and are shown in the Contract Summary before acceptance.
        </p>
      </BrandSection>

      <BrandSection tone="dark">
        <Reveal>
          <SectionEyebrow index="02" label="Process" tone="dark" />
          <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">How a business order moves</h2>
        </Reveal>
        <Reveal stagger as="ol" className="relative mt-12 grid gap-px border-[3px] border-white/20 bg-white/20 md:grid-cols-4">
          {steps.map(([n, t, d]) => (
            <motion.li key={n} variants={revealItem} className="relative bg-background p-6">
              <span className="font-display text-6xl leading-none text-primary">{n}</span>
              <h3 className="mt-4 font-display text-2xl uppercase leading-none text-white">{t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/65">{d}</p>
            </motion.li>
          ))}
        </Reveal>
      </BrandSection>

      <BusinessLeadBand index="03" title="Need a specialist instead?">
        <LeadForm interest="broadband" source="business_broadband_fallback" heading="Need a specialist instead?" />
      </BusinessLeadBand>
    </MotionConfig>
  </Layout>
);

export default BusinessBroadbandPage;

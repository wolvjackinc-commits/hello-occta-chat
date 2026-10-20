import { Link } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import type { ReactNode } from "react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { businessBundles, businessIndustries, businessFAQs } from "@/lib/business/catalogue";
import VatExPrice from "@/components/business/VatExPrice";
import BusinessTrustBar from "@/components/business/BusinessTrustBar";
import LeadForm from "@/components/business/LeadForm";
import { ArrowRight, CheckCircle2, Plus } from "lucide-react";
import { BrandSection, HeroKicker, HeroTitle, PosterStage, Reveal, SectionEyebrow, SectionTitle, TicketSlab } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";
import { BuildingArt, RouterArt, SimArt, VoiceArt } from "@/components/brand/illustrations";

const services: { art: ReactNode; title: string; desc: string; to: string; price: number; unit?: string }[] = [
  { art: <RouterArt className="h-auto w-full" />, title: "Business Broadband", desc: "SoGEA, full fibre, gigabit and dedicated connectivity with optional static IP, care upgrades and continuity.", to: "/business/broadband", price: 34.99 },
  { art: <VoiceArt className="h-auto w-full" />, title: "Hosted VoIP & SIP", desc: "UK numbers, softphones and call routing with porting subject to number eligibility.", to: "/business/voice", price: 6.95, unit: "/seat/mo" },
  { art: <SimArt className="h-auto w-full" />, title: "Business SIMs", desc: "Business mobile options for teams, with exact allowance and roaming terms shown before order.", to: "/business/sim", price: 7.5, unit: "/line/mo" },
];

const BusinessHub = () => (
  <Layout>
    <SEO
      title="Business Broadband, VoIP & SIM — UK"
      description="Business broadband from £34.99 ex VAT (£41.99 inc VAT), plus hosted VoIP and business SIM options. Address-led quoting, transparent VAT and final service terms confirmed before order."
      canonical="/business"
      keywords="business broadband UK, hosted VoIP UK, business SIM, SIP trunks UK, small business telecom, leased line UK"
    />

    <MotionConfig reducedMotion="user">
      <PosterStage ghost="B2B">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_460px] xl:gap-20">
          <div className="lg:pt-6">
            <HeroKicker>For business</HeroKicker>
            <HeroTitle size="md">
              Telecom built around the <span className="text-primary">actual site</span>, not a placeholder price.
            </HeroTitle>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
              Broadband, hosted VoIP and business SIMs with clear ex-VAT and inc-VAT pricing. We confirm network availability, setup, care level and the contractual price before anything is provisioned.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/business/quote"><Button variant="hero" size="lg">Build a business quote <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
              <Link to="/business/contact-sales"><Button variant="outline" size="lg">Talk to sales</Button></Link>
            </div>
            <div className="mt-6 border-l-[3px] border-primary pl-3 text-sm text-white/70">
              Broadband from <strong className="text-white">£34.99/mo ex VAT</strong> (£41.99 inc VAT), subject to address, route and term.
            </div>
          </div>
          <TicketSlab className="mr-3 mb-3">
            <div className="border-[3px] border-white bg-[hsl(0_0%_8%)] p-5 sm:p-6">
              <LeadForm compact heading="Get a business call-back" source="business_hub_hero" />
            </div>
          </TicketSlab>
        </div>
      </PosterStage>

      <BusinessTrustBar />

      {/* Services */}
      <BrandSection tone="light">
        <Reveal className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:items-end">
          <div>
            <SectionEyebrow index="01" label="Services" />
            <SectionTitle className="mt-5">One provider. Every service.</SectionTitle>
          </div>
        </Reveal>
        <Reveal stagger className="mt-12 grid gap-5 md:grid-cols-3">
          {services.map((s, i) => (
            <motion.div key={s.title} variants={revealItem}>
              <Link
                to={s.to}
                className="group flex h-full flex-col border-[3px] border-foreground bg-white text-black transition-shadow duration-300 hover:shadow-[8px_8px_0_0_hsl(var(--foreground))]"
              >
                <div className={`flex min-h-[180px] items-center justify-center border-b-[3px] border-foreground p-6 ${i === 1 ? "bg-primary" : "bg-secondary"}`}>
                  <div className="w-full max-w-[240px]">{s.art}</div>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-display text-3xl uppercase leading-none">{s.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-black/70">{s.desc}</p>
                  <div className="mt-5 border-t-2 border-black pt-4">
                    <div className="mb-1 text-xs uppercase tracking-wider text-black/60">From</div>
                    <VatExPrice amount={s.price} unit={s.unit ?? "/mo"} size="md" />
                  </div>
                  <div className="mt-5 flex items-center gap-2 font-display text-lg uppercase transition-all group-hover:gap-3">See options <ArrowRight className="w-4 h-4" /></div>
                </div>
              </Link>
            </motion.div>
          ))}
        </Reveal>
      </BrandSection>

      {/* Bundles */}
      <BrandSection tone="dark">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <SectionEyebrow index="02" label="Bundles" tone="dark" />
            <SectionTitle className="mt-5">Bundle the services. Quote the reality.</SectionTitle>
            <p className="mt-5 text-lg leading-relaxed text-white/70">We design the bundle first, then price the exact broadband route, seats, SIMs and optional resilience instead of hiding a loss-leading placeholder.</p>
          </div>
          <Link to="/business/bundles"><Button variant="outline">Compare bundle designs <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
        </Reveal>
        <Reveal stagger className="mt-12 grid gap-5 md:grid-cols-3">
          {businessBundles.map((b) => (
            <motion.div key={b.id} variants={revealItem} className="flex flex-col border-[3px] border-white/25 bg-white/[0.03] p-6">
              <h3 className="font-display text-3xl uppercase leading-none text-white">{b.name}</h3>
              <p className="mt-2 mb-5 text-sm text-white/60">{b.tagline}</p>
              {b.priceExVat != null ? <VatExPrice amount={b.priceExVat} size="lg" /> : (
                <div className="border-[3px] border-primary px-4 py-3">
                  <div className="font-display text-2xl text-white">Tailored price</div>
                  <div className="text-xs text-white/60">Built from the services actually selected for your sites.</div>
                </div>
              )}
              <ul className="mt-5 flex-1 space-y-2 text-sm text-white/85">
                {b.includes.slice(0, 4).map((i) => (
                  <li key={i} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> {i}</li>
                ))}
              </ul>
              <Link to={`/business/quote?service=bundle&bundle=${encodeURIComponent(b.id)}`} className="mt-6"><Button variant="hero" className="w-full">{b.cta ?? "Build bundle quote"}</Button></Link>
            </motion.div>
          ))}
        </Reveal>
      </BrandSection>

      {/* Industries */}
      <BrandSection tone="yellow" className="border-y-[3px] border-black">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow index="03" label="Industries" tone="yellow" />
            <SectionTitle className="mt-5">Built around how your site operates.</SectionTitle>
            <div className="mt-10 hidden max-w-[360px] border-[3px] border-black bg-white p-6 lg:block">
              <BuildingArt className="h-auto w-full" />
            </div>
          </Reveal>
          <Reveal as="ul" stagger className="border-t-[3px] border-black">
            {Object.values(businessIndustries).map((ind) => (
              <motion.li key={ind.slug} variants={revealItem} className="border-b-[3px] border-black">
                <Link
                  to={`/business/industries/${ind.slug}`}
                  className="group grid grid-cols-[1fr_auto] items-center gap-4 px-1 py-5 transition-colors hover:bg-black hover:text-primary md:py-6"
                >
                  <span className="min-w-0">
                    <span className="block font-display text-2xl uppercase leading-none sm:text-3xl">{ind.name}</span>
                    <span className="mt-1.5 block text-sm text-black/65 group-hover:text-white/70">{ind.hero}</span>
                  </span>
                  <ArrowRight className="mr-2 h-6 w-6 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
              </motion.li>
            ))}
          </Reveal>
        </div>
      </BrandSection>

      {/* FAQs */}
      <BrandSection tone="light">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow index="04" label="Questions" />
            <SectionTitle className="mt-5">Business FAQs</SectionTitle>
          </Reveal>
          <div className="border-t-[3px] border-foreground">
            {businessFAQs.map((f) => (
              <details key={f.q} className="group border-b-[3px] border-foreground">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-display text-xl uppercase leading-tight sm:text-2xl [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <Plus className="h-6 w-6 flex-shrink-0 transition-transform group-open:rotate-45" aria-hidden />
                </summary>
                <p className="pb-6 text-base leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </BrandSection>

      {/* CTA */}
      <BrandSection tone="yellow" className="border-t-[3px] border-black">
        <Reveal className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <SectionEyebrow index="05" label="Next step" tone="yellow" />
            <SectionTitle className="mt-5">Ready to price the real requirement?</SectionTitle>
            <p className="mt-5 max-w-2xl text-lg text-black/75">Start with the address and services. OCCTA confirms the commercial and provisioning route before contract acceptance.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/business/quote">
              <Button size="lg" className="border-[3px] border-black bg-black text-primary hover:bg-white hover:text-black">Build a quote</Button>
            </Link>
            <Link to="/business/contact-sales"><Button variant="outline" size="lg" className="bg-white text-black">Complex requirements</Button></Link>
          </div>
        </Reveal>
      </BrandSection>
    </MotionConfig>
  </Layout>
);

export default BusinessHub;

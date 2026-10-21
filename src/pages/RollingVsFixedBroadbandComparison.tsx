import { Link } from "react-router-dom";
import { Check, X } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SEO, StructuredData, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { AvailabilityProvider } from "@/contexts/AvailabilityContext";
import { MotionConfig } from "framer-motion";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow } from "@/components/brand/kit";
import { LockStripArt, RollingDialArt } from "@/components/brand/illustrations";

const rows = [
  { feature: "Minimum term", rolling: "30 days", fixed: "12 / 18 / 24 months" },
  { feature: "Ending the service", rolling: "No remaining-month ETF; network charge may apply where valid", fixed: "ETF may apply during minimum term; network charge may also apply where valid" },
  { feature: "Scheduled price rises", rolling: "No scheduled CPI/RPI rise on OCCTA Flex 30", fixed: "OCCTA Price Lock 24 has no scheduled CPI/RPI rise" },
  { feature: "Price certainty", rolling: "Month by month", fixed: "Locked for term (OCCTA Price Lock 24)" },
  { feature: "Best for", rolling: "Renters, students, short lets, movers", fixed: "Long-term homes wanting the lowest headline price" },
  { feature: "Typical starting price", rolling: "From £37.99/mo (OCCTA Flex 30)", fixed: "From £34.99/mo (OCCTA Price Lock 24)" },
];

const rollingPros = [
  "Cancel any time after the 30-day notice period",
  "No remaining-month ETF on Flex 30",
  "No mid-contract price hikes with OCCTA Flex 30",
  "Ideal for renters, students and short-term lets",
];
const rollingCons = [
  "Historically a small premium vs the cheapest 24-month deals (not with OCCTA)",
  "Fewer new-customer 'introductory' discounts",
];
const fixedPros = [
  "Lowest headline monthly price on long terms",
  "Price predictability if the provider offers a genuine price lock",
  "Simple 'set and forget' if you're not moving",
];
const fixedCons = [
  "A fixed-term ETF may apply if you leave during the minimum term; the exact method is in your agreement",
  "Some tariffs include a scheduled pounds-and-pence price change; check the current disclosure before signing",
  "Identity, credit and eligibility checks vary by provider, product and ordering process",
];

const faqs = [
  { question: "What is Flex 30 broadband?", answer: "OCCTA Flex 30 is a 30-day rolling broadband option with no fixed minimum term where eligible. Normal notice is 30 days. There is no remaining-month ETF, but a separately valid network cease or migration charge may apply where lawful, incurred and disclosed." },
  { question: "Is rolling broadband more expensive than a fixed contract?", answer: "OCCTA Flex 30 starts at the current headline price shown on the broadband page and Price Lock 24 normally has a lower headline monthly price for the same public speed band. Final pricing depends on address, supplier product, setup and router choices." },
  { question: "When should I pick a fixed-term contract instead?", answer: "Pick Price Lock 24 if a 24-month minimum term suits you and you value the absence of a scheduled CPI-, RPI-, inflation-linked or percentage-based rise under contract version 2026.10.1. Pick Flex 30 if you value a rolling option with no fixed minimum term where eligible." },
  { question: "Do I still get full fibre on a rolling plan?", answer: "Yes. The contract term does not by itself determine the physical access line. Technology, available speeds, router requirements and supplier product depend on the address and are confirmed before acceptance." },
  { question: "Are there mid-contract price rises on OCCTA Flex 30?", answer: "OCCTA contract version 2026.10.1 does not apply scheduled CPI-, RPI-, inflation-linked or percentage-based rises to residential broadband. If a later contract change gives you a right to leave without penalty, we will give the required notice and explain that right. Separately valid network charges may still apply where lawful." },
  { question: "Can I switch from a fixed contract to rolling later?", answer: "After Price Lock 24 ends, the service continues on a 30-day rolling basis unless you expressly agree another fixed term. Any internal plan change is handled by OCCTA; One Touch Switch applies when switching provider where the rules apply." },
];

const RollingVsFixedBroadbandComparisonPage = () => {
  const faqSchema = createFAQSchema(faqs);
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Guides", url: "/rolling-vs-fixed-broadband-comparison" },
    { name: "Rolling vs Fixed Broadband", url: "/rolling-vs-fixed-broadband-comparison" },
  ]);
  const combinedSchema = { "@context": "https://schema.org", "@graph": [faqSchema, breadcrumbSchema] };

  return (
    <Layout>
      <SEO
        title="Rolling vs Fixed Broadband UK — Which Should You Pick?"
        description="Flex 30 vs Price Lock 24, compared clearly: minimum term, notice, pricing, early termination and applicable network charges."
        canonical="/rolling-vs-fixed-broadband-comparison"
        keywords="Flex 30 broadband UK, rolling vs fixed broadband, 30 day broadband UK, flexible broadband, price lock broadband UK, OCCTA Flex 30, OCCTA Price Lock 24"
        type="article"
      />
      <StructuredData customOnly customSchema={combinedSchema} />

      <MotionConfig reducedMotion="user">
      <PosterStage>
        <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Rolling vs fixed broadband" }]} />
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_420px] xl:gap-20">
          <div>
            <HeroKicker>Flex 30 vs fixed-term broadband · Clear guide</HeroKicker>
            <HeroTitle size="md">
              Rolling vs Fixed
              {" "}<span className="block text-primary">Broadband, Compared</span>
            </HeroTitle>
            <p className="mt-6 mb-8 max-w-2xl text-lg leading-relaxed text-white/70">
              Should you take a 30-day rolling plan or lock in for 24 months? Here's the trade-off in plain English — with OCCTA's Flex 30 and Price Lock 24 as the case studies.
            </p>
            <PostcodeChecker variant="hero" />
          </div>
          <div className="hidden grid-cols-2 gap-[3px] border-[3px] border-white bg-white lg:grid">
            <div className="bg-[hsl(0_0%_8%)] p-5">
              <p className="mb-3 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Flex 30</p>
              <div className="bg-white p-3"><RollingDialArt className="h-auto w-full" /></div>
            </div>
            <div className="bg-[hsl(0_0%_8%)] p-5">
              <p className="mb-3 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Price Lock 24</p>
              <div className="flex h-[calc(100%-1.75rem)] items-center bg-white p-3"><LockStripArt className="h-auto w-full" /></div>
            </div>
          </div>
        </div>
      </PosterStage>

      <BrandSection tone="paper">
        <Reveal>
          <SectionEyebrow index="01" label="At a glance" />
          <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">The trade-off at a glance</h2>
        </Reveal>
        <Reveal className="mt-10 overflow-x-auto border-[3px] border-foreground bg-card">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b-[3px] border-foreground">
                <th scope="col" className="p-4 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/60">Feature</th>
                <th scope="col" className="border-l-[3px] border-foreground bg-primary p-4 font-display text-2xl uppercase leading-none text-black">Rolling (Flex 30)</th>
                <th scope="col" className="border-l-[3px] border-foreground bg-black p-4 font-display text-2xl uppercase leading-none text-primary">Fixed (Price Lock 24)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature} className="border-b-2 border-foreground/10 last:border-b-0">
                  <th scope="row" className="p-4 align-top font-display text-lg uppercase leading-tight">{r.feature}</th>
                  <td className="border-l-[3px] border-foreground p-4 align-top text-sm">{r.rolling}</td>
                  <td className="border-l-[3px] border-foreground p-4 align-top text-sm">{r.fixed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </BrandSection>

      <BrandSection tone="dark">
        <Reveal>
          <SectionEyebrow index="02" label="Pros and cons" tone="dark" />
        </Reveal>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {[
            { title: "Rolling — Flex 30", pros: rollingPros, cons: rollingCons, accent: "bg-primary text-black" },
            { title: "Fixed — Price Lock 24", pros: fixedPros, cons: fixedCons, accent: "bg-white text-black" },
          ].map((c) => (
            <Reveal key={c.title} className="border-[3px] border-white/25">
              <h3 className={`px-6 py-4 font-display text-3xl uppercase leading-none ${c.accent}`}>{c.title}</h3>
              <div className="p-6">
                <ul className="space-y-2.5">
                  {c.pros.map((p) => (
                    <li key={p} className="flex gap-3 text-white/90">
                      <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center bg-primary text-black" aria-hidden><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <ul className="mt-5 space-y-2.5 border-t border-white/15 pt-5">
                  {c.cons.map((p) => (
                    <li key={p} className="flex gap-3 text-white/60">
                      <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center border border-white/30" aria-hidden><X className="h-3.5 w-3.5" /></span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </BrandSection>

      <BrandSection tone="yellow" className="border-y-[3px] border-black">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <Reveal>
            <SectionEyebrow index="03" label="Decide" tone="yellow" />
            <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Which should you pick?</h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="border-[3px] border-black bg-black font-display uppercase text-primary hover:bg-white hover:text-black"><Link to="/broadband/flex">See Flex 30</Link></Button>
              <Button asChild size="lg" variant="outline" className="bg-white font-display uppercase text-black"><Link to="/broadband/contract-saver">See Price Lock 24</Link></Button>
            </div>
          </Reveal>
          <Reveal className="space-y-5 text-lg leading-relaxed text-black/80">
            <p className="border-l-[3px] border-black pl-5"><strong className="text-black">Pick Flex 30</strong> if you're renting, moving in the next year, or simply don't want to be told what your April price rise is going to be. You get a 30-day rolling option where available, normally with 30 days’ notice and no remaining-month ETF. Separately valid network charges may apply.</p>
            <p className="border-l-[3px] border-black pl-5"><strong className="text-black">Pick Price Lock 24</strong> if you're settled and want the reassurance of a locked monthly price for two years — with no CPI or RPI mid-contract hikes.</p>
            <p className="text-base text-black/70">Network technology, router options, setup and availability depend on the address and selected service. The Contract Summary shows the customer-specific details before acceptance.</p>
          </Reveal>
        </div>
      </BrandSection>

      <BrandSection tone="light">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow index="04" label="Questions" />
            <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">FAQs</h2>
          </Reveal>
          <Accordion type="single" collapsible className="border-t-[3px] border-foreground">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-b-[3px] border-foreground">
                <AccordionTrigger className="py-5 text-left font-display text-xl uppercase leading-tight hover:no-underline sm:text-2xl">{f.question}</AccordionTrigger>
                <AccordionContent className="pb-6 text-base leading-relaxed text-muted-foreground">{f.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </BrandSection>
      </MotionConfig>
    </Layout>
  );
};

const RollingVsFixedBroadbandComparison = () => (
  <AvailabilityProvider>
    <RollingVsFixedBroadbandComparisonPage />
  </AvailabilityProvider>
);

export default RollingVsFixedBroadbandComparison;
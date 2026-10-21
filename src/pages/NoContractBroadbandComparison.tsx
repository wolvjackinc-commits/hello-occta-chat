import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SEO, StructuredData, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { AvailabilityProvider } from "@/contexts/AvailabilityContext";
import { MotionConfig } from "framer-motion";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow } from "@/components/brand/kit";

const providers = [
  { name: "OCCTA Flex 30", price: "From £37.99/mo", term: "30-day rolling", midRise: "No scheduled CPI/RPI/percentage rise under v2026.10.1", credit: "Check order terms", exit: "No remaining-month ETF; valid disclosed network charge may apply", highlight: true },
  { name: "OCCTA Price Lock 24", price: "From £34.99/mo", term: "24-month minimum", midRise: "No scheduled CPI/RPI/percentage rise under v2026.10.1", credit: "Check order terms", exit: "ETF may apply during minimum term", highlight: false },
  { name: "Other UK providers", price: "Varies", term: "Varies by tariff", midRise: "Check exact pounds-and-pence disclosure", credit: "Varies by provider and product", exit: "Depends on accepted contract", highlight: false },
];

const faqs = [
  { question: "What counts as a no-contract broadband deal?", answer: "A rolling broadband deal has no long fixed minimum term. OCCTA Flex 30 is 30-day rolling with normal 30-day notice. There is no remaining-month ETF, but a separately valid network cease or migration charge may apply where lawful, incurred and disclosed." },
  { question: "Is no-contract broadband more expensive?", answer: "OCCTA Flex 30 has a higher headline starting price than Price Lock 24 for the Essential band. Final pricing depends on address, selected service, setup and router choices, so compare total cost and flexibility rather than only the headline price." },
  { question: "Do I need a credit check for no-contract broadband?", answer: "Identity, credit or eligibility checks vary by provider, product and ordering process. OCCTA shows the current requirements for the selected order before you commit." },
  { question: "Will my price go up?", answer: "Under OCCTA residential contract version 2026.10.1 there is no scheduled CPI-, RPI-, inflation-linked or percentage-based rise on the recurring broadband subscription. For another provider, check the exact pounds-and-pence price-change disclosure for the tariff you are considering." },
  { question: "Can I keep my phone number if I switch?", answer: "Number-porting eligibility depends on the service and switch. Confirm the porting option for your specific order before relying on it." },
];

const NoContractBroadbandComparisonPage = () => {
  const faqSchema = createFAQSchema(faqs);
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Compare", url: "/compare/no-contract-broadband" },
    { name: "No-Contract Broadband", url: "/compare/no-contract-broadband" },
  ]);

  const combinedSchema = {
    "@context": "https://schema.org",
    "@graph": [faqSchema, breadcrumbSchema],
  };

  return (
    <Layout>
      <SEO
        title="Compare No-Contract Broadband UK 2026"
        description="Compare rolling and fixed broadband terms. OCCTA Flex 30 has no fixed minimum term; Price Lock 24 has a 24-month minimum term. Check current provider terms before deciding."
        canonical="/compare/no-contract-broadband"
        keywords="Flex 30 broadband UK, rolling broadband, 30 day broadband, flexible broadband UK, Price Lock 24 comparison"
        type="article"
      />
      <StructuredData customOnly customSchema={combinedSchema} />

      <MotionConfig reducedMotion="user">
      <PosterStage>
        <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Compare no-contract broadband" }]} />
        <div className="max-w-3xl">
          <HeroKicker>From £37.99/mo · No minimum term</HeroKicker>
          <HeroTitle size="md">
            No-Contract Broadband
            {" "}<span className="block text-primary">Compared (UK 2026)</span>
          </HeroTitle>
          <p className="mt-6 mb-8 max-w-2xl text-lg leading-relaxed text-white/70">
            Compare rolling and fixed-term broadband using the things that change your real cost: minimum term, scheduled price changes, setup, eligibility requirements and termination charges.
          </p>
          <PostcodeChecker variant="hero" />
        </div>
      </PosterStage>

      <BrandSection tone="paper">
        <Reveal>
          <SectionEyebrow index="01" label="At a glance" />
          <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Rolling and fixed broadband at a glance</h2>
        </Reveal>
        <Reveal className="mt-10 overflow-x-auto border-[3px] border-foreground bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b-[3px] border-foreground">
                {["Provider", "From", "Term", "Mid-contract rise", "Credit check", "Exit fee"].map((h) => (
                  <th key={h} scope="col" className="p-4 text-left font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/60">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.name} className={`border-b-2 border-foreground/10 last:border-b-0 ${p.highlight ? "bg-primary/25 font-semibold" : ""}`}>
                  <th scope="row" className="p-4 text-left align-top font-display text-lg uppercase leading-tight">
                    {p.name}
                    {p.highlight && <span className="ml-2 inline-block bg-black px-1.5 py-0.5 font-sans text-[10px] font-bold tracking-wider text-primary">FLEX 30</span>}
                  </th>
                  <td className="p-4 align-top font-display text-lg leading-tight">{p.price}</td>
                  <td className="p-4 align-top">{p.term}</td>
                  <td className="p-4 align-top">{p.midRise}</td>
                  <td className="p-4 align-top">{p.credit}</td>
                  <td className="p-4 align-top">{p.exit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
        <p className="text-xs text-muted-foreground mt-4">Headline prices for entry-level fibre, correct at time of writing. Always check current provider pricing before switching.</p>
      </BrandSection>

      <BrandSection tone="dark">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <SectionEyebrow index="02" label="Flex 30" tone="dark" />
            <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl">How OCCTA Flex 30 works</h2>
            <ul className="mt-8 space-y-3">
              {[
                "Flex 30 is 30-day rolling where eligible — normal 30-day notice",
                "No remaining-month ETF on Flex 30; separately valid network charges may apply",
                "Current eligibility requirements are shown before you commit",
                "Setup from £0 may be available; exact setup is confirmed before acceptance",
                "Address-specific speed information and final price are confirmed before acceptance",
                "UK-based support",
              ].map((b) => (
                <li key={b} className="flex items-start gap-3 text-white/85">
                  <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center bg-primary text-black" aria-hidden><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal>
            <SectionEyebrow index="03" label="Checklist" tone="dark" />
            <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl">What to compare on any provider</h2>
            <ol className="mt-8 border-t border-white/20">
              {[
                "The exact monthly price and any scheduled pounds-and-pence increase",
                "Minimum term and notice period",
                "Setup, engineer, router and delivery charges",
                "Early-termination and network cease or migration charges",
                "Identity, credit or eligibility checks",
                "Address-specific speed information and technology",
              ].map((b, i) => (
                <li key={b} className="flex items-start gap-4 border-b border-white/20 py-3 text-white/80">
                  <span className="font-display text-xl leading-none text-primary">{String(i + 1).padStart(2, "0")}</span>
                  <span>{b}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </BrandSection>

      <BrandSection tone="light">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow index="04" label="Questions" />
            <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Frequently Asked Questions</h2>
          </Reveal>
          <Accordion type="single" collapsible className="border-t-[3px] border-foreground">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-b-[3px] border-foreground">
                <AccordionTrigger className="py-5 text-left font-display text-xl uppercase leading-tight hover:no-underline sm:text-2xl">{faq.question}</AccordionTrigger>
                <AccordionContent className="pb-6 text-base leading-relaxed text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </BrandSection>

      <BrandSection tone="yellow" className="border-t-[3px] border-black">
        <Reveal className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <h2 className="font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Check your address</h2>
            <p className="mt-4 max-w-2xl text-lg text-black/75">See which OCCTA Flex 30 and Price Lock 24 options are available at your address, with the applicable speed, price, term and setup information before acceptance.</p>
          </div>
          <Link to="/broadband">
            <Button size="lg" className="h-14 border-[3px] border-black bg-black px-8 font-display text-lg uppercase text-primary hover:bg-white hover:text-black">
              Check Availability
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </Reveal>
      </BrandSection>
      </MotionConfig>
    </Layout>
  );
};

const NoContractBroadbandComparison = () => (
  <AvailabilityProvider>
    <NoContractBroadbandComparisonPage />
  </AvailabilityProvider>
);

export default NoContractBroadbandComparison;
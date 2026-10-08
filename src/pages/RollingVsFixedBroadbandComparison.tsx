import { Link } from "react-router-dom";
import { Check, X, ChevronRight, Zap } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SEO, StructuredData, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { AvailabilityProvider } from "@/contexts/AvailabilityContext";
import { motion } from "framer-motion";

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

      <div className="bg-secondary border-b-4 border-foreground/10">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Rolling vs Fixed Broadband</span>
          </nav>
        </div>
      </div>

      <section className="py-12 md:py-16 grid-pattern">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="inline-block stamp text-accent border-accent mb-4 rotate-[-2deg]">
                <Zap className="w-4 h-4 inline mr-2" />
                Flex 30 vs fixed-term broadband · Clear guide
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase leading-[0.9] mb-4 text-foreground">
                Rolling vs Fixed
                <br />
                <span className="text-gradient">Broadband, Compared</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-6 max-w-2xl leading-relaxed">
                Should you take a 30-day rolling plan or lock in for 24 months? Here's the trade-off in plain English — with OCCTA's Flex 30 and Price Lock 24 as the case studies.
              </p>
              <PostcodeChecker />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-display uppercase mb-8">The trade-off at a glance</h2>
          <div className="overflow-x-auto border-4 border-foreground">
            <table className="w-full text-left">
              <thead className="bg-foreground text-background uppercase text-sm">
                <tr>
                  <th className="p-4">Feature</th>
                  <th className="p-4">Rolling (Flex 30)</th>
                  <th className="p-4">Fixed (Price Lock 24)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.feature} className="border-t-2 border-foreground/20">
                    <td className="p-4 font-semibold">{r.feature}</td>
                    <td className="p-4">{r.rolling}</td>
                    <td className="p-4">{r.fixed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-secondary border-y-4 border-foreground">
        <div className="container mx-auto px-4 max-w-5xl grid md:grid-cols-2 gap-8">
          <div className="bg-background border-4 border-foreground p-6">
            <h3 className="text-2xl font-display uppercase mb-4">Rolling — Flex 30</h3>
            <ul className="space-y-2 mb-4">
              {rollingPros.map((p) => (
                <li key={p} className="flex gap-2"><Check className="w-5 h-5 text-accent shrink-0" /><span>{p}</span></li>
              ))}
            </ul>
            <ul className="space-y-2">
              {rollingCons.map((p) => (
                <li key={p} className="flex gap-2 text-muted-foreground"><X className="w-5 h-5 shrink-0" /><span>{p}</span></li>
              ))}
            </ul>
          </div>
          <div className="bg-background border-4 border-foreground p-6">
            <h3 className="text-2xl font-display uppercase mb-4">Fixed — Price Lock 24</h3>
            <ul className="space-y-2 mb-4">
              {fixedPros.map((p) => (
                <li key={p} className="flex gap-2"><Check className="w-5 h-5 text-accent shrink-0" /><span>{p}</span></li>
              ))}
            </ul>
            <ul className="space-y-2">
              {fixedCons.map((p) => (
                <li key={p} className="flex gap-2 text-muted-foreground"><X className="w-5 h-5 shrink-0" /><span>{p}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-display uppercase mb-6">Which should you pick?</h2>
          <div className="space-y-4 text-lg leading-relaxed">
            <p><strong>Pick Flex 30</strong> if you're renting, moving in the next year, or simply don't want to be told what your April price rise is going to be. You get a 30-day rolling option where available, normally with 30 days’ notice and no remaining-month ETF. Separately valid network charges may apply.</p>
            <p><strong>Pick Price Lock 24</strong> if you're settled and want the reassurance of a locked monthly price for two years — with no CPI or RPI mid-contract hikes.</p>
            <p>Network technology, router options, setup and availability depend on the address and selected service. The Contract Summary shows the customer-specific details before acceptance.</p>
          </div>
          <div className="flex flex-wrap gap-3 mt-8">
            <Button asChild size="lg"><Link to="/broadband/flex">See Flex 30</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/broadband/contract-saver">See Price Lock 24</Link></Button>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-secondary">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-display uppercase mb-6">FAQs</h2>
          <Accordion type="single" collapsible className="border-4 border-foreground bg-background">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-b-2 border-foreground/20 last:border-b-0">
                <AccordionTrigger className="px-4 text-left font-semibold">{f.question}</AccordionTrigger>
                <AccordionContent className="px-4 pb-4 text-muted-foreground">{f.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </Layout>
  );
};

const RollingVsFixedBroadbandComparison = () => (
  <AvailabilityProvider>
    <RollingVsFixedBroadbandComparisonPage />
  </AvailabilityProvider>
);

export default RollingVsFixedBroadbandComparison;
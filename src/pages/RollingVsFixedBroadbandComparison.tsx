import { Link } from "react-router-dom";
import { Check, X, ChevronRight, Zap } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SEO, StructuredData, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { motion } from "framer-motion";

const rows = [
  { feature: "Minimum term", rolling: "30 days", fixed: "12 / 18 / 24 months" },
  { feature: "Exit fee if you leave early", rolling: "£0", fixed: "Often £200–£500+" },
  { feature: "Mid-contract price rises", rolling: "No (OCCTA Flex 30)", fixed: "Usually CPI/RPI + 3.9% every April" },
  { feature: "Price certainty", rolling: "Month by month", fixed: "Locked for term (OCCTA Price Lock 24)" },
  { feature: "Best for", rolling: "Renters, students, short lets, movers", fixed: "Long-term homes wanting the lowest headline price" },
  { feature: "Typical starting price", rolling: "From £22.99/mo (OCCTA)", fixed: "From £22.99/mo (OCCTA Price Lock 24)" },
];

const rollingPros = [
  "Cancel any time after the 30-day notice period",
  "No early-exit fees if life changes",
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
  "Early-exit fees can be £200–£500+ if you need to leave",
  "Most big-brand fixed deals raise prices every April (CPI/RPI + 3.9%)",
  "Harder credit checks are common",
];

const faqs = [
  { question: "What is no contract broadband in the UK?", answer: "No contract broadband uk plans are rolling monthly deals — typically 30 days — that you can cancel any time without paying an early-exit fee. OCCTA's Flex 30 is a no-contract plan available on full-fibre lines where eligible." },
  { question: "Is rolling broadband more expensive than a fixed contract?", answer: "Not with OCCTA. Flex 30 starts at £22.99/mo, the same headline price as our 24-month Price Lock plan. With most big providers, no contract broadband uk deals are £3–£8 more per month than their 18–24 month equivalents." },
  { question: "When should I pick a fixed-term contract instead?", answer: "Pick Price Lock 24 if you know you're staying put for at least two years and want the certainty of a locked monthly price with no April CPI/RPI hikes. Pick Flex 30 if you might move, are renting, or just want the freedom to leave." },
  { question: "Do I still get full fibre on a rolling plan?", answer: "Yes. OCCTA Flex 30 uses the same full-fibre lines as our fixed plans — same speeds, same router, same UK support. The only difference is the contract length." },
  { question: "Are there mid-contract price rises on OCCTA Flex 30?", answer: "No. OCCTA does not apply CPI or RPI mid-contract price rises to Flex 30 or Price Lock 24. If we ever change a price on a rolling plan, you're free to leave with no exit fee." },
  { question: "Can I switch from a fixed contract to rolling later?", answer: "Yes — once your fixed term ends you can move to Flex 30 in a few clicks. You keep your line, your speed and your number via the UK One Touch Switch process." },
];

const RollingVsFixedBroadbandComparison = () => {
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
        description="No contract broadband uk vs fixed-term contracts, compared honestly. Exit fees, mid-contract price rises, and when Flex 30 or Price Lock 24 wins."
        canonical="/rolling-vs-fixed-broadband-comparison"
        keywords="no contract broadband uk, rolling vs fixed broadband, 30 day broadband uk, flexible broadband, price lock broadband uk, occta flex 30, occta price lock 24"
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
                No contract broadband UK · Honest guide
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
            <p><strong>Pick Flex 30</strong> if you're renting, moving in the next year, or simply don't want to be told what your April price rise is going to be. You get full-fibre broadband with 30 days' notice to leave and no exit fee.</p>
            <p><strong>Pick Price Lock 24</strong> if you're settled and want the reassurance of a locked monthly price for two years — with no CPI or RPI mid-contract hikes.</p>
            <p>Both plans use the same full-fibre network, the same router and the same UK-based support. The only difference is how long you're committing for.</p>
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

export default RollingVsFixedBroadbandComparison;
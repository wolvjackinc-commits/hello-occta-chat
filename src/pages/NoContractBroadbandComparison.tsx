import { Link } from "react-router-dom";
import { ArrowRight, Check, X, ChevronRight, Zap } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SEO, StructuredData, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { motion } from "framer-motion";

const providers = [
  { name: "OCCTA", price: "£37.99", term: "30 days rolling", midRise: "No", credit: "No check", exit: "£0", highlight: true },
  { name: "Cuckoo", price: "£28.00", term: "30 days rolling", midRise: "No", credit: "Soft check", exit: "£0", highlight: false },
  { name: "NOW Broadband", price: "£25.00", term: "1 month rolling", midRise: "Possible", credit: "Hard check", exit: "£0", highlight: false },
  { name: "BT (12m)", price: "£32.99", term: "12-month contract", midRise: "Yes (CPI+3.9%)", credit: "Hard check", exit: "Up to £400+", highlight: false },
  { name: "Sky (18m)", price: "£28.00", term: "18-month contract", midRise: "Yes (RPI+3.9%)", credit: "Hard check", exit: "Up to £500+", highlight: false },
];

const faqs = [
  { question: "What counts as a no-contract broadband deal?", answer: "A no-contract (or rolling) broadband deal lets you cancel any time with no exit fee, usually after a 30-day notice period. There's no 12, 18 or 24-month lock-in." },
  { question: "Is no-contract broadband more expensive?", answer: "Historically yes, but not with OCCTA. Our Flex 30 rolling plans start at £37.99/mo, and Price Lock 24 starts at £34.99/mo — with no mid-contract price rises and no exit fee on Flex 30." },
  { question: "Do I need a credit check for no-contract broadband?", answer: "Some providers (BT, Sky, NOW) run a hard credit check. OCCTA does not run a credit check on any broadband plan." },
  { question: "Will my price go up mid-contract?", answer: "Most big providers raise prices every April by CPI+3.9% or RPI+3.9%. OCCTA has no mid-contract price hikes — what you sign up for is what you pay." },
  { question: "Can I keep my phone number if I switch?", answer: "Yes. The One Touch Switch process (UK-wide) lets you keep your number and switches you with no downtime." },
];

const NoContractBroadbandComparison = () => {
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
        description="Compare no-contract broadband from OCCTA, Cuckoo, NOW, BT & Sky. Rolling plans, no exit fees, no credit check. Pick the best flexible UK broadband."
        canonical="/compare/no-contract-broadband"
        keywords="no contract broadband uk, rolling broadband, 30 day broadband, flexible broadband uk, broadband no exit fee, compare no contract broadband"
      />
      <StructuredData customOnly customSchema={combinedSchema} />

      <div className="bg-secondary border-b-4 border-foreground/10">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Compare no-contract broadband</span>
          </nav>
        </div>
      </div>

      <section className="py-12 md:py-16 grid-pattern">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="inline-block stamp text-accent border-accent mb-4 rotate-[-2deg]">
                <Zap className="w-4 h-4 inline mr-2" />
                From £37.99/mo · No minimum term
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase leading-[0.9] mb-4 text-foreground">
                No-Contract Broadband
                <br />
                <span className="text-gradient">Compared (UK 2026)</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-6 max-w-2xl leading-relaxed">
                The honest side-by-side: OCCTA vs Cuckoo, NOW, BT and Sky. Rolling terms, exit fees, mid-contract price rises and credit checks — laid out so you can pick the one that actually fits.
              </p>
              <PostcodeChecker />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-display uppercase mb-6">UK no-contract broadband at a glance</h2>
          <div className="overflow-x-auto border-4 border-foreground/10">
            <table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr>
                  <th className="text-left p-3 font-display uppercase">Provider</th>
                  <th className="text-left p-3 font-display uppercase">From</th>
                  <th className="text-left p-3 font-display uppercase">Term</th>
                  <th className="text-left p-3 font-display uppercase">Mid-contract rise</th>
                  <th className="text-left p-3 font-display uppercase">Credit check</th>
                  <th className="text-left p-3 font-display uppercase">Exit fee</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.name} className={`border-t-2 border-foreground/10 ${p.highlight ? "bg-accent/10 font-semibold" : ""}`}>
                    <td className="p-3">{p.name}{p.highlight && <span className="ml-2 text-xs text-accent">★ Best value</span>}</td>
                    <td className="p-3">{p.price}/mo</td>
                    <td className="p-3">{p.term}</td>
                    <td className="p-3">{p.midRise}</td>
                    <td className="p-3">{p.credit}</td>
                    <td className="p-3">{p.exit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Headline prices for entry-level fibre, correct at time of writing. Always check current provider pricing before switching.</p>
        </div>
      </section>

      <section className="py-12 bg-secondary">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-display uppercase mb-4">Why OCCTA wins on flexibility</h2>
          <ul className="space-y-2">
            {[
              "30-day rolling plans where eligible — cancel anytime",
              "No mid-contract price rises — ever",
              "No credit check on any broadband plan",
              "£0 exit fees, no penalty if you switch away",
              "Setup from £0 where available",
              "UK-based support, no outsourced call centres",
            ].map((b) => (
              <li key={b} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-display uppercase mb-4">What to watch out for elsewhere</h2>
          <ul className="space-y-2">
            {[
              "BT and Sky bake CPI/RPI+3.9% into 12-24 month contracts — bills rise every April",
              "NOW Broadband runs a hard credit check that shows on your file",
              "Cuckoo's headline price is low, but their speeds and add-on pricing are less flexible than OCCTA's three-band range",
              "Most 'no-contract' deals on price comparison sites still tie you in for 30 days notice",
            ].map((b) => (
              <li key={b} className="flex items-start gap-3">
                <X className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-12 bg-secondary">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-display uppercase mb-6">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-4 border-foreground/10 bg-card px-4">
                <AccordionTrigger className="font-display text-left text-base hover:no-underline">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="card-brutal bg-card p-6 md:p-8 text-center">
            <h2 className="text-2xl md:text-3xl font-display uppercase mb-4">Check your address</h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">See exactly which OCCTA no-contract plans are live at your postcode — fibre speeds, real prices, no commitment.</p>
            <Link to="/broadband">
              <Button variant="hero" size="lg">
                Check Availability
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default NoContractBroadbandComparison;
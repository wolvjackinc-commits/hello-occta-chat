import { Link } from "react-router-dom";
import { ArrowRight, Check, X, ChevronRight, Zap } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SEO, StructuredData, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { AvailabilityProvider } from "@/contexts/AvailabilityContext";
import { motion } from "framer-motion";

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
                Compare rolling and fixed-term broadband using the things that change your real cost: minimum term, scheduled price changes, setup, eligibility requirements and termination charges.
              </p>
              <PostcodeChecker />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-display uppercase mb-6">Rolling and fixed broadband at a glance</h2>
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
                    <td className="p-3">{p.name}{p.highlight && <span className="ml-2 text-xs text-accent">Flex 30</span>}</td>
                    <td className="p-3">{p.price}</td>
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
          <h2 className="text-2xl md:text-3xl font-display uppercase mb-4">How OCCTA Flex 30 works</h2>
          <ul className="space-y-2">
            {[
              "Flex 30 is 30-day rolling where eligible — normal 30-day notice",
              "No remaining-month ETF on Flex 30; separately valid network charges may apply",
              "Current eligibility requirements are shown before you commit",
              "Setup from £0 may be available; exact setup is confirmed before acceptance",
              "Address-specific speed information and final price are confirmed before acceptance",
              "UK-based support",
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
          <h2 className="text-2xl md:text-3xl font-display uppercase mb-4">What to compare on any provider</h2>
          <ul className="space-y-2">
            {[
              "The exact monthly price and any scheduled pounds-and-pence increase",
              "Minimum term and notice period",
              "Setup, engineer, router and delivery charges",
              "Early-termination and network cease or migration charges",
              "Identity, credit or eligibility checks",
              "Address-specific speed information and technology",
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
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">See which OCCTA Flex 30 and Price Lock 24 options are available at your address, with the applicable speed, price, term and setup information before acceptance.</p>
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

const NoContractBroadbandComparison = () => (
  <AvailabilityProvider>
    <NoContractBroadbandComparisonPage />
  </AvailabilityProvider>
);

export default NoContractBroadbandComparison;
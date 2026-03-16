import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check, X, ChevronRight, Zap } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SEO, StructuredData, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import { getComparisonBySlug, comparisons } from "@/data/comparisons";
import NotFound from "@/pages/NotFound";
import { motion } from "framer-motion";

const ComparisonPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const comparison = slug ? getComparisonBySlug(slug) : undefined;

  if (!comparison) return <NotFound />;

  const faqSchema = createFAQSchema(comparison.faqs);
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Broadband", url: "/broadband" },
    { name: `${comparison.heroTitle}`, url: `/compare/${comparison.slug}` },
  ]);

  const combinedSchema = {
    "@context": "https://schema.org",
    "@graph": [faqSchema, breadcrumbSchema],
  };

  // Get other comparisons for related links
  const otherComparisons = comparisons.filter((c) => c.slug !== comparison.slug).slice(0, 4);

  return (
    <Layout>
      <SEO
        title={comparison.metaTitle}
        description={comparison.metaDescription}
        canonical={`/compare/${comparison.slug}`}
        keywords={comparison.keywords}
      />
      <StructuredData customOnly customSchema={combinedSchema} />

      {/* Breadcrumb */}
      <div className="bg-secondary border-b-4 border-foreground/10">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/broadband" className="hover:text-foreground transition-colors">Broadband</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium truncate">{comparison.heroTitle}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="py-12 md:py-16 grid-pattern">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="inline-block stamp text-accent border-accent mb-4 rotate-[-2deg]">
                <Zap className="w-4 h-4 inline mr-2" />
                Comparison
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase leading-[0.9] mb-4 text-foreground">
                {comparison.heroTitle.split(" ").map((word, i) => (
                  <span key={i}>
                    {i === 2 ? <span className="text-gradient">{word}</span> : word}
                    {" "}
                  </span>
                ))}
              </h1>
              <p className="text-xl font-display text-muted-foreground mb-4">{comparison.heroSubtitle}</p>
              <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">{comparison.intro}</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 bg-secondary stripes">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <h2 className="text-display-md mb-8">SIDE BY SIDE</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-4 border-foreground bg-card">
                <thead>
                  <tr className="border-b-4 border-foreground">
                    <th className="text-left p-4 font-display uppercase text-sm">Feature</th>
                    <th className="text-left p-4 font-display uppercase text-sm bg-primary/10 border-l-4 border-foreground">OCCTA</th>
                    <th className="text-left p-4 font-display uppercase text-sm border-l-4 border-foreground">{comparison.competitor}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.points.map((point, i) => (
                    <tr key={i} className="border-b-2 border-foreground/10">
                      <td className="p-4 font-medium text-sm">{point.feature}</td>
                      <td className="p-4 text-sm bg-primary/5 border-l-4 border-foreground">
                        <span className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          {point.occta}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground border-l-4 border-foreground">
                        {point.competitor}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Summary */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-display uppercase mb-4">The Verdict</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">{comparison.summary}</p>
        </div>
      </section>

      {/* FAQs */}
      {comparison.faqs.length > 0 && (
        <section className="py-12 bg-secondary">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-display uppercase mb-6">
              {comparison.heroTitle} — FAQs
            </h2>
            <Accordion type="single" collapsible className="space-y-2">
              {comparison.faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-4 border-foreground/10 bg-card px-4">
                  <AccordionTrigger className="font-display text-left text-base hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      )}

      {/* Other Comparisons */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-xl font-display uppercase mb-4">More Comparisons</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {otherComparisons.map((c) => (
              <Link key={c.slug} to={`/compare/${c.slug}`} className="card-brutal bg-card p-4 hover:bg-secondary transition-colors group">
                <h3 className="font-display text-base mb-1 group-hover:text-primary transition-colors">{c.heroTitle}</h3>
                <p className="text-sm text-muted-foreground">{c.heroSubtitle}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-secondary">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="card-brutal bg-card p-6 md:p-8 text-center">
            <h2 className="text-2xl md:text-3xl font-display uppercase mb-4">
              Ready to Switch from {comparison.competitor}?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              No contracts, no hidden fees, no price rises. Check what's available at your address.
            </p>
            <Link to="/broadband">
              <Button variant="hero" size="lg">
                View All Plans
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default ComparisonPage;

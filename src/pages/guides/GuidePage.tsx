import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, ChevronRight } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SEO, StructuredData, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import { getGuideBySlug, getRelatedGuides } from "@/data/guides";
import NotFound from "@/pages/NotFound";

const GuidePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const guide = slug ? getGuideBySlug(slug) : undefined;

  if (!guide) return <NotFound />;

  const related = getRelatedGuides(guide);
  const faqSchema = createFAQSchema(guide.faqs);
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Guides", url: "/guides" },
    { name: guide.title, url: `/guides/${guide.slug}` },
  ]);

  const combinedSchema = {
    "@context": "https://schema.org",
    "@graph": [faqSchema, breadcrumbSchema],
  };

  return (
    <Layout>
      <SEO
        title={guide.metaTitle}
        description={guide.description}
        canonical={`/guides/${guide.slug}`}
        keywords={guide.keywords}
      />
      <StructuredData customOnly customSchema={combinedSchema} />

      {/* Breadcrumb */}
      <div className="bg-secondary border-b-4 border-foreground/10">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/guides" className="hover:text-foreground transition-colors">Guides</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium truncate">{guide.title}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="py-12 md:py-16 grid-pattern">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="inline-block stamp text-primary border-primary mb-4">
              <BookOpen className="w-4 h-4 inline mr-2" />
              {guide.categoryLabel}
            </div>
            <h1 className="text-4xl sm:text-5xl font-display uppercase leading-[0.95] mb-6 text-foreground">
              {guide.title}
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {guide.intro}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content Sections */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="space-y-10">
            {guide.sections.map((section, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <h2 className="text-2xl md:text-3xl font-display uppercase mb-4 text-foreground">
                  {section.heading}
                </h2>
                {section.paragraphs.map((p, j) => (
                  <p key={j} className="text-muted-foreground leading-relaxed mb-4">
                    {p}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="space-y-2 mb-4">
                    {section.bullets.map((bullet, k) => (
                      <li key={k} className="flex items-start gap-2 text-muted-foreground">
                        <span className="w-1.5 h-1.5 mt-2 bg-primary flex-shrink-0" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-secondary stripes">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="card-brutal bg-card p-6 md:p-8 text-center">
            <h2 className="text-2xl md:text-3xl font-display uppercase mb-4">Ready to Get Started?</h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              No contracts, no hidden fees. See what OCCTA can offer you.
            </p>
            <Link to={guide.ctaLink}>
              <Button variant="hero" size="lg">
                {guide.ctaText}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQs */}
      {guide.faqs.length > 0 && (
        <section className="py-12 bg-background">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-display uppercase mb-6">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="space-y-2">
              {guide.faqs.map((faq, i) => (
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

      {/* Related Guides */}
      {related.length > 0 && (
        <section className="py-12 bg-secondary">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-xl font-display uppercase mb-4">Related Guides</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  to={`/guides/${r.slug}`}
                  className="card-brutal bg-card p-4 hover:bg-secondary transition-colors group"
                >
                  <span className="text-xs font-display uppercase text-primary mb-1 block">{r.categoryLabel}</span>
                  <h3 className="font-display text-lg mb-1 group-hover:text-primary transition-colors">{r.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </Layout>
  );
};

export default GuidePage;

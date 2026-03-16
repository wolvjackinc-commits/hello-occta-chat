import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Check, ChevronRight, Zap } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SEO, StructuredData, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { getKeywordPageBySlug } from "@/data/keywordPages";
import NotFound from "@/pages/NotFound";
import { motion } from "framer-motion";

const KeywordLanding = () => {
  const { pathname } = useLocation();
  const slug = pathname.replace(/^\//, "");
  const page = slug ? getKeywordPageBySlug(slug) : undefined;

  if (!page) return <NotFound />;

  const faqSchema = createFAQSchema(page.faqs);
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Broadband", url: "/broadband" },
    { name: page.metaTitle.split(" — ")[0], url: `/${page.slug}` },
  ]);

  const combinedSchema = {
    "@context": "https://schema.org",
    "@graph": [
      faqSchema,
      breadcrumbSchema,
      ...(page.price ? [{
        "@context": "https://schema.org",
        "@type": "Offer",
        name: page.metaTitle.split(" — ")[0],
        description: page.metaDescription,
        price: page.price,
        priceCurrency: "GBP",
        url: `https://www.occta.co.uk/${page.slug}`,
        availability: "https://schema.org/InStock",
        seller: { "@type": "Organization", name: "OCCTA LIMITED" },
      }] : []),
    ],
  };

  return (
    <Layout>
      <SEO
        title={page.metaTitle}
        description={page.metaDescription}
        canonical={`/${page.slug}`}
        keywords={page.keywords}
        price={page.price}
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
            <span className="text-foreground font-medium truncate">{page.metaTitle.split(" — ")[0]}</span>
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
                From £{page.price || "22.99"}/mo
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase leading-[0.9] mb-4 text-foreground">
                {page.heroTitle}
                <br />
                <span className="text-gradient">{page.heroHighlight}</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-6 max-w-2xl leading-relaxed">
                {page.heroSubtitle}
              </p>
              <PostcodeChecker />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Content Sections */}
      {page.sections.map((section, i) => (
        <section key={i} className={`py-12 ${i % 2 === 0 ? "bg-secondary" : "bg-background"}`}>
          <div className="container mx-auto px-4 max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-2xl md:text-3xl font-display uppercase mb-4">{section.heading}</h2>
              {section.paragraphs.map((p, j) => (
                <p key={j} className="text-muted-foreground mb-4 leading-relaxed">{p}</p>
              ))}
              {section.bullets && (
                <ul className="space-y-2 mt-4">
                  {section.bullets.map((bullet, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </div>
        </section>
      ))}

      {/* FAQs */}
      {page.faqs.length > 0 && (
        <section className="py-12 bg-secondary">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-display uppercase mb-6">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="space-y-2">
              {page.faqs.map((faq, i) => (
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

      {/* CTA */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="card-brutal bg-card p-6 md:p-8 text-center">
            <h2 className="text-2xl md:text-3xl font-display uppercase mb-4">{page.ctaTitle}</h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">{page.ctaText}</p>
            <Link to={page.ctaLink}>
              <Button variant="hero" size="lg">
                {page.ctaButton}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default KeywordLanding;

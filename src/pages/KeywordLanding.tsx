import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SEO, StructuredData, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { AvailabilityProvider } from "@/contexts/AvailabilityContext";
import { getKeywordPageBySlug } from "@/data/keywordPages";
import NotFound from "@/pages/NotFound";
import { MotionConfig } from "framer-motion";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, SectionTitle } from "@/components/brand/kit";

const KeywordLandingPage = () => {
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
        type="article"
        price={page.price}
      />
      <StructuredData customOnly customSchema={combinedSchema} />

      <MotionConfig reducedMotion="user">
        {/* Hero */}
        <PosterStage>
          <PosterBreadcrumb
            items={[
              { label: "Home", to: "/" },
              { label: "Broadband", to: "/broadband" },
              { label: page.metaTitle.split(" — ")[0] },
            ]}
          />
          <div className="max-w-3xl">
            <HeroKicker>From £{page.price || "34.99"}/mo</HeroKicker>
            <HeroTitle size="md">
              {page.heroTitle}
              {" "}<span className="block text-primary">{page.heroHighlight}</span>
            </HeroTitle>
            <p className="mt-6 mb-8 max-w-2xl text-lg leading-relaxed text-white/70">
              {page.heroSubtitle}
            </p>
            <PostcodeChecker variant="hero" />
          </div>
        </PosterStage>

        {/* Content Sections */}
        {page.sections.length > 0 && (
          <BrandSection tone="paper">
            <div className="mx-auto max-w-4xl">
              {page.sections.map((section, i) => (
                <Reveal key={i} className="grid gap-4 border-t-[3px] border-foreground py-10 first:border-t-0 first:pt-0 sm:grid-cols-[5.5rem_1fr]">
                  <span aria-hidden className="font-display text-5xl leading-[0.8] text-foreground/25 sm:text-7xl">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h2 className="font-display text-3xl uppercase leading-[0.95] md:text-4xl">{section.heading}</h2>
                    {section.paragraphs.map((p, j) => (
                      <p key={j} className="mt-4 text-base leading-relaxed text-foreground/75">{p}</p>
                    ))}
                    {section.bullets && (
                      <ul className="mt-5 space-y-2">
                        {section.bullets.map((bullet, j) => (
                          <li key={j} className="flex items-start gap-3">
                            <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center bg-black text-primary" aria-hidden>
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            </span>
                            <span className="text-foreground/80">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </BrandSection>
        )}

        {/* FAQs */}
        {page.faqs.length > 0 && (
          <BrandSection tone="dark">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
              <Reveal className="lg:sticky lg:top-28 lg:self-start">
                <SectionEyebrow index="01" label="Questions" tone="dark" />
                <SectionTitle className="mt-5">Frequently Asked Questions</SectionTitle>
              </Reveal>
              <Accordion type="single" collapsible className="border-t-[3px] border-white/25">
                {page.faqs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-b-[3px] border-white/25">
                    <AccordionTrigger className="py-5 text-left font-display text-xl uppercase leading-tight text-white hover:text-primary hover:no-underline sm:text-2xl">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 text-base leading-relaxed text-white/75">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </BrandSection>
        )}

        {/* CTA */}
        <BrandSection tone="yellow" className="border-t-[3px] border-black">
          <Reveal className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h2 className="font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">{page.ctaTitle}</h2>
              <p className="mt-4 max-w-xl text-lg text-black/75">{page.ctaText}</p>
            </div>
            <Link to={page.ctaLink}>
              <Button size="lg" className="h-14 border-[3px] border-black bg-black px-8 font-display text-lg uppercase text-primary hover:bg-white hover:text-black">
                {page.ctaButton}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </Reveal>
        </BrandSection>
      </MotionConfig>
    </Layout>
  );
};

const KeywordLanding = () => (
  <AvailabilityProvider>
    <KeywordLandingPage />
  </AvailabilityProvider>
);

export default KeywordLanding;

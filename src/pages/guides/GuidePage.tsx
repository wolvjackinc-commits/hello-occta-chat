import { useParams, Link } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SEO, StructuredData, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import { getGuideBySlug, getRelatedGuides } from "@/data/guides";
import NotFound from "@/pages/NotFound";
import { EmergencyCallNote } from "@/components/legal/EmergencyCallNote";
import { ArticleCard, BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, SectionTitle } from "@/components/brand/kit";
import ReadingProgress from "@/components/brand/ReadingProgress";
import { revealItem } from "@/components/brand/motion";

const GuidePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const guide = slug ? getGuideBySlug(slug) : undefined;

  if (!guide) return <NotFound />;

  const related = getRelatedGuides(guide);
  const showEmergencyNote = guide.category === "home-phone";
  const faqSchema = guide.faqs.length > 0 ? createFAQSchema(guide.faqs) : null;
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Guides", url: "/guides" },
    { name: guide.title, url: `/guides/${guide.slug}` },
  ]);

  const SITE = "https://www.occta.co.uk";
  const OG_IMAGE = `${SITE}/og-image.jpg`;
  const datePublished = guide.datePublished ?? "2025-01-15";
  const dateModified = guide.dateModified ?? guide.datePublished ?? "2026-07-10";

  const combinedSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        image: [OG_IMAGE],
        datePublished,
        dateModified,
        author: { "@type": "Organization", name: "OCCTA" },
        publisher: {
          "@type": "Organization",
          name: "OCCTA",
          logo: {
            "@type": "ImageObject",
            url: `${SITE}/pwa-512x512.png`,
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `${SITE}/guides/${guide.slug}`,
        },
        inLanguage: "en-GB",
      },
      ...(faqSchema ? [faqSchema] : []),
      breadcrumbSchema,
      ...(guide.howTo
        ? [
            {
              "@type": "HowTo",
              name: guide.howTo.name,
              description: guide.howTo.description,
              image: [OG_IMAGE],
              ...(guide.howTo.totalTime ? { totalTime: guide.howTo.totalTime } : {}),
              step: guide.howTo.steps.map((s, idx) => ({
                "@type": "HowToStep",
                position: idx + 1,
                name: s.name,
                text: s.text,
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <Layout>
      <SEO
        title={guide.metaTitle}
        description={guide.description}
        canonical={`/guides/${guide.slug}`}
        keywords={guide.keywords}
        type="article"
      />
      <StructuredData customOnly customSchema={combinedSchema} />

      <MotionConfig reducedMotion="user">
        <ReadingProgress />
        {/* Hero */}
        <PosterStage>
          <PosterBreadcrumb
            items={[
              { label: "Home", to: "/" },
              { label: "Guides", to: "/guides" },
              { label: guide.title },
            ]}
          />
          <div className="max-w-4xl">
            <HeroKicker>{guide.categoryLabel}</HeroKicker>
            <HeroTitle size="sm">{guide.title}</HeroTitle>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/70">
              {guide.intro}
            </p>
            {showEmergencyNote && (
              <div className="mt-6 max-w-3xl">
                <EmergencyCallNote className="text-white" />
              </div>
            )}
          </div>
        </PosterStage>

        {/* Content Sections */}
        <BrandSection tone="paper">
          <div className="grid gap-12 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-20">
            <aside className="hidden lg:block">
              <nav aria-label="In this guide" className="sticky top-28">
                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/60">In this guide</p>
                <ol className="mt-4 border-t-[3px] border-foreground">
                  {guide.sections.map((section, i) => (
                    <li key={i} className="border-b-2 border-foreground/15">
                      <a href={`#section-${i + 1}`} className="group flex gap-3 py-2.5 text-sm font-medium leading-snug">
                        <span className="font-display text-base leading-none text-foreground/30 group-hover:text-foreground">{String(i + 1).padStart(2, "0")}</span>
                        <span className="text-foreground/75 group-hover:text-foreground">{section.heading}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>

            <div className="min-w-0 max-w-3xl">
              {guide.sections.map((section, i) => (
                <Reveal key={i} className="border-t-[3px] border-foreground pt-6 pb-10 first:border-t-0 first:pt-0">
                  <section id={`section-${i + 1}`} className="scroll-mt-28">
                    <span className="font-display text-xl leading-none text-foreground/30">{String(i + 1).padStart(2, "0")}</span>
                    <h2 className="mt-2 font-display text-3xl uppercase leading-[0.95] text-foreground md:text-4xl">
                      {section.heading}
                    </h2>
                    {section.paragraphs.map((p, j) => (
                      <p key={j} className="mt-4 text-base leading-relaxed text-foreground/75">
                        {p}
                      </p>
                    ))}
                    {section.bullets && (
                      <ul className="mt-4 space-y-2">
                        {section.bullets.map((bullet, k) => (
                          <li key={k} className="flex items-start gap-3 text-foreground/80">
                            <span className="mt-2 h-2 w-2 flex-shrink-0 bg-foreground" />
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </Reveal>
              ))}
            </div>
          </div>
        </BrandSection>

        {/* CTA */}
        <BrandSection tone="yellow" className="border-y-[3px] border-black">
          <Reveal className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h2 className="font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Ready to Get Started?</h2>
              <p className="mt-4 max-w-xl text-lg text-black/75">
                Price Lock 24 or Flex 30 where eligible. See what OCCTA can offer you.
              </p>
            </div>
            <Link to={guide.ctaLink}>
              <Button size="lg" className="h-14 border-[3px] border-black bg-black px-8 font-display text-lg uppercase text-primary hover:bg-white hover:text-black">
                {guide.ctaText}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </Reveal>
        </BrandSection>

        {/* FAQs */}
        {guide.faqs.length > 0 && (
          <BrandSection tone="dark">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
              <Reveal className="lg:sticky lg:top-28 lg:self-start">
                <SectionEyebrow index="01" label="Questions" tone="dark" />
                <SectionTitle className="mt-5">Frequently Asked Questions</SectionTitle>
              </Reveal>
              <Accordion type="single" collapsible className="border-t-[3px] border-white/25">
                {guide.faqs.map((faq, i) => (
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

        {/* Related Guides */}
        {related.length > 0 && (
          <BrandSection tone="light">
            <Reveal>
              <SectionEyebrow index={guide.faqs.length > 0 ? "02" : "01"} label="Keep reading" />
              <h2 className="mt-5 font-display text-4xl uppercase leading-none sm:text-5xl">Related Guides</h2>
            </Reveal>
            <Reveal stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <motion.div key={r.slug} variants={revealItem}>
                  <ArticleCard to={`/guides/${r.slug}`} label={r.categoryLabel} title={r.title} desc={r.description} cta="Read guide" />
                </motion.div>
              ))}
            </Reveal>
          </BrandSection>
        )}
      </MotionConfig>
    </Layout>
  );
};

export default GuidePage;

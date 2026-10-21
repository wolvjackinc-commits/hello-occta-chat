import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SEO, StructuredData, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import { getComparisonBySlug, comparisons } from "@/data/comparisons";
import NotFound from "@/pages/NotFound";
import { MotionConfig, motion } from "framer-motion";
import { BrandSection, HeroKicker, HeroTitle, NumberedLinkList, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";
import LeadCaptureWidget from "@/components/marketing/LeadCaptureWidget";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { AvailabilityProvider } from "@/contexts/AvailabilityContext";

const ComparisonPageView = () => {
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
        type="article"
      />
      <StructuredData customOnly customSchema={combinedSchema} />

      <MotionConfig reducedMotion="user">
      {/* Hero */}
      <PosterStage>
        <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Broadband", to: "/broadband" }, { label: comparison.heroTitle }]} />
        <div className="max-w-4xl">
          <HeroKicker>Comparison</HeroKicker>
          <HeroTitle size="md">
            {comparison.heroTitle.split(" ").map((word, i) => (
              <span key={i}>
                {i === 2 ? <span className="text-primary">{word}</span> : word}
                {" "}
              </span>
            ))}
          </HeroTitle>
          <p className="mt-6 font-display text-2xl uppercase leading-tight text-white/85">{comparison.heroSubtitle}</p>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-white/65">{comparison.intro}</p>
        </div>
      </PosterStage>

      {/* Comparison Table */}
      <BrandSection tone="paper">
        <Reveal>
          <SectionEyebrow index="01" label="Feature by feature" />
          <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Side by side</h2>
        </Reveal>
        <Reveal className="mt-10 overflow-x-auto border-[3px] border-foreground bg-card">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b-[3px] border-foreground">
                <th scope="col" className="p-4 text-left font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/60">Feature</th>
                <th scope="col" className="border-l-[3px] border-foreground bg-primary p-4 text-left font-display text-2xl uppercase leading-none text-black">OCCTA</th>
                <th scope="col" className="border-l-[3px] border-foreground p-4 text-left font-display text-2xl uppercase leading-none">{comparison.competitor}</th>
              </tr>
            </thead>
            <tbody>
              {comparison.points.map((point, i) => (
                <tr key={i} className="border-b-2 border-foreground/10 last:border-b-0">
                  <th scope="row" className="p-4 text-left align-top font-display text-lg uppercase leading-tight">{point.feature}</th>
                  <td className="border-l-[3px] border-foreground bg-primary/10 p-4 align-top text-sm">
                    <span className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      {point.occta}
                    </span>
                  </td>
                  <td className="border-l-[3px] border-foreground p-4 align-top text-sm text-muted-foreground">
                    {point.competitor}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </BrandSection>

      {/* Summary */}
      <BrandSection tone="dark">
        <Reveal className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <div>
            <SectionEyebrow index="02" label="Summary" tone="dark" />
            <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">The Verdict</h2>
          </div>
          <p className="border-l-[3px] border-primary pl-6 text-xl leading-relaxed text-white/80">{comparison.summary}</p>
        </Reveal>
      </BrandSection>

      {/* FAQs */}
      {comparison.faqs.length > 0 && (
        <BrandSection tone="light">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <SectionEyebrow index="03" label="Questions" />
              <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl">
                {comparison.heroTitle} — FAQs
              </h2>
            </Reveal>
            <Accordion type="single" collapsible className="border-t-[3px] border-foreground">
              {comparison.faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-b-[3px] border-foreground">
                  <AccordionTrigger className="py-5 text-left font-display text-xl uppercase leading-tight hover:no-underline sm:text-2xl">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 text-base leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </BrandSection>
      )}

      {/* CTA */}
      <BrandSection tone="yellow" className="border-y-[3px] border-black">
        <Reveal>
          <SectionEyebrow index={comparison.faqs.length > 0 ? "04" : "03"} label="Your move" tone="yellow" />
          <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">
            Ready to switch from {comparison.competitor}?
          </h2>
          <p className="mt-4 max-w-xl text-lg text-black/75">
            Three ways to get moving — check your postcode, pick a plan, or ask us to do it for you. Price Lock 24 or Flex 30 where eligible.
          </p>
        </Reveal>
        <Reveal stagger as="ol" className="mt-10 grid gap-[3px] border-[3px] border-black bg-black sm:grid-cols-3">
          {[
            { to: "/coverage-areas", t: "1. Check my address", d: "See what speeds we can deliver." },
            { to: "/broadband", t: "2. Pick a plan", d: "Flex 30 or Price Lock 24." },
            { to: "/contact", t: "3. Talk to us", d: "A human, not a script." },
          ].map((s) => (
            <motion.li key={s.to} variants={revealItem}>
              <Link to={s.to} className="group flex h-full flex-col bg-white p-6 text-black transition-colors hover:bg-black hover:text-primary">
                <span className="font-display text-3xl uppercase leading-none">{s.t}</span>
                <span className="mt-2 text-sm text-black/65 group-hover:text-white/70">{s.d}</span>
                <ArrowRight className="mt-4 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.li>
          ))}
        </Reveal>
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-2">
          <div className="border-[3px] border-black bg-black p-6 dark hero-stage">
            <PostcodeChecker variant="hero" />
            <Link to="/broadband" className="mt-5 inline-block">
              <Button variant="hero" size="lg">
                View all plans <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
          <div className="border-[3px] border-black bg-white text-black">
            <LeadCaptureWidget
              source={`compare-${comparison.slug}`}
              title={`Want us to compare ${comparison.competitor} against your address?`}
              description="Drop your postcode — we'll come back with the exact OCCTA equivalent, including any speed and price differences."
              defaultInterest="broadband"
              compact
            />
          </div>
        </div>
      </BrandSection>

      {/* Other Comparisons */}
      <BrandSection tone="light">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <Reveal>
            <SectionEyebrow index={comparison.faqs.length > 0 ? "05" : "04"} label="Keep reading" />
            <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl">More Comparisons</h2>
          </Reveal>
          <NumberedLinkList items={otherComparisons.map((c) => ({ title: c.heroTitle, desc: c.heroSubtitle, path: `/compare/${c.slug}` }))} />
        </div>
      </BrandSection>
      </MotionConfig>
    </Layout>
  );
};

const ComparisonPage = () => (
  <AvailabilityProvider>
    <ComparisonPageView />
  </AvailabilityProvider>
);

export default ComparisonPage;

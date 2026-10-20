// /learn hub — one crawlable index of every static SEO explainer and authority
// article, grouped by category. Growth content is stored separately so expanding
// the hub cannot disturb customer journeys or account features.
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO, JsonLd, createBreadcrumbSchema } from "@/components/seo";
import { learnPages, learnCategoryLabels, LearnCategory } from "@/data/learnPages";
import { seoArticles } from "@/data/seoArticles";
import { seoGrowthArticles } from "@/data/seoGrowthArticles";
import { MotionConfig, motion } from "framer-motion";
import LeadCaptureWidget from "@/components/marketing/LeadCaptureWidget";
import { Button } from "@/components/ui/button";
import { ArticleCard, BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";

const orderedCategories: LearnCategory[] = [
  "broadband",
  "wifi",
  "switching",
  "sim",
  "voice",
  "payments",
];

const allPages = [...learnPages, ...seoArticles, ...seoGrowthArticles];

const groups = orderedCategories
  .map((category) => ({ category, pages: allPages.filter((page) => page.category === category) }))
  .filter((g) => g.pages.length > 0);

export default function LearnHub() {
  const breadcrumb = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Learn", url: "/learn" },
  ]);

  return (
    <Layout>
      <SEO
        title="UK broadband guides and Digital Voice | OCCTA"
        description="Practical UK guides on broadband deals, fibre, switching, the 2027 landline switch-off, Digital Voice, broadband for pensioners, Wi-Fi, SIM and billing."
        canonical="/learn"
        keywords="UK broadband guides, broadband deals UK, landline switch off 2027, broadband for pensioners, digital landline, fibre broadband deals, broadband comparison, broadband speed test, One Touch Switch"
      />
      <JsonLd data={breadcrumb} />

      <MotionConfig reducedMotion="user">
        <PosterStage>
          <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Learn" }]} />
          <div className="max-w-4xl">
            <HeroKicker>Learn</HeroKicker>
            <HeroTitle size="sm">
              Broadband, the 2027 landline switch, Digital Voice and bills—explained properly.
            </HeroTitle>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/70">
              Practical UK telecom guides written in plain English. Understand broadband deals,
              switching, full fibre, the move from old landlines to digital voice and the choices
              that matter before you order.
            </p>
            <p className="mt-4 inline-block border-l-[3px] border-primary pl-3 text-sm text-white/60">
              {allPages.length} guides available. Authority articles show their review date and
              supporting sources.
            </p>
            <nav aria-label="Topics" className="mt-8 flex flex-wrap gap-2">
              {groups.map((g) => (
                <a
                  key={g.category}
                  href={`#${g.category}`}
                  className="border-[3px] border-white/30 px-4 py-2 font-display text-lg uppercase leading-none text-white transition-colors hover:border-primary hover:text-primary"
                >
                  {learnCategoryLabels[g.category]}
                </a>
              ))}
            </nav>
          </div>
        </PosterStage>

        <BrandSection tone="paper">
          {groups.map(({ category, pages }, i) => (
            <section key={category} id={category} className="mb-16 scroll-mt-28 last:mb-0">
              <Reveal>
                <SectionEyebrow index={String(i + 1).padStart(2, "0")} label={`${pages.length} ${pages.length === 1 ? "guide" : "guides"}`} />
                <h2 className="mt-5 font-display text-4xl uppercase leading-none sm:text-5xl">
                  {learnCategoryLabels[category]}
                </h2>
              </Reveal>
              <Reveal stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {pages.map((page) => (
                  <motion.div key={page.slug} variants={revealItem}>
                    <ArticleCard to={`/learn/${page.slug}`} label={learnCategoryLabels[category]} title={page.h1} desc={page.shortAnswer} />
                  </motion.div>
                ))}
              </Reveal>
            </section>
          ))}
        </BrandSection>

        <BrandSection tone="yellow" className="border-t-[3px] border-black">
          <div className="grid items-start gap-10 md:grid-cols-[1fr_1.1fr] lg:gap-20">
            <Reveal>
              <SectionEyebrow index={String(groups.length + 1).padStart(2, "0")} label="Your move" tone="yellow" />
              <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Ready to check your options?</h2>
              <p className="mt-4 max-w-xl text-lg text-black/75">
                Broadband technology and availability are address-specific. Run a postcode check or
                speak to the team about a home or business requirement.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg" className="border-[3px] border-black bg-black font-display uppercase text-primary hover:bg-white hover:text-black">
                  <Link to="/order">Check my address</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="bg-white font-display uppercase text-black">
                  <Link to="/landline">Digital Home Phone</Link>
                </Button>
              </div>
            </Reveal>
            <div className="border-[3px] border-black bg-white text-black">
              <LeadCaptureWidget source="learn-hub" compact />
            </div>
          </div>
        </BrandSection>
      </MotionConfig>
    </Layout>
  );
}

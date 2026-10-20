import { MotionConfig, motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { SEO, StructuredData, createBreadcrumbSchema } from "@/components/seo";
import { guides } from "@/data/guides";
import { ArticleCard, BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";

const categories = [
  { key: "broadband" as const, label: "Broadband" },
  { key: "home-phone" as const, label: "Home Phone" },
  { key: "sim" as const, label: "SIM Plans" },
];

const Guides = () => {
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Guides", url: "/guides" },
  ]);

  const groups = categories
    .map((cat) => ({ ...cat, items: guides.filter((g) => g.category === cat.key) }))
    .filter((c) => c.items.length > 0);

  return (
    <Layout>
      <SEO
        title="Guides — Broadband, Home Phone & SIM"
        description="Helpful guides on UK broadband, Digital Home Phone, and SIM plans. No-contract options, switching tips, and money-saving advice from OCCTA."
        canonical="/guides"
        keywords="broadband guide UK, home phone guide, SIM guide, internet tips, switching broadband, digital voice guide"
      />
      <StructuredData customOnly customSchema={breadcrumbSchema} />

      <MotionConfig reducedMotion="user">
        {/* Hero */}
        <PosterStage>
          <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Guides" }]} />
          <div className="max-w-3xl">
            <HeroKicker>Resource Centre</HeroKicker>
            <HeroTitle>
              Guides &amp;
              {" "}<span className="block text-primary">resources</span>
            </HeroTitle>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              Practical advice on broadband, home phone, and mobile. No jargon, no sales pitch — just useful information.
            </p>
            {groups.length > 1 && (
              <nav aria-label="Guide topics" className="mt-8 flex flex-wrap gap-2">
                {groups.map((g) => (
                  <a
                    key={g.key}
                    href={`#${g.key}`}
                    className="border-[3px] border-white/30 px-4 py-2 font-display text-lg uppercase leading-none text-white transition-colors hover:border-primary hover:text-primary"
                  >
                    {g.label}
                  </a>
                ))}
              </nav>
            )}
          </div>
        </PosterStage>

        {/* Guides by Category */}
        <BrandSection tone="paper">
          {groups.map((cat, i) => (
            <div key={cat.key} id={cat.key} className="mb-16 scroll-mt-28 last:mb-0">
              <Reveal>
                <SectionEyebrow index={String(i + 1).padStart(2, "0")} label={`${cat.items.length} ${cat.items.length === 1 ? "guide" : "guides"}`} />
                <h2 className="mt-5 font-display text-4xl uppercase leading-none sm:text-5xl">{cat.label}</h2>
              </Reveal>
              <Reveal stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {cat.items.map((guide) => (
                  <motion.div key={guide.slug} variants={revealItem}>
                    <ArticleCard to={`/guides/${guide.slug}`} label={guide.categoryLabel} title={guide.title} desc={guide.description} cta="Read guide" />
                  </motion.div>
                ))}
              </Reveal>
            </div>
          ))}
        </BrandSection>
      </MotionConfig>
    </Layout>
  );
};

export default Guides;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import KbSearchBar from "@/components/kb/KbSearchBar";
import { supabase } from "@/integrations/supabase/client";
import { seoGrowthArticles } from "@/data/seoGrowthArticles";
import { Clock, ArrowRight } from "lucide-react";
import { ArticleCard, BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";

type Row = { id: string; slug: string; title: string; summary: string | null; read_minutes: number | null; updated_at: string };

export default function BlogIndex() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_kb_articles_by_kind", { _kind: "blog" });
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <Layout>
      <SEO
        title="OCCTA Blog — broadband, switching and voice"
        description="UK broadband guides covering broadband deals, fibre, speed tests, switching, the 2027 landline switch-off, Digital Voice, pensioners and home phone help."
        canonical="/blog"
        keywords="broadband deals UK, landline switch off 2027, broadband for pensioners, digital landline, fibre broadband deals, broadband comparison, broadband speed test"
      />
      <MotionConfig reducedMotion="user">
        <PosterStage>
          <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Blog" }]} />
          <div className="max-w-4xl">
            <HeroKicker>Blog &amp; guides</HeroKicker>
            <HeroTitle size="sm">Useful answers before you buy, switch or call support.</HeroTitle>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/70">
              Plain-English broadband, switching and Digital Voice guidance — including the January 2027 landline change and practical help for older customers and families.
            </p>
            <div className="mt-8 max-w-xl"><KbSearchBar kind="blog" placeholder="Search blog…" /></div>
          </div>
        </PosterStage>

        <BrandSection tone="paper">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionEyebrow index="01" label="Latest OCCTA guides" />
              <h2 className="mt-5 font-display text-4xl uppercase leading-none sm:text-5xl">2027 landline switch &amp; broadband buying guides</h2>
            </div>
            <Link to="/learn" className="group inline-flex items-center gap-1.5 font-display text-lg uppercase">
              All guides <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
          <Reveal stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {seoGrowthArticles.map((article) => (
              <motion.div key={article.slug} variants={revealItem}>
                <ArticleCard to={`/learn/${article.slug}`} label={article.category} title={article.h1} desc={article.shortAnswer} cta="Read guide" />
              </motion.div>
            ))}
          </Reveal>
        </BrandSection>

        <BrandSection tone="light">
          <Reveal>
            <SectionEyebrow index="02" label="Posts" />
            <h2 className="mt-5 font-display text-4xl uppercase leading-none sm:text-5xl">More from OCCTA</h2>
          </Reveal>
          <div className="mt-8">
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="max-w-2xl border-[3px] border-dashed border-foreground/30 bg-card p-6 text-muted-foreground">More posts are being prepared. Browse the latest guides above or visit the Learn hub.</p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((r) => (
                  <ArticleCard
                    key={r.id}
                    to={`/blog/${r.slug}`}
                    label={r.read_minutes ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {r.read_minutes} min</span> : "Article"}
                    title={r.title}
                    desc={r.summary}
                  />
                ))}
              </div>
            )}
          </div>
        </BrandSection>
      </MotionConfig>
    </Layout>
  );
}

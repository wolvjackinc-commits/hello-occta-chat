import { Link } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import { MessageCircle, BookOpen } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO, StructuredData, createBreadcrumbSchema } from "@/components/seo";
import { helpArticles, helpCategories } from "@/data/helpArticles";
import KbSearchBar from "@/components/kb/KbSearchBar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArticleCard, BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";
import { SupportChatArt } from "@/components/brand/illustrations";

type DbArticle = { id: string; slug: string; title: string; summary: string | null; kind: string; read_minutes: number | null };

const pad = (n: number) => String(n).padStart(2, "0");

const HelpCenter = () => {
  const [extra, setExtra] = useState<DbArticle[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_kb_articles_by_kind", { _kind: "help" });
      setExtra((data as DbArticle[]) ?? []);
    })();
  }, []);

  const breadcrumb = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Help Centre", url: "/help" },
  ]);

  const categories = helpCategories
    .map((cat) => ({ cat, items: helpArticles.filter((a) => a.category === cat) }))
    .filter((c) => c.items.length > 0);
  const offset = extra.length > 0 ? 1 : 0;

  return (
    <Layout>
      <SEO
        title="OCCTA Help Centre for broadband and SIM"
        description="Self-service guides for OCCTA customers. Getting started, billing, Wi-Fi fixes, Digital Voice, moving home and more. No queues, no jargon."
        canonical="/help"
        keywords="occta help, broadband help uk, self service broadband, occta support"
      />
      <StructuredData customOnly customSchema={breadcrumb} />

      <MotionConfig reducedMotion="user">
        <PosterStage ghost="HELP">
          <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Help Centre" }]} />
          <div className="max-w-3xl">
            <HeroKicker>Help Centre</HeroKicker>
            <HeroTitle>
              Get help
              {" "}<span className="text-primary">fast.</span>
            </HeroTitle>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              Most issues are fixed in under five minutes. Find your topic, follow the steps, and you're sorted.
            </p>
            <div className="mt-8 max-w-xl">
              <KbSearchBar />
            </div>
          </div>
        </PosterStage>

        <BrandSection tone="paper">
          {extra.length > 0 && (
            <div className="mb-16">
              <Reveal>
                <SectionEyebrow index="01" label="New" />
                <h2 className="mt-5 font-display text-4xl uppercase leading-none sm:text-5xl">Latest help articles</h2>
              </Reveal>
              <Reveal stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {extra.slice(0, 9).map((a) => (
                  <motion.div key={a.id} variants={revealItem}>
                    <ArticleCard to={`/help/${a.slug}`} label={a.read_minutes ? `${a.read_minutes} min read` : "Help"} title={a.title} desc={a.summary} />
                  </motion.div>
                ))}
              </Reveal>
            </div>
          )}
          {categories.map(({ cat, items }, i) => (
            <div key={cat} className="mb-16 last:mb-0">
              <Reveal>
                <SectionEyebrow index={pad(i + 1 + offset)} label="Topic" />
                <h2 className="mt-5 font-display text-4xl uppercase leading-none sm:text-5xl">{cat}</h2>
              </Reveal>
              <Reveal stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((a) => (
                  <motion.div key={a.slug} variants={revealItem}>
                    <ArticleCard to={`/help/${a.slug}`} label={`${a.readMinutes} min read`} title={a.title} desc={a.description} cta="Read article" />
                  </motion.div>
                ))}
              </Reveal>
            </div>
          ))}
        </BrandSection>

        <BrandSection tone="dark">
          <Reveal className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-20">
            <div>
              <SectionEyebrow index={pad(categories.length + 1 + offset)} label="Talk to us" tone="dark" />
              <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Still stuck?</h2>
              <p className="mt-4 max-w-xl text-lg text-white/70">Chat with Ollie (bottom-right) or email hello@occta.co.uk — we reply within a few hours, no scripts.</p>
              <Link to="/guides" className="mt-7 inline-flex items-center gap-2 border-[3px] border-white px-5 py-3 font-display text-lg uppercase text-white transition-colors hover:border-primary hover:bg-primary hover:text-black">
                <BookOpen className="w-5 h-5" /> Browse guides
              </Link>
            </div>
            <div className="border-[3px] border-white/25 bg-[hsl(0_0%_10%)] p-6">
              <div className="mb-4 flex items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                <MessageCircle className="h-4 w-4 text-primary" aria-hidden /> Support chat
              </div>
              <SupportChatArt />
            </div>
          </Reveal>
        </BrandSection>
      </MotionConfig>
    </Layout>
  );
};

export default HelpCenter;

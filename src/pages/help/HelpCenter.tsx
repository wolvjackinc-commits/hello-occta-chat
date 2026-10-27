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
import { CONTACT_PHONE_DISPLAY } from "@/lib/constants";

type DbArticle = { id: string; slug: string; title: string; summary: string | null; kind: string; read_minutes: number | null };

const pad = (n: number) => String(n).padStart(2, "0");
const anchor = (c: string) => c.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

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
        description={`${helpArticles.length}+ self-service guides for OCCTA broadband, mobile and home phone: setup, faults, Wi-Fi, SIM, billing, moving, switching, complaints and extra help.`}
        canonical="/help"
        keywords="occta help, broadband help uk, sim help, self service broadband, occta support, report broadband fault"
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
              Step-by-step guides written by the OCCTA team. Find your topic, follow the steps, and if you still need us, we're a message away.
            </p>
            <div className="mt-8 max-w-xl">
              <KbSearchBar size="lg" placeholder="Search e.g. ‘router lights’, ‘eSIM’, ‘cancel’…" />
            </div>
            <nav aria-label="Help topics" className="mt-6 flex flex-wrap gap-2">
              {categories.map(({ cat, items }) => (
                <a key={cat} href={`#${anchor(cat)}`} className="border-2 border-white/30 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:border-primary hover:text-primary">
                  {cat} <span className="text-white/50">({items.length})</span>
                </a>
              ))}
            </nav>
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
            <div key={cat} id={anchor(cat)} className="mb-16 scroll-mt-24 last:mb-0">
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
              <p className="mt-4 max-w-xl text-lg text-white/70">Chat with Ollie (bottom-right) any time, raise a tracked ticket, email hello@occta.co.uk or call {CONTACT_PHONE_DISPLAY} (Mon–Fri, 8am–6pm).</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/support" className="inline-flex items-center gap-2 border-[3px] border-primary bg-primary px-5 py-3 font-display text-lg uppercase text-black transition-colors hover:bg-transparent hover:text-primary">
                  <MessageCircle className="w-5 h-5" /> Contact support
                </Link>
                <Link to="/status" className="inline-flex items-center gap-2 border-[3px] border-white px-5 py-3 font-display text-lg uppercase text-white transition-colors hover:border-primary hover:text-primary">
                  Service status
                </Link>
                <Link to="/guides" className="inline-flex items-center gap-2 border-[3px] border-white px-5 py-3 font-display text-lg uppercase text-white transition-colors hover:border-primary hover:text-primary">
                  <BookOpen className="w-5 h-5" /> Browse guides
                </Link>
              </div>
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

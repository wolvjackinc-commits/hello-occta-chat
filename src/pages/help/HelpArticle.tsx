import { Link, useParams } from "react-router-dom";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/constants";
import { MotionConfig, motion } from "framer-motion";
import { Clock, MessageCircle } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO, StructuredData, createBreadcrumbSchema } from "@/components/seo";
import { getHelpArticle, helpArticles } from "@/data/helpArticles";
import NotFound from "@/pages/NotFound";
import { ArticleCard, BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow } from "@/components/brand/kit";
import ReadingProgress from "@/components/brand/ReadingProgress";
import { revealItem } from "@/components/brand/motion";

const HelpArticlePage = () => {
  const { slug } = useParams();
  const article = slug ? getHelpArticle(slug) : undefined;
  if (!article) return <NotFound />;

  const breadcrumb = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Help Centre", url: "/help" },
    { name: article.title, url: `/help/${article.slug}` },
  ]);

  const related = (article.related ?? [])
    .map((s) => helpArticles.find((a) => a.slug === s))
    .filter(Boolean) as typeof helpArticles;

  return (
    <Layout>
      <SEO title={article.metaTitle} description={article.description} canonical={`/help/${article.slug}`} keywords={article.keywords} type="article" />
      <StructuredData
        customOnly
        customSchema={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumb,
            {
              "@type": "TechArticle",
              headline: article.title,
              description: article.description,
              url: `https://www.occta.co.uk/help/${article.slug}`,
              inLanguage: "en-GB",
              author: { "@type": "Organization", name: "OCCTA LIMITED", url: "https://www.occta.co.uk/" },
              publisher: { "@id": "https://www.occta.co.uk/#organization" },
            },
          ],
        }}
      />

      <MotionConfig reducedMotion="user">
        <ReadingProgress />
        <article>
          <PosterStage>
            <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Help Centre", to: "/help" }, { label: article.title }]} />
            <div className="max-w-4xl">
              <HeroKicker>
                {article.category} · <Clock className="w-3 h-3 inline" /> {article.readMinutes} min
              </HeroKicker>
              <HeroTitle size="sm">{article.title}</HeroTitle>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/70">{article.intro}</p>
            </div>
          </PosterStage>

          <BrandSection tone="paper">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-20">
              <div className="min-w-0 max-w-3xl">
                {article.sections.map((s, i) => (
                  <Reveal key={i} className="grid gap-4 border-t-[3px] border-foreground py-8 first:border-t-0 first:pt-0 sm:grid-cols-[4rem_1fr]">
                    <span aria-hidden className="font-display text-5xl leading-[0.8] text-foreground/25">{String(i + 1).padStart(2, "0")}</span>
                    <section>
                      <h2 className="font-display text-2xl uppercase leading-none sm:text-3xl">{s.heading}</h2>
                      {s.paragraphs.filter(Boolean).map((p, j) => (
                        <p key={j} className="mt-3 text-base leading-relaxed text-foreground/80">{p}</p>
                      ))}
                      {s.bullets && (
                        <ul className="mt-3 space-y-2">
                          {s.bullets.map((b, j) => (
                            <li key={j} className="flex items-start gap-3 text-foreground/80">
                              <span className="mt-2 h-2 w-2 flex-shrink-0 bg-foreground" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </Reveal>
                ))}
              </div>

              <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
                {article.faqs.length > 0 && (
                  <section className="border-[3px] border-foreground bg-card">
                    <h2 className="border-b-[3px] border-foreground bg-primary px-5 py-2.5 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-black">FAQs</h2>
                    <div className="divide-y-2 divide-foreground/10">
                      {article.faqs.map((f, i) => (
                        <div key={i} className="p-5">
                          <p className="font-display text-lg uppercase leading-tight">{f.question}</p>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.answer}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <div className="border-[3px] border-foreground bg-[hsl(0_0%_5%)] p-5 text-white">
                  <div className="flex items-start gap-3">
                    <MessageCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-primary" />
                    <div className="text-sm leading-relaxed">
                      <p className="font-display text-lg uppercase leading-none">Still stuck?</p>
                      <p className="mt-2 text-white/75">Ask Ollie in the chat bubble any time, or talk to our UK team.</p>
                      <p className="mt-3"><a href={CONTACT_PHONE_TEL} className="font-semibold text-primary hover:underline">{CONTACT_PHONE_DISPLAY}</a> <span className="text-white/55">· Mon–Fri, 8am–6pm</span></p>
                      <p className="mt-1"><a href="mailto:hello@occta.co.uk" className="font-semibold text-primary hover:underline">hello@occta.co.uk</a></p>
                      <Link to="/support#tickets" className="mt-4 inline-flex border-2 border-white px-3 py-1.5 font-display text-sm uppercase hover:border-primary hover:text-primary">Raise a ticket</Link>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Was this article helpful? Tell Ollie or email us — we review every help article regularly.</p>
              </aside>
            </div>
          </BrandSection>

          {related.length > 0 && (
            <BrandSection tone="light">
              <Reveal>
                <SectionEyebrow index="01" label="Keep reading" />
                <h3 className="mt-5 font-display text-4xl uppercase leading-none sm:text-5xl">Related</h3>
              </Reveal>
              <Reveal stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r) => (
                  <motion.div key={r.slug} variants={revealItem}>
                    <ArticleCard to={`/help/${r.slug}`} label={r.category} title={r.title} desc={r.description} cta="Read article" />
                  </motion.div>
                ))}
              </Reveal>
            </BrandSection>
          )}
        </article>
      </MotionConfig>
    </Layout>
  );
};

export default HelpArticlePage;

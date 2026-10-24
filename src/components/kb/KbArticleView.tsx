import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import { Clock, ArrowRight, PhoneCall, Mail, MessageCircle } from "lucide-react";
import { SEO, JsonLd, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Layout from "@/components/layout/Layout";
import FeedbackWidget from "@/components/kb/FeedbackWidget";
import { companyConfig } from "@/lib/companyConfig";
import { breadcrumbLabel } from "@/lib/seo/breadcrumbLabel";
import ReadingProgress from "@/components/brand/ReadingProgress";
import {
  BrandSection,
  HeroKicker,
  HeroTitle,
  NumberedLinkList,
  PosterBreadcrumb,
  PosterStage,
  Reveal,
  SectionEyebrow,
  SectionTitle,
  TicketSlab,
} from "@/components/brand/kit";

export type KbFaq = { question: string; answer: string };
export type KbRelated = { slug: string; title: string; kind: string };

export interface KbArticle {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  content: string;
  kind: string;
  seo_title?: string | null;
  seo_description?: string | null;
  tags?: string[] | null;
  hero_image_url?: string | null;
  read_minutes?: number | null;
  last_reviewed_at?: string | null;
  structured_data?: Record<string, unknown> | null;
  faqs?: KbFaq[];
  related?: KbRelated[];
}

const openChat = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("open-ai-chat"));
};

function routeForKind(kind: string, slug: string): string {
  if (kind === "blog") return `/blog/${slug}`;
  if (kind === "guide") return `/guides/${slug}`;
  return `/help/${slug}`;
}

function labelForKind(kind: string): string {
  if (kind === "blog") return "Blog";
  if (kind === "guide") return "Guide";
  return "Help";
}

/**
 * Extracts a table of contents from `## Heading` markdown lines.
 */
function extractToc(content: string): { id: string; text: string }[] {
  const lines = content.split("\n");
  const items: { id: string; text: string }[] = [];
  for (const line of lines) {
    const m = /^##\s+(.+)$/.exec(line.trim());
    if (!m) continue;
    const text = m[1].trim();
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    items.push({ id, text });
  }
  return items;
}

/** Slugify a heading text for anchor IDs (matches extractToc). */
function slugifyHeading(children: React.ReactNode): string {
  const text = typeof children === "string" ? children : Array.isArray(children) ? children.join("") : String(children ?? "");
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function KbArticleView({ article }: { article: KbArticle }) {
  const toc = extractToc(article.content);
  const canonical = routeForKind(article.kind, article.slug);
  const kindLabel = breadcrumbLabel(labelForKind(article.kind));
  const articleLabel = breadcrumbLabel(article.title);
  const kindHub = article.kind === "blog" ? "/blog" : article.kind === "guide" ? "/guides" : "/help";

  const breadcrumb = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: kindLabel, url: kindHub },
    { name: articleLabel, url: canonical },
  ]);
  const faqSchema = article.faqs && article.faqs.length > 0 ? createFAQSchema(article.faqs) : null;
  const pageUrl = `https://www.occta.co.uk${canonical}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": article.kind === "help" ? "TechArticle" : article.kind === "blog" ? "BlogPosting" : "Article",
    headline: article.title.slice(0, 110),
    description: article.seo_description || article.summary || undefined,
    url: pageUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
    ...(article.last_reviewed_at ? { dateModified: article.last_reviewed_at } : {}),
    ...(article.hero_image_url ? { image: article.hero_image_url } : { image: "https://www.occta.co.uk/og-image.jpg" }),
    ...(article.tags?.length ? { keywords: article.tags.join(", ") } : {}),
    inLanguage: "en-GB",
    author: { "@type": "Organization", name: "OCCTA LIMITED", url: "https://www.occta.co.uk/" },
    publisher: {
      "@type": "Organization",
      name: "OCCTA LIMITED",
      logo: { "@type": "ImageObject", url: "https://www.occta.co.uk/pwa-512x512.png" },
    },
  };

  const reviewedText = article.last_reviewed_at
    ? new Date(article.last_reviewed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <Layout>
      <SEO
        title={article.seo_title || `${article.title} — OCCTA`}
        description={article.seo_description || article.summary || `${article.title} — OCCTA ${kindLabel}.`}
        canonical={canonical}
        type="article"
        image={article.hero_image_url || undefined}
      />
      <JsonLd data={articleSchema} />
      <JsonLd data={breadcrumb} />
      {faqSchema && <JsonLd data={faqSchema} />}
      {article.structured_data && <JsonLd data={article.structured_data as object} />}

      <ReadingProgress />
      <article>
        <PosterStage>
          <PosterBreadcrumb
            items={[
              { label: "Home", to: "/" },
              { label: kindLabel, to: kindHub },
              { label: articleLabel },
            ]}
          />
          <div className={`grid items-end gap-10 ${article.summary ? "lg:grid-cols-[minmax(0,1fr)_400px] xl:gap-16" : ""}`}>
            <div className="max-w-4xl">
              <HeroKicker>
                {kindLabel}
                {article.read_minutes ? <> · <Clock className="w-3 h-3 inline" /> {article.read_minutes} min</> : null}
                {reviewedText ? <> · Last reviewed {reviewedText}</> : null}
              </HeroKicker>
              <HeroTitle size="sm">{article.title}</HeroTitle>
            </div>
            {article.summary && (
              <TicketSlab className="mr-3 mb-3">
                <div className="border-[3px] border-white bg-white text-black">
                  <p className="border-b-[3px] border-black bg-primary px-5 py-2.5 font-sans text-[11px] font-bold uppercase tracking-[0.2em]">In short</p>
                  <p className="p-5 text-base leading-relaxed">{article.summary}</p>
                </div>
              </TicketSlab>
            )}
          </div>
        </PosterStage>

        <BrandSection tone="paper">
          <div className={`grid gap-12 lg:gap-20 ${toc.length > 2 ? "lg:grid-cols-[260px_minmax(0,1fr)]" : ""}`}>
            {toc.length > 2 && (
              <aside>
                <nav aria-label="On this page" className="border-[3px] border-foreground bg-card p-4 lg:sticky lg:top-28 lg:border-0 lg:bg-transparent lg:p-0">
                  <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/60">On this page</p>
                  <ol className="mt-3 lg:mt-4 lg:border-t-[3px] lg:border-foreground">
                    {toc.map((t, i) => (
                      <li key={t.id} className="lg:border-b-2 lg:border-foreground/15">
                        <a href={`#${t.id}`} className="group flex gap-3 py-1.5 text-sm font-medium leading-snug lg:py-2.5">
                          <span className="font-display text-base leading-none text-foreground/30 group-hover:text-foreground">{String(i + 1).padStart(2, "0")}</span>
                          <span className="text-foreground/75 group-hover:text-foreground">{t.text}</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </aside>
            )}

            <div className="min-w-0 max-w-3xl">
              <div className="prose prose-neutral max-w-none text-foreground prose-p:text-foreground/80 prose-li:text-foreground/80 dark:prose-invert">
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => (
                      <h2 id={slugifyHeading(children)} className="mt-12 mb-3 scroll-mt-28 border-t-[3px] border-foreground pt-6 font-display text-3xl uppercase leading-[0.95] md:text-4xl">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="font-display uppercase text-xl mt-6 mb-2">{children}</h3>
                    ),
                    a: ({ href, children }) => (
                      <a href={href} className="font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4">{children}</a>
                    ),
                  }}
                >
                  {article.content}
                </ReactMarkdown>
              </div>

              <div className="mt-12">
                <FeedbackWidget articleId={article.id} />
              </div>
            </div>
          </div>
        </BrandSection>

        {article.faqs && article.faqs.length > 0 && (
          <BrandSection tone="dark">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
              <Reveal className="lg:sticky lg:top-28 lg:self-start">
                <SectionEyebrow index="01" label="Questions" tone="dark" />
                <SectionTitle className="mt-5">FAQs</SectionTitle>
              </Reveal>
              <Accordion type="single" collapsible className="border-t-[3px] border-white/25">
                {article.faqs.map((f, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-b-[3px] border-white/25">
                    <AccordionTrigger className="py-5 text-left font-display text-xl uppercase leading-tight text-white hover:text-primary hover:no-underline sm:text-2xl">
                      {f.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 text-base leading-relaxed text-white/75">
                      {f.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </BrandSection>
        )}

        <BrandSection tone="yellow" className="border-y-[3px] border-black">
          <Reveal className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h2 className="font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Still need help?</h2>
              <p className="mt-4 max-w-xl text-lg text-black/75">Check availability at your address, or talk to a human.</p>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-black/80">
                <a href={companyConfig.phone.href} className="inline-flex items-center gap-2 underline-offset-4 hover:underline">
                  <PhoneCall className="h-4 w-4" /> {companyConfig.phone.display}
                </a>
                <a href={`mailto:${companyConfig.email.general}`} className="inline-flex items-center gap-2 underline-offset-4 hover:underline">
                  <Mail className="h-4 w-4" /> {companyConfig.email.general}
                </a>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="border-[3px] border-black bg-black font-display uppercase text-primary hover:bg-white hover:text-black">
                <Link to="/order">Check availability <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-white font-display uppercase text-black">
                <Link to="/support">Contact support</Link>
              </Button>
              <Button type="button" variant="ghost" size="lg" className="font-display uppercase text-black hover:bg-black/10" onClick={openChat}>
                <MessageCircle className="mr-2 h-4 w-4" /> Ask Ollie
              </Button>
            </div>
          </Reveal>
        </BrandSection>

        {article.related && article.related.length > 0 && (
          <BrandSection tone="light">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
              <Reveal>
                <SectionEyebrow index={article.faqs && article.faqs.length > 0 ? "02" : "01"} label="Keep reading" />
                <SectionTitle className="mt-5">Related</SectionTitle>
              </Reveal>
              <NumberedLinkList items={article.related.map((r) => ({ title: r.title, desc: labelForKind(r.kind), path: routeForKind(r.kind, r.slug) }))} />
            </div>
          </BrandSection>
        )}

        <section className="border-t-[3px] border-foreground bg-secondary">
          <p className="mx-auto w-full max-w-[1440px] px-4 py-8 text-xs leading-relaxed text-muted-foreground sm:px-6 md:px-12">
            This guide is for general information only. Your accepted Contract Summary, Contract Information and OCCTA terms apply to your service.
          </p>
        </section>
      </article>
    </Layout>
  );
}

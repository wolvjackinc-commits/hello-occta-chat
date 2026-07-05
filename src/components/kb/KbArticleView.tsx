import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import { Clock, ArrowRight, PhoneCall, Mail, MessageCircle } from "lucide-react";
import { SEO, JsonLd, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Layout from "@/components/layout/Layout";
import FeedbackWidget from "@/components/kb/FeedbackWidget";
import { companyConfig } from "@/lib/companyConfig";

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
  const kindLabel = labelForKind(article.kind);

  const breadcrumb = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: kindLabel, url: article.kind === "blog" ? "/blog" : article.kind === "guide" ? "/guides" : "/help" },
    { name: article.title, url: canonical },
  ]);
  const faqSchema = article.faqs && article.faqs.length > 0 ? createFAQSchema(article.faqs) : null;

  const reviewedText = article.last_reviewed_at
    ? new Date(article.last_reviewed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <Layout>
      <SEO
        title={article.seo_title || `${article.title} — OCCTA`}
        description={article.seo_description || article.summary || `${article.title} — OCCTA ${kindLabel}.`}
        canonical={canonical}
      />
      <JsonLd data={breadcrumb} />
      {faqSchema && <JsonLd data={faqSchema} />}
      {article.structured_data && <JsonLd data={article.structured_data as object} />}

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <nav aria-label="Breadcrumb" className="text-xs font-display uppercase tracking-[0.18em] text-muted-foreground mb-4">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <Link to={article.kind === "blog" ? "/blog" : article.kind === "guide" ? "/guides" : "/help"} className="hover:text-foreground">
            {kindLabel}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{article.title}</span>
        </nav>

        <span className="inline-block text-xs font-display uppercase tracking-[0.18em] text-primary mb-2">
          {kindLabel}
          {article.read_minutes ? <> · <Clock className="w-3 h-3 inline" /> {article.read_minutes} min</> : null}
          {reviewedText ? <> · Last reviewed {reviewedText}</> : null}
        </span>

        <h1 className="font-display uppercase text-3xl md:text-5xl leading-[0.95] mb-4 text-foreground">
          {article.title}
        </h1>

        {article.summary && (
          <p className="text-lg md:text-xl text-foreground border-l-4 border-primary pl-4 mb-8">
            {article.summary}
          </p>
        )}

        {toc.length > 2 && (
          <nav aria-label="On this page" className="border-2 border-foreground p-4 mb-8 bg-secondary/40">
            <p className="font-display uppercase text-xs mb-2 text-muted-foreground">On this page</p>
            <ul className="text-sm space-y-1">
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="hover:text-primary">{t.text}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="prose prose-neutral dark:prose-invert max-w-none text-foreground">
          <ReactMarkdown
            components={{
              h2: ({ children }) => (
                <h2 id={slugifyHeading(children)} className="font-display uppercase text-2xl md:text-3xl mt-10 mb-3 scroll-mt-24">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="font-display uppercase text-lg mt-6 mb-2">{children}</h3>
              ),
              a: ({ href, children }) => (
                <a href={href} className="text-primary underline underline-offset-2">{children}</a>
              ),
            }}
          >
            {article.content}
          </ReactMarkdown>
        </div>

        {article.faqs && article.faqs.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display uppercase text-2xl md:text-3xl mb-4">FAQs</h2>
            <Accordion type="single" collapsible className="border-4 border-foreground">
              {article.faqs.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-b-4 border-foreground last:border-b-0">
                  <AccordionTrigger className="px-4 py-3 font-display uppercase text-sm text-left hover:no-underline">
                    {f.question}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 text-base leading-relaxed">
                    {f.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        <FeedbackWidget articleId={article.id} />

        <section className="mt-12 border-4 border-foreground p-6">
          <h2 className="font-display uppercase text-xl md:text-2xl mb-3">Still need help?</h2>
          <p className="text-base mb-5">Check availability at your address, or talk to a human.</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="font-display uppercase">
              <Link to="/build-plan">Check availability <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" className="font-display uppercase">
              <Link to="/support">Contact support</Link>
            </Button>
            <Button type="button" variant="ghost" className="font-display uppercase" onClick={openChat}>
              <MessageCircle className="mr-2 h-4 w-4" /> Ask Ira
            </Button>
          </div>
          <div className="mt-5 text-sm text-muted-foreground flex flex-wrap gap-x-6 gap-y-2">
            <a href={companyConfig.phone.href} className="inline-flex items-center gap-2 hover:text-foreground">
              <PhoneCall className="h-4 w-4" /> {companyConfig.phone.display}
            </a>
            <a href={`mailto:${companyConfig.email.general}`} className="inline-flex items-center gap-2 hover:text-foreground">
              <Mail className="h-4 w-4" /> {companyConfig.email.general}
            </a>
          </div>
        </section>

        {article.related && article.related.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display uppercase text-xl md:text-2xl mb-4">Related</h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {article.related.map((r) => (
                <li key={r.slug} className="border-2 border-foreground p-4 hover:bg-accent/10 transition-colors">
                  <Link to={routeForKind(r.kind, r.slug)} className="font-display uppercase text-sm">
                    {r.title} <ArrowRight className="inline h-4 w-4" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10 pt-6 border-t-2 border-foreground/30 text-xs text-muted-foreground leading-relaxed">
          This guide is for general information only. Your accepted Contract Summary, Contract Information and OCCTA terms apply to your service.
        </p>
      </article>
    </Layout>
  );
}
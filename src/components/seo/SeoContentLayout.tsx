import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { SEO, JsonLd, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, MessageCircle, PhoneCall, Mail } from "lucide-react";
import { companyConfig } from "@/lib/companyConfig";
import { breadcrumbLabel } from "@/lib/seo/breadcrumbLabel";
import {
  BrandSection,
  HeroTitle,
  NumberedLinkList,
  PosterBreadcrumb,
  PosterStage,
  Reveal,
  SectionEyebrow,
  SectionTitle,
  TicketSlab,
} from "@/components/brand/kit";

export interface SeoSection {
  heading: string;
  body: ReactNode;
}
export interface QA {
  question: string;
  answer: string;
}
export interface RelatedLink {
  label: string;
  to: string;
  description?: string;
}
export interface SeoContentPageProps {
  title: string;
  metaDescription: string;
  canonical: string;
  h1: string;
  intro: ReactNode;
  /** Short answer block that appears directly under the H1 (AEO-friendly). */
  shortAnswer?: string;
  sections?: SeoSection[];
  /** Inline AEO question/answer blocks rendered as <h3>+<p>. Not added to FAQ schema. */
  aeo?: QA[];
  /** Visible FAQs rendered in an accordion AND emitted as FAQPage JSON-LD. */
  faqs?: QA[];
  relatedLinks?: RelatedLink[];
  /** Compliance / disclosure footnote (small print). */
  compliance?: ReactNode;
  /** Override default CTA row. */
  primaryCta?: { label: string; to: string };
  secondaryCta?: { label: string; to: string };
  /** Extra page content (e.g. a lead-capture widget) shown after the main sections, inside the page. */
  afterContent?: ReactNode;
}

const openChat = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-ai-chat"));
  }
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const pad = (n: number) => String(n).padStart(2, "0");

export default function SeoContentLayout({
  title,
  metaDescription,
  canonical,
  h1,
  intro,
  shortAnswer,
  sections = [],
  aeo = [],
  faqs = [],
  relatedLinks = [],
  compliance,
  primaryCta = { label: "Check availability", to: "/order" },
  secondaryCta = { label: "Check Availability", to: "/broadband" },
  afterContent,
}: SeoContentPageProps) {
  const faqSchema = faqs.length > 0 ? createFAQSchema(faqs.map(f => ({ question: f.question, answer: f.answer }))) : null;
  const breadcrumb = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: breadcrumbLabel(h1), url: canonical },
  ]);

  // Numbered page sections, so the eyebrow index runs on across the page.
  const contents = [
    ...sections.map((s) => ({ id: slug(s.heading), label: s.heading })),
    ...(aeo.length > 0 ? [{ id: "quick-answers", label: "Quick answers" }] : []),
  ];
  let n = contents.length > 0 ? 1 : 0;
  const faqIndex = faqs.length > 0 ? ++n : 0;
  const nextIndex = ++n;
  const relatedIndex = relatedLinks.length > 0 ? ++n : 0;

  return (
    <Layout>
      <SEO title={title} description={metaDescription} canonical={canonical} type="article" />
      <JsonLd data={breadcrumb} />
      {faqSchema && <JsonLd data={faqSchema} />}

      <MotionConfig reducedMotion="user">
        <article>
          <PosterStage>
            <div className={`grid items-end gap-10 ${shortAnswer ? "lg:grid-cols-[minmax(0,1fr)_420px] xl:gap-16" : ""}`}>
              <div className="max-w-4xl">
                <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: breadcrumbLabel(h1) }]} />
                <HeroTitle size={h1.length > 34 ? "sm" : "md"}>{h1}</HeroTitle>
                <div className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">{intro}</div>
              </div>

              {shortAnswer && (
                <TicketSlab className="mr-3 mb-3">
                  <div className="border-[3px] border-white bg-white text-black">
                    <p className="border-b-[3px] border-black bg-primary px-5 py-2.5 font-sans text-[11px] font-bold uppercase tracking-[0.2em]">
                      The short answer
                    </p>
                    <p className="p-5 text-base leading-relaxed">{shortAnswer}</p>
                  </div>
                </TicketSlab>
              )}
            </div>
          </PosterStage>

          {contents.length > 0 && (
            <BrandSection tone="paper">
              <div className="grid gap-12 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-20">
                {/* Contents rail */}
                <aside className="hidden lg:block">
                  <nav aria-label="On this page" className="sticky top-28">
                    <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/60">On this page</p>
                    <ol className="mt-4 border-t-[3px] border-foreground">
                      {contents.map((c, i) => (
                        <li key={c.id} className="border-b-2 border-foreground/15">
                          <a href={`#${c.id}`} className="group flex gap-3 py-2.5 text-sm font-medium leading-snug transition-colors hover:text-foreground">
                            <span className="font-display text-base leading-none text-foreground/30 group-hover:text-foreground">{pad(i + 1)}</span>
                            <span className="text-foreground/75 group-hover:text-foreground">{c.label}</span>
                          </a>
                        </li>
                      ))}
                    </ol>
                  </nav>
                </aside>

                <div className="min-w-0 max-w-3xl">
                  {sections.map((s, i) => (
                    <Reveal key={i} className="scroll-mt-28 border-t-[3px] border-foreground pt-6 pb-10 first:border-t-0 first:pt-0">
                      <section id={slug(s.heading)} className="scroll-mt-28">
                        <span className="font-display text-xl leading-none text-foreground/30">{pad(i + 1)}</span>
                        <h2 className="mt-2 font-display text-3xl uppercase leading-[0.95] text-foreground md:text-4xl">{s.heading}</h2>
                        <div className="prose prose-neutral mt-4 max-w-none text-base leading-relaxed text-foreground/80 dark:prose-invert">{s.body}</div>
                      </section>
                    </Reveal>
                  ))}

                  {aeo.length > 0 && (
                    <Reveal className="border-t-[3px] border-foreground pt-6 pb-4">
                      <section id="quick-answers" className="scroll-mt-28">
                        <span className="font-display text-xl leading-none text-foreground/30">{pad(sections.length + 1)}</span>
                        <h2 className="mt-2 font-display text-3xl uppercase leading-[0.95] text-foreground md:text-4xl">Quick answers</h2>
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                          {aeo.map((q, i) => (
                            <div key={i} className="border-[3px] border-foreground bg-card p-5">
                              <h3 className="font-display text-xl uppercase leading-tight text-foreground">{q.question}</h3>
                              <p className="mt-2 text-sm leading-relaxed text-foreground/75">{q.answer}</p>
                            </div>
                          ))}
                        </div>
                      </section>
                    </Reveal>
                  )}
                </div>
              </div>
            </BrandSection>
          )}

          {afterContent && (
            <BrandSection tone="light" containerClassName="!py-12 md:!py-16">
              <div className="max-w-3xl">{afterContent}</div>
            </BrandSection>
          )}

          {faqs.length > 0 && (
            <BrandSection tone="dark">
              <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
                <Reveal className="lg:sticky lg:top-28 lg:self-start">
                  <SectionEyebrow index={pad(faqIndex)} label="Questions" tone="dark" />
                  <SectionTitle className="mt-5">FAQs</SectionTitle>
                </Reveal>
                <Accordion type="single" collapsible className="border-t-[3px] border-white/25">
                  {faqs.map((f, i) => (
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
                <SectionEyebrow index={pad(nextIndex)} label="Your move" tone="yellow" />
                <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Next step</h2>
                <p className="mt-4 max-w-xl text-lg text-black/75">
                  Find out what's available at your address, or talk to a human about your setup.
                </p>
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
                  <Link to={primaryCta.to}>{primaryCta.label} <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="bg-white font-display uppercase text-black">
                  <Link to={secondaryCta.to}>{secondaryCta.label}</Link>
                </Button>
                <Button type="button" variant="ghost" size="lg" className="font-display uppercase text-black hover:bg-black/10" onClick={openChat}>
                  <MessageCircle className="mr-2 h-4 w-4" /> Ask Ollie
                </Button>
              </div>
            </Reveal>
          </BrandSection>

          {relatedLinks.length > 0 && (
            <BrandSection tone="light">
              <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
                <Reveal>
                  <SectionEyebrow index={pad(relatedIndex)} label="Keep reading" />
                  <SectionTitle className="mt-5">Related pages</SectionTitle>
                </Reveal>
                <NumberedLinkList items={relatedLinks.map((l) => ({ title: l.label, desc: l.description ?? "", path: l.to }))} />
              </div>
            </BrandSection>
          )}

          {compliance && (
            <section className="border-t-[3px] border-foreground bg-secondary">
              <div className="mx-auto w-full max-w-[1440px] px-4 py-8 text-xs leading-relaxed text-muted-foreground sm:px-6 md:px-12">
                <div className="max-w-4xl">{compliance}</div>
              </div>
            </section>
          )}
        </article>
      </MotionConfig>
    </Layout>
  );
}

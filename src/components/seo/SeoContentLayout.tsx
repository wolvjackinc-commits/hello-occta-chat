import { ReactNode } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO, JsonLd, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, MessageCircle, PhoneCall, Mail } from "lucide-react";
import { companyConfig } from "@/lib/companyConfig";

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
}

const openChat = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-ai-chat"));
  }
};

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
  primaryCta = { label: "Check availability", to: "/build-plan" },
  secondaryCta = { label: "Check Availability", to: "/broadband" },
}: SeoContentPageProps) {
  const faqSchema = faqs.length > 0 ? createFAQSchema(faqs.map(f => ({ question: f.question, answer: f.answer }))) : null;
  const breadcrumb = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: h1, url: canonical },
  ]);

  return (
    <Layout>
      <SEO title={title} description={metaDescription} canonical={canonical} />
      <JsonLd data={breadcrumb} />
      {faqSchema && <JsonLd data={faqSchema} />}

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <nav aria-label="Breadcrumb" className="text-xs font-display uppercase tracking-[0.18em] text-muted-foreground mb-4">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{h1}</span>
        </nav>

        <h1 className="font-display uppercase text-4xl md:text-5xl leading-[0.95] mb-6 text-foreground">
          {h1}
        </h1>

        {shortAnswer && (
          <p className="text-lg md:text-xl text-foreground border-l-4 border-primary pl-4 mb-8">
            {shortAnswer}
          </p>
        )}

        <div className="prose prose-neutral dark:prose-invert max-w-none text-foreground">
          <div className="mb-8 text-base leading-relaxed">{intro}</div>

          {sections.map((s, i) => (
            <section key={i} className="mb-8">
              <h2 className="font-display uppercase text-2xl md:text-3xl mt-10 mb-3 text-foreground">{s.heading}</h2>
              <div className="text-base leading-relaxed">{s.body}</div>
            </section>
          ))}

          {aeo.length > 0 && (
            <section className="mb-8">
              <h2 className="font-display uppercase text-2xl md:text-3xl mt-10 mb-3 text-foreground">Quick answers</h2>
              {aeo.map((q, i) => (
                <div key={i} className="mb-5">
                  <h3 className="font-display uppercase text-base text-foreground mb-1">{q.question}</h3>
                  <p className="text-base text-foreground leading-relaxed">{q.answer}</p>
                </div>
              ))}
            </section>
          )}
        </div>

        {faqs.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display uppercase text-2xl md:text-3xl mb-4">FAQs</h2>
            <Accordion type="single" collapsible className="border-4 border-foreground">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-b-4 border-foreground last:border-b-0">
                  <AccordionTrigger className="px-4 py-3 font-display uppercase text-sm text-left hover:no-underline">
                    {f.question}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 text-base text-foreground leading-relaxed">
                    {f.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        <section className="mt-12 border-4 border-foreground p-6">
          <h2 className="font-display uppercase text-xl md:text-2xl mb-3">Next step</h2>
          <p className="text-base text-foreground mb-5">
            Find out what's available at your address, or talk to a human about your setup.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="font-display uppercase">
              <Link to={primaryCta.to}>{primaryCta.label} <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" className="font-display uppercase">
              <Link to={secondaryCta.to}>{secondaryCta.label}</Link>
            </Button>
            <Button type="button" variant="ghost" className="font-display uppercase" onClick={openChat}>
              <MessageCircle className="mr-2 h-4 w-4" /> Ask Ollie
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

        {relatedLinks.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display uppercase text-xl md:text-2xl mb-4">Related pages</h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {relatedLinks.map((l) => (
                <li key={l.to} className="border-2 border-foreground p-4 hover:bg-accent/10 transition-colors">
                  <Link to={l.to} className="font-display uppercase text-sm text-foreground">
                    {l.label} <ArrowRight className="inline h-4 w-4" />
                  </Link>
                  {l.description && <p className="text-sm text-muted-foreground mt-1">{l.description}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {compliance && (
          <section className="mt-10 pt-6 border-t-2 border-foreground/30 text-xs text-muted-foreground leading-relaxed">
            {compliance}
          </section>
        )}
      </article>
    </Layout>
  );
}
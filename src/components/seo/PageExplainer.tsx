import { BrandSection, Reveal, SectionEyebrow, SectionTitle } from "@/components/brand/kit";
import { StructuredData, createFAQSchema } from "@/components/seo";

interface PageExplainerProps {
  index?: string;
  title: string;
  paragraphs: string[];
  faqs: { question: string; answer: string }[];
  /** Extra page schema (e.g. a Service with offers), merged into one graph with the FAQPage. */
  schema?: object[];
}

/** Plain-English explainer plus visible FAQs (with FAQPage schema) for hub pages. */
export default function PageExplainer({ index = "03", title, paragraphs, faqs, schema = [] }: PageExplainerProps) {
  return (
    <>
      <StructuredData customOnly customSchema={{ "@context": "https://schema.org", "@graph": [...schema, createFAQSchema(faqs)] }} />
      <BrandSection tone="paper" className="border-t-[3px] border-foreground">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <SectionEyebrow index={index} label="Explained" />
            <SectionTitle className="mt-5">{title}</SectionTitle>
          </Reveal>
          {paragraphs.map((p) => (
            <p key={p} className="mt-5 text-base leading-relaxed text-foreground/80">{p}</p>
          ))}
          <h2 className="mt-12 font-display text-3xl uppercase leading-none">Questions</h2>
          <dl className="mt-6 divide-y-2 divide-foreground/10 border-y-[3px] border-foreground">
            {faqs.map((f) => (
              <div key={f.question} className="py-5">
                <dt className="font-display text-xl uppercase leading-tight">{f.question}</dt>
                <dd className="mt-2 text-base leading-relaxed text-foreground/75">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </BrandSection>
    </>
  );
}

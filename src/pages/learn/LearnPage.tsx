// Renders a single /learn/<slug> page from static content in learnPages.
// Delegates all layout, SEO, JSON-LD (FAQPage + BreadcrumbList) and CTA
// wiring to SeoContentLayout — this file is a thin adapter.
import { useParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import SeoContentLayout from "@/components/seo/SeoContentLayout";
import NotFound from "@/pages/NotFound";
import { getLearnPageBySlug } from "@/data/learnPages";

export default function LearnPage() {
  const { slug } = useParams<{ slug: string }>();
  const page = slug ? getLearnPageBySlug(slug) : undefined;

  if (!page) {
    return (
      <Layout>
        <NotFound />
      </Layout>
    );
  }

  return (
    <SeoContentLayout
      title={`${page.title}`}
      metaDescription={page.metaDescription}
      canonical={`/learn/${page.slug}`}
      h1={page.h1}
      shortAnswer={page.shortAnswer}
      intro={<p>{page.intro}</p>}
      sections={page.sections.map((s) => ({ heading: s.heading, body: <p>{s.body}</p> }))}
      faqs={page.faqs}
      relatedLinks={page.related}
    />
  );
}

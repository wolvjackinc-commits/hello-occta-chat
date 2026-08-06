// Renders a single /learn/<slug> page from static content.
// Existing explainers live in learnPages; new authority articles live in
// seoArticles so content expansion remains isolated and low-risk.
import { useParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import SeoContentLayout from "@/components/seo/SeoContentLayout";
import { JsonLd } from "@/components/seo";
import NotFound from "@/pages/NotFound";
import { getLearnPageBySlug } from "@/data/learnPages";
import { getSeoArticleBySlug } from "@/data/seoArticles";

const SITE_URL = "https://www.occta.co.uk";

export default function LearnPage() {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? getSeoArticleBySlug(slug) : undefined;
  const page = article ?? (slug ? getLearnPageBySlug(slug) : undefined);

  if (!page) {
    return (
      <Layout>
        <NotFound />
      </Layout>
    );
  }

  const canonical = `/learn/${page.slug}`;
  const articleSchema = article
    ? {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.h1,
        description: article.metaDescription,
        datePublished: article.datePublished,
        dateModified: article.dateModified,
        mainEntityOfPage: `${SITE_URL}${canonical}`,
        image: `${SITE_URL}/og-image.png`,
        author: {
          "@type": "Organization",
          name: article.authorName,
          url: SITE_URL,
        },
        reviewedBy: {
          "@type": "Organization",
          name: article.reviewedBy,
          url: SITE_URL,
        },
        publisher: {
          "@type": "Organization",
          name: "OCCTA LIMITED",
          url: SITE_URL,
          logo: {
            "@type": "ImageObject",
            url: `${SITE_URL}/pwa-512x512.png`,
          },
        },
      }
    : null;

  const disclosure = article ? (
    <div className="space-y-3">
      <p>
        Written by {article.authorName}. Reviewed by {article.reviewedBy}. Published{" "}
        <time dateTime={article.datePublished}>{article.datePublished}</time>; last reviewed{" "}
        <time dateTime={article.dateModified}>{article.dateModified}</time>.
      </p>
      <div>
        <span className="font-semibold text-foreground">Sources:</span>{" "}
        {article.sources.map((source, index) => (
          <span key={source.url}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              {source.label}
            </a>
            {index < article.sources.length - 1 ? "; " : "."}
          </span>
        ))}
      </div>
      <p>
        General information only. Availability, estimated speeds, installation work,
        features and commercial terms are confirmed for the specific address and order.
      </p>
    </div>
  ) : undefined;

  return (
    <>
      {articleSchema && <JsonLd data={articleSchema} />}
      <SeoContentLayout
        title={page.title}
        metaDescription={page.metaDescription}
        canonical={canonical}
        h1={page.h1}
        shortAnswer={page.shortAnswer}
        intro={<p>{page.intro}</p>}
        sections={page.sections.map((section) => ({
          heading: section.heading,
          body: <p>{section.body}</p>,
        }))}
        faqs={page.faqs}
        relatedLinks={page.related}
        compliance={disclosure}
      />
    </>
  );
}

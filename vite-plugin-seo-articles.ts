/**
 * Isolated build-time prerendering for the static authority articles in
 * src/data/seoArticles.ts. This plugin only writes /learn/<slug>/index.html
 * and does not alter application routes, customer journeys or private pages.
 */
import type { Plugin } from "vite";
import fs from "fs";
import path from "path";
import { seoArticles } from "./src/data/seoArticles";

const BASE_URL = "https://www.occta.co.uk";
const OG_IMAGE = `${BASE_URL}/og-image.png`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function replaceOrInsert(
  html: string,
  pattern: RegExp,
  replacement: string,
): string {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace("</head>", `    ${replacement}\n  </head>`);
}

function renderArticleHtml(template: string, article: (typeof seoArticles)[number]): string {
  const canonical = `${BASE_URL}/learn/${article.slug}`;
  const title = article.title;
  const description = article.metaDescription;

  let html = template;
  html = replaceOrInsert(html, /<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = replaceOrInsert(
    html,
    /<meta name="title" content="[^"]*" ?\/?>/,
    `<meta name="title" content="${escapeHtml(title)}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta name="description" content="[^"]*" ?\/?>/,
    `<meta name="description" content="${escapeHtml(description)}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta name="keywords" content="[^"]*" ?\/?>/,
    `<meta name="keywords" content="${escapeHtml(article.keywords)}" />`,
  );
  html = replaceOrInsert(
    html,
    /<link rel="canonical" href="[^"]*" ?\/?>/,
    `<link rel="canonical" href="${canonical}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta property="og:type" content="[^"]*" ?\/?>/,
    '<meta property="og:type" content="article" />',
  );
  html = replaceOrInsert(
    html,
    /<meta property="og:url" content="[^"]*" ?\/?>/,
    `<meta property="og:url" content="${canonical}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta property="og:title" content="[^"]*" ?\/?>/,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta property="og:description" content="[^"]*" ?\/?>/,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta property="og:image" content="[^"]*" ?\/?>/,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta name="twitter:url" content="[^"]*" ?\/?>/,
    `<meta name="twitter:url" content="${canonical}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta name="twitter:title" content="[^"]*" ?\/?>/,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta name="twitter:description" content="[^"]*" ?\/?>/,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  );

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.h1,
    description,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    mainEntityOfPage: canonical,
    image: OG_IMAGE,
    author: {
      "@type": "Organization",
      name: article.authorName,
      url: BASE_URL,
    },
    reviewedBy: {
      "@type": "Organization",
      name: article.reviewedBy,
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "OCCTA LIMITED",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/pwa-512x512.png`,
      },
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${BASE_URL}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Learn",
        item: `${BASE_URL}/learn`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.h1,
        item: canonical,
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: article.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const schemas = [articleSchema, breadcrumbSchema, faqSchema]
    .map((schema) => `<script type="application/ld+json">${JSON.stringify(schema)}</script>`)
    .join("\n    ");

  html = html.replace("</head>", `    ${schemas}\n  </head>`);
  return html;
}

export function seoArticlePrerender(): Plugin {
  return {
    name: "vite-plugin-seo-authority-articles",
    apply: "build",
    closeBundle: {
      sequential: true,
      order: "post",
      async handler() {
        const distDir = path.resolve(process.cwd(), "dist");
        const templatePath = path.join(distDir, "index.html");

        if (!fs.existsSync(templatePath)) {
          console.warn("SEO authority articles: dist/index.html not found; skipping.");
          return;
        }

        const template = fs.readFileSync(templatePath, "utf-8");

        for (const article of seoArticles) {
          const articleDir = path.join(distDir, "learn", article.slug);
          fs.mkdirSync(articleDir, { recursive: true });
          fs.writeFileSync(
            path.join(articleDir, "index.html"),
            renderArticleHtml(template, article),
            "utf-8",
          );
        }

        console.log(
          `SEO authority articles: generated ${seoArticles.length} static article pages.`,
        );
      },
    },
  };
}

/**
 * Custom Vite SEO Prerender Plugin
 *
 * Generates route-specific HTML files at build time with correct <title>,
 * <meta description>, <link rel="canonical">, Open Graph tags, Twitter cards,
 * and JSON-LD structured data baked into the raw HTML.
 *
 * Crawlers see the SEO signals immediately — no JS hydration required.
 * The SPA bundle still loads and hydrates normally for interactive users.
 */

import type { Plugin } from "vite";
import fs from "fs";
import path from "path";

/* ------------------------------------------------------------------ */
/*  SEO route definitions                                              */
/* ------------------------------------------------------------------ */

const BASE_URL = "https://www.occta.co.uk";
const SITE_NAME = "OCCTA";
const OG_IMAGE = `${BASE_URL}/og-image.png`;
const OG_IMAGE_ALT = "OCCTA - Affordable UK Broadband and SIM Plans";

interface RouteSEO {
  path: string;
  title: string;
  description: string;
  canonical: string;
  keywords: string;
  price?: string;
  priceCurrency?: string;
  jsonLd?: object[];
}

/* ─── Shared JSON-LD schemas (Organization + WebSite) ─── */

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "OCCTA LIMITED",
  legalName: "OCCTA LIMITED",
  url: `${BASE_URL}/`,
  logo: `${BASE_URL}/pwa-512x512.png`,
  image: `${BASE_URL}/og-image.png`,
  description:
    "Cheap UK broadband, SIM plans, and landline services with no contracts. Affordable internet from £22.99/month.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "22 Pavilion View",
    addressLocality: "Huddersfield",
    postalCode: "HD3 3WU",
    addressCountry: "GB",
    addressRegion: "England",
  },
  email: "hello@occta.co.uk",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "hello@occta.co.uk",
    areaServed: "GB",
    availableLanguage: ["en"],
  },
  areaServed: { "@type": "Country", name: "United Kingdom" },
  sameAs: [
    "https://x.com/Occtatelecom",
    "https://www.facebook.com/Occtalimited/",
    "https://www.instagram.com/occtalimited",
  ],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "OCCTA LIMITED",
  url: BASE_URL,
  description:
    "Cheap UK broadband, SIM plans, and landline services with no contracts.",
  publisher: {
    "@type": "Organization",
    name: "OCCTA LIMITED",
    logo: { "@type": "ImageObject", url: `${BASE_URL}/pwa-512x512.png` },
  },
  potentialAction: {
    "@type": "SearchAction",
    target: `${BASE_URL}/broadband?search={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${BASE_URL}/#localbusiness`,
  name: "OCCTA LIMITED",
  description:
    "Cheap UK broadband, SIM plans, and landline services. No contracts, no hidden fees, cancel anytime.",
  url: BASE_URL,
  email: "hello@occta.co.uk",
  priceRange: "£",
  image: `${BASE_URL}/pwa-512x512.png`,
  address: {
    "@type": "PostalAddress",
    streetAddress: "22 Pavilion View",
    addressLocality: "Huddersfield",
    postalCode: "HD3 3WU",
    addressCountry: "GB",
    addressRegion: "England",
  },
  areaServed: "GB",
};

const globalSchemas = [organizationSchema, websiteSchema, localBusinessSchema];

/* ─── Per-route definitions ─── */

const routes: RouteSEO[] = [
  {
    path: "/",
    title: "Cheap UK Broadband & SIM Plans | OCCTA - Cheap UK Broadband & SIM",
    description:
      "Cheap broadband UK from £22.99/mo. No contract broadband with 900Mbps speeds, 5G SIM plans from £7.99, landline from £7.99. No credit check, cancel anytime. Get connected today!",
    canonical: "/",
    keywords:
      "cheap broadband UK, no contract broadband, cancel anytime broadband, affordable internet UK, 5G SIM no credit check, cheap SIM deals UK, budget broadband 2025, fibre broadband no contract, unlimited broadband UK, OCCTA broadband",
    price: "22.99",
    jsonLd: globalSchemas,
  },
  {
    path: "/broadband",
    title: "Cheap Broadband UK - No Contract Fibre | OCCTA - Cheap UK Broadband & SIM",
    description:
      "Cheap broadband UK from £22.99/mo. No contract fibre broadband with 900Mbps speeds. No price rises, no hidden fees, cancel anytime. Best budget broadband 2025.",
    canonical: "/broadband",
    keywords:
      "cheap broadband UK, no contract broadband, cancel anytime broadband, fibre broadband no contract, budget broadband, cheap fibre UK, unlimited broadband UK, 900Mbps broadband, affordable internet UK",
    price: "22.99",
    jsonLd: [
      localBusinessSchema,
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "OCCTA Broadband",
        description:
          "Fast, reliable fibre broadband with speeds up to 900Mbps. No contracts, no price rises.",
        url: `${BASE_URL}/broadband`,
        provider: { "@type": "Organization", name: "OCCTA LIMITED", url: BASE_URL },
        areaServed: { "@type": "Country", name: "United Kingdom" },
        offers: {
          "@type": "Offer",
          price: "22.99",
          priceCurrency: "GBP",
          availability: "https://schema.org/InStock",
        },
      },
    ],
  },
  {
    path: "/sim-plans",
    title: "Cheap SIM Only Deals UK - 5G No Contract | OCCTA - Cheap UK Broadband & SIM",
    description:
      "Cheap SIM deals UK from £7.99/mo. 5G SIM no credit check, no contracts, EU roaming included. Best budget SIM plans 2025. Unlimited calls & texts.",
    canonical: "/sim-plans",
    keywords:
      "cheap SIM deals UK, 5G SIM no credit check, no contract SIM, cheap mobile plans UK, SIM only deals, budget SIM UK, unlimited SIM UK, PAYG SIM cheap, best SIM deals 2025",
    price: "7.99",
    jsonLd: [
      localBusinessSchema,
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "OCCTA SIM Plans",
        description:
          "UK SIM-only mobile plans with 5G, EU roaming, and no contracts.",
        url: `${BASE_URL}/sim-plans`,
        provider: { "@type": "Organization", name: "OCCTA LIMITED", url: BASE_URL },
        areaServed: { "@type": "Country", name: "United Kingdom" },
        offers: {
          "@type": "Offer",
          price: "7.99",
          priceCurrency: "GBP",
          availability: "https://schema.org/InStock",
        },
      },
    ],
  },
  {
    path: "/landline",
    title: "Cheap Landline Deals UK - No Contract | OCCTA - Cheap UK Broadband & SIM",
    description:
      "Cheap landline UK from £7.99/mo. No contract home phone, fraud protection, free voicemail. Digital voice clarity. Cancel anytime.",
    canonical: "/landline",
    keywords:
      "cheap landline UK, no contract landline, home phone deals, cheap home phone UK, landline no contract, budget landline, affordable landline UK",
    price: "7.99",
    jsonLd: [
      localBusinessSchema,
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "OCCTA Landline",
        description:
          "Reliable UK landline phone service with fraud protection and free voicemail.",
        url: `${BASE_URL}/landline`,
        provider: { "@type": "Organization", name: "OCCTA LIMITED", url: BASE_URL },
        areaServed: { "@type": "Country", name: "United Kingdom" },
        offers: {
          "@type": "Offer",
          price: "7.99",
          priceCurrency: "GBP",
          availability: "https://schema.org/InStock",
        },
      },
    ],
  },
  {
    path: "/no-contract-broadband-uk",
    title: "No Contract Broadband UK | Cheap & Flexible Broadband | OCCTA - Cheap UK Broadband & SIM",
    description:
      "Looking for no-contract broadband in the UK? OCCTA offers simple, affordable broadband with no lock-ins, no hidden fees, and no surprise price rises.",
    canonical: "/no-contract-broadband-uk",
    keywords:
      "no contract broadband UK, flexible broadband, cancel anytime broadband, no lock-in broadband, cheap broadband UK, OCCTA broadband, rolling monthly broadband, no exit fee broadband",
    price: "22.99",
    jsonLd: [
      localBusinessSchema,
      {
        "@context": "https://schema.org",
        "@type": "Offer",
        name: "No Contract Broadband",
        description:
          "Flexible UK broadband with no contracts, no hidden fees, and no price rises.",
        price: "22.99",
        priceCurrency: "GBP",
        url: `${BASE_URL}/no-contract-broadband-uk`,
        availability: "https://schema.org/InStock",
        seller: { "@type": "Organization", name: "OCCTA LIMITED", url: BASE_URL },
      },
    ],
  },
  {
    path: "/support",
    title: "Help & Support - 24/7 Customer Service | OCCTA - Cheap UK Broadband & SIM",
    description:
      "OCCTA Support Hub – UK-based help for broadband, SIM and landline. AI chat, FAQs, ticket system. Fast resolution guaranteed.",
    canonical: "/support",
    keywords:
      "OCCTA support, broadband help, SIM support UK, customer service telecom, internet support, landline help",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/about",
    title: "About OCCTA - UK Telecom Company | OCCTA - Cheap UK Broadband & SIM",
    description:
      "OCCTA is a UK telecom company providing cheap broadband, SIM, and landline services. No hidden fees, real UK-based customer support. 5,000+ happy customers.",
    canonical: "/about",
    keywords:
      "OCCTA, UK telecom company, cheap broadband provider, affordable internet UK, honest broadband, UK internet provider",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/faq",
    title: "FAQs - Broadband, SIM & Landline | OCCTA - Cheap UK Broadband & SIM",
    description:
      "Answers to common questions about OCCTA broadband, SIM plans, and landline services. Installation, billing, contracts, and more.",
    canonical: "/faq",
    keywords:
      "OCCTA FAQ, broadband questions, SIM FAQ, landline FAQ, internet help UK, telecom FAQ",
    jsonLd: [localBusinessSchema],
  },
];

/* ------------------------------------------------------------------ */
/*  HTML injection helpers                                             */
/* ------------------------------------------------------------------ */

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function injectSEO(template: string, route: RouteSEO): string {
  let html = template;

  // ── Title ──
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(route.title)}</title>`);

  // ── Meta name="title" ──
  html = html.replace(
    /<meta name="title" content="[^"]*" ?\/?>/,
    `<meta name="title" content="${escapeHtml(route.title)}" />`
  );

  // ── Meta description ──
  html = html.replace(
    /<meta name="description" content="[^"]*" ?\/?>/,
    `<meta name="description" content="${escapeHtml(route.description)}" />`
  );

  // ── Keywords ──
  html = html.replace(
    /<meta name="keywords" content="[^"]*" ?\/?>/,
    `<meta name="keywords" content="${escapeHtml(route.keywords)}" />`
  );

  // ── Canonical ──
  html = html.replace(
    /<link rel="canonical" href="[^"]*" ?\/?>/,
    `<link rel="canonical" href="${BASE_URL}${route.canonical}" />`
  );

  // ── Open Graph ──
  html = html.replace(
    /<meta property="og:url" content="[^"]*" ?\/?>/,
    `<meta property="og:url" content="${BASE_URL}${route.canonical}" />`
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*" ?\/?>/,
    `<meta property="og:title" content="${escapeHtml(route.title)}" />`
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*" ?\/?>/,
    `<meta property="og:description" content="${escapeHtml(route.description)}" />`
  );

  // ── Twitter ──
  html = html.replace(
    /<meta name="twitter:url" content="[^"]*" ?\/?>/,
    `<meta name="twitter:url" content="${BASE_URL}${route.canonical}" />`
  );
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*" ?\/?>/,
    `<meta name="twitter:title" content="${escapeHtml(route.title)}" />`
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*" ?\/?>/,
    `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`
  );

  // ── Price meta ──
  if (route.price) {
    html = html.replace(
      /<meta property="product:price:amount" content="[^"]*" ?\/?>/,
      `<meta property="product:price:amount" content="${route.price}" />`
    );
  }

  // ── JSON-LD: inject before </head> ──
  if (route.jsonLd && route.jsonLd.length > 0) {
    const ldScripts = route.jsonLd
      .map((schema) => `<script type="application/ld+json">${JSON.stringify(schema)}</script>`)
      .join("\n    ");
    html = html.replace("</head>", `    ${ldScripts}\n  </head>`);
  }

  return html;
}

/* ------------------------------------------------------------------ */
/*  Vite Plugin                                                        */
/* ------------------------------------------------------------------ */

export function seoPrerender(): Plugin {
  return {
    name: "vite-plugin-seo-prerender",
    apply: "build",
    closeBundle: {
      sequential: true,
      order: "post",
      async handler() {
        const distDir = path.resolve(process.cwd(), "dist");
        const templatePath = path.join(distDir, "index.html");

        if (!fs.existsSync(templatePath)) {
          console.warn("⚠️  SEO prerender: dist/index.html not found, skipping.");
          return;
        }

        const template = fs.readFileSync(templatePath, "utf-8");

        for (const route of routes) {
          const html = injectSEO(template, route);

          if (route.path === "/") {
            // Overwrite the root index.html with SEO-enriched version
            fs.writeFileSync(templatePath, html, "utf-8");
          } else {
            // Create /broadband/index.html, /sim-plans/index.html, etc.
            const routeDir = path.join(distDir, route.path.slice(1));
            fs.mkdirSync(routeDir, { recursive: true });
            fs.writeFileSync(path.join(routeDir, "index.html"), html, "utf-8");
          }
        }

        console.log(
          `\n✅ SEO prerender: generated ${routes.length} static HTML files with baked-in metadata.\n` +
            routes.map((r) => `   • dist${r.path === "/" ? "/index.html" : r.path + "/index.html"}`).join("\n")
        );
      },
    },
  };
}

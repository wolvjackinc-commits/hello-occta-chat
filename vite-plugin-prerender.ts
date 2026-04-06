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
    "Cheap UK broadband, SIM plans, and digital home phone services with no contracts. Affordable internet from £22.99/month.",
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
    "Cheap UK broadband, SIM plans, and digital home phone services with no contracts.",
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
    "Cheap UK broadband, SIM plans, and digital home phone services. No contracts, no hidden fees, cancel anytime.",
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
      "Cheap broadband UK from £22.99/mo. No contract broadband with 900Mbps speeds, 5G SIM plans from £7.99, digital home phone from £4.95. No credit check, cancel anytime. Get connected today!",
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
    title: "Digital Home Phone UK - Add to Broadband | OCCTA - Cheap UK Broadband & SIM",
    description:
      "Add Digital Home Phone from £4.95/mo to your OCCTA broadband. Crystal clear digital voice, keep your number. No contracts.",
    canonical: "/landline",
    keywords:
      "digital home phone, digital voice UK, VoIP home phone, home phone broadband, cheap home phone UK, no contract home phone, digital home phone UK",
    price: "4.95",
    jsonLd: [
      localBusinessSchema,
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "OCCTA Digital Home Phone",
        description:
          "Digital home phone service that works through your OCCTA broadband. Crystal clear HD calls.",
        url: `${BASE_URL}/landline`,
        provider: { "@type": "Organization", name: "OCCTA LIMITED", url: BASE_URL },
        areaServed: { "@type": "Country", name: "United Kingdom" },
        offers: {
          "@type": "Offer",
          price: "4.95",
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
      "OCCTA Support Hub – UK-based help for broadband, SIM and home phone. AI chat, FAQs, ticket system. Fast resolution guaranteed.",
    canonical: "/support",
    keywords:
      "OCCTA support, broadband help, SIM support UK, customer service telecom, internet support, home phone help",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/about",
    title: "About OCCTA - UK Telecom Company | OCCTA - Cheap UK Broadband & SIM",
    description:
      "OCCTA is a UK telecom company providing cheap broadband, SIM, and digital home phone services. No hidden fees, real UK-based customer support. 5,000+ happy customers.",
    canonical: "/about",
    keywords:
      "OCCTA, UK telecom company, cheap broadband provider, affordable internet UK, honest broadband, UK internet provider",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/faq",
    title: "FAQs - Broadband, SIM & Home Phone | OCCTA - Cheap UK Broadband & SIM",
    description:
      "Answers to common questions about OCCTA broadband, SIM plans, and digital home phone services. Installation, billing, contracts, and more.",
    canonical: "/faq",
    keywords:
      "OCCTA FAQ, broadband questions, SIM FAQ, home phone FAQ, internet help UK, telecom FAQ",
    jsonLd: [localBusinessSchema],
  },
  /* ─── Guide pages ─── */
  {
    path: "/guides",
    title: "Guides — Broadband, Home Phone & SIM | OCCTA - Cheap UK Broadband & SIM",
    description: "Helpful guides on UK broadband, Digital Home Phone, and SIM plans. No-contract options, switching tips, and money-saving advice from OCCTA.",
    canonical: "/guides",
    keywords: "broadband guide UK, home phone guide, SIM guide, internet tips, switching broadband, digital voice guide",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/no-contract-broadband-uk",
    title: "No Contract Broadband UK — Flexible Internet | OCCTA - Cheap UK Broadband & SIM",
    description: "Looking for no contract broadband in the UK? Learn how rolling monthly broadband works, who it suits, and how to get connected without lock-ins or exit fees.",
    canonical: "/guides/no-contract-broadband-uk",
    keywords: "no contract broadband UK, flexible broadband, cancel anytime broadband, rolling monthly broadband, no lock-in broadband",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/cheap-broadband-uk",
    title: "Cheap Broadband UK — Affordable Internet Plans | OCCTA - Cheap UK Broadband & SIM",
    description: "Find genuinely cheap broadband in the UK without sacrificing speed or reliability. Compare what matters and avoid hidden costs.",
    canonical: "/guides/cheap-broadband-uk",
    keywords: "cheap broadband UK, affordable broadband, budget broadband, cheapest internet UK, low cost broadband",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/how-to-switch-broadband",
    title: "How to Switch Broadband — Step by Step Guide | OCCTA - Cheap UK Broadband & SIM",
    description: "A step-by-step guide to switching broadband provider in the UK. Learn about the One Touch Switch process and how to avoid downtime.",
    canonical: "/guides/how-to-switch-broadband",
    keywords: "switch broadband UK, change broadband provider, how to switch internet, One Touch Switch",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/digital-voice-uk",
    title: "Digital Voice UK — Home Phone Over Broadband | OCCTA - Cheap UK Broadband & SIM",
    description: "Everything you need to know about Digital Voice — the new way home phones work over broadband in the UK.",
    canonical: "/guides/digital-voice-uk",
    keywords: "digital voice UK, digital home phone, VoIP home phone, home phone broadband, landline over broadband",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/pstn-switch-off-uk",
    title: "UK PSTN Switch-Off — Copper Line Shutdown | OCCTA - Cheap UK Broadband & SIM",
    description: "The UK PSTN copper phone network is shutting down by 2027. Find out what this means for your home phone and how Digital Voice replaces it.",
    canonical: "/guides/pstn-switch-off-uk",
    keywords: "PSTN switch off UK, copper line shutdown, BT landline switch off, digital switchover UK",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/cheap-sim-only-deals",
    title: "Cheap SIM Only Deals UK — Budget Mobile Plans | OCCTA - Cheap UK Broadband & SIM",
    description: "Find the best cheap SIM only deals in the UK. No credit check, no contracts, 5G included.",
    canonical: "/guides/cheap-sim-only-deals",
    keywords: "cheap SIM only UK, budget SIM deals, cheap mobile plans, SIM only no contract, best SIM deals UK",
    jsonLd: [localBusinessSchema],
  },
  /* ─── Location broadband pages ─── */
  ...([
    { slug: "london", city: "London", region: "Greater London" },
    { slug: "manchester", city: "Manchester", region: "Greater Manchester" },
    { slug: "birmingham", city: "Birmingham", region: "West Midlands" },
    { slug: "leeds", city: "Leeds", region: "West Yorkshire" },
    { slug: "glasgow", city: "Glasgow", region: "Scotland" },
    { slug: "liverpool", city: "Liverpool", region: "Merseyside" },
    { slug: "sheffield", city: "Sheffield", region: "South Yorkshire" },
    { slug: "bristol", city: "Bristol", region: "South West England" },
    { slug: "leicester", city: "Leicester", region: "East Midlands" },
    { slug: "nottingham", city: "Nottingham", region: "East Midlands" },
    { slug: "edinburgh", city: "Edinburgh", region: "Scotland" },
    { slug: "cardiff", city: "Cardiff", region: "Wales" },
    { slug: "newcastle", city: "Newcastle", region: "Tyne and Wear" },
    { slug: "southampton", city: "Southampton", region: "Hampshire" },
    { slug: "coventry", city: "Coventry", region: "West Midlands" },
    { slug: "brighton", city: "Brighton", region: "East Sussex" },
    { slug: "plymouth", city: "Plymouth", region: "Devon" },
    { slug: "stoke-on-trent", city: "Stoke-on-Trent", region: "Staffordshire" },
    { slug: "wolverhampton", city: "Wolverhampton", region: "West Midlands" },
    { slug: "derby", city: "Derby", region: "East Midlands" },
    { slug: "swansea", city: "Swansea", region: "Wales" },
    { slug: "aberdeen", city: "Aberdeen", region: "Scotland" },
    { slug: "reading", city: "Reading", region: "Berkshire" },
    { slug: "sunderland", city: "Sunderland", region: "Tyne and Wear" },
    { slug: "norwich", city: "Norwich", region: "Norfolk" },
    { slug: "luton", city: "Luton", region: "Bedfordshire" },
    { slug: "preston", city: "Preston", region: "Lancashire" },
    { slug: "milton-keynes", city: "Milton Keynes", region: "Buckinghamshire" },
    { slug: "northampton", city: "Northampton", region: "Northamptonshire" },
    { slug: "dundee", city: "Dundee", region: "Scotland" },
    { slug: "york", city: "York", region: "North Yorkshire" },
    { slug: "portsmouth", city: "Portsmouth", region: "Hampshire" },
    { slug: "exeter", city: "Exeter", region: "Devon" },
    { slug: "cambridge", city: "Cambridge", region: "Cambridgeshire" },
    { slug: "oxford", city: "Oxford", region: "Oxfordshire" },
    { slug: "bath", city: "Bath", region: "Somerset" },
    { slug: "bournemouth", city: "Bournemouth", region: "Dorset" },
    { slug: "middlesbrough", city: "Middlesbrough", region: "North Yorkshire" },
    { slug: "bolton", city: "Bolton", region: "Greater Manchester" },
    { slug: "blackpool", city: "Blackpool", region: "Lancashire" },
    { slug: "ipswich", city: "Ipswich", region: "Suffolk" },
    { slug: "peterborough", city: "Peterborough", region: "Cambridgeshire" },
    { slug: "huddersfield", city: "Huddersfield", region: "West Yorkshire" },
    { slug: "wakefield", city: "Wakefield", region: "West Yorkshire" },
    { slug: "hull", city: "Hull", region: "East Yorkshire" },
    { slug: "warrington", city: "Warrington", region: "Cheshire" },
    { slug: "doncaster", city: "Doncaster", region: "South Yorkshire" },
    { slug: "stockport", city: "Stockport", region: "Greater Manchester" },
    { slug: "wigan", city: "Wigan", region: "Greater Manchester" },
    { slug: "cheltenham", city: "Cheltenham", region: "Gloucestershire" },
  ].map(({ slug, city, region }): RouteSEO => ({
    path: `/broadband-${slug}`,
    title: `Cheap Broadband in ${city} - No Contract Fibre | OCCTA - Cheap UK Broadband & SIM`,
    description: `Cheap broadband in ${city} from \u00A322.99/mo. No contract fibre up to 900Mbps in ${region}. No price rises, cancel anytime.`,
    canonical: `/broadband-${slug}`,
    keywords: `cheap broadband ${city}, broadband ${city}, fibre broadband ${city}, no contract broadband ${city}, internet ${city}, ${region} broadband`,
    price: "22.99",
    jsonLd: [localBusinessSchema],
  }))),
  /* ─── Keyword landing pages ─── */
  {
    path: "/cheap-broadband-near-me",
    title: "Cheap Broadband Near Me — Find Affordable Internet | OCCTA",
    description: "Looking for cheap broadband near you? OCCTA offers affordable fibre broadband from £22.99/mo with no contracts across the UK.",
    canonical: "/cheap-broadband-near-me",
    keywords: "cheap broadband near me, affordable broadband near me, broadband deals near me, internet near me cheap",
    price: "22.99",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/broadband-no-credit-check",
    title: "Broadband No Credit Check — Get Connected Today | OCCTA",
    description: "Need broadband with no credit check? OCCTA offers fast fibre broadband from £22.99/mo with no credit check, no contract.",
    canonical: "/broadband-no-credit-check",
    keywords: "broadband no credit check, internet no credit check, wifi no credit check, broadband without credit check UK",
    price: "22.99",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/broadband-for-students",
    title: "Student Broadband — No Contract Internet for Students | OCCTA",
    description: "Best broadband for students in the UK. No contract, no credit check, cancel anytime. From £22.99/mo.",
    canonical: "/broadband-for-students",
    keywords: "student broadband, broadband for students UK, student internet deals, no contract broadband students",
    price: "22.99",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/best-broadband-deals-uk",
    title: "Best Broadband Deals UK 2026 — Compare & Save | OCCTA",
    description: "Find the best broadband deals in the UK for 2026. No-contract plans from £22.99/mo. No hidden fees.",
    canonical: "/best-broadband-deals-uk",
    keywords: "best broadband deals UK, best broadband deals 2026, cheapest broadband UK, broadband deals comparison",
    price: "22.99",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/broadband-for-gaming",
    title: "Best Broadband for Gaming UK — Low Latency Internet | OCCTA",
    description: "Best broadband for gaming in the UK. Low latency, fast speeds up to 900Mbps, no contracts. From £22.99/mo.",
    canonical: "/broadband-for-gaming",
    keywords: "broadband for gaming, gaming broadband UK, best internet for gaming, low latency broadband",
    price: "22.99",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/broadband-for-working-from-home",
    title: "Best Broadband for Working from Home — Reliable WFH Internet | OCCTA",
    description: "Best broadband for working from home. Reliable fibre, fast speeds, no contracts. From £22.99/mo.",
    canonical: "/broadband-for-working-from-home",
    keywords: "broadband for working from home, WFH broadband, remote working internet, home office broadband",
    price: "22.99",
    jsonLd: [localBusinessSchema],
  },
  /* ─── Comparison pages ─── */
  ...([
    { slug: "occta-vs-bt", competitor: "BT" },
    { slug: "occta-vs-sky", competitor: "Sky" },
    { slug: "occta-vs-virgin-media", competitor: "Virgin Media" },
    { slug: "occta-vs-talktalk", competitor: "TalkTalk" },
    { slug: "occta-vs-plusnet", competitor: "Plusnet" },
  ].map(({ slug, competitor }): RouteSEO => ({
    path: `/compare/${slug}`,
    title: `OCCTA vs ${competitor} — Honest Comparison | OCCTA - Cheap UK Broadband & SIM`,
    description: `Compare OCCTA vs ${competitor} broadband. See how OCCTA offers cheaper prices, no contracts, and no mid-contract price rises.`,
    canonical: `/compare/${slug}`,
    keywords: `OCCTA vs ${competitor}, ${competitor} broadband alternative, cheaper than ${competitor}, ${competitor} broadband comparison`,
    jsonLd: [localBusinessSchema],
  }))),
  /* ─── New guide pages ─── */
  {
    path: "/guides/broadband-for-gaming",
    title: "Best Broadband for Gaming UK — Low Latency Guide | OCCTA",
    description: "Find the best broadband for gaming in the UK. Learn what speeds, latency, and connection types you need.",
    canonical: "/guides/broadband-for-gaming",
    keywords: "broadband for gaming, gaming broadband UK, best internet for gaming, low latency broadband",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/broadband-for-working-from-home",
    title: "Best Broadband for Working from Home — WFH Guide | OCCTA",
    description: "Find the best broadband for working from home in the UK. Reliable fibre for video calls and remote work.",
    canonical: "/guides/broadband-for-working-from-home",
    keywords: "broadband working from home, WFH broadband, remote work internet, home office broadband",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/fibre-broadband-explained",
    title: "Fibre Broadband Explained — FTTC vs FTTP UK | OCCTA",
    description: "Understand the difference between FTTC and FTTP fibre broadband in the UK.",
    canonical: "/guides/fibre-broadband-explained",
    keywords: "fibre broadband explained, FTTC vs FTTP, full fibre broadband, fibre to the cabinet",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/broadband-for-students",
    title: "Student Broadband UK — No Contract Internet | OCCTA",
    description: "Best broadband for students in the UK. No contract, no credit check, cancel when you move.",
    canonical: "/guides/broadband-for-students",
    keywords: "student broadband, broadband for students, student internet UK, no contract student broadband",
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

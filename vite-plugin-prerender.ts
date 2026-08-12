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
    "UK fibre broadband, 5G SIM plans and digital home phone. Broadband from £34.99/month on Price Lock 24 or Flex 30 where eligible.",
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
    "UK fibre broadband, 5G SIM plans and digital home phone. Simple telecom, clear terms.",
  publisher: {
    "@type": "Organization",
    name: "OCCTA LIMITED",
    logo: { "@type": "ImageObject", url: `${BASE_URL}/pwa-512x512.png` },
  },
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${BASE_URL}/#localbusiness`,
  name: "OCCTA LIMITED",
  description:
    "UK fibre broadband, 5G SIM plans and digital home phone. Clear terms, no mid-contract price rises, UK-based support.",
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
    title: "OCCTA — UK Broadband, SIM & Digital Voice",
    description:
      "UK full fibre broadband from £34.99/mo on Price Lock 24 or Flex 30 where eligible. 5G SIMs from £7.99 and digital home phone. Clear terms, UK support.",
    canonical: "/",
    keywords:
      "UK broadband, fibre broadband UK, price lock broadband, flexible broadband, 5G SIM UK, SIM only deals UK, digital home phone UK, OCCTA broadband",
    price: "34.99",
    jsonLd: globalSchemas,
  },
  {
    path: "/broadband",
    title: "UK Fibre Broadband Deals from £34.99/mo | OCCTA",
    description:
      "UK fibre broadband from £34.99/mo, up to 1000Mbps. Choose Price Lock 24 or Flex 30 where eligible — no mid-contract price rises, clear first bill.",
    canonical: "/broadband",
    keywords:
      "UK fibre broadband, broadband deals UK, price lock broadband, flexible broadband, full fibre UK, 1000Mbps broadband, FTTP broadband UK",
    price: "34.99",
    jsonLd: [
      localBusinessSchema,
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "OCCTA Broadband",
        description:
          "UK fibre broadband with speeds up to 1000Mbps on Price Lock 24 or Flex 30 where eligible. No mid-contract price rises.",
        url: `${BASE_URL}/broadband`,
        provider: { "@type": "Organization", name: "OCCTA LIMITED", url: BASE_URL },
        areaServed: { "@type": "Country", name: "United Kingdom" },
        offers: {
          "@type": "Offer",
          price: "34.99",
          priceCurrency: "GBP",
          availability: "https://schema.org/InStock",
        },
      },
    ],
  },
  {
    path: "/sim-plans",
    title: "SIM Only Deals UK — 5G SIMs from £7.99 | OCCTA",
    description:
      "UK 5G SIM only plans from £7.99/mo with EU roaming, unlimited calls and texts, and no minimum term on our rolling SIM plans.",
    canonical: "/sim-plans",
    keywords:
      "cheap SIM deals UK, 5G SIM no credit check, no contract SIM, cheap mobile plans UK, SIM only deals, budget SIM UK, unlimited SIM UK, PAYG SIM cheap, best SIM only deals UK",
    price: "7.99",
    jsonLd: [
      localBusinessSchema,
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "OCCTA SIM Plans",
        description:
          "UK SIM-only mobile plans with 5G, EU roaming and no minimum term.",
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
    title: "Digital Home Phone UK - Add to Broadband | OCCTA",
    description:
      "Add Digital Home Phone from £4.95/mo to your OCCTA broadband. Clear digital voice calls and keep your existing number.",
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
    title: "No Contract Broadband UK — Flex 30 Rolling Monthly | OCCTA",
    description:
      "Want broadband without a long contract? OCCTA Flex 30 is rolling monthly with 30 days' notice where eligible — no lock-in and no mid-contract price rises.",
    canonical: "/no-contract-broadband-uk",
    keywords:
      "no contract broadband UK, flex 30 broadband, rolling monthly broadband, flexible broadband UK, 30 day notice broadband",
    price: "34.99",
    jsonLd: [
      localBusinessSchema,
      {
        "@context": "https://schema.org",
        "@type": "Offer",
        name: "No Contract Broadband",
        description:
          "Flex 30 rolling monthly UK broadband where eligible — 30 days' notice, no mid-contract price rises.",
        price: "34.99",
        priceCurrency: "GBP",
        url: `${BASE_URL}/no-contract-broadband-uk`,
        availability: "https://schema.org/InStock",
        seller: { "@type": "Organization", name: "OCCTA LIMITED", url: BASE_URL },
      },
    ],
  },
  {
    path: "/support",
    title: "Help & Support - 24/7 Customer Service | OCCTA",
    description:
      "OCCTA Support Hub — UK-based help for broadband, SIM and home phone. Live chat, FAQs and ticket tracking in one place.",
    canonical: "/support",
    keywords:
      "OCCTA support, broadband help, SIM support UK, customer service telecom, internet support, home phone help",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/about",
    title: "About OCCTA - UK Telecom Company | OCCTA",
    description:
      "OCCTA LIMITED is a UK telecom provider offering fibre broadband, 5G SIM plans and digital home phone, with clear terms and UK-based customer support.",
    canonical: "/about",
    keywords:
      "OCCTA, UK telecom company, cheap broadband provider, affordable internet UK, honest broadband, UK internet provider",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/faq",
    title: "FAQs - Broadband, SIM & Home Phone | OCCTA",
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
    title: "Guides — Broadband, Home Phone & SIM | OCCTA",
    description: "Helpful guides on UK broadband, Digital Home Phone, and SIM plans. No-contract options, switching tips, and money-saving advice from OCCTA.",
    canonical: "/guides",
    keywords: "broadband guide UK, home phone guide, SIM guide, internet tips, switching broadband, digital voice guide",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/no-contract-broadband-uk",
    title: "How No Contract Broadband Works in the UK | OCCTA",
    description: "How no-contract broadband works in the UK, who rolling monthly suits, and how OCCTA Flex 30 compares with fixed-term Price Lock 24.",
    canonical: "/guides/no-contract-broadband-uk",
    keywords: "no contract broadband UK, flexible broadband, rolling monthly broadband, 30 day notice broadband",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/cheap-broadband-uk",
    title: "Cheap Broadband UK — How to Cut Your Bill | OCCTA",
    description: "Find genuinely cheap broadband in the UK without sacrificing speed or reliability. Compare what matters and avoid hidden costs.",
    canonical: "/guides/cheap-broadband-uk",
    keywords: "cheap broadband UK, affordable broadband, budget broadband, cheapest internet UK, low cost broadband",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/how-to-switch-broadband",
    title: "How to Switch Broadband — Step by Step Guide | OCCTA",
    description: "A step-by-step guide to switching broadband provider in the UK. Learn about the One Touch Switch process and how to avoid downtime.",
    canonical: "/guides/how-to-switch-broadband",
    keywords: "switch broadband UK, change broadband provider, how to switch internet, One Touch Switch",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/digital-voice-uk",
    title: "Digital Voice UK — Home Phone Over Broadband | OCCTA",
    description: "Everything you need to know about Digital Voice — the new way home phones work over broadband in the UK.",
    canonical: "/guides/digital-voice-uk",
    keywords: "digital voice UK, digital home phone, VoIP home phone, home phone broadband, landline over broadband",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/pstn-switch-off-uk",
    title: "UK PSTN Switch-Off — Copper Line Shutdown | OCCTA",
    description: "The UK PSTN copper phone network is shutting down by 2027. Find out what this means for your home phone and how Digital Voice replaces it.",
    canonical: "/guides/pstn-switch-off-uk",
    keywords: "PSTN switch off UK, copper line shutdown, BT landline switch off, digital switchover UK",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/cheap-sim-only-deals",
    title: "How to Compare Cheap SIM Only Deals in the UK | OCCTA",
    description: "How to compare cheap SIM only deals in the UK: data, 5G, roaming and minimum term — plus what OCCTA rolling SIM plans include.",
    canonical: "/guides/cheap-sim-only-deals",
    keywords: "cheap SIM only UK, SIM only deals UK, 5G SIM UK, rolling SIM plans",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/how-to-get-broadband-with-bad-credit",
    title: "Broadband with Bad Credit — No Credit Check UK | OCCTA",
    description: "Bad credit? Learn how to get UK broadband without a hard credit check and how OCCTA's flexible no long-contract plans help.",
    canonical: "/guides/how-to-get-broadband-with-bad-credit",
    keywords: "broadband no credit check, broadband with bad credit UK, bad credit broadband, no credit check broadband",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/guides/router-lights-and-broadband-troubleshooting",
    title: "Router Red Light Fix & Broadband Troubleshooting Guide | OCCTA",
    description:
      "What do router lights mean and how do you fix slow or dropped broadband? Plain-English guide to router LEDs, ONT lights, Wi-Fi optimisation and 2.4GHz vs 5GHz for UK homes.",
    canonical: "/guides/router-lights-and-broadband-troubleshooting",
    keywords:
      "router red light fix, router lights meaning, broadband troubleshooting guide, slow broadband fix, wifi troubleshooting UK, 2.4ghz vs 5ghz, ONT light meaning",
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
    title: `Fibre Broadband in ${city} — Plans from £34.99 | OCCTA`,
    description: `Fibre broadband in ${city} from \u00A334.99/mo, up to 1000Mbps across ${region}. Price Lock 24 or Flex 30 where eligible, with no mid-contract price rises.`,
    canonical: `/broadband-${slug}`,
    keywords: `broadband ${city}, fibre broadband ${city}, full fibre ${city}, broadband deals ${city}, ${region} broadband`,
    price: "34.99",
    jsonLd: [localBusinessSchema],
  }))),
  /* ─── Keyword landing pages ─── */
  {
    path: "/cheap-broadband-near-me",
    title: "Cheap Broadband Near Me — Find Affordable Internet | OCCTA",
    description: "Looking for cheap broadband near you? Check your postcode for OCCTA fibre broadband from £34.99/mo, on Price Lock 24 or Flex 30 where eligible.",
    canonical: "/cheap-broadband-near-me",
    keywords: "cheap broadband near me, affordable broadband near me, broadband deals near me, internet near me cheap",
    price: "34.99",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/broadband-no-credit-check",
    title: "Broadband No Credit Check — Get Connected Today | OCCTA",
    description: "Need broadband with no credit check? OCCTA runs no hard credit check and offers fibre broadband from £34.99/mo, including Flex 30 rolling monthly where eligible.",
    canonical: "/broadband-no-credit-check",
    keywords: "broadband no credit check, internet no credit check, wifi no credit check, broadband without credit check UK",
    price: "34.99",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/broadband-for-students",
    title: "Student Broadband UK — Rolling Monthly Plans | OCCTA",
    description: "Student broadband in the UK from £34.99/mo. Flex 30 rolling monthly where eligible, so you can end it with 30 days' notice when term ends.",
    canonical: "/broadband-for-students",
    keywords: "student broadband UK, broadband for students, student internet deals, rolling monthly student broadband",
    price: "34.99",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/best-broadband-deals-uk",
    title: "Best Broadband Deals UK 2026 — Compare & Save | OCCTA",
    description: "Compare UK broadband deals in 2026: OCCTA full fibre from £34.99/mo on Price Lock 24 or Flex 30 where eligible, with no mid-contract price rises.",
    canonical: "/best-broadband-deals-uk",
    keywords: "best broadband deals UK, best broadband deals 2026, cheapest broadband UK, broadband deals comparison",
    price: "34.99",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/broadband-for-gaming",
    title: "Best Broadband for Gaming UK — Low Latency Internet | OCCTA",
    description: "Broadband for gaming in the UK: low latency full fibre up to 1000Mbps from £34.99/mo, with upload speeds that hold up during streaming.",
    canonical: "/broadband-for-gaming",
    keywords: "broadband for gaming, gaming broadband UK, best internet for gaming, low latency broadband",
    price: "34.99",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/broadband-for-working-from-home",
    title: "Best Broadband for Working from Home — Reliable WFH Internet | OCCTA",
    description: "Broadband for working from home: reliable UK full fibre from £34.99/mo with the upload headroom video calls need.",
    canonical: "/broadband-for-working-from-home",
    keywords: "broadband for working from home, WFH broadband, remote working internet, home office broadband",
    price: "34.99",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/broadband-no-upfront-cost",
    title: "Broadband With No Upfront Cost — £0 Setup Where Available | OCCTA",
    description: "Broadband with no upfront cost. Full-fibre from £34.99/mo, £0 setup where available, bring your own router for £0. No hidden activation fees.",
    canonical: "/broadband-no-upfront-cost",
    keywords: "broadband no upfront cost, broadband no setup fee, no upfront cost broadband, free setup broadband, broadband no activation fee",
    price: "34.99",
    jsonLd: [localBusinessSchema],
  },
  /* ─── /learn hub + long-tail explainers ─── */
  {
    path: "/learn",
    title: "Learn — Broadband, SIM, Voice and Payments guides | OCCTA",
    description: "Plain-English UK guides on broadband, Wi-Fi, SIM, digital voice, switching and Direct Debit. No jargon. Answers to the questions you actually search for.",
    canonical: "/learn",
    keywords: "broadband guides UK, SIM guides, digital voice UK, direct debit guarantee, switch broadband guide, FTTP explained",
    jsonLd: [localBusinessSchema],
  },
  ...([
    { slug: "what-is-fttp", title: "What is FTTP? Full-fibre broadband explained", desc: "FTTP vs FTTC vs SOGEA — what full-fibre broadband actually means in the UK, and how to check what's at your address.", kw: "FTTP, full fibre broadband UK, FTTP vs FTTC, what is FTTP" },
    { slug: "broadband-speed-guide", title: "How much broadband speed do I need? UK guide", desc: "Streaming, gaming, working from home — how much broadband speed you actually need in the UK, without overpaying.", kw: "broadband speed guide UK, Mbps needed for streaming, gaming broadband speed" },
    { slug: "slow-broadband-fixes", title: "Slow broadband? 10 fixes that actually work", desc: "Slow UK broadband? Try these 10 practical fixes before calling your ISP — router placement, Wi-Fi channel, DNS, cables and more.", kw: "slow broadband fixes, why is my broadband slow, boost Wi-Fi speed, fix slow internet UK" },
    { slug: "wifi-vs-broadband", title: "Wi-Fi vs broadband — what's the difference?", desc: "Wi-Fi is not broadband. Understand the difference between your internet connection and the wireless signal in your home.", kw: "wifi vs broadband, difference between wifi and broadband, is wifi the internet" },
    { slug: "router-buying-guide", title: "Router buying guide UK — what to look for in 2026", desc: "How to buy a broadband router in the UK: Wi-Fi 6, mesh support, ports and compatibility with OCCTA and other Openreach ISPs.", kw: "router buying guide UK, best broadband router 2026, Wi-Fi 6 router, bring your own router broadband" },
    { slug: "mesh-wifi-guide", title: "Mesh Wi-Fi UK guide — cover every room properly", desc: "Mesh Wi-Fi vs extenders vs powerline: how to blanket your UK home in fast, reliable Wi-Fi.", kw: "mesh WiFi UK, best mesh WiFi 2026, mesh vs extender, whole home WiFi UK" },
    { slug: "how-to-switch-broadband", title: "How to switch broadband in the UK (One Touch Switch)", desc: "How to switch broadband providers in the UK using the One Touch Switch process. What happens, how long it takes, and how to avoid downtime.", kw: "how to switch broadband UK, one touch switch, changing broadband providers, switch ISP UK" },
    { slug: "leaving-bt", title: "Leaving BT Broadband — how to switch away", desc: "Thinking of leaving BT? Cancel BT broadband, avoid exit fees, and switch to a cheaper provider on the same Openreach network.", kw: "leaving BT broadband, how to cancel BT, switch from BT, BT broadband alternative" },
    { slug: "leaving-sky", title: "Leaving Sky Broadband — how to switch away", desc: "How to leave Sky Broadband: One Touch Switch, exit fees, keeping Sky TV, and finding a cheaper Openreach provider.", kw: "leaving Sky broadband, cancel Sky broadband, switch from Sky, Sky alternative UK" },
    { slug: "leaving-virgin", title: "Leaving Virgin Media — switch to Openreach fibre", desc: "How to leave Virgin Media broadband: exit fees, cable-to-fibre switch, keeping your number, and finding a cheaper Openreach alternative.", kw: "leaving Virgin Media, cancel Virgin broadband, switch from Virgin to fibre, Virgin alternative" },
    { slug: "leaving-talktalk", title: "Leaving TalkTalk — how to switch away", desc: "Leaving TalkTalk broadband: how to switch, exit fees, and finding a faster provider on the same Openreach network.", kw: "leaving TalkTalk, cancel TalkTalk broadband, switch from TalkTalk, TalkTalk alternative" },
    { slug: "mid-contract-price-rises", title: "Mid-contract broadband price rises explained", desc: "Why UK broadband providers put prices up mid-contract, what Ofcom rules say, and how to avoid CPI+3.9% hikes altogether.", kw: "broadband price rise, CPI + 3.9% broadband, mid-contract price rise, Ofcom price rise rules" },
    { slug: "esim-vs-physical-sim", title: "eSIM vs physical SIM — which should you choose?", desc: "eSIM vs physical SIM in the UK: what's the difference, which phones support it, and which is right for you.", kw: "eSIM vs physical SIM, what is eSIM, eSIM UK, how does eSIM work" },
    { slug: "best-sim-only-deals-uk", title: "Best SIM-only deals UK 2026 — what to look for", desc: "How to find the best SIM-only deal in the UK: rolling contracts, data caps, roaming, and what OCCTA offers.", kw: "best SIM only deals UK, SIM only UK 2026, cheap SIM only, 5G SIM deals UK" },
    { slug: "digital-voice-explained", title: "Digital Voice explained — the UK PSTN switch-off", desc: "The UK's PSTN switch-off means every landline moves to Digital Voice by 2027. Here's what changes and what you need to do.", kw: "digital voice UK, PSTN switch off, landline switch off 2027, VoIP home phone UK" },
    { slug: "keeping-your-landline-number", title: "Keep your landline number when you switch", desc: "How to keep your existing UK landline number when you switch broadband or move to Digital Voice.", kw: "keep landline number, port phone number UK, keep phone number switch broadband" },
    { slug: "direct-debit-explained", title: "Direct Debit explained — how it works in the UK", desc: "How UK Direct Debit works, what protects you under the Direct Debit Guarantee, and why it's the cheapest way to pay a broadband bill.", kw: "direct debit explained, how does direct debit work UK, direct debit guarantee, DD payment UK" },
    { slug: "direct-debit-guarantee", title: "The Direct Debit Guarantee explained", desc: "The UK Direct Debit Guarantee gives you an immediate refund if any DD is taken incorrectly. Full rules and what to do if there's a problem.", kw: "direct debit guarantee, DD guarantee UK, direct debit refund, bacs guarantee" },
    { slug: "paying-broadband-bill", title: "How to pay your broadband bill — the cheapest way", desc: "Direct Debit, card, bank transfer, cash — the pros and cons of paying your UK broadband bill each way, and which is cheapest.", kw: "how to pay broadband bill, cheapest way to pay broadband, direct debit vs card broadband" },
  ].map(({ slug, title, desc, kw }): RouteSEO => ({
    path: `/learn/${slug}`,
    title: `${title} | OCCTA`,
    description: desc,
    canonical: `/learn/${slug}`,
    keywords: kw,
    jsonLd: [localBusinessSchema],
  }))),
  /* ─── Comparison pages ─── */
  ...([
    { slug: "occta-vs-bt", competitor: "BT" },
    { slug: "occta-vs-sky", competitor: "Sky" },
    { slug: "occta-vs-virgin-media", competitor: "Virgin Media" },
    { slug: "occta-vs-talktalk", competitor: "TalkTalk" },
    { slug: "occta-vs-plusnet", competitor: "Plusnet" },
    { slug: "occta-vs-vodafone", competitor: "Vodafone" },
    { slug: "occta-vs-now-broadband", competitor: "NOW Broadband" },
    { slug: "occta-vs-community-fibre", competitor: "Community Fibre" },
    { slug: "occta-vs-hyperoptic", competitor: "Hyperoptic" },
    { slug: "occta-vs-ee", competitor: "EE" },
  ].map(({ slug, competitor }): RouteSEO => ({
    path: `/compare/${slug}`,
    title: `OCCTA vs ${competitor} — Honest Comparison | OCCTA`,
    description: `OCCTA vs ${competitor} broadband compared on price, speed, contract terms and price rises — so you can see which suits your address.`,
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
    title: "Student Broadband Guide — What to Check Before You Sign | OCCTA",
    description: "A student guide to UK broadband: term-time contracts, rolling monthly options and what to check before you sign at a shared address.",
    canonical: "/guides/broadband-for-students",
    keywords: "student broadband guide, broadband for students UK, student internet, rolling monthly broadband students",
    jsonLd: [localBusinessSchema],
  },
  /* ─── SEO content pages (Pricing, Coverage, Billing, etc.) ─── */
  {
    path: "/pricing",
    title: "OCCTA Pricing — Broadband, Digital Voice, SIM & Business",
    description: "How OCCTA prices its UK broadband, Digital Voice / Home Phone, SIM-only and business telecom. Final price depends on your address and chosen plan.",
    canonical: "/pricing",
    keywords: "OCCTA pricing, UK broadband pricing, digital voice price, SIM only price UK, business telecom pricing",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/coverage",
    title: "UK Broadband Coverage — How to Check Availability | OCCTA",
    description: "How OCCTA checks UK broadband availability at your address — full fibre, FTTC and copper alternatives.",
    canonical: "/coverage",
    keywords: "UK broadband coverage, broadband availability check, fibre coverage UK, FTTP availability, FTTC coverage",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/fibre-broadband",
    title: "Fibre Broadband UK — Honest, Flexible Plans | OCCTA",
    description: "OCCTA fibre broadband for UK homes. Full fibre and FTTC where available; billing starts only after activation.",
    canonical: "/fibre-broadband",
    keywords: "fibre broadband UK, full fibre, FTTP UK, FTTC, OCCTA fibre",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/broadband-and-digital-voice",
    title: "Broadband + Digital Voice / Home Phone | OCCTA",
    description: "Add OCCTA Digital Voice / Home Phone to your broadband. Requires an active OCCTA broadband line.",
    canonical: "/broadband-and-digital-voice",
    keywords: "broadband and digital voice, digital home phone UK, VoIP home phone, broadband home phone bundle",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/small-business-telecom",
    title: "Small Business Telecom — Broadband, Voice & SIM | OCCTA",
    description: "OCCTA small business telecom: business broadband, Digital Voice, SIM-only and number management.",
    canonical: "/small-business-telecom",
    keywords: "small business telecom UK, business broadband, business digital voice, business SIM only, SME telecom",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/billing-explained",
    title: "Billing Explained — How OCCTA Invoices Work",
    description: "How OCCTA billing works: billing starts only after activation; invoices show monthly charges, VAT and any pro-rata.",
    canonical: "/billing-explained",
    keywords: "OCCTA billing, telecom billing explained, broadband invoice UK, pro-rata billing, VAT invoice telecom",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/first-invoice-explained",
    title: "First Invoice Explained — Activation & Pro-Rata | OCCTA",
    description: "Your first OCCTA invoice may include an activation fee and pro-rata charges for the part-month after activation.",
    canonical: "/first-invoice-explained",
    keywords: "first invoice broadband, activation fee, pro-rata broadband bill, telecom first bill UK",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/direct-debit-setup",
    title: "Direct Debit Setup — How It Works at OCCTA",
    description: "How to set up a Direct Debit at OCCTA. We don't collect anything until you've confirmed the mandate. Protected by the Direct Debit Guarantee.",
    canonical: "/direct-debit-setup",
    keywords: "direct debit setup, OCCTA direct debit, broadband direct debit, direct debit guarantee UK",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/pay-by-card",
    title: "Pay by Card — Secure Worldpay Payment Links | OCCTA",
    description: "Pay your OCCTA invoice by card using a secure Worldpay-hosted payment link. OCCTA does not store card details.",
    canonical: "/pay-by-card",
    keywords: "pay by card OCCTA, Worldpay payment, secure card payment broadband, pay broadband bill card",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/cancellation",
    title: "Cancellation — How to Cancel Your OCCTA Service",
    description: "How to cancel an OCCTA broadband, Digital Voice or SIM service. Notice and any charges depend on your accepted agreement.",
    canonical: "/cancellation",
    keywords: "cancel broadband OCCTA, telecom cancellation UK, broadband notice period, end OCCTA contract",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/contact",
    title: "Contact OCCTA — Phone, Email and Address",
    description: "Contact OCCTA: 0800 260 6626, hello@occta.co.uk, or write to OCCTA LIMITED, 22 Pavilion View, Huddersfield, HD3 3WU.",
    canonical: "/contact",
    keywords: "contact OCCTA, OCCTA support number, OCCTA email, telecom support UK",
    jsonLd: [localBusinessSchema],
  },
  {
    path: "/vulnerable-customers",
    title: "Vulnerable Customers — Extra Support at OCCTA",
    description: "Extra support for OCCTA customers in vulnerable circumstances: priority handling, accessible communication, back-up options and fair payment plans.",
    canonical: "/vulnerable-customers",
    keywords: "vulnerable customers telecom, priority support broadband, accessible telecom UK, digital voice power cut back up",
    jsonLd: [localBusinessSchema],
  },
];

/* ------------------------------------------------------------------ */
/*  HTML injection helpers                                             */
/* ------------------------------------------------------------------ */

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const ROBOTS_INDEXABLE =
  "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

/**
 * Replace a head tag when it already exists in the template, otherwise insert it
 * before </head>. The shipped index.html intentionally omits canonical/og:url
 * (they are per-route), so a plain .replace() would silently no-op.
 */
function replaceOrInsert(html: string, pattern: RegExp, replacement: string): string {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace("</head>", `    ${replacement}\n  </head>`);
}

function injectSEO(template: string, route: RouteSEO): string {
  let html = template;
  const url = `${BASE_URL}${route.canonical}`;
  // The root document doubles as the SPA fallback for every non-prerendered
  // route, so it must not carry a hardcoded canonical/og:url of "/".
  const isRootFallback = route.path === "/";

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

  // ── Robots (always explicit) ──
  html = replaceOrInsert(
    html,
    /<meta name="robots" content="[^"]*" ?\/?>/,
    `<meta name="robots" content="${ROBOTS_INDEXABLE}" />`
  );

  // ── Canonical + og:url / twitter:url ──
  if (!isRootFallback) {
    html = replaceOrInsert(
      html,
      /<link rel="canonical" href="[^"]*" ?\/?>/,
      `<link rel="canonical" href="${url}" />`
    );
    html = replaceOrInsert(
      html,
      /<meta property="og:url" content="[^"]*" ?\/?>/,
      `<meta property="og:url" content="${url}" />`
    );
    html = replaceOrInsert(
      html,
      /<meta name="twitter:url" content="[^"]*" ?\/?>/,
      `<meta name="twitter:url" content="${url}" />`
    );
  }

  // ── Open Graph ──
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

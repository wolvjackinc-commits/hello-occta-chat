## Goal

Make OCCTA visible for almost any UK search around **broadband, SIM, digital voice, routers, switching, conversions, and payments** — the same content-moat playbook Wise and GoCardless use (dense blog + explainer + comparison + location hubs, all interlinked, all schema-marked).

## What we already have

- Keyword landing pages (`/keyword/*`), comparison pages, location pages (`/broadband-in/:city`), guides + blog (DB-backed, sitemap fragment via `kb-sitemap` edge function).
- `SEO.tsx` + `StructuredData.tsx` component set, prerender plugin, `sitemap.xml`, JSON-LD helpers.

The gap is **volume, depth and interlinking** — not infrastructure.

## Plan (single build pass)

### 1. Content Hub — `/learn`

New parent hub at `/learn` linking every guide, comparison, blog, help and location page in one crawlable index. Category rails: Broadband basics · Switching · Fibre & speeds · Routers & Wi-Fi · SIM & mobile · Digital Voice · Billing & payments · Business telecom · Local coverage.

### 2. New static SEO pages (20)

High-intent, low-competition long-tail queries — each gets its own route, unique H1, 600–1000 words, FAQ schema, related-links rail, CTA to postcode checker.

Broadband & speeds
- `/learn/what-is-fttp` — FTTP vs FTTC vs SOGEA explained
- `/learn/broadband-speed-guide` — what speed do I actually need
- `/learn/slow-broadband-fixes` — troubleshooting
- `/learn/wifi-vs-broadband` — common confusion
- `/learn/router-buying-guide` — bring-your-own router
- `/learn/mesh-wifi-guide`

Switching & contracts
- `/learn/how-to-switch-broadband` — One Touch Switch walkthrough
- `/learn/leaving-bt` / `/learn/leaving-sky` / `/learn/leaving-virgin` / `/learn/leaving-talktalk`
- `/learn/mid-contract-price-rises` — why OCCTA doesn't do them

SIM & voice
- `/learn/esim-vs-physical-sim`
- `/learn/best-sim-only-deals-uk`
- `/learn/digital-voice-explained` — PSTN switch-off
- `/learn/keeping-your-landline-number`

Payments & billing (Wise/GoCardless-style)
- `/learn/direct-debit-explained`
- `/learn/direct-debit-guarantee`
- `/learn/paying-broadband-bill`

### 3. Location expansion

Extend `src/data/locations.ts` from current set to **50 UK towns/cities** (top broadband-search markets) — same template, unique intro + local ISPs + coverage notes so pages stay non-duplicate.

### 4. Comparison expansion

Add 6 new comparison rows to `src/data/comparisons.ts`: OCCTA vs BT / Sky / Virgin / TalkTalk / Vodafone / Now Broadband — leverages existing `ComparisonPage` route.

### 5. Interlinking + schema

- Every new page: BreadcrumbList + FAQPage + Article JSON-LD.
- `RelatedLinks` component on all learn/guide/comparison/location pages (3 contextual siblings + 1 CTA to postcode checker).
- Footer gets a "Learn" column linking the hub.
- Sitemap generator updated to include all new routes.

### 6. Homepage + service pages content boost

- Homepage: add a "Popular guides" strip pulling 6 top learn pages.
- `/broadband`, `/sim-plans`, `/landline`: append an FAQ (10 Qs each) with FAQPage schema — biggest SEO lift for money pages.

## Technical notes

- One route file per learn page under `src/pages/learn/*` using existing `SeoContentLayout`.
- Register routes in `App.tsx` (lazy-loaded).
- Update `public/sitemap.xml` + prerender list in `vite-plugin-prerender.ts` for all new paths.
- No DB changes — all content is static TSX so it prerenders for crawlers.
- No design changes — reuses brutalist tokens and existing SEO components.

## Out of scope

- New CMS or dynamic authoring UI.
- Paid link building / off-site SEO.
- Rewriting existing guides (only additive).

Approve and I'll ship it in one pass.

Do not create another plan. Implement the SEO upgrade now.

## REQUIRED CORRECTIONS BEFORE BUILD

1. Canonical domain must match the real preferred live domain

Do not hard-code `https://www.occta.co.uk` unless the production site actually redirects all non-www traffic to [www](http://www).

Use the real canonical domain consistently:

- either `https://occta.co.uk`
- or `https://www.occta.co.uk`

Confirm one preferred domain and ensure canonical tags, sitemap URLs, Open Graph URLs and redirects all match it.

2. Do not accidentally noindex public acquisition pages

Review these carefully before adding noindex:

- `/quote/start`
- `/build-plan`
- `/coverage`
- `/pricing`
- `/pay-by-card`
- `/billing-explained`

If the page is a public marketing/acquisition page with useful SEO content, keep it indexable.

Only noindex:

- private quote-token pages;
- customer-specific Contract Summary pages;
- payment links;
- admin;
- dashboard;
- authenticated account pages;
- receipts/invoices/private documents;
- support ticket private pages.

3. Split public payment content from private payment links

If `/pay-invoice` is a private customer payment route, keep it noindex.

Create or use a public SEO page like:

- `/pay-by-card`
- `/manual-card-payment`
- `/billing-explained`

for search content about manual card invoice payments.

Do not index real invoice-payment links.

4. Digital Voice wording

Keep `/landline` if it already exists, but update the page label, H1 and copy to:

“Digital Voice / Home Phone”

Make clear:

- Digital Voice requires broadband;
- no standalone landline is being sold unless OCCTA truly offers one;
- availability depends on address and service setup.

5. Location pages

Do not mass-generate city pages.

Only keep or create curated, useful location pages with genuine information and an availability CTA.

No fake local branches, no fake shops, no fake local phone numbers.

6. Schema safety

Only add schema that matches visible content.

Do not add:

- fake reviews;
- fake ratings;
- fake local branches;
- Product/Offer schema where the price is not visible;
- FAQ schema where the FAQ is not visible.

7. Legal/private pages

Legal, privacy, cookie, complaints and vulnerable customer pages can be indexable if they are public informational pages.

Customer-specific legal documents, signed Contract Summaries, invoices, receipts and token links must stay private/noindex.

8. Search Console/Bing placeholders

Add verification placeholders only. Do not invent verification codes.

9. Do not touch private business logic

Do not modify:

- quote journey logic;
- Contract Summary generation or acceptance;
- Worldpay;
- Direct Debit;
- billing;
- service activation;
- cancellation/ETF;
- admin/customer dashboard logic;
- AI assistant logic;
- RLS/security policies.

## FINAL IMPLEMENTATION SCOPE

Complete:

- public page metadata;
- sitemap generator;
- robots.txt cleanup;
- structured data;
- public SEO pages;
- AEO question-answer blocks;
- FAQ sections;
- internal links;
- image alt/performance fixes;
- noindex audit;
- public route prerender audit;
- Search Console/Bing readiness;
- Lighthouse/PageSpeed spot checks;
- build/typecheck.

## FINAL REPORT

Return:

- files changed;
- pages created/improved;
- canonical domain used;
- sitemap result;
- robots result;
- pages marked noindex;
- schema added;
- FAQ/AEO sections added;
- internal linking result;
- image optimisation result;
- structured-data validation result;
- Lighthouse/PageSpeed result;
- private-route noindex result;
- quote journey regression result;
- build/typecheck result.

Proceed with implementation now.

  
OCCTA SEO + AI Search Optimisation — Implementation Plan

Scope: improve SEO, AEO/GEO, technical hygiene, structured data, content depth and conversion across the **public** site only. Zero changes to quote journey, Contract Summary, Worldpay, Direct Debit, dashboard, admin, lifecycle, billing, activation, cancellation, AI assistant, RLS or customer data.

What's already in place (reuse, do not rebuild):

- `src/components/seo/SEO.tsx` + `StructuredData.tsx` (Helmet-based per-route head)
- `vite-plugin-prerender.ts` SSG for public routes
- `public/robots.txt`, `public/sitemap.xml`
- Centralised company identity in `src/lib/companyConfig.ts`
- Guides, locations, comparisons, keyword pages, FAQ system, schema standard (per project memory)

---

### 1. Technical SEO foundation

- Sweep every public page (Index, Broadband, NoContractBroadband, Flex, ContractSaver, Business, BusinessOffers, BusinessSales, SimPlans, Landline, Switching, Rewards, Support, Faq, About, Complaints, ServiceStatus, OrderLookup, PayInvoice marketing copy, Legal/*, Guides, Locations, Keyword, Comparison) and ensure each renders via `<SEO>` with:
  - unique `<title>` (<60 chars, brand suffix " · OCCTA")
  - unique meta description (<160 chars)
  - self-referencing `canonical` on `https://www.occta.co.uk`
  - matching `og:title`, `og:description`, `og:url`, `og:type`, `twitter:card=summary_large_image`
  - single H1 audit
- Confirm SSG prerender list covers every public route; exclude private/tokenised ones.
- Add `<meta name="robots" content="noindex,nofollow">` (via SEO component prop) on: `/auth`, `/dashboard/*`, `/admin/*`, `/checkout`, `/pre-checkout`, `/thank-you`, `/install`, `/build-plan`, `/quote/*`, `/receipt/*`, `/pay-invoice`, `/business-checkout`, `/offline`.
- Add `hreflang="en-GB"` and `<html lang="en-GB">`.

### 2. robots.txt + sitemap.xml

- Move sitemap to a generator script (`scripts/generate-sitemap.ts`) wired via `predev`/`prebuild`, driven by a single `PUBLIC_ROUTES` source of truth that also drives the prerender plugin (eliminates drift).
- Sitemap entries: home, all marketing/service pages, all guides (from `src/data/guides.ts`), all comparisons (`src/data/comparisons.ts`), all keyword pages (`src/data/keywordPages.ts`), curated locations (`src/data/locations.ts`), legal pages.
- robots.txt: keep public-everything default; tighten Disallow list to match private routes above; keep `Sitemap:` directive; drop redundant per-bot blocks; remove `Crawl-delay` for Googlebot (it ignores it and can confuse Bing).

### 3. Structured data (JSON-LD)

- Sitewide (`index.html`): Organization + WebSite + SearchAction.
- Per-route via existing `StructuredData` component:
  - Service pages → `Service` + `Offer` (only when price is visibly displayed)
  - Bundle/Plan landing pages → `Product` + `Offer` (visible prices only)
  - Guides → `Article` + `BreadcrumbList`
  - Comparison pages → `Article` + `BreadcrumbList` (no fake `Review`)
  - Location pages → `Service` + `BreadcrumbList` + `Place` reference (no fake `LocalBusiness` branches)
  - FAQ pages and any page with visible FAQ block → `FAQPage` (customOnly, already standardised in memory)
  - Support/Contact → `ContactPoint` + `PostalAddress`
- Remove any existing schema that is not visibly backed by content.

### 4. Public page content + AEO/GEO answers

Create or upgrade with genuine, useful content (no thin pages, no keyword stuffing). New routes only if missing:

- New: `/fibre-broadband`, `/broadband-and-digital-voice`, `/small-business-telecom`, `/pricing`, `/coverage`, `/billing-explained`, `/first-invoice-explained`, `/direct-debit-setup`, `/pay-by-card`, `/cancellation`, `/contact`, `/vulnerable-customers` (public-facing companion to the legal one).
- Improve existing: Home, Broadband, NoContractBroadband, Business, SimPlans, Landline (rename label to "Digital Voice / Home Phone"), Switching, Support, About, Complaints, Faq.
- Each service page sections: What it is · Who it's for · Key benefits · How ordering works · How billing works · Activation & start date · FAQs · CTA · related-service internal links.
- Add concise AEO answer blocks (question H2 + 40–60 word answer) covering the 13 questions in the brief, on the most relevant page each.

### 5. Local SEO

- Add real `PostalAddress` + `ContactPoint` (0800 260 6626 / [hello@occta.co.uk](mailto:hello@occta.co.uk) / HD3 3WU) in Organization schema and on `/contact` + footer.
- Keep current curated location pages only; do not mass-generate. Honest coverage disclaimer + availability CTA on each.
- No false claims of physical shops.

### 6. Internal linking

- Add a shared `RelatedLinks` section component used on every service/guide/location page with descriptive anchor text (no "click here").
- Footer audit: ensure links to Pricing, Coverage, Billing, Cancellation, Support, Complaints, Vulnerable Customers, Switching, About.

### 7. Image SEO + performance

- Audit `src/assets` for descriptive filenames; add/fix `alt` on every public image; ensure `loading="lazy"` everywhere except the LCP hero; `decoding="async"` already standardised.
- Convert oversized JPG/PNG hero assets to WebP via `vite-imagetools` (where the asset is bundled). Preload only the LCP hero in `index.html`.
- Verify route code-splitting still keeps admin/dashboard bundles out of public pages (already standardised).

### 8. Analytics / Search Console readiness

- Add Search Console + Bing meta verification slots (commented placeholders the user can fill).
- GA4 already configured per memory — leave untouched; document `gtag` event names for the key conversions (`check_availability`, `quote_started`, `order_submitted`, `pay_now_clicked`).

### 9. Compliance & honesty

- Sweep marketing copy: remove any "guaranteed cheapest / instant activation / Ofcom approved / BT partner" style claims.
- Add standard disclosures (availability address-dependent, estimated speeds, billing starts at activation, pro-rata first invoice, DV needs broadband) to the relevant pages.

### 10. Verification & report

- Build + typecheck.
- Validate sitemap.xml syntax; confirm zero private routes leak in.
- Spot-check rendered HTML of 5 public routes for unique title/description/canonical and valid JSON-LD.
- Manual smoke: open `/`, `/broadband`, `/quote/start`, `/build-plan`, `/dashboard`, `/admin` — confirm no behaviour regressions and private routes carry `noindex`.
- Produce final report (files changed, pages created/improved, schema added, sitemap/robots diff, keyword map, FAQ list, link audit, image audit, perf notes, noindex audit, build result).

---

### Out of scope (will not touch)

- Any edge function except optional `places-autocomplete` (untouched here).
- Any DB schema, RLS, migrations.
- Quote journey, Contract Summary, Worldpay, DD, payment, dashboard, admin, AI assistant logic.
- Pricing engine, catalogue, availability logic.

### Risks / mitigations

- Renaming `/landline` to a new slug would break inbound links → keep slug, update H1/copy to "Digital Voice / Home Phone" and add a Service schema name accordingly.
- Sitemap generator could drift from router → single `PUBLIC_ROUTES` constant shared with prerender plugin.
- Adding FAQ schema without visible FAQ would be a Google violation → only emit FAQPage JSON-LD on pages that visibly render the same Q&A.

### Deliverable

One coherent SEO upgrade implementation, no follow-up plan, no private-flow changes, no fabricated content.
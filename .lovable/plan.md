# SEO Fixes Plan - August 17, 2026

The objective is to fix failing SEO findings and ensure consistency across the application.

## 1. Google Search Console & Sitemap
- Re-verify site ownership for `https://www.occta.co.uk/`.
- Ensure `sitemap.xml` includes all new SEO landing pages and guides.
- Fix broken links in `sitemap.xml` (e.g., checking if `/sim-plans` should be `/sim`).

## 2. Meta Tag Consistency
- Update `index.html` meta description to match current pricing (£34.99/mo).
- Synchronize `SEO.tsx` defaults with the latest branding and pricing.
- Ensure all keyword landing pages use the updated 2026 price lock messaging.

## 3. Redirects & Funnel Logic
- Update remaining legacy `/quote/start` links to point to `/order` (Journey 2.0).
- Ensure canonical URLs are correctly formed in the `SEO` component.

## 4. Technical Details
- **Files to modify:** `index.html`, `src/components/seo/SEO.tsx`, `public/sitemap.xml`, `src/pages/NoContractBroadband.tsx`.
- **Tools:** `google_search_console--diagnose`, `standard_connectors--connect`.

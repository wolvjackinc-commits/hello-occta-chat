

# SEO Guide System for OCCTA

## Summary
Add 7 new pages (1 index + 6 SEO articles) targeting broadband, home phone, and SIM search queries. No existing pages or logic modified beyond appending links.

## New Files

**`src/data/guides.ts`** — Guide content data with 6 articles:
| Slug | Category | Keywords |
|------|----------|----------|
| `no-contract-broadband-uk` | broadband | no contract broadband uk, flexible broadband |
| `cheap-broadband-uk` | broadband | cheap broadband uk, affordable broadband |
| `how-to-switch-broadband` | broadband | switch broadband uk, change provider |
| `digital-voice-uk` | home-phone | digital voice uk, digital home phone |
| `pstn-switch-off-uk` | home-phone | pstn switch off uk, copper line shutdown |
| `cheap-sim-only-deals` | sim | cheap sim only uk, budget sim deals |

**`src/pages/guides/GuidePage.tsx`** — Dynamic page using `:slug` param. Hero → sections → CTA → FAQ accordion. Uses `<StructuredData customOnly>` with `createFAQSchema()` only (no global schema duplication). 404 if slug not found.

**`src/pages/guides/Guides.tsx`** — Index page with card grid grouped by category.

## Modified Files

- **`App.tsx`** — Lazy-import + add `/guides` and `/guides/:slug` routes before catch-all
- **`vite-plugin-prerender.ts`** — Add 7 prerender entries (no trailing slashes)
- **`public/_redirects`** — Add 7 rewrite rules (no trailing slashes)
- **`public/sitemap.xml`** — Add 7 URL entries (no trailing slashes)
- **`Footer.tsx`** — Add "Guides" links section
- **`Broadband.tsx`**, **`Landline.tsx`**, **`SimPlans.tsx`** — Append "Related Guides" section

## Constraints
1. FAQ schema only on guide pages — no Organization/WebSite/LocalBusiness duplication
2. Routes placed before `*` catch-all
3. Consistent canonical format across redirects/sitemap/prerender (no trailing slash)
4. "Digital Home Phone" / "Digital Voice" / "requires broadband" wording throughout
5. No changes to existing checkout, service logic, or routes


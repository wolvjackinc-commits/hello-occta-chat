# OCCTA SEO Growth Release — 7 August 2026

This release adds a static, crawlable acquisition-content cluster for the January 2027 landline migration and high-intent UK broadband searches.

## New authority pages

- `/learn/landline-switch-off-2027-uk`
- `/learn/what-happens-to-my-landline-in-2027`
- `/learn/digital-landline-power-cut`
- `/learn/telecare-personal-alarm-digital-landline`
- `/learn/keep-landline-number-digital-switch`
- `/learn/help-parents-landline-switch`
- `/learn/broadband-for-pensioners-uk`
- `/learn/broadband-social-tariffs-pension-credit`
- `/learn/one-touch-switch-broadband-guide`
- `/learn/broadband-deals-uk-how-to-compare`
- `/learn/fibre-broadband-deals-uk`
- `/learn/broadband-comparison-checklist-uk`
- `/learn/broadband-speed-test-uk`

## SEO implementation

Each authority page has a unique title, meta description, canonical URL, keyword field, H1, concise answer, substantial sections, FAQs, internal conversion links, publication/review dates and authoritative source links. Build-time prerendering injects Article, BreadcrumbList and FAQPage JSON-LD into static HTML.

All new pages are added to `sitemap-learning.xml` and `llms.txt`, surfaced in both `/learn` and `/blog`, and linked to relevant OCCTA commercial/support journeys.

The authority prerenderer removes inherited JSON-LD from the root template before inserting article-specific schema, preventing unrelated legacy product schema from leaking into these pages.

## Content safeguards

The growth cluster does not use blanket `no contracts`, `cancel anytime`, `free installation`, `24/7 support` or legacy £22.99 claims. Address-specific availability, speeds, setup and pricing remain explicitly address/order dependent. Digital Home Phone remains described as a broadband add-on/bundle rather than a standalone traditional landline.

Safety-sensitive landline migration content is grounded in current Ofcom, GOV.UK and Openreach guidance, including the 31 January 2027 network-retirement date, power-resilience considerations and telecare compatibility requirements.

## Release gate

`.github/workflows/seo-growth-check.yml` verifies typecheck, focused lint, content-quality tests, production build, prerendered files, canonical URLs, Article/FAQ/Breadcrumb schema, sitemap coverage, llms.txt coverage and absence of legacy blanket claims from the new pages.

This release does not modify checkout, payments, Direct Debit, order submission, authentication, customer data or pricing-engine logic.

# Audit: residential visitors still reaching the legacy quote flow

Read-only audit. No files changed.

## Confirmed root cause (live data)

The only real residential broadband quote request since Journey 2 went to 100% came in on **14 Aug 2026 13:12 UTC**:

```text
landing_page:    https://www.occta.co.uk/broadband/flex
conversion_page: https://www.occta.co.uk/quote/start?service=broadband&plan=flex
source: web · service_interest: broadband · customer_type: residential
```

That is the **"Check availability & get your quote" CTA on the Flex plan page**, `src/pages/broadband/Flex.tsx:73` — `<Link to="/quote/start?service=broadband&plan=flex">`. It bypasses `startAssignedJourney` entirely and posts straight to the `submit-quote-request` edge function.

Journey 2 assignment itself is healthy: `platform_settings` shows `customer_journey_default = v2`, `customer_journey_v2_enabled = true`, `kill_switch = false`, `rollout_percentage = 100`, preflight all-pass. So no visitor is being *assigned* to v1 today — they are being *linked* around the assignment.

## Every customer-facing route into the legacy quote flow

Legacy destinations still live: `/quote/start` (`src/App.tsx:283` → `src/pages/quote/QuoteStart.tsx`, which invokes `submit-quote-request` at line 148) and `/build-plan` (`src/App.tsx:278`).

### A. Direct `/quote/start` CTAs — residential, highest risk
| File:line | CTA text | Notes |
|---|---|---|
| `src/pages/broadband/Flex.tsx:73` | Flex plan page quote CTA | **Producing real requests today** |
| `src/pages/broadband/ContractSaver.tsx:78` | `/quote/start?interest=broadband_contract_saver` | Price Lock plan page |
| `src/components/seo/SeoContentLayout.tsx:63` | default `secondaryCta` "Get a quote" → `/quote/start` | **Inherited by every SEO content page** — widest blast radius |
| `src/pages/seo/FirstInvoiceExplained.tsx:55` | primary CTA "Get a quote" | overrides primary CTA to legacy |
| `src/pages/seo/BillingExplained.tsx:61` | secondary CTA "Get a quote" | |
| `src/pages/Switching.tsx:54` | `/quote/start?interest=switch` | residential switching page |
| `src/pages/Rewards.tsx:88` | `/quote/start?interest=rewards` | |
| `src/pages/Checkout.tsx:143` | `navigate('/quote/start?interest=...')` fallback | legacy checkout fallback |
| `src/pages/BusinessCheckout.tsx:79` | `/quote/start?interest=business` | business — acceptable, but shares the legacy form |

### B. `/build-plan` links — currently safe, but fragile
`src/pages/BuildPlan.tsx:833-849` now redirects through `startAssignedJourney` unless `?test=1`, so these links reach Journey 2 today:
`src/components/home/HeroSection.tsx:38,321`, `src/components/home/PostcodeChecker.tsx:54`, `src/pages/Broadband.tsx:75`, `src/pages/CoverageAreas.tsx:86,134`, `src/pages/Dashboard.tsx:559`, `src/pages/Checkout.tsx:104`, `src/pages/PreCheckout.tsx:235`, `src/pages/learn/LearnHub.tsx:105`, `src/components/kb/KbArticleView.tsx:182`, `src/pages/seo/FibreBroadband.tsx:48`, `src/pages/seo/Coverage.tsx:52,54`, `src/data/seoArticles.ts:18`, `src/data/seoGrowthArticles.ts:5`, `src/data/learnPages.ts:57`.

Two residual risks on this path:
1. `?test=1` renders the full legacy BuildPlan form for anyone who appends it; that form calls `submit-build-plan`, which inserts into `quote_requests` (`supabase/functions/submit-build-plan/index.ts:92`, `source: build_plan`) — matching the 19 historic `build_plan` rows (all on/before 6 Aug).
2. `src/lib/journey2/route.ts:20` sends a v1 assignment back to `/build-plan`, which is now the Journey-2 gateway — if the kill switch is ever flipped, that pairing dead-ends on the "Starting your order" spinner rather than showing a legacy form.

### C. Returning / known customers
No code path intentionally resumes a returning customer into the legacy quote flow. `supabase/functions/journey2-session/index.ts:212-227` resumes an existing session in its own recorded version; `/quote/:token` (`src/App.tsx:291`, `UnifiedJourney`) is token-only and only reachable from admin-issued links (`src/pages/admin/Quotes.tsx:354`, `src/pages/admin/QuoteRequests.tsx:374,1153`). A v1 answer is only returned for `v2_kill_switch` or out-of-rollout buckets (`supabase/functions/_shared/journey2.ts:115-140`), neither active.

### D. SEO / static
`public/robots.txt:29-30` deliberately leaves `/quote/start` and `/quote/thank-you` indexable, so Google can rank the legacy quote page as an organic entry point. `public/_redirects` contains no `/quote` rules.

## Proposed correction (not applied — for approval)
1. Repoint residential CTAs in group A to `/order` (or `startAssignedJourney`), keeping business quote CTAs on the quote form.
2. Change the `SeoContentLayout` default `secondaryCta` to `/order` so all SEO pages inherit Journey 2.
3. Restrict `/quote/start` to business/non-broadband intent, and `noindex` + disallow it for residential keywords.
4. Gate the `?test=1` legacy BuildPlan form behind an admin check, and change the v1 fallback target in `src/lib/journey2/route.ts` to a dedicated legacy path so the kill switch cannot dead-end.
5. Add a regression test asserting no residential broadband CTA resolves to `/quote/start`.

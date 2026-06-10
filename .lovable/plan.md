Approved — proceed with OCCTA Live Website Consistency Fix exactly as scoped, with the corrections below.

This is a launch-blocker fix, not a new phase.

Do not start Phase 7.  
Do not add new features.  
Do not redesign the site.  
Do not touch Worldpay HPP/webhook, /pay, /pay-invoice, payment_requests logic, invoice generation, DD mandates, rewards logic, campaigns logic, complaints workflow, finance exports, AI chat, supplier resolver, supplier pricing DB rows, quote resolver, Contract Summary logic, server-side Build Plan price resolver or RLS/security.

Critical corrections before coding:

1. Broadband checkout gating only

Do not globally remove “Complete Your Order” or checkout wording if SIM-only or landline-only flows still need it.

The rule is:

- Broadband cart / broadband plan / broadband checkout = block and redirect to /build-plan
- SIM-only / landline-only = leave existing checkout behaviour unchanged unless broken

For broadband only, do not show:

- £22.99
- £32.95
- £33.95
- £27.59
- Router included
- FREE setup/install
- Complete Your Order
- Place order securely
- Due today £0

Broadband must follow:  
Address check → /build-plan → First Bill Preview → Quote → Contract Summary → payment only after CS acceptance.

2. Digital Home Phone safety

Update wording:

- “Keep your existing number” → “Keep your existing number where porting is available.”
- “no extra line needed” → “Works over compatible broadband — no traditional landline required.”
- “£4.95/month” → “from £4.95/month — final price confirmed before order.”

Do not allow Digital Home Phone to become an automatic live checkout add-on unless its pricing and fulfilment are confirmed. If uncertain, keep it quote-led or add-on preview only.

3. Add-ons safety

For Static IP, WiFi Extender, Mesh Node, Norton, Parental Controls and Priority Support:

- If supplier-backed and margin-confirmed, keep them.
- If not confirmed, mark “available by quote” or hide from broadband checkout.
- Static IP must say: “Static IP available on selected services.”

4. Fair Pricing must be the public source

Replace all old static broadband display prices with:

Essential:

- Price Lock 24 from £34.99/month
- Flex 30 from £37.99/month

Superfast:

- Price Lock 24 from £39.99/month
- Flex 30 from £42.99/month

Ultrafast:

- Price Lock 24 from £49.99/month
- Flex 30 from £52.99/month

Gigabit:

- Price Lock 24 from £52.99/month, auto-bump where needed
- Flex 30 from £54.99/month, auto-bump where needed

Server-side resolver remains authoritative.

5. Price Lock / Flex must be visible to customers

Customers must clearly see:

- Price Lock 24
- Flex 30

This must be visible on:

- broadband cards
- /build-plan
- First Bill Preview
- quote summary
- Contract Summary view/read-only label

Use the approved wording from fairPricing.ts.

6. Postcode checker must route to Build Plan

After postcode/address check, route customers to /build-plan, not /pre-checkout or /checkout.

Availability messages:

If full fibre appears available:  
“Full Fibre appears available at your address. Final speed, setup and price are confirmed before order.”

If broadband options are found:  
“Broadband options found for your address. Choose your plan and we’ll confirm the final speed, setup and price before order.”

If uncertain:  
“We couldn’t confirm availability online. You can request a manual quote or call 0800 260 6626.”

7. Dashboard Add Service route

Customer dashboard Add Service must not route broadband customers to old checkout.

Broadband Add Service should route to:

- /build-plan  
or
- /quote/start

SIM and landline can keep their own routes.

8. Admin dashboard counts

Check:

- Suppliers Active
- Pricing Rules Active
- VAT Settings

If the counts are stale, fix the queries.  
If VAT is truly incomplete, do not change VAT settings; report exactly what is missing.

9. Search sweep

After changes, run search for:

- 22.99
- 32.95
- 33.95
- 27.59
- cancel anytime
- free router
- free installation
- guaranteed speed
- Router included
- free static IP included

No public customer-facing broadband page should contain those.

It is acceptable only if a phrase appears in an internal test/comment/document clearly not rendered publicly, but report it.

10. Published URL verification required

After deployment, verify the actual published customer URL, not only Lovable preview.

Check:

- hard refresh / incognito
- desktop
- mobile
- homepage
- /broadband
- /broadband/flex
- /broadband/contract-saver
- /build-plan
- /checkout with broadband cart
- dashboard Add Service

Required customer test paths:

A) Homepage → postcode → Build Plan → Essential → Price Lock 24 → own router  
Expected: £34.99/month, not £22.99

B) Homepage → postcode → Build Plan → Essential → Flex 30 → own router  
Expected: £37.99/month

C) Broadband page → Superfast → Build Plan  
Expected: Price Lock/Flex choice, not old checkout

D) Direct /checkout with broadband cart  
Expected: blocked/redirected to Build Plan

E) Dashboard → Add Service  
Expected: Build Plan or quote start, not old checkout

11. Build checks

Run:

- TypeScript
- production build
- phrase sweep

Do not fix old unrelated lint debt.

12. Final report

Stop after the fix and report:

- exact root cause confirmed
- files changed
- old prices removed
- Price Lock/Flex visibility result
- old checkout gating result
- postcode checker route result
- dashboard Add Service result
- Digital Home Phone wording result
- add-on handling result
- admin dashboard count finding
- published URL verification result
- mobile verification result
- build result
- what was untouched
- whether public customer website is now consistent and safe for controlled beta  
  
OCCTA Live Website Consistency Fix

## Root cause (from code audit)

The published site is built from the same code as preview — there is no stale-deploy issue. The old prices are showing because the **broadband retail cards still come from `src/lib/pricing/catalogue.ts` retailMonthly values (£22.99 / £32.95 / £33.95)**, fed into `getRetailBroadbandCards()` → `plans.ts` → `Broadband.tsx`, `Index.tsx` services section, location pages, comparison pages, and keyword landing pages.

The old checkout flow is showing because:

- `/pre-checkout` and `/checkout` still accept broadband line items and render "Router included", "FREE" setup, "Place order securely", "Complete Your Order".
- "Choose Plan" / "Add Service" CTAs on `Broadband.tsx`, `Index.tsx`, dashboard `ServicesTab.tsx`, location pages route into `/pre-checkout` / `/checkout` rather than `/build-plan`.

Files holding hard-coded legacy prices:

- `src/lib/pricing/catalogue.ts` (retailMonthly fields — feeds cards)
- `src/lib/pricing/constants.ts` (`broadband: '22.99'` fallback)
- `src/lib/pricing/engine.ts` (`22.99` fallback in `getFromPrices`)
- `src/lib/pricing/fairPricing.ts` (already correct — defaults £34.99 / £39.99 / £49.99 / £52.99)
- `src/data/locations.ts` (50 city meta descriptions — `£22.99`)
- `src/data/comparisons.ts` (`£22.99` rows)
- `src/data/keywordPages.ts` / `src/pages/KeywordLanding.tsx` (`"22.99"` default)
- `public/llms.txt` (£22.99)

## What changes

### 1. Make Fair Pricing the public source of truth

- New helper `src/lib/pricing/fairPricingDisplay.ts` exporting `getFairCards()` that returns four cards (Essential / Superfast / Ultrafast / Gigabit) using `FAIR_PRICING_DEFAULTS.headline` and `SPEED_BUCKET_META`, each with `lock24FromPrice`, `flex30FromPrice`, speed range, badges, tagline.
- Update `getFromPrices()` in `engine.ts` and `constants.ts` fallback from `22.99` → `34.99` so "from" prices anywhere are Essential Price Lock 24.

### 2. Update Broadband cards to use Fair Pricing

- `src/pages/Broadband.tsx`: replace `broadbandPlans` mapping with `getFairCards()`. Each card shows:
  - Title (Essential / Superfast / Ultrafast / Gigabit Fibre)
  - "From £X/month with Price Lock 24"
  - "Flex 30 from £Y/month"
  - Speed range
  - Approved badges (Bring your own router for £0, Router options at checkout, Setup from £0 where available, Final price confirmed before order, Price Lock 24 or Flex 30, Speeds depend on your address)
  - CTA: "Check availability" / "Build your plan" → `/build-plan?bucket=<bucket>` (no `/pre-checkout`, no `/checkout`)
- `src/components/home/ServicesSection.tsx` & `Index.tsx`: same data source, same CTA target.
- `src/pages/broadband/Flex.tsx` & `src/pages/broadband/ContractSaver.tsx`: refresh price chips and route CTAs to `/build-plan`.
- `src/pages/LocationBroadband.tsx` & `src/data/locations.ts`: replace `£22.99` with `£34.99`, "Price Lock 24 from £34.99/mo or Flex 30 from £37.99/mo".
- `src/data/comparisons.ts`: replace `£22.99` with `From £34.99/mo (Price Lock 24)`.
- `src/data/keywordPages.ts` + `KeywordLanding.tsx`: default price `34.99`, route CTAs to `/build-plan`.
- `public/llms.txt`: update broadband from-price to £34.99.

### 3. Gate the legacy /checkout and /pre-checkout for broadband

- In `src/pages/PreCheckout.tsx` and `src/pages/Checkout.tsx`, at the top of the component check the cart/plan-id. If any item is a broadband plan (id starts with `broadband-` or service type `broadband`), render a small notice card:
  > "Broadband orders now require an address check, first bill preview and Contract Summary before payment."
  > with a primary CTA → `/build-plan`. Auto-redirect after 4 s.
- Remove the strings "Router included", "FREE" setup line, "Place order securely", "Complete Your Order" from the broadband branch. SIM-only and landline-only carts continue to work unchanged.
- This does NOT touch `/pay`, `/pay-invoice`, Worldpay HPP, invoice generation, DD mandates, quote resolver, or Contract Summary logic.

### 4. Postcode checker → Build Plan

- `src/components/home/PostcodeChecker.tsx` already routes to `/build-plan` after availability — keep, but update the success copy:
  - FTTP: "Full Fibre appears available at your address. Final speed, setup and price are confirmed before order."
  - FTTC: "Broadband options found for your address. Choose your plan and we'll confirm the final speed, setup and price before order."
  - Unknown: "We couldn't confirm availability online. You can request a manual quote or call 0800 260 6626." with quote CTA.

### 5. Customer dashboard "Add Service"

- `src/components/dashboard/tabs/ServicesTab.tsx` (and any "Add Service" in `AppHome.tsx` / `Dashboard.tsx`): change `Add Service` link from `/checkout` / `/broadband` → `/build-plan` for broadband, `/sim-plans` for SIM, `/landline` for landline. No old £22.99 cards.

### 6. Price Lock 24 / Flex 30 visibility

- New small component `src/components/pricing/TermChoiceBadge.tsx` rendering the two options with the approved wording from `fairPricing.ts` (PRICE_LOCK_WORDING, FLEX_30_WORDING).
- Embed it on: Broadband cards (compact), `/build-plan` (full selector — verify it's already present, add if missing), First Bill Preview, quote summary, Contract Summary view (read-only label).

### 7. Digital Home Phone modal copy

- In the landline plan/modal component, change:
  - "Keep your existing number" → "Keep your existing number where porting is available."
  - "no extra line needed" → "Works over compatible broadband — no traditional landline required."
  - "£4.95/month" → "from £4.95/month — final price confirmed before order."

### 8. Add-ons safety pass

- In broadband cards / add-ons selector, audit Static IP, WiFi Extender, Mesh Node, Norton, Parental Controls, Priority Support. Anything not in approved Fair Pricing add-ons gets either hidden from public checkout or marked "available by quote". Static IP wording → "Static IP available on selected services."

### 9. Admin dashboard counts (small fix)

- `src/pages/admin/Overview.tsx`: investigate the "Suppliers Active 0 / Pricing Rules Active 0 / VAT Settings Incomplete" widget. Likely a stale query. Fix the queries to count from `supplier_products` (distinct active suppliers), `pricing_rules` (active = true), and report VAT completeness based on `platform_settings.vat_*` fields. If VAT is truly incomplete, surface a precise reason.

### 10. Sweep & verify

- Run repo-wide `rg` for: `22\.99`, `32\.95`, `33\.95`, `27\.59`, `cancel anytime`, `free router`, `free installation`, `guaranteed speed`, `Router included`, `Complete Your Order`, `Place order securely`. Replace residual matches.
- TypeScript + production build.
- Verify on published URL via browser tool with hard reload (cache-buster query) on `/`, `/broadband`, `/broadband/flex`, `/broadband/contract-saver`, `/build-plan`, `/checkout` (with broadband cart), `/dashboard` Add Service, mobile viewport.

## Untouched (explicit)

Worldpay HPP/webhook, `/pay`, `/pay-invoice`, payment_requests logic, invoice generation, DD mandates, rewards logic, campaigns logic, complaints workflow, finance exports, SEO technical setup (only copy/price text inside meta strings changes), AI chat, supplier resolver, supplier pricing DB rows, quote resolver, Contract Summary logic, server-side Build Plan price resolver, RLS/security.

## Deliverables / final report

- Files changed list
- Removed prices/phrases sweep result
- Before/after screenshots of the gated `/checkout` notice
- Build + TypeScript result
- Published URL verification result (desktop + mobile)
- Admin Overview count finding
- Verdict: public site consistent and safe for controlled beta
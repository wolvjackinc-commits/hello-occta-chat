Approved — start Phase 3C only, with these corrections before coding.

Critical correction:

Do not run margin guard or supplier-cost calculations in the browser.

The customer-facing Build Your Plan UI can show safe prices and options, but supplier cost, supplier product IDs, Giacom cost rows, margin calculations and internal pricing logic must stay server-side.

Use this structure:

1. Client-side Build Your Plan

- Shows speed bucket, Price Lock/Flex, router options, setup options and add-ons.
- Shows safe returned customer price only.
- Shows first bill preview using customer-safe returned values.
- Never receives supplier cost, supplier product ID, margin result details or Giacom ratecard values.

2. Server-side pricing resolver

Create an edge function or RPC:

resolve-build-plan-price

Input:

- address/availability reference
- speed_bucket
- plan_term
- router_option
- router_payment_type
- setup_option
- addons
- customer_type

Server does:

- finds available internal supplier products
- maps them to Essential/Superfast/Ultrafast
- selects safe product
- applies fair_pricing settings
- applies router/setup/add-on pricing
- applies margin guard
- auto-bumps price if margin fails
- falls back to “available by quote” if no safe price exists

Return only:

- customer monthly incl VAT
- customer monthly ex VAT if business
- VAT amount
- one-off charges
- add-ons
- first bill total
- eligibility wording
- Price Lock/Flex wording
- quote-only flag if needed

Do not return:

- supplier cost
- supplier product ID
- margin calculation
- internal notes
- Giacom document values
- margin floor
- selected wholesale provider unless admin later enables network branding safely

3. Contract Summary / Quote safety

Do not trust client-submitted prices.

When create-quote receives selected options, server must recalculate the final pricing using the same server-side resolver.

Client can submit:

- selected speed bucket
- selected term
- router option
- setup option
- add-ons

Server must calculate:

- monthly charge
- VAT
- one-off charges
- first bill
- margin pass/fail
- Contract Summary line items

4. Price Lock wording

Do not use “No price rises” as a general claim.

Use only:  
“No confusing annual rises on Price Lock plans.”

Customer wording:  
“Your monthly broadband price stays the same for the agreed Price Lock term. Optional add-ons, usage charges, services added later, or charges outside the Price Lock scope may change only where shown or agreed.”

5. Flex 30 wording

Use:  
“30-day rolling broadband where available. If your monthly broadband price needs to change, we tell you first and you can leave before the change.”

Do not say:  
“cancel anytime”

6. Public pricing

The public headline cards can show:

- Essential Fibre from £29.99/month
- Superfast Fibre from £34.99/month
- Ultrafast Fibre from £39.99/month

But the disclosure must say:  
“From prices depend on address availability, selected plan type, router choice, setup type and margin-safe availability. Final charges are confirmed before order.”

7. First Bill Preview

First Bill Preview must use returned safe pricing from the server.

It must show:

- broadband monthly
- router monthly or one-off
- setup
- add-ons
- VAT
- first bill estimate

Copy:  
“If it is not shown in your Contract Summary, we do not add it without your agreement.”

8. Admin Fair Pricing controls

Good to use `platform_settings.fair_pricing` JSONB.

Admin controls should include:

- headline prices
- Price Lock enabled
- Flex 30 enabled
- router prices
- setup prices
- add-on prices
- buffers
- margin floors
- fallback behaviour: auto-bump / quote-only

Only admin/super_admin/finance_admin should edit.

9. Contract Summary carry-through

Contract Summary must include:

- speed bucket
- plan term: Price Lock 24 or Flex 30
- router choice
- router payment type
- setup option
- add-ons
- monthly total
- one-off total
- first bill estimate
- VAT-inclusive residential pricing
- business ex VAT + VAT where relevant
- known cease/disconnection/termination warnings where applicable

10. Do not expose supplier data

No public/customer route or network response should expose:

- supplier cost
- supplier product ID
- internal provider selection
- margin data
- Giacom ratecard values
- admin notes

11. Keep untouched

Do not touch:

- Worldpay webhook/HPP
- invoice generation
- DD mandates
- /pay
- /pay-invoice
- checkout gate
- rewards
- campaigns
- complaints workflow
- finance exports
- SEO technical setup
- AI chat

12. Verification

After Phase 3C:

- public cards show the new attractive wording
- Fair Broadband Promise section renders
- /build-plan works
- own router is £0
- router one-off/monthly options work
- First Bill Preview works
- server-side resolver returns safe customer prices only
- unsafe prices are bumped or marked quote-only
- Contract Summary includes all selected charges
- no supplier cost/product ID appears in browser/network responses
- /quote/start, checkout gate, /pay, /pay-invoice still work

Stop after Phase 3C and report.  
Do not start Phase 7.  
  
Phase 3C — OCCTA Fair Broadband Pricing + Problem-Solving Plan Builder

Reposition broadband around customer problem-solving. Adds Price Lock 24 / Flex 30, BYO-router, transparent first-bill preview, plan-builder funnel, margin guard and admin pricing controls.

Out of scope (untouched): Worldpay HPP/webhook, invoice generation, DD mandates, /pay, /pay-invoice, checkout payment gate, rewards, campaigns, complaints workflow, finance exports, SEO technical setup, AI chat.

---

### 1. Public pricing copy rewrite

Rewrite `src/lib/pricing/retailCards.ts` for the three buckets — Essential / Superfast / Ultrafast — using the new badges from the brief. Strip all forbidden phrases: "free router included", "free installation", "cancel anytime", "guaranteed speed", "free static IP included", "no price rises".

Per card show: from-price (£29.99 / £34.99 / £39.99), speed range, problem-solving badges, "Final price confirmed before order" footer.

Update `HeroSection` and `ServicesSection` copy to lead with: *"Broadband built around you. Bring your own router and save. Choose Price Lock or Flex 30. See your first bill before you order."*

### 2. New `FairBroadbandPromise` home section

New `src/components/home/FairBroadbandPromise.tsx` with 5 brutalist cards:

- No forced router
- No confusing annual rises (Price Lock)
- No hidden first bill
- No long contract (Flex 30)
- No support black hole

Mount in `src/pages/Index.tsx` between hero and services.

### 3. Build Your Plan journey

New route `/build-plan` → `src/pages/BuildPlan.tsx`, kicked off from `PostcodeChecker` after a successful address check (availability already stored in `AvailabilityContext`).

Five-step wizard (one component per step under `src/components/build-plan/`):

1. **Speed** — Essential / Superfast / Ultrafast (filtered by what the address supports)
2. **Plan type** — Price Lock 24 / Flex 30 (only options the supplier product + margin guard allow)
3. **Router** — Own (£0) / Standard WiFi 6 (£79.99 once or £4.99/mo) / Premium mesh (£129.99 once or £7.99/mo) / Business (quote)
4. **Setup** — Remote £0 / Standard £49.99 / Engineer £99.99 / Complex (quoted)
5. **Add-ons** — Priority support £6.99/mo, Static IP, Digital Voice, paper billing

Footer of every step shows live **First Bill Preview** panel (component below).

### 4. Pricing engine extensions

`src/lib/pricing/engine.ts` + `types.ts` extended with:

- `PlanTerm = 'price_lock_24' | 'flex_30'`
- Per-bucket headline matrix (own-router):
  - Price Lock 24: Essential £29.99, Superfast £34.99, Ultrafast £39.99, Gigabit £44.99
  - Flex 30: Essential £32.99, Superfast £37.99, Ultrafast £44.99, Gigabit £49.99
- Router add-ons: +£4.99/mo standard, +£7.99/mo premium (or one-off equivalents)
- `resolvePlanQuote(address, bucket, term, router, setup, addons)` → returns monthly, one-offs, first-bill total, term rules, eligibility, marginPassed flag.
- Address→bucket mapping (internal only):
  - Essential: 40/10, 80/20
  - Superfast: 150/160/30, 220/30, 330/50
  - Ultrafast: 500/550/75, 900/1000/115, CityFibre 1Gb
- Supplier cost, product ID, internal notes never returned to client.

### 5. Margin guard

New `src/lib/pricing/marginGuard.ts`:

```text
customer_ex_vat = monthly_incl_vat / 1.2
margin = customer_ex_vat
       − supplier_monthly_net
       − router_recovery_if_included
       − support_buffer (£1.00)
       − payment_failure_buffer (£0.50)
       − term_risk_buffer (Lock £1.00 / Flex £2.00)
       − rewards_buffer (0 unless enabled)
```

Floors: Essential Lock-BYO £1.50, Essential Flex £3.50, Superfast £3.50, Ultrafast/Gigabit £4.50. First-3-month margin must be ≥0 (admin/super_admin override with reason).

If fail: bump to next safe `.99`, else mark plan as "Available by quote" and route to `/quote/start`.

Buffer values + floors are read from `platform_settings` / `margin_rules` (already in DB) so admin can tune without code changes.

### 6. Price Lock & Flex 30 eligibility rules

`isPriceLockEligible(product)`: supplier supports 24-month term + margin pass + clear router/setup + acceptable supplier risk.

`isFlex30Eligible(product)`: supplier offers 1-month min term OR risk priced in + cease/disconnection risk shown + margin pass.

Surface customer wording verbatim from brief on selection cards and Contract Summary.

### 7. First Bill Preview

`src/components/build-plan/FirstBillPreview.tsx` — sticky panel showing monthly broadband, router monthly/one-off, setup, add-ons, VAT-inclusive total (residential) / ex-VAT + VAT (business), estimated first bill.

Footer copy: *"If it is not shown in your Contract Summary, we do not add it without your agreement."*

### 8. "Included at no extra cost" section

New `src/components/home/IncludedFreeSection.tsx` listing the 11 items from the brief. Mounted under FairBroadbandPromise.

### 9. Contract Summary carry-through

Update `supabase/functions/create-quote/index.ts` + `generate-contract-summary/index.ts` to accept and persist: `speed_bucket`, `plan_term` (lock_24/flex_30), `router_option`, `setup_option`, `addons[]`, and surface all selected charges in the CS (already has the columns for monthly/setup/router/delivery/installation — add `plan_term`, `speed_bucket` to `quotes` + `contract_summaries` via migration).

Existing checkout-gate on CS acceptance stays untouched and continues to enforce "no payment without CS".

### 10. Admin controls

New `src/pages/admin/FairPricing.tsx` (linked from admin nav under Pricing) — single page editing the singleton row in `platform_settings` plus per-bucket overrides table:

- Headline from-prices per bucket × term
- Price Lock enable/disable
- Flex 30 enable/disable
- Router prices (standard / premium / monthly add-ons)
- Setup prices (remote / standard / engineer)
- Buffer amounts (support / payment-failure / lock-risk / flex-risk / rewards)
- Margin floors per bucket
- Public display status (Live / Hidden / Quote-only fallback)

Backed by new `fair_pricing_settings` table (or extend `platform_settings` with a JSONB `fair_pricing` column — preferred to avoid extra GRANT/RLS surface) plus existing `margin_rules` table for floors.

### 11. Database

One migration:

- `ALTER TABLE platform_settings ADD COLUMN fair_pricing JSONB DEFAULT '{}'::jsonb` (singleton, already RLS-locked).
- `ALTER TABLE quotes ADD COLUMN speed_bucket text, ADD COLUMN plan_term text;`
- `ALTER TABLE contract_summaries ADD COLUMN speed_bucket text, ADD COLUMN plan_term text;`

No new tables → no new GRANT/RLS needed.

### 12. Verification checklist

- Public cards show problem-solving badges, no forbidden phrases.
- `/build-plan` flow works end-to-end and feeds `create-quote`.
- Price Lock + Flex 30 selectable only where eligible.
- BYO router = £0, router monthly/one-off math correct.
- First Bill Preview matches Contract Summary line items.
- Margin guard blocks unsafe combos, auto-bumps or falls back to quote-only.
- CS includes speed_bucket / plan_term / router / setup / add-ons.
- No supplier cost or product ID visible in any network response.
- `/quote/start`, checkout gate, `/pay`, `/pay-invoice` still work.

### Files (new / edited)

New: `src/components/home/FairBroadbandPromise.tsx`, `IncludedFreeSection.tsx`, `src/pages/BuildPlan.tsx`, `src/components/build-plan/{StepSpeed,StepTerm,StepRouter,StepSetup,StepAddons,FirstBillPreview}.tsx`, `src/lib/pricing/marginGuard.ts`, `src/pages/admin/FairPricing.tsx`, one Supabase migration.

Edited: `src/lib/pricing/retailCards.ts`, `engine.ts`, `types.ts`, `constants.ts`, `src/components/home/HeroSection.tsx`, `ServicesSection.tsx`, `PostcodeChecker.tsx`, `src/pages/Index.tsx`, `src/App.tsx` (route), `src/components/admin/layout/AdminLayout.tsx` (nav link), `supabase/functions/create-quote/index.ts`, `generate-contract-summary/index.ts`.

Stop after Phase 3C. Do not start Phase 7.
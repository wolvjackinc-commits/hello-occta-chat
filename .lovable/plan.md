# Customer Journey 2.0 — full production build

Journey 1 (`/build-plan` → quote request → `/quote/:token` UnifiedJourney) stays exactly as it is. Journey 2 is a new, separate immediate-ordering flow at `/order` that reuses the existing pricing, legal document, Direct Debit, customer, order and email services rather than duplicating them.

Confirmed current state: there is no `/order` route, no Journey 2 session table, and `platform_settings` only has the legacy `unified_journey_enabled` flag. The existing `journey-*` edge functions and contract/DD/order services are in place and will be reused.

Agreed decisions: build the whole thing in one pass; Journey 2 uses assumed availability (no live ICUK call, no "subject to confirmation" wording); existing router and add-on prices are used as-is, and any item with "from"/unknown pricing is excluded from Journey 2.

## What the customer will experience

A single continuous session at `/order`, nine steps, no waiting for a quote email:

1. Address — postcode and address selection
2. Plan — orderable speeds, Price Lock 24 or Flex 30, with a savings comparison
3. Router — fixed-price router options
4. Extras — exactly priced add-ons, Digital Voice where added to broadband
5. Your details
6. Preferred start date
7. Billing day and Direct Debit details
8. Contract — Contract Summary and Contract Information shown, then signed
9. Final review, then Place order

They then get an OCCTA order number immediately, a completion page, and the full welcome and document pack by email. Progress is autosaved; a secure resume link by email is a backup, not the main route forward.

## Safety and rollout

- Journey 2 ships disabled to the public. Kill switch on, test mode on, rollout 0%.
- Only admins can open a Journey 2 test session; no public URL parameter can force it.
- A preflight check must pass before Journey 2 can become the default: active fixed-price plans with exact Flex 30 / Price Lock 24 pricing, exact router and extra prices, valid VAT config, two-document contract flow, current legal versions, successful Contract Summary / Contract Information / acceptance certificate generation, DD provider config and approved Guarantee wording, email provider, document storage, order-number generation and customer-account creation. Failures are listed to the admin and block promotion.
- Journey assignment is deterministic per anonymous session and stored permanently, so nobody switches version on refresh, and setting changes only affect new sessions. If both journeys are unavailable, a safe service message with OCCTA contact details is shown.
- No collection is attempted before the agreement is accepted and the service reaches the permitted billing stage. Wording never promises a Direct Debit will be taken until the mandate is completed and activated.
- No supplier names, costs or margins reach the customer. All Journey 2 routes are `noindex, nofollow` with no-referrer, no marketing scripts and no tokens in analytics or logs.

## Admin operations

A new **Customer Journey Controls** admin section showing: Journey 1 / Journey 2 enabled, default journey, kill switch, test mode, rollout percentage, abandoned-resume settings, last preflight result, active session counts for both journeys and the conversion funnel for both.

Journey 2 sessions get an admin view with step, price snapshot, contract and DD status, linked order, plus manual-review handling for anything that fails atomic submission.

## Technical implementation

### Database (additive migrations only)
- `platform_settings`: add the twelve `customer_journey_*` columns from the spec with the specified constraints (default journey in `v1`/`v2`, rollout 0–100, positive resume delay, expiry 1–90 days). `unified_journey_enabled` is retained as a legacy compatibility flag and no longer treated as always-on.
- New `customer_journey_sessions` table with the specified columns, hashed public token, status and step enumerations, indexes on token hash, status, last activity and expiry, plus `updated_at` trigger. RLS: no anon/authenticated access to raw rows; all reads and writes go through edge functions using the service role, with admin read policies via `has_any_admin_role`. GRANTs issued in the same migration.
- `journey_version` and final contractual snapshot columns added to the existing quote/contract/order records so every artifact records which journey produced it.
- Retention job for expired and abandoned sessions.

### Edge functions (new, `journey2-*`)
`journey2-session` (create/resume/assign version), `journey2-catalogue` (server-side plans, routers, extras with exact prices only), `journey2-save-step` (validated per-step autosave), `journey2-prepare-contract` (calls the existing contract summary and information pack generators), `journey2-accept` (acceptance certificate), `journey2-payment-method` (DD details via existing encryption), `journey2-submit-order` (single idempotent transaction creating customer, payment method, contract acceptance and canonical order, returning the OCCTA order number), `journey2-preflight`, `journey2-resume-email`. Each validates input with Zod, enforces state-transition rules, is idempotent on retry/double-click, and rolls back to `manual_review` with an admin alert rather than half-completing.

### Frontend
`src/pages/order/OrderJourney.tsx` plus one component per step under `src/pages/order/steps/`, a shared `useJourney2Session` hook, and `src/lib/journey2/` for client-side state and wording. Routes `/order`, `/order/:token`, `/order/:token/complete` added to `App.tsx`, lazy-loaded, wrapped in the existing private no-index route guard. Homepage postcode checker and broadband CTAs route through the journey router instead of assuming Journey 1. Full keyboard accessibility, visible focus, labelled errors and mobile layouts, in the existing brutalist design system.

### Emails, analytics, audit
Milestone and welcome emails go through the existing transactional queue and templates with the approved Direct Debit Instruction and Guarantee. Journey 2 funnel events are recorded per step for both journeys. Every state transition, price snapshot and submission writes to the existing audit and notification logging.

## Verification before handover
Typecheck and build, then an admin-only end-to-end Journey 2 test session driven in the browser: all nine steps, autosave and resume, refresh and double-submit idempotency, contract documents generated and downloadable, DD details stored and visible in the customer dashboard, order number issued, emails accepted by the provider, and confirmation that Journey 1 still works unchanged. Preflight is run and its result reported. No test or demo customer records are left behind and no existing customer, pricing or payment data is modified.

## Known limitation
Because availability is assumed, an order for a line that later proves unserviceable will need manual handling; that lands in the admin manual-review queue rather than being silently converted into a quote request.

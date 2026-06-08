# OCCTA Full Build — Amended Plan (Phase 0 + 1 first)

Extend in place. Nothing existing gets broken: Worldpay HPP, invoices, DD mandates, admin panel, AI chat, SEO pages, customer dashboard, ICUK pricing engine and all current Supabase tables stay intact.

---

## Locked rules (apply across every phase)

1. **Manual Mode default ON.** Admin toggles `api_mode` between `manual` and `live`.
2. **Contract Summary is mandatory in BOTH modes.** Payment/order cannot be initiated without an accepted, versioned contract summary tied to the quote.
3. **Live mode is not "as-is".** Even live checkout enforces:
  - accepted Contract Summary first
  - VAT-inclusive residential pricing everywhere
  - business ex VAT + incl VAT shown
  - proper VAT invoice generation
  - payment status only set to `paid` by Worldpay webhook / server confirmation
  - browser return never marks paid
4. **Manual Quote Mode applies to broadband, digital voice, business.** SIM has an admin-level switch `sim_checkout_mode` (`instant` | `quote`), default `quote` until supplier pricing is confirmed.
5. **Rewards full build, values disabled until margin rules set.** Unlock trigger configurable: `first_cleared_payment` | `second_cleared_payment` | `custom_rule`. Reward values null/zero until admin enables.
6. **Campaign Engine full build, never auto-publishes.** State machine: `draft → margin_check → compliance_check → admin_approval → published`. AI may draft only.
7. **VAT invoice gate:** system refuses to issue VAT invoices unless `vat_number` and `vat_effective_date` are set. Below that date or without those values → plain invoice, no VAT line.
8. **Nothing hardcoded:** supplier prices, product IDs, availability rules, reward values, campaign offers, plan attributes — all DB-driven.
9. **Universal Activity Log from day one.** Every new module writes to it as it ships.
10. **Finance/VAT export foundation early.** Tables capture tax_point, net, vat_rate, vat_amount, gross, customer_type (B2C/B2B), customer_vat_number from the start.
11. **Role-based access + audit from day one** for: VAT changes, price changes, quote approval, invoice edits, payment overrides, reward approval, campaign publishing, contract summary changes.

---

## PHASE 0 — Foundation (build now)

### Migration 0.1 — Platform settings, roles, activity log

- `app_role` enum extended: add `super_admin`, `finance_admin`, `support_agent`, `sales_agent`, `compliance_admin`, `marketing_admin`, `auditor`. Keep existing `admin`, `user` for back-compat (treat `admin` = `super_admin` in `has_role` checks during transition).
- `platform_settings` (singleton row):
  - `api_mode` text default `'manual'`
  - `sim_checkout_mode` text default `'quote'`
  - `manual_mode_message` text
  - `rewards_unlock_rule` text default `'first_cleared_payment'`
  - `rewards_enabled` bool default `false`
  - `vat_number` text null
  - `vat_effective_date` date null
  - `vat_scheme` text default `'standard'`
  - `vat_default_rate` numeric default `20`
  - `residential_vat_display` text default `'inclusive'`
  - `business_vat_display` text default `'dual'`
  - `invoice_prefix` text default `'INV-'`
  - `credit_note_prefix` text default `'CN-'`
- SECURITY DEFINER `public.get_setting(text)` and `public.is_vat_active()` (true only when vat_number and effective_date set and effective_date <= today).
- `activity_log` table: id, ts, actor_type (`customer|admin|system|ai`), actor_id, customer_id, order_id, invoice_id, quote_id, contract_summary_id, ticket_id, complaint_id, event_type, title, details jsonb, old_value jsonb, new_value jsonb, ip, ua, source_module, severity, audit_locked bool default true.
- SECURITY DEFINER `public.log_event(...)` writes to activity_log; called from triggers and edge functions.
- `admin_audit_log` view filtered for sensitive actions only.
- Full GRANTs + RLS: only admin roles read; nobody updates (audit-locked).

### Migration 0.2 — Claims cleanup data layer

- `site_copy` table (singleton key/value) so the public site reads risky-claim replacements from DB (admin-editable later) — but Phase 1 also hard-replaces them in JSX so site is correct immediately even before admin edits.

### Frontend 0.x

- `src/hooks/usePlatformMode.ts`
- `src/lib/activityLog.ts` (client helper that calls a `log-event` edge function for client-side events worth logging)
- `src/contexts/PlatformSettingsContext.tsx` (loads platform_settings once, exposes `apiMode`, `simMode`, `vatActive`)

---

## PHASE 1 — Public site rebuild (extend, no breakage)

### Claims cleanup pass (all existing public pages)

Replace risky phrases per spec:

- "Cancel anytime" → "30-day rolling options available. Cancel with notice."
- "No hidden fees" → "All monthly and one-off charges shown before you order."
- "24/7 support" → "24/7 AI support with human escalation when needed."
- "Free installation" → "Free standard installation where available and shown in your quote."
- "Available everywhere" → "Availability depends on your exact address."
- "No credit check" → "Checks or deposits may apply depending on product/supplier."

### Pages — new or rewritten

- `**/` Homepage** — hero "Broadband without the lock-in", Flex vs Contract Saver block, Broadband, SIM, Digital Voice, Business strip, Switching, Rewards teaser, AI support, Why OCCTA, trust/compliance strip, FAQs. CTAs respect `api_mode`: in manual, "View plans" routes into Quote Request flow (Phase 2) — for Phase 1 they route to plan pages with a "Request a confirmed quote" CTA wired to a placeholder `/quote/start` route that Phase 2 will fill.
- `**/broadband**` — split: Flex Broadband and Contract Saver Broadband. Cards read from `plans` table (existing). No final-price guarantees. Availability disclaimer.
- `**/broadband/flex**` — 30-day rolling positioning with compliant wording.
- `**/broadband/contract-saver**` — lower monthly price positioning, reward eligibility note (values hidden until rewards_enabled).
- `**/sim-plans**` — config-driven attributes. Hide instant-checkout CTA when `sim_checkout_mode = 'quote'`.
- `**/digital-voice**` — emergency / power-cut warning, vulnerable-customer CTA, porting "where available", quote-led.
- `**/business**` — B2B quote-led: Business Broadband, Business SIMs, Business VoIP, Managed Telecom, Upload current bill, Request business quote, Book a call. Never instant checkout.
- `**/switching**` — One Touch Switch explainer.
- `**/rewards**` — teaser only; values hidden until `rewards_enabled = true`.
- `**/track-order**` — keep existing, ensure logged-in users see fuller timeline (full pipeline rendering lands in Phase 4).
- **Legal pages added/updated:** Complaints Code, Contract Summary explainer, Digital Voice & Emergency Calls, Vulnerable Customers, Accessibility, Fair Usage, Cancellation & Cease Charges, Payment Security, DD Guarantee, Price Rise Policy, Rewards Terms, Business Terms.

### Routing & checkout guard (Phase 1 enforcement of locked rule 3)

- New helper `requireContractSummaryForPayment()` used by `Pay`, `PayInvoice`, `Checkout`, `BusinessCheckout`. If no accepted contract summary linked to the cart/quote/invoice, redirect to `/quote/contract-summary?ref=...`. Contract Summary table comes online in Phase 2; until then the helper:
  - in **manual mode**: blocks instant checkout entirely (sends user to quote flow placeholder)
  - in **live mode**: allows current behaviour BUT shows a clear "Contract Summary required" gate placeholder so Phase 2 wire-up is a drop-in.
- This guards live mode from regressing once Phase 2 lands.

### Activity logging in Phase 1

Every new public action writes to `activity_log` via `log-event` edge function:

- postcode check, quote-CTA click, contract-summary view, legal-page version view, form submission.

### Edge function 0/1.x

- `log-event` — JWT optional, validates payload, writes to activity_log via SECURITY DEFINER fn. CORS + rate-limit.

---

## Pause point

End of Phase 1: stop, summarise what changed (files, tables, settings), and wait for go-ahead before starting Phase 2 (Quote & Contract Summary system).

---

## Phases 2–9 unchanged from prior plan, with amendments folded in

2. Quote Requests + Quotes + Contract Summary (mandatory both modes), pay-gate wired, activity log entries per step.
3. Admin: Leads, Quote Builder (margin-locked), Pricing Rules, Supplier Settings, VAT Settings (gates VAT invoices), KPI cards.
4. Customer dashboard expansion incl. Contract Summaries, Quotes, Complaints, Rewards & Referrals, Vulnerable Support.
5. Rewards (values disabled until admin) + Campaign Engine (no auto-publish).
6. Support, Complaints (ADR 6-week tracker), Communications Centre, AI KB (restricted retrieval).
7. Finance & VAT Export Centre — uses fields captured from day one in Phase 0/2.
8. Roles hardening + Compliance Centre + audit deepening.
9. SEO expansion pages.

---

Reply "go" and I'll start with Phase 0 migrations, then Phase 1 frontend.  
  
  
  
Add these final safeguards before building:  
  
1. Legacy invoice/payment exception:  
Contract Summary is mandatory for all new telecom sales/orders, but do not block payment links for old/legacy invoices, arrears, manual invoices, or non-contract payment requests where no new telecom contract is being created. Those payments should still work.  
  
2. Contract Summary linking:  
Contract Summary should be linkable to quote_id, order_id, cart_id, or invoice_id. In manual mode it will usually link to quote_id. In live mode it may link to cart/order.  
  
3. Sensitive activity logging:  
Public/client log-event must only accept low-risk events like page views, CTA clicks, quote-start events and form submissions. Sensitive logs such as VAT changes, payment status, quote approval, invoice edit, reward approval and campaign publish must only be created server-side/admin-side, not trusted from client payload.  
  
4. Do not let activity_log store unnecessary sensitive data:  
No card data, no full bank details, no passwords, no secret tokens. Mask personal data where possible in event details.  
  
5. RLS must be tested after every migration:  
Admin-only tables must not be readable by normal users. Customers should only see their own rows.  
  
6. Migration safety:  
Before changing tables/enums/policies, create migration in a way that does not break existing roles, admin login, customer dashboard, invoices, Worldpay, DD mandates or current SEO pages.  
  
7. Keep current payment links working:  
Worldpay HPP and payment request links must keep functioning. Only new sales checkout/order flows should be gated by Contract Summary.  
  
8. Add a rollback note after Phase 0:  
At the pause point, list every migration/table/policy/function added so we can reverse or fix if anything breaks.  
  
9. Phase 0 + Phase 1 only for now:  
After Phase 1, stop and show:  
- tables added  
- functions added  
- files changed  
- pages changed  
- what was not touched  
- any errors/warnings
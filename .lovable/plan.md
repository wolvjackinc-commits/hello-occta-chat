Approved — run the OCCTA Go-Live Readiness Audit exactly as scoped.

Additional safety requirements before starting:

1. Do not mutate live settings unless necessary.  
If any setting must be temporarily changed for testing, record:

- original value
- test value
- restored value

2. Do not create real orders, real payments, or real customer obligations.  
Any quote/request created during testing must be clearly marked TEST / INTERNAL where possible.
3. Test permissions with three views:

- anonymous/public user
- normal customer user
- admin/staff user

Confirm admin-only data is never visible to public/customer users.

4. Confirm test artefacts are either:

- deleted after testing, or
- clearly labelled TEST / INTERNAL so they cannot be mistaken for real customer activity.

5. For Contract Summary tests, do not proceed into real payment. Stop after verifying CS content and acceptance gate behaviour.
6. For real-address beta tests, do not submit real payment or supplier order. This is journey verification only.
7. If any serious issue is found, stop and report before attempting a broad fix.

Final report must clearly say one of:

- Safe for controlled beta
- Needs small fixes before beta
- Do not launch yet

Do not start Phase 7.  
Do not start any new feature.  
Do not redesign anything.  
  
  
  
  
OCCTA Go-Live Readiness Audit — Plan

QA-only sweep. No new phase, no Phase 7, no new features, no redesign. Fixes only if a route is broken or a calculation is clearly wrong, and strictly scoped to recent OCCTA work.

## 1. Build & code checks

- Run TypeScript check, production build, and lint (if configured) on the frontend.
- Type-check Supabase edge functions where a tsconfig/deno-check is available.
- Report pass/fail with exact errors. Only fix regressions caused by recent OCCTA work.

## 2. Public route smoke

Load each route, check console errors, broken buttons/images, CTA targets, mobile layout:
`/`, `/broadband`, `/broadband/flex`, `/broadband/contract-saver`, `/switching`, `/rewards`, `/quote/start`, `/quote/thank-you`, `/build-plan`, `/checkout`, `/pay`, `/pay-invoice`, legal pages, support/contact.
Flag any forbidden copy: "free router", "free installation", "cancel anytime", "guaranteed speed", "free static IP included".

## 3. Homepage + pricing copy

Verify Fair Broadband positioning lines and pricing cards:

- Essential PL24 £34.99 / Flex30 £37.99
- Superfast PL24 £39.99 / Flex30 £42.99
- Ultrafast PL24 £49.99 / Flex30 £52.99
- Gigabit PL24 £52.99 / Flex30 £54.99 (auto-bump)
- Disclosure present (address/plan/router/setup dependent; final price confirmed before order).

## 4. Build Plan A–E

Test via `/build-plan?test=1` (admin) for scenarios A–E. For each: option availability, PL24/Flex30 rules, router pricing (own £0, monthly, one-off), setup charge, add-ons, VAT, first-bill preview, quote_only fallback, no supplier data in response.

## 5. Resolver / margin safety

Re-read `_shared/buildPlanResolver.ts` and confirm: only `active=true`, `quote_only=false`, correct bucket+term+max_download+broadband service_type; Flex30→1-month rows; PL24→24-month (or tagged 36m); empty bucket→quote_only; loader failure→quote_only; no legacy hardcoded fallback.

## 6. Supplier-data security

Inspect network responses for: `resolve-build-plan-price`, `submit-build-plan`, `create-quote`, `generate-contract-summary`, customer quote page, Contract Summary page. Confirm no supplier cost, supplier_product_id, supplier/Giacom name, network, margin, floor, internal block, ratecard, source document/page, or admin notes leak.

## 7. Quote flow

Test `/quote/start` manual flow and `/build-plan → submit-build-plan` flow. Confirm client prices are ignored, server re-resolves, quote_only fallback path works, admin and customer token views render correctly.

## 8. Contract Summary

Generate CS for: PL24 priced, Flex30 priced, router monthly, setup charge, add-on, ETF/disconnect, quote_only case. Verify required fields present and forbidden supplier/margin/source fields absent.

## 9. Admin routes

Load: `/admin`, `/admin/fair-pricing`, `/admin/pricing-rules`, `/admin/margin-rules`, `/admin/suppliers`, `/admin/suppliers/giacom-import`, `/admin/quotes`, `/admin/quote-requests`, `/admin/vat-settings`, `/admin/rewards`, `/admin/referrals`, `/admin/contract-benefits`, `/admin/campaigns`, `/admin/tickets`, `/admin/complaints`, `/admin/knowledge-base`, `/admin/communications`. Confirm permissions, Giacom rows admin-only, active/inactive toggles, fair-pricing render, quote_only fallback settings, audit logging on sensitive changes.

## 10. Customer dashboard

Check all tabs: Overview, Services, Orders, Quotes, Contract Summaries, Invoices & Payments, Support, Chat History, Complaints, Rewards & Referrals, Documents, Account Settings, Vulnerable Support. Confirm own-data scoping and no supplier/margin/internal leakage.

## 11. Support / complaints / KB

Confirm support form, vulnerable support form, complaint form, complaint status tracking, admin complaints page, public vs admin-only KB articles, hidden internal notes.

## 12. Rewards & campaigns

Pages load; campaigns draft/admin only; no auto public publishing; no rewards applied to invoices unintentionally; no cash withdrawal wording.

## 13. Payment route safety (no real payment)

Smoke `/checkout`, `/pay`, `/pay-invoice`. Confirm CS gate still enforced for new telecom sales, legacy payment links not blocked, browser return cannot mark Worldpay paid, no payment logic touched.

## 14. VAT & pricing display

Residential VAT-inclusive, business ex+VAT where shown, `/admin/vat-settings` loads, VAT-inactive guard intact, no Phase 7 VAT export work started.

## 15. Mobile / WLR

SIM not accidentally public self-checkout; WLR/ISDN manual-quote-only; supplier costs hidden; placeholders admin/reference only.

## 16. Real-address beta (read-only)

2–3 ICUK test addresses (normal, fibre/gigabit, limited): availability → buckets → builder → quote outcome → quote_only behaviour. No real orders/payments.

## 17. Final report

Single consolidated report covering: build, public routes, admin routes, dashboard, A–E, pricing/margin, supplier security, quote flow, CS, payment safety, support/complaints/KB, rewards/campaigns, VAT, mobile/WLR, remaining issues, beta-readiness verdict, files changed (if any), what was untouched.

## Scope guardrails

Untouched unless strictly required to fix a broken route: Worldpay HPP/webhook, invoice generation, DD mandates, `/pay`, `/pay-invoice`, checkout gate, rewards logic, campaigns logic, complaints workflow, finance exports, SEO setup, AI chat. No Phase 7. No new features. No redesign. No pricing changes unless a calculation is clearly broken.
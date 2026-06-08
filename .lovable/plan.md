## Phase 1 Completion Plan

Finish all remaining Phase 1 deliverables. No Phase 2 work, no new Quote/Contract Summary tables, no breaking changes to existing flows.

### New pages (placeholder-grade, no hardcoded prices/IDs/speeds/rewards)

- `src/pages/broadband/ContractSaver.tsx` — explains the Contract Saver track, "indicative pricing — final price confirmed in your Contract Summary" language, single CTA → `/quote/start?interest=broadband_contract_saver`.
- `src/pages/Switching.tsx` — how OCCTA handles One Touch Switch, no downtime promises, CTA → `/quote/start?interest=switch`.
- `src/pages/Rewards.tsx` — teaser only. Copy: "Rewards programme launching soon. Final reward values, eligibility and unlock rules will be published before activation." No numbers. Reads `rewards_enabled` from `usePlatformSettings`; if false, shows teaser. Never shows live values in Phase 1.
- `src/pages/quote/QuoteStart.tsx` — Phase 1 placeholder for the Phase 2 quote flow. Captures interest + postcode + contact intent in local state, shows manual-mode message from `platform_settings.manual_mode_message`, fires `quote_start` low-risk event, and presents two next steps: "Request a callback" (mailto/phone) and "Continue via chat" (opens AI chat). Does NOT create DB rows, does NOT create quote tables.
- Legal/compliance pages:
  - `src/pages/legal/AcceptableUse.tsx`
  - `src/pages/legal/ComplaintsCode.tsx` (mirrors `/complaints` but as the formal Code of Practice document — link from `Complaints.tsx`)
  - `src/pages/legal/VulnerableCustomers.tsx`
  - `src/pages/legal/Accessibility.tsx`
  - `src/pages/legal/Modern Slavery → ModernSlavery.tsx`
  - `src/pages/legal/CodeOfPractice.tsx`
  - `src/pages/legal/PriceTransparency.tsx` (Ofcom-aligned, no figures — references the Contract Summary)
  - `src/pages/legal/SwitchingPolicy.tsx`
  - `src/pages/legal/NetworkManagement.tsx`
  Each: H1, short body, "Last updated" date pulled from a constant, link back to home and to `/complaints`.

### Routing (`src/App.tsx`)

Add lazy or direct routes for:

```
/broadband/flex                 -> pages/broadband/Flex (already exists)
/broadband/contract-saver       -> pages/broadband/ContractSaver
/switching                      -> pages/Switching
/rewards                        -> pages/Rewards
/quote/start                    -> pages/quote/QuoteStart
/legal/acceptable-use
/legal/complaints-code
/legal/vulnerable-customers
/legal/accessibility
/legal/modern-slavery
/legal/code-of-practice
/legal/price-transparency
/legal/switching-policy
/legal/network-management
```

All added ABOVE the `*` catch-all. No removals.

### Claims cleanup pass (frontend copy only)

Scan and rewrite non-compliant claims on:

- `src/components/home/HeroSection.tsx`
- `src/components/home/CTASection.tsx`
- `src/components/home/WhyUsSection.tsx`
- `src/components/home/ServicesSection.tsx`
- `src/components/home/CustomerLoveSection.tsx`
- `src/pages/Broadband.tsx`, `src/pages/SimPlans.tsx`, `src/pages/Landline.tsx`, `src/pages/Business.tsx`, `src/pages/BusinessOffers.tsx`, `src/pages/NoContractBroadband.tsx`
- `src/components/layout/Footer.tsx` (add legal links)

Replacement rules:

- "Guaranteed 900Mbps" / hard speed claims → "Speeds vary by line — confirmed in your Contract Summary".
- "Free installation worth £60" → "Installation costs confirmed in your Contract Summary".
- "Switch in 60 seconds" / instant-order language on broadband/voice/business → "Get a personalised quote in minutes".
- Hardcoded "£X/mo" hero figures on broadband/voice/business → "From indicative pricing — final price confirmed in your Contract Summary". (SIM page keeps existing copy but routes its CTAs through quote when `simIsQuoteLed`.)
- Any "guaranteed availability" → "We'll check availability for your address".
- Reward amounts in marketing copy → removed; replaced with teaser link to `/rewards`.

Primary CTAs on broadband / voice / business / homepage that previously went to `/checkout`, `/pre-checkout`, `/auth?mode=signup` for purchase → route to `/quote/start?interest=...`. Existing dashboard, login, support, pay-invoice, track-order, admin links are untouched.

SIM page: when `simIsQuoteLed === true` (default), CTA → `/quote/start?interest=sim`; otherwise current flow.

### Pay-gate wiring

- `src/pages/Checkout.tsx`: on mount, build a `CheckoutContext` of kind `new_telecom_sale` from URL/cart state. If `requiresContractSummary(ctx)` and `hasAcceptedContractSummary(ctx)` returns `{accepted:false}`, redirect to `/quote/start?interest=<derived>` with a toast: "We'll confirm your Contract Summary before payment." No change to Worldpay HPP code path.
- `src/pages/BusinessCheckout.tsx`: same gate, kind `new_telecom_sale`, redirect to `/quote/start?interest=business`.
- `src/pages/PayInvoice.tsx` and `src/pages/Pay.tsx`: classify as `legacy_invoice` / `payment_request`, gate returns `false`, untouched flow.
- Worldpay edge functions, webhook, DD mandates, invoice generation: untouched.

### Low-risk activity logging

Wire `logClientEvent` from `src/lib/activityLog.ts` on:

- Hero/CTA primary clicks → `cta_click`
- Postcode check submit → `postcode_check`
- `/quote/start` mount → `quote_start`
- Legal page mount → `legal_view`
- Rewards page mount → `page_view`
No sensitive payloads. Failures swallowed.

### Footer

Add a "Legal & Compliance" column linking to all new `/legal/*` pages, `/complaints`, `/privacy`, `/cookies`, `/terms`. No other footer changes.

### Not in scope (Phase 2)

- `quote_requests`, `quotes`, `contract_summaries`, `contract_acceptances` tables.
- Admin quote builder, margin engine, pricing rules, suppliers, VAT settings UI.
- Rewards values, points ledger, campaign engine, fraud flags.
- Live API mode wiring.
- New supplier integrations, product IDs, real pricing.

### Verification

- Build passes.
- `/`, `/broadband`, `/sim-plans`, `/landline`, `/business`, `/dashboard`, `/admin/overview`, `/pay`, `/pay-invoice`, `/track-order` all still render.
- New routes render placeholder content.
- `/checkout` and `/business-checkout` redirect to `/quote/start` when no accepted CS (which is always in Phase 1, since `hasAcceptedContractSummary` is a stub returning false).
- `/pay-invoice?invoice=INV-...` and `/pay?token=PR-...` are NOT gated.

### Closing summary

After build, post a summary covering: files changed, routes added, pages changed, claims replaced (bullet list of before → after categories), payment/checkout guard changes, untouched areas (Worldpay, DD, invoices, admin, AI chat, SEO pages, dashboard), and any warnings/errors. Then stop. No Phase 2 work.  
  
Please apply these final checks while building:  
  
1. Modern Slavery route/file  
Use file name:  
src/pages/legal/ModernSlavery.tsx  
Route:  
/legal/modern-slavery  
  
2. Complaints Code  
Make sure the Complaints Code uses the 6-week ADR escalation wording, not 8 weeks.  
  
3. Contract Summary wording  
Even though Phase 2 will build the actual Contract Summary system, all public copy should now say:  
“Final price, contract length, fees, speed and key terms will be confirmed in your Contract Summary before you pay.”  
  
4. Quote Start placeholder  
Do not collect full customer data yet in Phase 1. Only collect low-risk intent/postcode/contact-start info locally, and do not create Supabase quote rows until Phase 2.  
  
5. Pay-gate  
Do not block:  
/pay  
/pay-invoice  
legacy invoices  
payment request links  
arrears/manual invoice payments  
  
Only new telecom checkout/order flows should be redirected.  
  
6. Footer  
Add legal links, but do not remove existing footer links.  
  
7. SEO pages  
Do not delete or overwrite existing SEO pages. Only clean risky claims and add safe internal links where needed.  
  
8. Activity logging  
Only log low-risk public actions. No sensitive customer/payment data in client logs.  
  
Continue Phase 1 only. After completion, stop and provide the closing summary.
Continue Phase 2 only — finish the remaining items, but apply these corrections before coding.

Do NOT restart Phase 2.

Do NOT re-run migrations.

Do NOT recreate existing edge functions.

Do NOT touch Worldpay webhook, invoices, DD mandates, AI chat, existing dashboard, SEO pages, /pay or /pay-invoice.

Do NOT start Phase 3.

Use the existing Phase 2 DB schema and edge functions already created.

CORRECTIONS BEFORE BUILDING

1. Quote request status mismatch

The admin screen must use the existing DB enum statuses:

new | assigned | checking | quoted | expired | rejected | converted

Do NOT use:

contacted | won | lost | spam

If needed, map UI labels like:

assigned = assigned/contacted

converted = won

rejected = lost

expired = expired

2. Quotes table field names

Use the fields that exist in the Phase 2 schema:

monthly_net

monthly_vat_rate

monthly_vat_amount

monthly_gross

Do NOT reference non-existing fields like monthly_price_incl_vat unless already present.

For customer email/name in /admin/quotes, join via quote_request_id → quote_requests.email/full_name, or use whatever snapshot fields already exist. Do not assume customer_email_snapshot exists unless it was created.

3. VAT active check

Use the RPC:

supabase.rpc('is_vat_active')

Do not call platform_[settings.is](http://settings.is)_vat_active() as if it is a table method.

4. Token handling

Raw public tokens are not stored. They are only available when created/sent.

So:

- Do not attempt to display raw token links from stored DB rows unless the function returns a link at action time.

- Admin “view tokenised quote link” should either:

  a) show link immediately after Send Quote action, or

  b) offer “resend/regenerate secure link” if needed.

- Do not expose token hashes to the frontend.

5. Quote page to Contract Summary link

Because raw Contract Summary tokens are not stored, /quote/:token should not assume it can reconstruct a CS token.

Safe behaviour:

- If get-quote-by-token returns a valid contract summary link/token, show “View Contract Summary”.

- If not, show:

  “Your Contract Summary is being prepared. We’ll email you once it is ready.”

- Do not fake or derive CS token client-side.

6. Contract Summary acceptance

Acceptance must validate against either:

- customer_email_snapshot on contract_summaries, if it exists, or

- quote_[requests.email](http://requests.email) via quote_id / quote_request_id.

Do not rely on a missing email field.

7. Admin quote builder

Keep it basic:

- create/edit draft quote

- send quote

- generate Contract Summary

- view acceptance status

Do not build:

- pricing rules engine

- supplier catalogue

- margin engine

- VAT settings UI

- finance export

- rewards

- campaign engine

8. Checkout pass-through

For /checkout and /business-checkout:

- If ?quote=<uuid>, check has_accepted_contract_summary RPC.

- If ?cs=<token>, call get-contract-summary-by-token and check status accepted.

- If accepted, allow existing checkout flow.

- If not accepted/missing, redirect to /quote/start.

Do not gate /pay or /pay-invoice.

9. Activity logging

Only log low-risk client events from frontend.

Sensitive logs must remain server-side only.

Do not log full email, full address, full phone, tokens, payment data, card data, or bank details.

10. Scope

Only touch these files unless absolutely necessary:

- src/lib/requireContractSummary.ts

- src/App.tsx

- src/pages/quote/QuoteStart.tsx

- src/pages/Checkout.tsx

- src/pages/BusinessCheckout.tsx

- src/components/admin/layout/AdminLayout.tsx

- create src/pages/admin/QuoteRequests.tsx

- create src/pages/admin/Quotes.tsx

11. Verification

After finishing, test:

- /quote/start renders and submits

- /quote/thank-you renders

- /quote/:token renders through get-quote-by-token

- /quote/contract-summary/:token renders and accepts

- /checkout without accepted CS redirects

- /checkout?quote=<accepted-id> passes

- /checkout?cs=<accepted-token> passes

- /pay and /pay-invoice remain unchanged

- /admin/quote-requests renders

- /admin/quotes renders

- /, /dashboard, /admin/overview, /track-order still render

Stop after Phase 2 and report:

- files changed

- routes added

- admin pages added

- pay-gate changes

- token handling

- what was untouched

- verification result

- warnings/errors

Continue Phase 2 only.  
  
  
  
  
  
  
  
  
  
  
  
  
Phase 2 — Finish Remaining Items

Scope is strictly the open items. No Phase 3, no new migrations, no changes to Worldpay webhook, invoices, DD mandates, AI chat, dashboard, SEO pages, /pay or /pay-invoice.

## 1. Pay-gate — `src/lib/requireContractSummary.ts`

Replace the Phase 1 stub with a real check.

- `CheckoutContext` extended with optional `quoteId`, `contractSummaryId`, `token`.
- `hasAcceptedContractSummary(ctx)`:
  - If `ctx.quoteId` → `supabase.rpc('has_accepted_contract_summary', { _quote_id })`.
  - Else if `ctx.token` → call `get-contract-summary-by-token` edge function (already exists) and check `status === 'accepted'`.
  - Else if `ctx.contractSummaryId` → select `contract_summaries.status` directly.
  - Returns `{ accepted, contractSummaryId }`.
- `requiresContractSummary` unchanged: legacy invoice, payment request, SIM-instant remain exempt.
- Add helper `enforceContractSummaryGate(ctx, navigate, toast)` that redirects to `/quote/start?interest=<derived>` with toast when not accepted, and returns boolean.

## 2. Real Quote Start form — `src/pages/quote/QuoteStart.tsx`

Full rewrite (Phase 1 placeholder removed). Fields:

- service interest (radio: Broadband / SIM / Digital Home Phone / Business / Switching / Not sure) — preselected from `?interest=`
- plan preference (Flex / Contract Saver / Not sure) shown when broadband
- residential or business toggle
- business name (required when business)
- postcode, address line 1, address line 2, town, county
- full name, email, phone
- preferred contact method (email / phone / either)
- current provider (optional), current monthly bill (optional)
- message (optional, max 1000)
- marketing consent checkbox (default off)
- privacy acknowledgement checkbox (required)

Validation with `zod` (already a project dep pattern via existing forms). Submit via `supabase.functions.invoke('submit-quote-request', { body })`. On success → `navigate('/quote/thank-you?ref=' + reference)`. Errors → toast. Only low-risk fields logged via `logClientEvent` (event_type, interest, residential vs business — never PII).

## 3. Routes — `src/App.tsx`

Add imports + routes above catch-all:

- `/quote/thank-you` → `QuoteThankYou`
- `/quote/:token` → `QuoteView`
- `/quote/contract-summary/:token` → `ContractSummaryView`
- `/quote/payment/:token` → `QuotePayment`
- Inside `/admin/*`: `quote-requests` → `AdminQuoteRequests`, `quotes` → `AdminQuotes`

No existing route removed.

## 4. Minimum admin screens

New files:

- `src/pages/admin/QuoteRequests.tsx`
  - Table from `quote_requests` (id, created_at, full_name, email, service_interest, postcode, status, assigned_to).
  - Search by name/email/postcode, status filter (`new | contacted | quoted | won | lost | spam`).
  - Row click → side `Sheet` with detail; buttons: "Mark contacted", "Assign to me", "Create quote" (opens quote draft dialog).
- `src/pages/admin/Quotes.tsx`
  - Table from `quotes` (id, customer email snapshot, plan name, monthly_price_incl_vat, status, expires_at).
  - Create/edit draft dialog: plan name, monthly price (ex VAT), setup fee, term months, notes, customer email/name, link to quote_request_id.
  - Actions per row: Send (invokes `send-quote-email`), Generate Contract Summary (invokes `generate-contract-summary` — disabled with tooltip if `platform_settings.is_vat_active()` indicates VAT incomplete), view tokenised quote link, view Contract Summary link, view printable PDF link (calls `generate-contract-summary-pdf`).
  - Shows acceptance status badge per quote (joins latest contract_summary status).
  - Yellow warning banner if VAT not active (queried once on mount).

Both pages wrapped by existing `AdminLayout`. No new RLS, no new tables. Limited to staff via existing `ProtectedAdminRoute`.

## 5. Admin sidebar

Edit `src/components/admin/layout/AdminLayout.tsx` (or its nav config) to add:

- "Quote Requests" → `/admin/quote-requests`
- "Quotes" → `/admin/quotes`

Existing nav order preserved; inserted in a sensible spot (after Orders).

## 6. Checkout pass-through

Edit `src/pages/Checkout.tsx` and `src/pages/BusinessCheckout.tsx`:

- On mount, read `?cs=<token>` or `?quote=<id>` from URL.
- Build `CheckoutContext { kind: 'new_telecom_sale', quoteId, token }` and run `enforceContractSummaryGate`.
- If not accepted → redirect to `/quote/start?interest=broadband` (or `business`) with toast "Please complete your Contract Summary before paying".
- If accepted → continue to existing Worldpay flow unchanged.
- `/pay`, `/pay-invoice`, `/payment-result` untouched.

## 7. Verification

After build, smoke-test in preview:

- `/quote/start` renders form and POST succeeds (validation works).
- `/quote/thank-you?ref=TEST` renders.
- `/quote/:token`, `/quote/contract-summary/:token`, `/quote/payment/:token` render (token-fetch edge function paths existing).
- `/checkout` with no `cs`/`quote` → redirects to `/quote/start`.
- `/checkout?quote=<accepted-id>` → continues (verified against RPC).
- `/pay` and `/pay-invoice` load unchanged.
- `/admin/quote-requests`, `/admin/quotes` render under AdminLayout.
- `/`, `/dashboard`, `/admin/overview`, `/track-order` still render.

## 8. Final summary

Stop after this and report: files changed, routes added, admin pages added, gate changes, what was already done, what was untouched (Worldpay webhook/HPP, invoices, DD, AI chat, SEO, payment requests, dashboard), verification result, any warnings.

## Files touched

- Edit: `src/lib/requireContractSummary.ts`, `src/App.tsx`, `src/pages/quote/QuoteStart.tsx`, `src/pages/Checkout.tsx`, `src/pages/BusinessCheckout.tsx`, `src/components/admin/layout/AdminLayout.tsx` (nav only).
- Create: `src/pages/admin/QuoteRequests.tsx`, `src/pages/admin/Quotes.tsx`.

No DB migration. No edge function changes. No changes outside the listed files.
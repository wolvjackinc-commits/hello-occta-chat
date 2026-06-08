## Phase 2 Plan — Quote Requests, Quotes & Contract Summary System

Builds the real manual quote-to-contract-to-pay journey on top of Phase 1's pay-gate. No Phase 3 work. Manual mode stays default ON. Legacy `/pay` and `/pay-invoice` remain ungated.

### Database (one migration, RLS + GRANTs in same migration)

Tables created in `public`:

1. `**quote_requests**` — all fields from the brief. `status` enum `quote_request_status`: `new|assigned|checking|quoted|expired|rejected|converted`. `service_interest` enum `service_interest_kind`. `customer_type` enum `customer_type_kind` (`residential|business`). `plan_preference` enum `plan_preference_kind`. `customer_id uuid nullable references profiles(id)`. Defaults: `status='new'`, `source='web'`. Trigger `updated_at`.
2. `**quotes**` — all fields. Enums `plan_type_kind` (`flex|contract_saver`), `margin_status_kind`, `quote_status_kind`. `expires_at timestamptz`. Money columns `numeric(10,2)`. `created_by uuid` (admin). VAT amounts stored alongside net+gross to keep audit clarity. `public_token text unique` (secure random, 32 bytes base64url) for `/quote/:token`. `token_expires_at` mirrors `expires_at`.
3. `**contract_summaries**` — all fields. `version int default 1`. `status` enum `contract_summary_status_kind`. `public_token text unique` for `/quote/contract-summary/:token`. `one_off_charges_json jsonb`. **Immutability trigger** `cs_block_update_if_accepted`: rejects any UPDATE if row's previous `status='accepted'` (only allow `status` transition to `superseded` by service_role).
4. `**contract_acceptances**` — append-only. `BEFORE UPDATE/DELETE` trigger raises exception (except service_role). `accepted_at default now()`. Stores `ip`, `user_agent`, `acceptance_text`, `checkbox_confirmed`.
5. `**quote_events**` — `event_type text`, `details jsonb`, `actor_type`, `actor_id`. Also dual-writes to `activity_log` from the edge functions.

#### RLS policies (using existing helpers)

- `quote_requests`:
  - `SELECT`: customer can read own (`customer_id = auth.uid()`) OR staff (`has_role(auth.uid(),'admin')` OR `is_staff(auth.uid())`).
  - `INSERT`: deny direct from anon/authenticated. Public form goes through `submit-quote-request` edge function (service_role).
  - `UPDATE/DELETE`: staff only.
- `quotes`:
  - `SELECT`: customer reads own; staff reads all. Anonymous token reads go through edge function `get-quote-by-token` (no direct table read for anon).
  - `INSERT/UPDATE/DELETE`: staff only via edge functions.
- `contract_summaries`:
  - `SELECT`: customer own + staff. Token reads via edge function `get-contract-summary-by-token`.
  - `INSERT`: staff via edge functions.
  - `UPDATE`: blocked entirely by immutability trigger except service_role transitions allowed by trigger.
- `contract_acceptances`:
  - `SELECT`: staff + customer own.
  - `INSERT`: via `accept-contract-summary` (service_role).
  - `UPDATE/DELETE`: blocked by trigger.
- `quote_events`:
  - `SELECT`: staff + customer own (joined via quote_request_id).
  - `INSERT`: service_role only.

GRANTs: `SELECT, INSERT, UPDATE, DELETE … TO authenticated`, `ALL … TO service_role`. No `anon` grants — all anon access goes through edge functions.

#### Security-definer helpers

- `public.get_quote_by_token(_token text)` — returns quote + safe summary fields.
- `public.get_contract_summary_by_token(_token text)` — returns CS row.
- `public.has_accepted_contract_summary(_quote_id uuid)` — returns boolean (used by checkout pay-gate query through `requireContractSummary`).
- `public.expire_old_quotes()` — sets status=`expired` where `expires_at < now()` and status in (`draft`,`sent`,`viewed`). Called via cron (not scheduled in this phase; runnable manually).

All `SECURITY DEFINER` set `search_path = public`.

### Edge functions

All under `supabase/functions/`, CORS via `npm:@supabase/supabase-js@2/cors`, Zod input validation, service-role client for writes:

1. `**submit-quote-request**` — public. Zod schema (email, UK postcode regex, phone length, max lengths, marketing_consent bool). Rate-limit by IP+email via existing `check_rate_limit('quote_submit',5,60)`. Inserts row, calls `log_event('public','quote_request_submitted',…)`. Triggers `admin-notify` edge function with a minimal internal email. Returns `{ok:true, reference}`. No PII echoed back beyond reference.
2. `**create-quote**` — admin only (verify JWT + `has_role` admin/sales_agent). Inputs all pricing fields. Computes VAT amounts and gross from `platform_settings.vat_default_rate` only if `is_vat_active()`; otherwise stores `monthly_vat_amount=0` and flags `vat_inactive=true` in `admin_notes`. Generates `public_token` (32-byte random). Marks quote `status='draft'`. Logs `quote_created`.
3. `**send-quote-email**` — admin only. Validates required fields (`monthly_gross`, `expires_at`, `contract_length_months` for contract_saver). Sets status `sent`. Sends customer email via Resend (existing) with `/quote/<token>` link. Email copy includes "final terms confirmed in your Contract Summary before you pay." Logs `quote_sent`.
4. `**generate-contract-summary**` — admin/system. Builds CS from quote. Pulls boilerplate (`price_rise_policy`, `complaints_adr_info`, `digital_voice_warning` for voice services, `vulnerable_customer_note`) from a `legal_text_versions` constants file in `supabase/functions/_shared/legalText.ts` (no new table needed). Versioning: if a CS already exists for this quote, increments `version`, supersedes previous (only if previous status != `accepted`; if previous `accepted`, refuses with "create new quote"). Generates own `public_token`. Status `issued`. Logs `contract_summary_generated`.
5. `**accept-contract-summary**` — public token. Validates token. Requires JSON body `{checkbox_confirmed:true, accepted_by_name, accepted_by_email}` matching CS email. Captures IP (`x-forwarded-for`) and UA. Inserts `contract_acceptances`, updates `contract_summaries.status='accepted'`, `quotes.status='accepted'`. Logs `contract_summary_accepted`. Returns `{ok:true, paymentEligible:true, quoteId}`.
6. `**generate-contract-summary-pdf**` — uses existing server-side `jsPDF` pattern (mirrors `lib/generateInvoicePdf.ts`). Returns PDF binary (or signed Storage URL). All CS fields included plus legal text + acceptance signature block if accepted. Stores `pdf_url` on the CS row when uploaded to `user-files` bucket. Phase 2 ships a working printable HTML route as fallback if PDF generation hits issues.
7. `**get-quote-by-token**` / `**get-contract-summary-by-token**` — public read-only. Bumps `viewed` status the first time. Logs `quote_viewed` / `contract_summary_viewed`. Returns only safe fields.

### Email templates (app emails / brutalist)

Under `supabase/functions/_shared/transactional-email-templates/`:

- `quote-request-received.tsx`
- `quote-ready.tsx` (with Contract Summary link)
- `contract-summary-accepted.tsx` (next-step payment info)
- `quote-expired.tsx`
- Internal: `admin-new-quote-request.tsx` sent to `hello@occta.co.uk`

Registry updated. Deploy `send-transactional-email`. Wording uses the compliance copy from the brief.

### Frontend pages

- `**/quote/start**` — replaces Phase 1 placeholder. Multi-step (single page, sectioned): service interest, postcode/address (4 lines + town/county), plan preference (Flex / Contract Saver / Not sure), residential vs business (+ business name if business), contact (name/email/phone, preferred contact), optional current provider + monthly bill, message, marketing consent + Privacy acknowledgement. Zod validation client-side + server-side. Submit → `submit-quote-request` → navigate `/quote/thank-you?ref=<reference>`.
- `**/quote/thank-you**` — confirmation copy from brief.
- `**/quote/:token**` — fetch via `get-quote-by-token`. Displays plan name, monthly (residential incl VAT / business ex+incl VAT), one-off charges table, contract length, expiry countdown, "View Contract Summary" CTA → `/quote/contract-summary/<cs_token>`. Shows reject button (optional).
- `**/quote/contract-summary/:token**` — full CS render with all fields, mandatory checkbox + acceptance text from brief, name/email confirmation. On accept → calls edge function → routes to payment step. Digital voice services show the warning block verbatim.
- `**/quote/payment/:token**` — minimal post-acceptance landing: "Payment link will be sent / proceed to payment" with button to existing Worldpay flow (using `/pay?token=…` when admin issues a payment request, OR if Phase 2 wires a direct flow, calls existing `worldpay-payment` edge function with quoteId + accepted CS id).

### Pay-gate update

- Update `src/lib/requireContractSummary.ts.hasAcceptedContractSummary`:
  - Real implementation queries `contract_summaries` via `has_accepted_contract_summary(quote_id)` RPC.
  - Reads quote/cs id from URL (`?quote=` or `?cs=`) or `localStorage`.
- `/checkout` and `/business-checkout`: read accepted CS context from `?cs=<token>` or `?quote=<id>`; if missing, redirect to `/quote/start` (existing Phase 1 behaviour preserved).
- `/pay` and `/pay-invoice` remain ungated (Phase 1 rule).
- New behaviour: when an accepted CS exists, gate passes and existing checkout/Worldpay flow runs unmodified.

### Minimum admin screens

- `**/admin/quote-requests**` — table with status filter, search, assign-to-me, open detail drawer. Detail shows full request + "Convert to quote" button → opens quote builder dialog.
- `**/admin/quotes**` — table; create new quote (links to a request), edit draft, "Send to customer", "Generate Contract Summary", view acceptance status, see issued CS PDF link. Quote builder dialog has all pricing inputs (net), live-computes VAT + gross using `platform_settings.vat_default_rate`. Shows VAT-inactive warning banner if `is_vat_active()=false`.
- **Overview**: add four small queue cards reusing existing `QueueSkeleton` pattern: New Quote Requests, Quotes Sent (awaiting acceptance), Contract Summaries Accepted (last 7d), Quotes Needing Action (sent + viewed + nearing expiry).

Both new admin routes added under existing `AdminLayout`. Roles allowed: `admin`, `super_admin`, `sales_agent`.

### Activity logging

Server-side via `log_event(…)`:
`quote_request_submitted, quote_created, quote_sent, quote_viewed, contract_summary_generated, contract_summary_viewed, contract_summary_accepted, quote_expired, quote_rejected, payment_gate_passed, payment_gate_blocked`.

Client-side (`logClientEvent`) only adds existing low-risk events (`quote_start`, `cta_click`, `legal_view`, `page_view`). Pay-gate pass/block events are logged server-side from the `worldpay-payment` function (small additive check) — no PII in payload.

### VAT logic

- `usePlatformSettings.vatActive` used to drive admin warning banner on `/admin/quotes` and `/admin/settings` (if not already).
- Customer-facing residential view: monthly_price_incl_vat only.
- Customer-facing business view: monthly_net (ex VAT) + VAT line + monthly_incl_vat.
- VAT-inactive: customer-facing pages show "VAT to be confirmed" footnote rather than a VAT figure; Contract Summary blocks issuance entirely until VAT is set (admin sees a clear error).

### Compliance copy (centralised)

New `src/lib/legal/contractSummaryCopy.ts` and matching `supabase/functions/_shared/legalText.ts` exporting:

- `CONTRACT_SUMMARY_PROMISE_TEXT` ("Your final price, speed estimate, contract length, one-off charges, installation details, cancellation/cease charges and key terms will be confirmed in your Contract Summary before you pay.")
- `DIGITAL_VOICE_WARNING_TEXT` (verbatim from brief)
- `ACCEPTANCE_CHECKBOX_TEXT` (verbatim from brief)
- `COMPLAINTS_ADR_INFO_TEXT` (6-week ADR reference)
Used on `/quote/start`, `/quote/:token`, `/quote/contract-summary/:token`, and the CS PDF.

### Not in scope (Phase 3+)

- Pricing rules engine, supplier catalogue UI, admin VAT settings UI, rewards activation, campaign engine, finance/VAT export, audit-log centre, complaints workflow, communication centre, AI KB, SEO landing expansion, full customer dashboard expansion beyond linking accepted CS into existing "My Orders".
- Automatic supplier order submission. Admins issue payment links / use existing Worldpay path manually.
- pg_cron schedule for `expire_old_quotes` (function exists, scheduling deferred).

### Verification

- Build passes. Existing flows untouched: `/`, `/dashboard`, `/admin/overview`, `/pay`, `/pay-invoice`, `/track-order`, Worldpay HPP, DD mandates, invoices, AI chat, SEO pages.
- New flows:
  - Submit `/quote/start` → row in `quote_requests`, admin email fires, customer email fires, `/quote/thank-you` renders.
  - Admin creates quote → `quotes` row with token → `send-quote-email` → `/quote/<token>` renders.
  - Admin generates CS → `/quote/contract-summary/<token>` renders → checkbox accept → `contract_acceptances` row → CS immutable.
  - `/checkout?cs=<token>` passes pay-gate; without it, redirects to `/quote/start`.
- Linter run after migration; immutability triggers verified by attempted UPDATE.

### Stop point

After Phase 2 completes, post summary: tables added, functions added, routes/pages added, admin pages added, checkout/pay-gate changes, RLS/policy summary, activity logs added, what was not touched, warnings/errors. Then stop — no Phase 3 until approved.  
  
Approved to start Phase 2 only, but apply these final corrections before building.

1. Token security correction

Do not store raw public tokens in quotes or contract_summaries.

Instead use:

- public_token_hash

- token_expires_at

Generate the raw token once, send it in the email/link, but store only SHA-256 hash in Supabase. Lookup functions should hash the incoming token and compare against token_hash.

This must follow our existing token-hash rule.

2. /quote/payment/:token safety

Do not directly create or trigger Worldpay payment from the quote token unless the accepted Contract Summary is verified server-side first.

Safe Phase 2 behaviour:

- After CS acceptance, show “Payment link will be sent” OR let admin issue the existing payment request link.

- If direct payment is wired, the server must verify:

  - quote exists

  - contract summary is accepted

  - quote status is accepted

  - token is valid and not expired

  - payment has not already been made

3. Contract Summary email matching

The plan says acceptance email must match CS email, but contract_summaries table does not include email.

Fix by either:

- validating against quote_[request.email](http://request.email) through quote_id / quote_request_id, or

- storing customer_email_snapshot on contract_summaries.

Use a snapshot so the accepted record is clear and auditable.

4. Accepted Contract Summary immutability

Accepted contract summaries must be fully immutable.

Do not allow editing accepted records.

If a quote changes after acceptance, create a new quote and new Contract Summary version.

Only allow status change to superseded through a controlled service/admin function with audit reason.

5. VAT inactive rule

Because OCCTA is VAT registered, Contract Summary issuance should be blocked if VAT number/effective date are missing in platform_settings.

Admin should see:

“VAT settings incomplete. Enter VAT number and effective date before issuing Contract Summary or VAT invoice.”

6. Legacy payments remain untouched

Do not block:

- /pay

- /pay-invoice

- arrears

- old invoices

- payment request links

- manual invoice payments

Only new telecom sales/orders need accepted Contract Summary.

7. Public edge functions

Public functions may be JWT optional only for:

- submit-quote-request

- get-quote-by-token

- get-contract-summary-by-token

- accept-contract-summary

Admin functions must verify JWT and role:

- create-quote

- send-quote-email

- generate-contract-summary

- generate-contract-summary-pdf if admin-only

8. Rate limiting

Apply rate limits to:

- submit-quote-request

- get-quote-by-token

- get-contract-summary-by-token

- accept-contract-summary

This protects public token links from abuse.

9. PII and logs

Do not log sensitive personal data inside activity_log details JSON.

Allowed:

- quote id

- status

- event type

- masked email

- last 3 postcode characters if needed

- actor type

Do not log:

- full address

- full phone

- full email body

- payment details

- tokens

- bank/card details

10. Admin quote builder

Phase 2 admin quote builder should be basic only.

Do not build full pricing rules, supplier catalogue, margin engine or finance export yet. Those are Phase 3+.

11. Customer access

If customer is not logged in, quote/contract summary access must work only by secure token link.

If logged in, customers can only see rows linked to their own customer_id.

12. Existing project safety

Do not touch Worldpay webhook, invoice generation, DD mandates, AI chat, existing dashboard, existing admin payment tools or SEO pages except where explicitly needed for Phase 2 routing/gates.

Start Phase 2 only. After completion, stop and summarise:

- tables added

- functions added

- routes/pages added

- admin pages added

- RLS/policies

- token handling

- checkout/pay-gate changes

- what was not touched

- warnings/errors
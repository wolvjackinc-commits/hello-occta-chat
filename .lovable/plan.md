Approved — proceed with OCCTA Phase D: Contract Summary Generation + PDF Acceptance Vault, with the corrections below.

This is Phase D only.

Do not start payments.  
Do not start Phase 7.  
Do not create orders.  
Do not create supplier orders.  
Do not create invoices.  
Do not create DD mandates.  
Do not activate services.  
Do not touch Worldpay, /pay, /pay-invoice, supplier ordering, billing automation, rewards, campaigns, complaints, finance exports or AI chat.

Current verified state:

- Phase B complete.
- Phase C complete.
- Corrected approved quote exists: QT-2606-f1dd8a69.
- quote_[request.final](http://request.final)_quote_id points to the corrected approved quote.
- Retail floor and margin guard are enforced.
- Customer quote data is exposed only through safe RPCs.
- No downstream artefacts have been created.

Critical correction 1 — PDF signed URLs

Do not store an expiring signed URL as a permanent source of truth.

Store permanently:

- pdf_storage_key
- pdf_sha256
- pdf_generated_at
- pdf_generated_by
- contract_summary_id
- quote_id
- quote_request_id
- customer_id
- account_number
- version
- terms_version
- privacy_version

Generate a fresh signed download URL only when customer/admin clicks “Download PDF”.

If keeping existing `pdf_url`, treat it as temporary/cache only. It must not be the legal record.

Acceptance snapshot should store:

- pdf_storage_key
- pdf_sha256
- cs_version
- terms_version
- privacy_version

Do not rely on expired signed URLs as evidence.

Critical correction 2 — customer acceptance identity

The preferred acceptance path is authenticated customer acceptance from dashboard:

/dashboard/contract/:csId

Acceptance must be tied to:

- auth.uid()
- customer_id
- account_number
- contract_summary_id
- quote_id
- quote_request_id

Token route may be used for viewing/review only if needed, but do not allow weak anonymous acceptance unless it is already secured and explicitly records verified identity.

If token acceptance remains supported:

- verify token hash
- do not expose public_token_hash
- capture name/email/IP/user agent
- prevent duplicate acceptance
- return only safe fields
- do not redirect to payment

Preferred:  
Customer signs in → reviews CS → downloads PDF → accepts.

Critical correction 3 — no payment redirect

After acceptance, never redirect to:  
/quote/payment/:token  
/pay  
/pay-invoice  
checkout  
Worldpay

Use:

- /dashboard?tab=contract  
or
- /quote/contract-summary/:token/accepted

Customer success copy:  
“Contract Summary accepted. We’ll contact you with payment and setup instructions.”

No payment button in Phase D.

Critical correction 4 — storage bucket creation

Create the private `contract-pdfs` bucket using the correct Supabase-supported method for this project.

Do not use invalid SQL or pseudo syntax.

Required:

- private bucket
- service role writes
- customer can only access their own PDF via controlled signed URL function
- staff can access relevant PDFs
- no public bucket
- no anonymous list access
- no direct public PDF URLs

Critical correction 5 — Contract Summary must come only from approved final quote

generate-contract-summary must enforce:

- quote.status = approved
- quote_request.status = final_quote_ready
- quote_[request.final](http://request.final)_quote_id = [quote.id](http://quote.id)
- quote.customer_id is not null
- customer/account exists
- quote is not rejected/expired/cancelled
- no existing accepted CS for that quote unless creating a superseding CS through a controlled path
- VAT guard remains intact if VAT is required

If any check fails:

- return 409 with clear error
- do not create CS
- do not create PDF
- do not change statuses

Critical correction 6 — customer-safe CS payload

Contract Summary customer payload and PDF must never include:

- supplier name
- Giacom
- supplier_product_id
- supplier_reference
- supplier cost
- wholesale cost
- margin
- margin_status
- admin notes
- override reason
- internal product IDs
- ratecard/source document

Contract Summary may include only customer-facing service and pricing data.

Critical correction 7 — PDF immutability

Once a Contract Summary is accepted:

- PDF must not be regenerated or overwritten
- same pdf_storage_key and hash must remain
- re-download should generate a fresh signed URL to the same stored PDF
- any changed quote or terms require a new Contract Summary version
- old CS/PDF remains stored for audit

Critical correction 8 — acceptance vault

contract_acceptances must capture:

- contract_summary_id
- quote_id
- quote_request_id
- customer_id
- account_number
- accepted_by user_id
- accepted_at
- IP address
- user agent
- acceptance checkbox value
- exact acceptance text shown
- acceptance text version/hash
- terms_version
- privacy_version
- cs_version
- pdf_storage_key
- pdf_sha256
- audit event reference if available

Acceptance record must be append-only / immutable.

Second acceptance attempt:

- do not create duplicate row
- return already_accepted
- show existing acceptance receipt

Critical correction 9 — statuses

Use clear Phase-D statuses:

quote_request:

- contract_summary_generated
- contract_summary_accepted

quote:

- contract_summary_generated
- contract_summary_accepted

contract_summary:

- generated / issued
- viewed
- accepted
- superseded
- expired

Do not use:

- converted
- paid
- order_created
- active
- accepted meaning contract/order/payment

Critical correction 10 — dashboard CTA logic

Customer dashboard should show:

Before CS generation:

- Final quote ready
- Contract Summary will follow

After CS generation:

- Review Contract Summary

After acceptance:

- Accepted ✓
- Download PDF
- We’ll contact you with payment and setup instructions

No payment button.  
No place order button.  
No supplier order button.

Phase D approved build:

1. Audit current CS implementation  
Report what exists and what is reused:

- contract_summaries
- contract_acceptances
- generate-contract-summary
- generate-contract-summary-pdf
- accept-contract-summary
- get-contract-summary-by-token
- dashboard tabs
- admin Quotes page
- storage buckets
- RLS

2. Migration  
Add:

- quote_request_status: contract_summary_generated, contract_summary_accepted
- quote_status_kind: contract_summary_generated, contract_summary_accepted
- contract_acceptances snapshot columns
- contract_summaries PDF metadata columns
- safe customer CS RPCs
- acceptance RPC/edge wrapper for authenticated customer
- storage policies/bucket setup using supported Supabase method

3. Generate Contract Summary  
From approved quote only:

- QT-2606-f1dd8a69
- approved quote
- final_quote_ready quote_request
- final_quote_id match
- customer linked

Generate CS record.  
Generate/store PDF.  
Update statuses:

- quote.status = contract_summary_generated
- quote_request.status = contract_summary_generated
- contract_summary.status = issued/generated

4. Customer review page  
Create authenticated route:  
/dashboard/contract/:csId

Customer can:

- view CS
- download PDF
- accept with checkbox

Customer cannot:

- pay
- place order
- trigger supplier order

5. Acceptance  
Acceptance writes immutable vault record.  
Updates:

- contract_summary.status = accepted
- quote.status = contract_summary_accepted
- quote_request.status = contract_summary_accepted

Does not create:

- order
- supplier order
- payment link
- invoice
- DD mandate
- active service

6. Admin visibility  
Admin can see:

- CS generated
- CS viewed
- CS accepted
- accepted_at
- accepted_by
- IP/user agent summary
- PDF download
- audit events

Admin cannot edit accepted CS/acceptance.

7. Verification tests

Test A — generate CS:  
Use approved quote QT-2606-f1dd8a69.  
Expected:

- CS row created
- PDF stored
- storage key/hash written
- quote + quote_request statuses updated to contract_summary_generated
- no downstream artefacts

Test B — customer review:  
Sign in as linked customer.  
Open dashboard CS page.  
Expected:

- safe customer fields only
- PDF download works
- network payload contains no supplier/cost/margin/internal data

Test C — accept:  
Tick checkbox and accept.  
Expected:

- acceptance row created
- accepted_at/IP/UA/text/version/terms/pdf hash captured
- statuses become contract_summary_accepted
- second accept returns already_accepted
- no duplicate row

Test D — immutability:  
Try editing accepted CS or acceptance.  
Expected:

- blocked
- old PDF unchanged
- PDF re-download uses same stored file/key/hash

Test E — wrong user:  
Wrong customer cannot:

- view CS
- download PDF
- accept CS

Test F — anonymous:  
Anon cannot:

- list CS
- download private PDF
- accept CS

Token route, if used, exposes only safe fields.

Test G — downstream:  
Confirm zero new:

- orders
- guest_orders
- payment_requests
- invoices
- dd_mandates
- services
- supplier orders

8. Build checks  
Run:

- TypeScript
- production build
- redeploy required edge functions

9. Final report  
Stop after Phase D and report:

- audit findings
- files changed
- migrations added
- storage bucket/policy result
- Contract Summary generation result
- PDF generation/storage/hash result
- customer dashboard CS review result
- PDF download result
- acceptance vault result
- duplicate acceptance result
- immutability result
- admin visibility result
- RLS/security result
- network payload safety result
- no downstream artefacts confirmation
- TypeScript/build result
- what was untouched
- remaining blockers before payment/DD phase  
  
  
Phase D — Contract Summary Generation + PDF Acceptance Vault

Scope: Phase D only. No payments, orders, supplier orders, invoices, DD mandates, or service activation. Builds on Phase C (approved final quote with retail floor + margin guard).

### Part 1 — Audit findings (what's already there)

**Database (reuse):**

- `contract_summaries` — full schema with `cs_number`, `version`, `status` (draft/issued/viewed/accepted/superseded/expired), `public_token_hash`, `accepted_at/ip/ua`, `pdf_url` (currently always NULL), `terms_version`, `privacy_version`. RLS: customer reads own, staff reads/updates, `cs_block_update_if_accepted` trigger enforces immutability + only allows accepted→superseded by service role.
- `contract_acceptances` — captures email, name, ip, ua, acceptance_text, checkbox. Append-only via `ca_block_mutations` triggers on UPDATE/DELETE. **Missing:** terms_version, privacy_version, cs_version, pdf_url snapshots.
- `quote_request_status` enum has `final_quote_ready` and `converted` but **no `contract_summary_generated` / `contract_summary_accepted**` states.
- `quote_status_kind` enum has `approved` and `accepted` but **no `contract_summary_generated**` state.
- Storage: `user-files` bucket (private) exists; `email-assets` (public). **No `contract-pdfs` bucket and no storage.objects policies for contract PDFs.**

**Edge functions (reuse, patch):**

- `generate-contract-summary` — works but enforces only VAT-active + Build-Plan re-verify. **Missing guards:** quote.status=`approved`, quote_request.status=`final_quote_ready`, `quote_request.final_quote_id = quote_id`, customer_id present.
- `generate-contract-summary-pdf` — returns HTML only, never produces a real PDF, never stores anything, never writes `pdf_url`.
- `accept-contract-summary` — works but writes `quote_request.status='converted'` (Phase 7 wording) instead of `contract_summary_accepted`, and `quote.status='accepted'` instead of `contract_summary_accepted`. Doesn't snapshot terms/cs versions or pdf_url into the acceptance row. Redirects to `/quote/payment/:token` (a payment path) — must be removed for Phase D.
- `get-contract-summary-by-token` — fine; transitions issued→viewed.

**Frontend:**

- `ContractSummaryView.tsx` at `/quote/contract-summary/:token` — token-based public review/accept flow. Calls `navigate('/quote/payment/${token}')` on accept (must redirect to a Phase-D-safe "thanks, we'll be in touch" screen instead).
- `ContractSummariesTab.tsx` — dashboard tab queries `pdf_url` (always null), no auth-route review CTA, no fallback when PDF missing.
- Admin `Quotes.tsx` — has Generate CS / Generate CS PDF actions. PDF button currently opens HTML.
- **Missing:** "Review Contract Summary" CTA in dashboard QuotesTab / QuoteRequestsTab; authed customer route (no token needed) for a logged-in customer to review their own CS; Phase-D-safe acceptance success screen.

**Network payload safety:** `get-contract-summary-by-token` returns `select("*")` from `contract_summaries`. Stored columns are all customer-safe (no supplier name, cost, margin, supplier_product_id, admin notes) — confirmed by schema. Safe.

### Part 2 — Build steps

**Step 1 — Migration: enums, acceptance vault columns, storage bucket, policies**

- Add enum values: `quote_request_status` → `contract_summary_generated`, `contract_summary_accepted`. `quote_status_kind` → `contract_summary_generated`, `contract_summary_accepted`.
- `contract_acceptances`: add `terms_version text`, `privacy_version text`, `cs_version int`, `cs_pdf_url text`, `quote_request_id uuid` (nullable, snapshot from CS at acceptance time). Append-only triggers already cover them.
- `contract_summaries`: add `pdf_storage_key text`, `pdf_sha256 text`, `pdf_generated_at timestamptz`, `pdf_generated_by uuid`. (Keep existing `pdf_url` for the dashboard link — will hold a signed URL or empty.)
- Create private storage bucket `contract-pdfs` via `supabase--storage_create_bucket` (not SQL).
- RLS policies on `storage.objects` for `contract-pdfs`:
  - Customer can SELECT a file whose path starts with their own `customer_id/...` (lookup via `contract_summaries.customer_id = auth.uid()` for that key).
  - Staff (`is_staff(auth.uid())`) can SELECT all.
  - Only service_role writes/deletes.
- New RPC `get_customer_contract_summary_by_id(_id uuid)` — SECURITY DEFINER, returns the safe column subset for `customer_id = auth.uid()`. Used by the authed dashboard review route to avoid leaking the `public_token_hash` column from a direct `select *`.
- New RPC `get_customer_contract_summary_acceptance(_cs_id uuid)` — returns the single acceptance row for that CS when `customer_id = auth.uid()`.

**Step 2 — Patch `generate-contract-summary` edge function**

- Add hard guards (return 409 with clear `error` code):
  - `quote.status === 'approved'`
  - `quote_request.status === 'final_quote_ready'` (or already `contract_summary_generated` when regenerating before acceptance)
  - `quote_request.final_quote_id === quote.id`
  - `quote.customer_id` non-null
- Keep VAT-active guard. Keep "previous accepted ⇒ blocked" check. Keep version+supersede logic.
- After CS row inserted: flip `quotes.status` → `contract_summary_generated`, `quote_requests.status` → `contract_summary_generated`.
- Synchronously invoke the new PDF builder (Step 3) so the row gets a `pdf_url` + storage key before returning. If PDF fails, leave CS row and return ok with `pdf_pending: true`; admin can re-trigger.

**Step 3 — Real PDF generation + storage (replace `generate-contract-summary-pdf`)**

- Use Deno `npm:jspdf` (already standard in this project per `mem://infrastructure/server-side-pdf-parity`) to render a single canonical Contract Summary PDF that mirrors the customer-facing view.
- Inputs: `{ contract_summary_id }` (admin/staff) OR `{ token }` (customer). For customer use: verify token hash and rate limit; for admin: `requireStaff`.
- If PDF already exists for the CS (`pdf_storage_key` set), return the existing signed URL (immutability — never regenerate after acceptance).
- Storage key pattern: `${customer_id}/${cs_id}/v${version}.pdf` in `contract-pdfs`. Compute SHA-256, store `pdf_storage_key`, `pdf_sha256`, `pdf_generated_at`, `pdf_generated_by`. Create a long-lived signed URL (e.g. 7 days) and put it in `pdf_url`.
- Response: `{ ok, signed_url, pdf_sha256, expires_at }`.

**Step 4 — Patch `accept-contract-summary**`

- After insert into `contract_acceptances`, also write `terms_version`, `privacy_version`, `cs_version`, `cs_pdf_url`, `quote_request_id` snapshots.
- Set `contract_summaries.status='accepted'` as today (trigger allows it).
- Change downstream status writes:
  - `quotes.status` → `contract_summary_accepted` (not `accepted`).
  - `quote_requests.status` → `contract_summary_accepted` (not `converted`).
- Keep the audit log + quote_events + customer email + internal email.
- **Do not** create order, payment_request, invoice, DD mandate or service. Confirmed by reading current code — none of those side-effects exist; we just replace the status labels.
- Return `{ ok, next_url: '/dashboard?tab=contract' }` instead of redirecting to a payment route. `ContractSummaryView` will use this for navigation.

**Step 5 — Authed customer review route + dashboard CTAs**

- New route `/dashboard/contract/:csId` rendering `<ContractSummaryAuthedView />` — uses the new `get_customer_contract_summary_by_id` RPC, displays the same CS layout as `ContractSummaryView`, plus a "Download PDF" button that calls `generate-contract-summary-pdf` (customer side authenticates via supabase session; the function checks `customer_id = auth.uid()` before signing the URL).
- Acceptance from this view calls a new RPC `customer_accept_contract_summary(_cs_id, _ua, _checkbox)` — wraps the same writes as the edge function but server-side with auth.uid() identity, no token needed. Captures IP via `request.headers->>x-forwarded-for` proxied through an edge wrapper `accept-contract-summary-authed`.
- Dashboard `QuoteRequestsTab` / `QuotesTab`: when `quote_request.status` ∈ {`contract_summary_generated`, `contract_summary_accepted`} and CS row exists for `customer_id`, show "Review Contract Summary" button linking to `/dashboard/contract/:csId`. After acceptance show "Accepted ✓ · Download PDF" only.
- `ContractSummariesTab`: replace `pdf_url` direct anchor with a button that calls `generate-contract-summary-pdf` on click to get a fresh signed URL.

**Step 6 — Phase-D-safe acceptance success screen**

- `ContractSummaryView` (token flow): on accept success, navigate to `/quote/contract-summary/:token/accepted` showing:
  - "Contract Summary accepted ✓"
  - CS number, accepted timestamp
  - "Download PDF" button
  - Copy: "We'll contact you with payment and setup instructions."
- No payment button, no order button, no supplier action.

**Step 7 — Admin visibility**

- In `admin/Quotes.tsx` CS row: show status with labels `not generated / generated / sent / viewed / accepted` plus `accepted_at`, `accepted_by_name`. Add a "Download PDF" link (always-valid via re-sign). Show "Accepted — locked" badge.
- Show acceptance record (ip, ua truncated, accepted_at, terms_version, cs_version) in a small admin-only sub-panel for accepted CS rows.
- Admin cannot edit accepted CS or acceptance row — already enforced by triggers; UI just hides edit affordances.

**Step 8 — Verification (Phase D tests)**

- Test A — Generate from `QT-2606-f1dd8a69`: invoke `generate-contract-summary`, expect CS row v1 + PDF storage key + quote.status `contract_summary_generated` + quote_request.status `contract_summary_generated`.
- Test B — Customer view: sign-in as `02643ff3-3562-439d-83cb-c64c3fbec155`, open `/dashboard/contract/:csId`, confirm safe fields only (no supplier_name/cost/margin/admin_notes/supplier_product_id present in network payload), download PDF.
- Test C — Acceptance via authed route: tick checkbox, accept; check `contract_acceptances` row has ip, ua, terms_version, cs_version, cs_pdf_url; CS status `accepted`; quote and quote_request statuses `contract_summary_accepted`; second accept attempt returns `already_accepted` without duplicating.
- Test D — Immutability: try updating accepted CS core fields (expect trigger error); try UPDATE/DELETE on `contract_acceptances` (expect `ca_block_mutations` error); re-running `generate-contract-summary-pdf` returns the existing storage key, doesn't overwrite.
- Test E — Wrong user: sign in as a different customer, attempt `get_customer_contract_summary_by_id` (returns 0 rows); attempt PDF download (function returns 403); attempt accept RPC (returns 403).
- Test F — Anonymous: anon cannot SELECT `contract_summaries` (RLS); token route exposes only safe columns (already stripped `public_token_hash` in response).
- Test G — Downstream artefacts: confirm zero rows added in `orders`, `payment_requests`, `invoices`, `dd_mandates`, `services`, supplier order tables during the full walkthrough.

**Step 9 — Build checks**

- TypeScript compile (auto via harness) + Vite production build.
- Re-deploy edge functions: `generate-contract-summary`, `generate-contract-summary-pdf`, `accept-contract-summary`, `accept-contract-summary-authed` (new).

### What stays untouched

Worldpay, `/pay`, `/pay-invoice`, supplier ordering, billing automation, rewards, campaigns, complaints, finance exports, AI chat, invoices, DD mandates, services, orders.

### Remaining blockers after Phase D (for the next phase)

- Phase 7 / payments: no payment link is generated on acceptance — that is intentional and the next phase's work.
- Supplier ordering and service activation still need to be wired off `contract_summary_accepted` in the following phase.

### Technical reference

- New migration adds: 4 enum values, 5 new `contract_acceptances` columns, 4 new `contract_summaries` columns, 2 new SECURITY DEFINER RPCs (`get_customer_contract_summary_by_id`, `get_customer_contract_summary_acceptance`, `customer_accept_contract_summary`), and storage.objects RLS for the new `contract-pdfs` bucket.
- New/changed files (expected):
  - `supabase/functions/generate-contract-summary/index.ts` (guards + status writes + PDF kickoff)
  - `supabase/functions/generate-contract-summary-pdf/index.ts` (real jsPDF + storage upload + signed URL)
  - `supabase/functions/accept-contract-summary/index.ts` (vault snapshots + status labels + no-payment redirect)
  - `supabase/functions/accept-contract-summary-authed/index.ts` (new, session-based)
  - `src/pages/dashboard/ContractSummaryAuthedView.tsx` (new)
  - `src/pages/quote/ContractSummaryAccepted.tsx` (new success screen)
  - `src/pages/quote/ContractSummaryView.tsx` (redirect target swap)
  - `src/components/dashboard/tabs/ContractSummariesTab.tsx` (signed URL via function call)
  - `src/components/dashboard/tabs/QuotesTab.tsx`, `QuoteRequestsTab.tsx` (Review CS CTA)
  - `src/pages/admin/Quotes.tsx` (accepted vault sub-panel + PDF re-sign)
  - `src/App.tsx` (new routes)
  - `src/integrations/supabase/types.ts` (regenerated by migration)
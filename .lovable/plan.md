Approved — proceed with Phase 7 / Phase E: Payment Readiness After Contract Summary Acceptance, with the corrections below.

This phase is payment readiness only.

Do not create supplier orders.  
Do not activate services.  
Do not create live telecom orders.  
Do not create DD mandates.  
Do not create services.  
Do not trigger provisioning.  
Do not touch supplier ordering, service activation, billing automation, rewards, campaigns, complaints, finance exports or AI chat.

Keep `/pay-invoice` and the legacy `worldpay-payment` invoice flow untouched unless a bug is found directly related to this phase.

Current verified state:

- Phase B complete.
- Phase C complete.
- Phase D fully closed.
- Contract Summary is generated, PDF stored, accepted, immutable, and customer acceptance is recorded.
- Accepted PDF cannot be overwritten.
- No downstream order/payment/invoice/DD/service/supplier-order artefacts were created.

Build Phase E with these mandatory corrections.

Correction 1 — audit existing payment status values before adding constraint

Before adding a status CHECK/trigger, query existing `payment_requests.status` values.

Do not break old/legacy payment requests.

If existing statuses are outside:  
draft, pending, checkout_created, paid, failed, cancelled, expired

Then either:

- migrate/map old statuses safely, or
- allow legacy statuses only for non-CS-linked records, or
- use a controlled trigger only for new CS-linked payment requests.

Do not deploy a constraint that breaks `/pay`, `/pay-invoice`, old payment links, admin lists, or existing records.

Correction 2 — CS-linked payment only after accepted Contract Summary

For new CS-linked payment requests, require:

- contract_summary.status = accepted
- quote.status = contract_summary_accepted
- quote_request.status = contract_summary_accepted
- contract_acceptance row exists
- accepted PDF has pdf_storage_key and pdf_sha256
- customer_id exists
- account_number exists where available
- no active duplicate payment request for the same accepted CS

Active duplicate statuses:  
pending, checkout_created, paid

Also include draft if draft payment requests are used in this project.

If these checks fail:

- block creation
- return clear error
- do not create checkout/session/payment link

Correction 3 — amount must come from accepted CS snapshot

Payment amount must be derived from the accepted Contract Summary customer-facing values.

Use the CS/accepted quote snapshot for:

- first month
- setup/install
- router
- delivery
- one-off charges
- VAT/customer totals

Do not use supplier costs.  
Do not use margin.  
Do not recalculate from live supplier product.  
Do not allow accidental admin undercharge.

If admin override is allowed:

- require explicit amount_override reason
- audit log required
- show difference from CS amount
- do not allow customer-facing amount to be lower than accepted CS without senior override

Correction 4 — minor units and currency safety

Store/submit provider amount using minor units where provider requires it.

Verify:

- decimal precision
- GBP currency
- amount sent to Worldpay equals payment_request.amount
- webhook amount/currency exactly match the payment_request before marking paid

No floating-point rounding mistakes.

Correction 5 — tokenised `/pay/:token` safety

The `/pay/:token` route can remain tokenised, but must be safe.

Required:

- token stored only as SHA-256 hash
- token must be high entropy
- token must expire
- invalid/expired/cancelled/paid token must not create new checkout
- token page returns only customer-safe payment fields
- no supplier/cost/margin/admin/internal fields
- no token hash exposed
- no ability to alter amount/status/customer/provider refs from frontend

The customer can pay from token page, but token access must not expose private internal data.

Correction 6 — customer cannot create or mutate payment requests

Remove the broken customer INSERT policy.

Customers must not be able to:

- create payment requests
- change amount
- change status
- set paid
- set webhook_verified
- edit provider_reference
- edit checkout URL
- edit metadata

Only admin/staff or service-role edge function paths can create/manage payment requests.

Webhook/service-role only can set:

- status = paid
- webhook_verified = true
- paid_at
- provider_payment_id

Correction 7 — paid payment immutability

Once payment_request.status = paid:

- amount cannot change
- currency cannot change
- customer_id/user_id cannot change
- contract_summary_id cannot change
- contract_acceptance_id cannot change
- quote_id cannot change
- quote_request_id cannot change
- provider_reference cannot change
- paid_at cannot be cleared
- webhook_verified cannot be set false

If a correction is needed, create adjustment/refund/admin note later, not silent mutation.

Correction 8 — webhook must be authoritative

Browser return must never mark paid.

Only verified webhook/server confirmation can mark paid.

Webhook must:

- verify Worldpay signature using raw request body
- fail closed if webhook secret missing
- match provider reference to payment_request
- verify amount
- verify currency
- verify paid/failed status
- be idempotent
- record event/audit
- not create supplier order
- not create service
- not create invoice
- not create DD mandate

Repeated valid webhook should not duplicate events or change paid record incorrectly.

Invalid signature or wrong amount:

- do not mark paid
- record safe audit/failure

Correction 9 — payment events table

If `payment_request_events` already exists, reuse it.

If missing, add a small append-only event table:

- id
- payment_request_id
- provider
- event_type
- provider_event_id
- provider_reference
- status_before
- status_after
- amount
- currency
- webhook_verified
- raw_event_hash
- received_at
- created_at

Do not store full sensitive payload if not needed. Store raw hash/safe metadata.

Use this for webhook idempotency and audit trail.

Correction 10 — checkout idempotency

If customer clicks “Pay securely” multiple times:

- do not create duplicate payment requests
- do not create uncontrolled duplicate checkout sessions
- if existing checkout_created and not expired, return same checkout URL/session if provider supports it
- if expired, create a new checkout session and record event
- paid request should not create another checkout

Correction 11 — no downstream side effects

Even after paid webhook:

Do not create:

- supplier order
- active service
- provisioning record
- invoice unless already explicitly existing receipt-only logic
- DD mandate

Payment received only prepares the next phase.

Correction 12 — `/pay-invoice` legacy path

Do not refactor or break:

- `/pay-invoice`
- `worldpay-payment`
- legacy invoice payment logic

Only extend shared webhook logic carefully if needed, and confirm old `INV-` references still work.

Approved build scope:

1. Migration

Add CS-linked fields to payment_requests:

- contract_summary_id
- contract_acceptance_id
- quote_id
- quote_request_id
- payment_request_number
- provider_session_id
- provider_checkout_url
- provider_payment_id
- paid_at
- failed_at
- webhook_verified
- metadata jsonb

Add indexes:

- contract_summary_id
- provider_reference
- token_hash if missing

Add or reuse payment_request_events.

Harden RLS:

- customers SELECT own only
- customers cannot INSERT/UPDATE/DELETE
- admin/staff can manage
- webhook/service-role can update paid fields

Add DB triggers:

- require accepted CS for CS-linked request
- prevent customer mutation
- prevent non-service setting paid/webhook_verified
- protect paid record immutability
- generate payment_request_number

2. Edge function `payment-request`

Extend actions:

- create CS-linked payment request
- create Worldpay checkout/session
- verify-payment read-only

Create action must:

- require staff/admin
- accept contract_summary_id
- load accepted CS and acceptance
- derive amount from accepted CS snapshot
- link quote, quote_request, contract_summary, acceptance
- create token hash
- create payment_request_number
- status pending
- no checkout until pay action or admin/customer checkout action

create-worldpay-session must:

- use server-side provider secret only
- create checkout/session
- store provider_session_id
- store provider_checkout_url
- store provider_reference
- set status checkout_created
- not set paid

verify-payment must:

- be read-only
- return status, webhook_verified, paid_at
- not mutate payment state

3. Edge function `worldpay-webhook`

Patch for PR references:

- verify signature
- verify amount/currency
- update paid only when valid
- set paid_at
- set webhook_verified true
- set provider_payment_id if available
- write payment_request_events/audit
- idempotent repeated event
- failed events set failed_at/status failed
- invalid events do not mark paid

Do not break INV legacy references.

4. Admin UI

Add “Create payment request” only after CS accepted.

Admin sees:

- customer
- account number
- CS reference
- quote reference
- amount breakdown
- expiry
- current status
- provider reference
- webhook verified badge
- paid_at

Hide button if:

- CS not accepted
- active PR already exists
- paid PR exists

5. Customer UI

`/pay/:token` shows:

- payment request number
- Contract Summary reference
- package/payment purpose
- amount due
- customer-safe breakdown
- “Your Contract Summary has been accepted”
- “Payment is required before we process your order”
- Pay securely button

No supplier/cost/margin/internal fields.

Payment result page:

- “Confirming your payment”
- polls read-only verify-payment
- shows “Payment received” only when webhook_verified=true
- if pending, says still confirming
- if failed, gives retry link

No order/service/supplier wording.

6. Dashboard

After CS accepted and PR exists:

- show Pay now link
- show payment status
- show paid receipt state after webhook verified

No supplier/internal fields.

7. Verification tests

Test A — block before CS accepted:  
Try creating PR for unaccepted CS/non-CS quote.  
Expected blocked.

Test B — create CS-linked payment request:  
Use accepted CS from Phase D.  
Expected PR created with correct links and amount.

Test C — customer pay page:  
Open `/pay/:token`.  
Expected safe fields only.

Test D — checkout creation:  
Click Pay securely.  
Expected provider checkout/session created server-side, status checkout_created, not paid.

Test E — browser return:  
Return page must not mark paid.  
Expected pending unless webhook already verified.

Test F — valid webhook:  
Send valid signed Worldpay test webhook.  
Expected paid, paid_at set, webhook_verified true, amount/currency checked, idempotent repeat.

Test G — invalid webhook:  
Wrong signature or wrong amount.  
Expected not paid.

Test H — duplicate protection:  
Second PR for same accepted CS blocked while active/paid PR exists.  
Repeated checkout click does not create uncontrolled duplicates.

Test I — wrong user:  
Wrong customer cannot view/pay another customer’s PR.

Test J — anonymous:  
Anonymous can only access token page if token is valid and safe.  
Anonymous cannot list payment_requests or access internal data.

Test K — paid immutability:  
After paid, attempt to change amount/status/linked CS/provider data.  
Expected blocked except controlled admin/service correction path if explicitly defined.

Test L — downstream:  
Confirm zero:

- supplier orders
- services
- provisioning records
- DD mandates
- invoices unless receipt-only existing logic intentionally creates one

8. Build checks

Run:

- TypeScript
- Vite production build

9. Final report

Stop after Phase E and report:

- existing status audit result
- migration details
- RLS hardening result
- accepted-CS guard result
- payment amount derivation result
- admin create PR result
- customer pay page result
- Worldpay checkout/session result
- browser return safety result
- webhook verification result
- invalid webhook result
- duplicate/idempotency result
- paid immutability result
- legacy `/pay-invoice` unaffected result
- RLS/security result
- network payload safety result
- no supplier/provisioning side effects result
- TypeScript/build result
- what was untouched
- remaining blockers before supplier order/provisioning phase  
  
  
Phase 7 / Phase E — Payment Readiness After CS Acceptance

Scope: payment request creation, customer pay page, Worldpay session, return UI, webhook verification. No supplier orders, no service activation, no DD changes, no invoice auto-creation.

## Part 1 — Audit findings

**Already exists (reusable):**

- `payment_requests` table (21 cols): `id, user_id, account_number, type, status, amount, currency, invoice_id, due_date, customer_email, customer_name, notes, token_hash, expires_at, last_opened_at, completed_at, provider, provider_reference, created_by, created_at, updated_at`.
- Edge function `payment-request` (~1.6k LOC) with admin actions: `create`, `create-worldpay-session`, `verify-payment`, `send-email`, plus DD/phone-payment actions (out of scope here).
- Edge function `worldpay-webhook` (~425 LOC): HMAC-SHA256 signature verification, fail-closed on missing `WORLDPAY_WEBHOOK_SECRET`, processes both `INV-` and `PR-` refs.
- Edge function `worldpay-payment` (legacy invoice path) — used by `/pay-invoice`.
- Frontend: `Pay.tsx` (tokenized payment-request page), `PayInvoice.tsx` (legacy invoice pay), `PaymentResult.tsx` (return handler), `WorldpayCheckout.tsx`.
- RLS on `payment_requests`: customer SELECT own; admin full; customer INSERT policy exists but has NULL qual (effectively permissive — see gap below).
- Token hashing pattern (SHA-256) per memory; webhook verification per memory.

**Gaps vs Phase E requirements:**

1. `payment_requests` has **no link to `contract_summary_id`, `contract_acceptance_id`, `quote_id`, `quote_request_id**` — cannot enforce "CS-accepted gate" or show CS reference to customer.
2. No `webhook_verified` boolean, no `paid_at` (uses `completed_at`), no `failed_at`, no `provider_session_id` / `provider_checkout_url` / `provider_payment_id` distinct fields, no `metadata jsonb`, no `payment_request_number` (only UUID).
3. Status field is free-text — no enum, accepts any string. Need constrained set: `draft|pending|checkout_created|paid|failed|cancelled|expired`.
4. No DB-level guard that blocks creation unless CS is accepted; current `create` action only checks admin role.
5. Customer INSERT policy on `payment_requests` has `WITH CHECK NULL` — needs to be **removed** (customers must never create payment requests directly).
6. `/pay-invoice` is a **legacy** invoice-only path (`worldpay-payment` function). Leave untouched; new flow uses `/pay/:token` (already tokenized) extended with CS context.
7. Worldpay sandbox/live toggle exists (`WORLDPAY_LIVE_MODE`). Webhook secret already wired. No code path currently marks paid from browser return — `PaymentResult.tsx` calls `verify-payment` which is read-only against DB (good).
8. `verify-payment` in `payment-request` returns success based on `status === 'paid'` only — safe, but we'll ensure it also surfaces `webhook_verified` for UI.
9. No side effects today create orders/services/supplier orders on payment success — confirmed clean.

## Part 2 — Migration (single file)

Add to `payment_requests`:

- `contract_summary_id uuid REFERENCES contract_summaries(id)`
- `contract_acceptance_id uuid REFERENCES contract_acceptances(id)`
- `quote_id uuid REFERENCES quotes(id)`
- `quote_request_id uuid REFERENCES quote_requests(id)`
- `payment_request_number text UNIQUE` (format `PR-YYMM-####`, generated by trigger)
- `provider_session_id text`, `provider_checkout_url text`, `provider_payment_id text`
- `paid_at timestamptz`, `failed_at timestamptz`
- `webhook_verified boolean NOT NULL DEFAULT false`
- `metadata jsonb NOT NULL DEFAULT '{}'`

Constraints / triggers:

- CHECK on `status IN ('draft','pending','checkout_created','paid','failed','cancelled','expired')` (added as trigger to remain immutable-safe).
- Trigger `pr_guard_requires_accepted_cs()` BEFORE INSERT: if `contract_summary_id IS NOT NULL`, require `contract_summaries.status='accepted'` AND matching `contract_acceptances` row AND `pdf_storage_key` + `pdf_sha256` not null. If CS-linked, require no existing PR for same CS in status `('pending','checkout_created','paid')`.
- Trigger `pr_block_customer_mutation()`: only `service_role` or staff can INSERT/UPDATE; customers blocked entirely (defense-in-depth alongside RLS).
- Trigger `pr_block_paid_from_non_service()`: only `service_role` can set `status='paid'` / `webhook_verified=true` / `paid_at`. Blocks any UI path from marking paid.
- Generator function for `payment_request_number` + BEFORE INSERT trigger.

RLS changes:

- DROP the broken `Users can create own payment requests` insert policy.
- Keep customer SELECT own; admin full. Add explicit `WITH CHECK (false)` insert policy for `authenticated` to be explicit.

Index: `(contract_summary_id)`, `(provider_reference)`.

GRANTs already exist (table pre-existed); no new public tables created.

## Part 3 — Edge function changes

`**payment-request` function — extend `create` action:**

- Accept `contract_summary_id` (required for new CS-gated requests; legacy invoice path keeps working when `invoice_id` is passed without CS).
- Server-side load CS + acceptance + quote; derive `amount` from CS one-off charges + first month (admin can override only via explicit `amount_override` with audit metadata).
- Populate all new FK columns + `customer_email/name` snapshots from CS.
- Reject if guard trigger would fire (pre-flight friendly error).
- Status starts `pending`.

`**payment-request` function — extend `create-worldpay-session`:**

- After Worldpay returns checkoutUrl, store `provider_session_id`, `provider_checkout_url`, set status=`checkout_created`.
- `transactionReference` stays `PR-{id8}-{ts}` (webhook already matches).

`**worldpay-webhook`:**

- On verified PAID event for `PR-…` ref: set `status='paid'`, `paid_at=now()`, `webhook_verified=true`, `provider_payment_id`. Idempotent (no-op if already paid + webhook_verified).
- On FAILED: `status='failed'`, `failed_at`.
- Verify `amount` and `currency` match `payment_requests` row; on mismatch → audit + do NOT mark paid.
- Write `payment_request_events` row + `log_event` audit entry.

`**verify-payment` action:** return `{status, webhook_verified, paid_at}` — no mutation.

## Part 4 — Admin UI

New action on accepted CS in `src/pages/admin/CustomerDetail.tsx` (and CS detail view):

- "Create payment request" button, visible only when CS `status='accepted'` and no live PR exists.
- Dialog shows: customer, account_number, CS reference, quote reference, computed amount + line breakdown (setup/router/delivery/installation/first month), expiry (default 14 days), notes.
- Calls `payment-request` `create` with `contract_summary_id`.
- Admin PR list (`src/pages/admin/PaymentRequests.tsx`) — add columns: CS ref, webhook_verified badge, provider_reference, paid_at; filter by status.

## Part 5 — Customer UI

`Pay.tsx` (tokenized `/pay/:token`):

- When PR is CS-linked, render CS-context panel: PR number, CS reference, plan name, amount, itemized breakdown (safe fields only — no supplier name, no margin, no supplier_product_id, no admin notes).
- "Your Contract Summary has been accepted. Payment is required before we process your order." copy.
- "Pay securely" CTA → `create-worldpay-session` → redirect via `redirectToExternal`.

`PaymentResult.tsx`:

- Always show "Confirming your payment…" until `verify-payment` returns `webhook_verified=true`.
- Poll every 3s up to 60s; then show pending state with manual refresh.
- On verified paid: "Payment received. Our team will now process your setup." No mention of order created / service active.
- On failed/cancelled: clear retry CTA back to `/pay/:token`.

Customer dashboard (`ContractSummariesTab` / `OverviewTab`): if accepted CS has live PR, surface "Pay now" link to `/pay/:token`. Hide all supplier/internal fields (already the case for CS views).

## Part 6 — Verification tests (manual via curl + UI)

A–J as specified. Will run via `supabase--curl_edge_functions` plus DB reads. Test G uses signed but wrong-amount webhook → must not mark paid. Test F uses correct signature → idempotent re-post check.

## Part 7 — Out of scope (explicitly untouched)

- supplier orders, supplier_products writes
- service activation / `services` table
- DD mandate creation flow (`submit-dd-mandate` left as-is)
- invoice auto-generation (none triggered by PR paid)
- rewards, campaigns, complaints, finance exports, AI chat
- `/pay-invoice` legacy invoice path + `worldpay-payment` function

## Technical summary

- 1 migration: schema + triggers + RLS hardening on `payment_requests`.
- 3 edge function edits: `payment-request`, `worldpay-webhook`, (no change to `worldpay-payment`).
- ~4 frontend files touched: `Pay.tsx`, `PaymentResult.tsx`, `admin/PaymentRequests.tsx` (or CS detail), one new admin dialog component.
- No changes to contract_summaries / contract_acceptances tables (already immutable).
- Final report will cover all 16 items from the brief.

Awaiting approval to switch to build mode.
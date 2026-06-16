The revised Stage 5A architecture is approved, subject to the following final implementation requirements.

## Answers to the three open items

1. Approved: complete §0 Worldpay compatibility discovery first and return the compatibility note before implementing any token or MIT code.
2. Approved: request and create the following separate 32-byte base64 secrets through the secure secret manager:

- `WORLDPAY_TOKEN_ENC_KEY`
- `DD_FIELD_ENC_KEY`

Use different keys for staging and production. Never display, log or store these keys in the database or repository.

3. Direct Debit:  
Do not ship placeholder Direct Debit Instruction or Guarantee wording.  
Keep the DD intake path behind:

`DD_INTAKE_ENABLED=false`

until OCCTA provides:

- DD provider name
- Service User Number or facilities-managed arrangement details
- provider-approved online/paperless signup wording
- approved Direct Debit Guarantee wording
- required customer confirmation and advance-notice rules

The database, encryption and masked admin UI may be prepared, but public DD collection must remain disabled until the wording is approved.

## Final mandatory corrections

### 1. Environment-specific Worldpay feature flag

Use different feature flags by environment:

- Production: `WORLDPAY_RECURRING_ENABLED=false`
- Staging/test environment: may be set to `true` only for the controlled E2E test after the §0 compatibility note confirms the exact API contract

Do not enable recurring card setup in production merely to perform the test.

Production may be enabled only after the complete staging/test flow passes and an authorised admin explicitly approves the release.

### 2. Contract acceptance and billing snapshot must be one database transaction

The following must succeed or fail together:

- Contract Summary acceptance
- acceptance evidence
- immutable acceptance reference
- `contract_billing_snapshots` creation
- journey advancement

Do not attempt to make separate Edge Function calls appear transactional.

Implement a single SECURITY DEFINER database RPC or equivalent database transaction used by `order-accept-contract`.

If billing snapshot creation fails, the CS must not be recorded as successfully accepted.

### 3. Do not synchronously send the Order Pack email from `order-submit`

`order-submit` must not perform PDF generation and email delivery as unreliable external side effects inside the customer request.

Instead, in one database transaction:

1. Validate the completed journey.
2. Set journey status to `submitted`.
3. Create the recurring authorisation where applicable.
4. Insert one unique outbox job:  
`complete_order_pack:<order_journey_id>`
5. Return the confirmation page immediately.

The worker must then:

1. Generate the Order Pack PDF.
2. Store it privately.
3. Generate the signed download link.
4. Send exactly one master onboarding email.
5. Record `master_email_sent_at`.
6. Record the communication entry.

If PDF or email delivery fails:

- journey remains safely submitted
- outbox job is retryable
- admin sees an alert
- customer does not need to complete the order again
- no duplicate master email may be sent

### 4. Cooling-off date calculation

Store the cooling-off deadline as a UK calendar deadline, not merely `accepted_timestamp + 336 hours`.

For a distance service contract, calculate:

- contract date in `Europe/London`
- cancellation period ending at the end of the 14th calendar day after the day the contract was entered into

Store:

- `contract_entered_date`
- `cooling_off_ends_date`
- `cooling_off_ends_at` as the end of that UK calendar date

Use the date value for customer display and service-start validation.

### 5. Prevent activation during cooling-off

The database activation function must reject:

- activation before Contract Summary acceptance
- activation without a completed payment-method setup
- activation of a cancelled journey
- activation before `cooling_off_ends_date`

For Stage 5A, do not permit early service commencement.

A future early-activation option would require separate, explicit customer consent and appropriate cancellation-charge wording; it is not included now.

The admin button should show:

`Available after the cooling-off period ends`

until eligible.

### 6. Use Europe/London billing dates

Billing dates are business calendar dates, not UTC timestamps.

Use `Europe/London` when determining:

- actual activation date
- billing-period start
- invoice date
- due date
- monthly anchor date
- whether a job is due today

The 06:00 UTC cron may wake the worker, but all due-date comparisons must use the UK local date.

### 7. Payment Request uniqueness for manual invoices

When a manual-invoice customer receives a Worldpay payment link:

- create exactly one active Payment Request per invoice
- add or confirm database uniqueness linking `payment_requests.invoice_id`
- reopening or resending the invoice must reuse the existing valid PR
- it must not create a second payable request for the same invoice
- verified settlement remains the only event that marks the invoice paid

### 8. Secure customer cancellation

Do not allow a high-impact order cancellation using possession of the quote token alone.

For guest cancellation require an additional confirmation, such as:

- one-time code sent to the confirmed customer email; or
- authenticated customer account confirmation

Record:

- verification method
- verified email/account
- cancellation timestamp
- IP
- user agent
- reason

Viewing the journey can remain token-scoped, but cancelling the order needs step-up verification.

### 9. Activation and first-billing visibility

When admin marks the service active:

- database transaction creates or updates the service
- activation is committed
- first-invoice outbox job is created
- admin immediately sees `Activation recorded — first invoice queued`
- no Worldpay network call occurs in the activation request
- billing worker processes the invoice and payment separately

Show separate statuses:

- service active
- invoice queued
- invoice issued
- card charge queued
- awaiting settlement
- paid or payment failed

Never show `paid` merely because an MIT request was accepted by Worldpay.

### 10. Discovery deliverable required before migrations

First return only the §0 compatibility note containing:

- exact Worldpay product currently used
- exact existing endpoint
- exact authentication method
- confirmed first stored-credential request structure
- confirmed zero-value verification support
- exact token field returned
- exact scheme-reference field returned
- exact subsequent MIT endpoint and request structure
- webhook events used for setup, failure and settlement
- whether separate credentials or entity IDs are required
- sources within existing code/configuration or official Worldpay documentation

Do not run migrations, request production secrets or modify the live Worldpay functions until this compatibility note is reviewed and approved.

After approval, proceed in this order:

1. Worldpay compatibility note
2. Database migration
3. Secrets and environment flags
4. Unified order journey without card/DD enabled
5. Manual invoice path
6. DD foundation behind disabled flag
7. Card path behind staging flag
8. Controlled end-to-end verification
9. Production release approval
10. Production feature-flag enablement  
  
Stage 5A (Revised) — Unified Order Journey, Recurring Card, DD Request, Billing Foundation

Architecture stays as previously approved. The 14 mandatory corrections below are baked in. Existing `/pay/:token` flow stays live and untouched throughout. Recurring card MIT remains feature-flagged off (`WORLDPAY_RECURRING_ENABLED=false`) until one full end-to-end test passes.

---

## 0. Pre-implementation discovery (blocking, before any code)

Before writing any token-setup or MIT code:

1. Read in full: `supabase/functions/worldpay-payment/index.ts`, `worldpay-webhook/index.ts`, `worldpay-status/*`, `worldpay-verify-*`, plus the project memories `payments/worldpay-hpp-integration`, `payments/worldpay-live-configuration`, `payments/worldpay-hpp-api-constraints`, `payments/worldpay-3ds-browser-constraints`.
2. Produce a short written compatibility note covering the exact OCCTA-enabled Worldpay product:
  - Token-creation request fields actually accepted by the current HPP request (`createToken.*`, `customerAgreement.*`, or alternative on this product).
  - Endpoint used today for the first stored-credential / CIT (HPP `/payment_pages` or other) and whether zero-value verification is supported on that endpoint.
  - Exact location of the returned token href / scheme reference in the current webhook payload.
  - Endpoint + auth method for subsequent MIT (must be confirmed — do not assume `/api/payments`).
  - Stored-credential / subscription / scheme-reference field names accepted.
  - Whether OCCTA's recurring product requires separate credentials.
3. Only after this note is written do we implement §4 functions. No assumed Access Worldpay shapes.

Until full E2E test passes:

- `WORLDPAY_RECURRING_ENABLED=false` gates: card-setup edge function, MIT charge function, recurring-authorisation creation. With the flag off, the "Automatic monthly card payment" option is shown as "Coming soon" and only DD intake + manual invoice are selectable.

---

## 1. New customer route

- `src/pages/order/OrderJourney.tsx` at `/order/:token` (token = existing quote public token, hashed lookup).
- Steps: Review quote → Approve/Decline → Contract Summary → Start date → Payment method → Card/DD/Invoice setup → Review → Submit → Confirmation.
- Components in `src/components/order/` (one per step + `JourneyStepper.tsx`).
- All state persisted server-side on `order_journeys` (§3), keyed by `order_journey_id`. Never relies on `customer_id` for ownership during the journey.

## 2. Quote approve / decline

- Edge function `order-decision` (`approve` | `decline`), token-scoped.
- Decline: requires reason enum + optional text; records timestamp, IP, UA; updates `quotes.status`; emits `quote_events`; notifies admin internally; no CS / PR / invoice / order / service created.
- Approve: records evidence on `order_journeys`; generates/reuses exactly one immutable CS via existing CS issue path; advances journey. No separate "CS ready" email.

## 3. Database (one migration, all GRANTed correctly + RLS + uniqueness)

### Sensitive tables — service-role only on ciphertext columns

For `payment_tokens`, `dd_intake_requests`, `recurring_payment_authorisations`:

- `GRANT ALL ON … TO service_role`. **No `authenticated` SELECT/INSERT/UPDATE/DELETE.**
- Customer and admin access only through SECURITY DEFINER RPCs that return masked, allowlisted columns.
- Raw decryption only inside edge functions (not in any DB function).

### New tables

`**order_journeys**` — `id (pk)`, `quote_id unique`, `token_hash unique`, `customer_id null`, `contract_summary_id`, `decision`, `decision_reason`, `decision_at`, `accepted_at`, `cooling_off_ends_at`, `preferred_start_date`, `payment_method`, `payment_token_id`, `dd_intake_id`, `recurring_authorisation_id`, `submitted_at`, `master_email_sent_at`, `order_pack_pdf_key`, `cancelled_at`, `cancel_reason`, `ip`, `ua`, `status`. Unique `(quote_id)` enforces one journey per quote. RLS: token-scoped RPC for guest; `authenticated` may read only their own row after linking; staff via `is_staff()`.

`**payment_tokens**` — `id`, `order_journey_id`, `customer_id null`, `provider='worldpay'`, `token_ciphertext bytea`, `token_iv bytea` (96-bit), `token_aad text` (e.g. `worldpay|journey:<id>|token:<id>`), `enc_key_version int`, `enc_alg_version int`, `enc_created_at`, `token_hash text` (lookup/dedupe), `scheme_reference_ciphertext bytea`, `scheme_reference_iv bytea`, `namespace text` (= `order_journey_id`), `card_last4`, `card_brand`, `card_exp_month`, `card_exp_year`, `consent_text_version`, `consent_at/ip/ua`, `status` (`pending|active|revoked|expired`). Unique `(token_hash)`. **No `authenticated` grants.**

`**dd_intake_requests**` — `id`, `order_journey_id`, `customer_id null`, `account_holder_name`, `account_number_ciphertext`, `account_number_iv`, `account_number_aad`, `account_number_last4`, `sort_code_ciphertext`, `sort_code_iv`, `sort_code_aad`, `sort_code_last2`, `enc_key_version`, `enc_alg_version`, `bank_name`, `billing_address jsonb`, `preferred_collection_day`, `authorised_by_account_holder bool`, `dd_guarantee_version`, `consent_at/ip/ua`, `status` default `'details_received_awaiting_provider_setup'`. **No `authenticated` grants.**

`**recurring_payment_authorisations**` — `id`, `order_journey_id`, `customer_id null`, `payment_token_id null`, `dd_intake_id null`, `contract_summary_id`, `service_id null`, `payment_method`, `monthly_amount_incl_vat`, `billing_frequency='monthly'`, `billing_anchor_day int` (1–31, original anchor preserved), `authorisation_text_version`, `authorised_at`, `ip`, `ua`, `status` (`pending|active|cancelled|suspended`), `cancelled_at`, `cancellation_reason`. Partial unique index: one `status='active'` authorisation per `(service_id, payment_method)`.

`**contract_billing_snapshots**` (immutable) — `id`, `contract_summary_id unique`, `quote_id`, `plan_description`, `monthly_net`, `vat_rate`, `vat_amount`, `monthly_gross`, `setup_net`, `setup_gross`, `router_net`, `router_gross`, `contract_term_months`, `discounts jsonb`, `price_lock_terms text`, `payment_frequency`, `created_at`. Append-only trigger; mutations blocked. Created at CS acceptance.

`**services` (ALTER)** — add `order_journey_id`, `contract_summary_id`, `recurring_authorisation_id`, `actual_activation_date`, `activation_status` (`awaiting_manual_activation|active|cancelled`), `billing_anchor_day int`, `next_invoice_date`. Partial unique index: one row per `order_journey_id` unless `is_additional_service=true` (new bool).

`**billing_outbox**` — `id`, `kind` (`activate_first_invoice|generate_monthly_invoice|attempt_card_charge|send_invoice_email`), `service_id`, `invoice_id null`, `idempotency_key text unique`, `payload jsonb`, `status` (`pending|processing|done|failed`), `attempts int`, `last_error`, `available_at`, `created_at`, `processed_at`. Picked up by `billing-worker`.

`**invoices` (ALTER if needed)** — partial unique `(service_id, billing_period_start)` to prevent duplicate period invoices. Add `billing_period_start`, `billing_period_end`, `source` (`activation|recurring|manual_admin`).

`**recurring_charge_attempts**` — `id`, `invoice_id`, `payment_token_id`, `idempotency_key text unique`, `worldpay_transaction_ref`, `status` (`queued|sent_to_provider|settled|failed`), `failure_code`, `failure_message`, `attempted_at`, `settled_at`. Append-only after settled.

`**receipts` (ensure unique)** — unique `(recurring_charge_attempt_id)` for one receipt per settled charge.

`**order_journey_cancellations**` — `id`, `order_journey_id`, `actor` (`customer|admin`), `cancel_type` (`order|recurring_authority_only`), `reason`, `ip`, `ua`, `created_at`.

All sensitive tables: append-only triggers on ciphertext + key-version fields (mutation blocked after insert except via service role with `enc_key_version` rotation flow).

### Uniqueness summary (DB-enforced)

- 1 `order_journeys` per `quote_id`.
- 1 accepted CS version per journey (existing CS table guards via `contract_acceptances` + add unique on `(order_journey_id, version)` if CS now linked to journey).
- 1 `master_email_sent_at` per journey (column not table — but `communications_log` gets unique `(order_journey_id, template='order_master_onboarding')`).
- 1 active `recurring_payment_authorisations` per `(service_id, payment_method)` (partial unique).
- 1 invoice per `(service_id, billing_period_start)`.
- 1 `recurring_charge_attempts` per `idempotency_key`.
- 1 receipt per `recurring_charge_attempt_id`.
- 1 `billing_outbox` row per `idempotency_key` (e.g. `first_invoice:<service_id>`).

---

## 4. Edge functions

All Deno, CORS, `getClaims()` for authed, token-validation for guest endpoints.

1. `order-journey-state` (GET/POST, token-scoped) — load/update journey row.
2. `order-decision` — approve/decline (§2).
3. `order-accept-contract` — verifies CS; captures typed name/email/mobile/IP/UA; calls existing CS acceptance writer; on success **creates `contract_billing_snapshots` row in the same transaction**. Refuses if already accepted.
4. `order-start-date` — validates `>= cooling_off_ends_at`; stores `preferred_start_date`.
5. `worldpay-card-setup` (flagged) — uses the **verified-from-§0** Worldpay endpoint + field shape; namespace = `order_journey_id`; zero-value verification only if §0 confirms support, otherwise use the smallest CIT flow Worldpay accepts on this product and document it. Return URL = `/order/:token?cardSetup=processing`.
6. `worldpay-token-capture` (flagged) — invoked by webhook only. Reads token href + scheme reference from the actual webhook payload shape; AES-256-GCM encrypts with `WORLDPAY_TOKEN_ENC_KEY` and AAD `worldpay|journey:<id>|token:<id>`; stores ciphertext + IV + key/alg versions; idempotent on `token_hash`; sets `payment_tokens.status='active'`.
7. `order-card-status` (token-scoped GET) — used by the browser-return polling page; returns `processing|active|failed|timeout`. Never returns the token.
8. `dd-intake-submit` — AES-256-GCM encrypts account number + sort code with `DD_FIELD_ENC_KEY`, separate IVs, AAD `dd|journey:<id>|field:account_number` / `sort_code`; stores ciphertext + last4/last2 only; status `details_received_awaiting_provider_setup`; notifies admin; never logs raw fields.
9. `order-submit` — final atomic step. Validates: decision=approved, CS accepted, snapshot exists, start date valid, payment method chosen and ready (card token `active` OR DD intake present OR invoice method). Writes `recurring_payment_authorisations` (`active` only for card with verified token; otherwise `pending`). Calls `send-order-master-email` exactly once (idempotent via unique `communications_log` row). Generates Order Pack PDF (§10). Returns confirmation payload.
10. `generate-order-pack-pdf` — server-side jsPDF; stores in private bucket; returns storage key + signed expiring URL. Does not replace originals.
11. `send-order-master-email` — single template `order_master_onboarding`; attaches Order Pack PDF where supported + secure expiring download link; strict allowlist (no token, no bank details, no supplier cost, no margin, no internal notes). Idempotent.
12. `account-link-journey` — secure RPC-style edge function. When a guest later signs up/in, verifies email matches (and postcode MFA per existing memory) and links `order_journeys.customer_id`, `payment_tokens.customer_id`, `dd_intake_requests.customer_id`, `recurring_payment_authorisations.customer_id`.
13. `order-cancel` — actor=customer (token-scoped, only during cooling-off) or actor=admin. `cancel_type='order'`: sets journey cancelled, sets `services.activation_status='cancelled'` if exists, revokes recurring authorisation, sets card token to `revoked` (server side; provider revocation in 5B), blocks future invoices, halts manual fulfilment task. `cancel_type='recurring_authority_only'`: revokes the recurring authorisation only — does **not** cancel the service or void existing invoices. Records reason/IP/UA.
14. `admin-mark-service-activated` — admin-only. In one DB transaction:
  - Creates `services` row for this `order_journey_id` if none (or updates pending one).
    - Records `actual_activation_date`, `activation_status='active'`.
    - Sets `billing_anchor_day = day-of-month of activation` (anchor preserved as original; clamping happens at scheduling time, not at storage).
    - Links `order_journey_id`, `quote_id`, `contract_summary_id`, `recurring_authorisation_id`.
    - Inserts `billing_outbox` row `kind='activate_first_invoice'`, `idempotency_key='first_invoice:<service_id>'`.
    - For a past activation date: surfaces an admin warning; does NOT auto-create historical invoices. Backfill requires an explicit second admin action with a confirm dialog.
    - Returns immediately. No Worldpay call in this request.
15. `billing-worker` (cron + manual trigger) — drains `billing_outbox` with row-level lock:
  - `activate_first_invoice` → generates first invoice using `contract_billing_snapshots` amount; period = activation date → +1 month; inserts invoice with unique `(service_id, billing_period_start)`; sets `services.next_invoice_date = activation_date + 1 month (anchor preserved, clamp only when target month lacks the day)`; if method=`saved_card` and authorisation active and `WORLDPAY_RECURRING_ENABLED`, enqueues `attempt_card_charge`; if `direct_debit` → invoice flagged `awaiting_dd_collection` (no API call); if `manual_invoice` → enqueues `send_invoice_email`.
    - `generate_monthly_invoice` → same logic monthly.
    - `attempt_card_charge` (flagged) → calls `worldpay-mit-charge` (§16). Marks attempt `sent_to_provider`. Does NOT mark invoice paid.
    - `send_invoice_email` → branded invoice email with HPP payment link reusing existing `/pay` flow.
16. `worldpay-mit-charge` (flagged) — uses endpoint + field shape confirmed in §0. Decrypts token in-memory only (never logged); includes scheme reference; unique `transactionReference = idempotency_key`. Inserts/updates `recurring_charge_attempts`. Never marks invoice paid.
17. `worldpay-webhook` (extend, don't replace) — adds handlers for:
  - Token setup events → `worldpay-token-capture`.
    - Settlement (`sentForSettlement` etc.) for recurring attempts → on match of `attempt + invoice + amount + currency`, mark invoice paid (only here), generate receipt (unique per attempt), send `payment_received` email idempotently, update dashboards.
    - Failure events → mark attempt failed, invoice back to `due`, single customer "action needed" email, create `admin_tasks` row, no auto-retry.
    - Existing INV-/PR- handling untouched.

### Cron

- pg_cron 06:00 UTC daily → `billing-worker`. Cron also pokes outbox every 5 min for fast paths (token capture timeout alerts).

---

## 5. Encryption (Edge-Function-only AES-256-GCM)

- Secrets: `WORLDPAY_TOKEN_ENC_KEY`, `DD_FIELD_ENC_KEY` (distinct, never shared).
- Each row stores: `ciphertext`, `iv` (96-bit random per row per field), `enc_key_version int`, `enc_alg_version int`, `enc_created_at`, AAD string. AES-GCM's auth tag is part of `ciphertext`.
- AAD format: `worldpay|journey:<order_journey_id>|token:<payment_token_id>` and `dd|journey:<id>|field:<name>`.
- Decryption is only ever performed inside `worldpay-mit-charge`, `worldpay-token-capture` (write side), and an admin-only `reveal-dd-details` function (RBAC + audit log + reason) — never in any DB function, never in webhooks beyond what is required.
- Logging: zero PII / secret rule, enforced by code review. Wrappers strip these fields from all `log_event` calls and `communications_log` payloads.

---

## 6. Guest identity & account linking

- Journey identity = `order_journey_id`. Used as Worldpay token namespace and as foreign key on `payment_tokens` / `dd_intake_requests` / `recurring_payment_authorisations` / `services`.
- `customer_id` is nullable on all these tables until the customer creates an account.
- `account-link-journey` performs the link with MFA (email + postcode + journey token) and writes an audit log row.

---

## 7. Customer dashboard + Admin Customer 360

- Customer dashboard `PaymentsTab`: shows masked saved-card (brand/last4/expiry/status), DD setup status, recurring authorisation status. Two distinct actions: "Cancel automatic payment authority" and "Cancel my order (cooling-off only)".
- Admin `CustomerDetail.tsx`: surfaces journey decision/decline reason, CS acceptance evidence + snapshot, start dates, payment method + masked details, recurring authorisation status, service activation control, billing schedule, invoices, charge attempts. Reads only masked RPCs.

---

## 8. Browser-return processing screen

- On return from Worldpay card setup: `/order/:token` renders "We are securely confirming your card. Please wait…" and polls `order-card-status` every 2s (max 30s).
- Submit button disabled until `status='active'`.
- On timeout: keep journey state; show "Check again" and "Use a different method"; create `admin_tasks` alert; never auto-create a second card setup session.

---

## 9. Billing math

- `cooling_off_ends_at = accepted_at + 14 calendar days`.
- `preferred_start_date >= cooling_off_ends_at`.
- Billing keyed off `actual_activation_date` only.
- Anchor day preserved as the original day-of-month (e.g. 31). When the target month lacks that day, that month's invoice uses the final calendar day; subsequent months return to the original anchor where it exists.
- Past activation: only first invoice auto-created; backfill requires explicit second admin confirm.

---

## 10. Master email + Order Pack

- Exactly one `order_master_onboarding` email per journey (DB-unique).
- Order Pack PDF: branded, contains approved quote, accepted CS, e-acceptance certificate, preferred start date, cooling-off end, selected payment method confirmation (masked), monthly contractual amount, next-step timeline, OCCTA contact + complaints.
- Original quote, CS PDF, and acceptance evidence remain immutably stored separately.
- Email attaches Order Pack where transport allows + secure expiring signed download link + dashboard link.
- Allowlist enforced: no token, no bank details, no supplier cost, no margin, no internal notes.

---

## 11. Cancellation

- Two clearly distinct flows in UI and API: "Cancel automatic payment authority" vs "Cancel the order/service".
- Customer cancellation of the order is only allowed during cooling-off; admin can cancel any time pre-activation.
- Cancellation effects per §13 of the request: stops manual fulfilment task, revokes recurring authorisation, revokes saved-card billing authority (status='revoked'; provider-side revocation deferred to 5B), prevents activation and future invoices, preserves all signed evidence.

---

## 12. Verification (gating Stage 5A "done")

1. TS build clean.
2. End-to-end journey for a new test quote token:
  - Approve → CS accept (snapshot created) → start date → DD intake path → submit → exactly one master email + Order Pack delivered.
  - Same for manual invoice path.
  - Saved-card path executed against Worldpay sandbox: setup → token captured + encrypted → polling page transitions to active → submit allowed → recurring authorisation active.
3. Admin "Mark service active": creates service row exactly once, inserts `billing_outbox` job, returns immediately. Worker generates first invoice using snapshot price. For saved-card, MIT enqueued with unique idempotency key; invoice flips to `paid` only on verified settlement webhook; single receipt; single `payment_received` email.
4. Re-running `billing-worker` same day does not double-invoice or double-charge (uniqueness asserted).
5. DD path: ciphertext stored; admin sees only masked last4/last2; raw never logged.
6. Cancellation during cooling-off: order cancellation revokes authorisation + blocks future invoices; payment-authority-only cancellation leaves service intact.
7. Old `/pay/:token` PR flow remains green (regression run against a fresh PR).
8. Security audit: grep all new code for raw token / PAN / CVV / raw bank field references in logs, emails, responses, `communications_log` — must be zero.
9. Only after all of the above passes is `WORLDPAY_RECURRING_ENABLED` flipped to `true` in production.

---

## 13. Out of scope (deferred to 5B)

- Live DD provider API submission & collection.
- Provider-side card token revocation on cancellation (we only mark `revoked` locally for now).
- Automated dunning beyond the single failure email.
- Removing the old `/pay/:token` PR path.
- Multi-service per customer (single-service-per-journey constraint enforced; `is_additional_service` column added now for future use).

---

## Open items requiring your confirmation before I start

1. Approve §0 discovery first: I will produce the Worldpay compatibility note as a separate deliverable before any token/MIT code is written.
2. Confirm secrets `WORLDPAY_TOKEN_ENC_KEY` and `DD_FIELD_ENC_KEY` may be requested via `add_secret` once you approve this plan (32-byte base64 each).
3. Confirm the DD Instruction + Guarantee wording you are authorised to use; I will not ship placeholder wording.

On approval, implementation order is: §0 discovery note → migration → secrets → edge functions (non-card paths first) → UI → card path behind flag → verification → flag flip.
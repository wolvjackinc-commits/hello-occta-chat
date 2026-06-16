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
  
  
Stage 5A (revised) — Unified Order Completion, Recurring Card, DD Setup, Billing Foundation

All 14 corrections are folded in. Implementation will not start until this plan is approved. The existing live `/pay/:token` PR flow and `worldpay-payment` (Access HPP `/payment_pages`) integration remain **untouched and live** throughout Stage 5A.

---

### 0. Worldpay capability verification (must complete BEFORE token/MIT code is written)

Current verified integration in this repo:

- Endpoint: `https://access.worldpay.com/payment_pages` (Access Worldpay Hosted Payment Pages, HAL v1).
- Auth: HTTP Basic `WORLDPAY_API_USERNAME` / `WORLDPAY_API_PASSWORD`, with `WORLDPAY_ENTITY_ID`.
- Request shape today: `transactionReference`, `merchant.entity`, `value`, `resultURLs`, `narrative`, `riskData.account.email`. No token, no `customerAgreement`, no `storedCardUsage`.
- Result delivery: redirect to `resultURLs.*` + `worldpay-webhook` for settlement.

This means token capture and MIT are **not yet proven on OCCTA's enabled Worldpay product**. Before any token/MIT code is enabled, we must obtain from Worldpay (or the live response of a verification call) the exact, account-specific answers to:

1. Does this account expose HPP token-on-file fields (`createToken` + returned token href) on `/payment_pages`, or do we need the Access Payments API (`/api/payments`) and/or Verified Tokens API enabled separately?
2. Exact JSON fields required on the first stored-credential transaction (`customerAgreement.type`, `storedCardUsage`, `schemeTransactionReference` etc.) and which endpoint accepts them.
3. Whether zero-value account verification is supported on that endpoint for this account.
4. Exact location of the reusable token/href in the response (webhook event vs. payment page result vs. payments API response).
5. Exact endpoint, auth, and required scheme/agreement fields for subsequent MIT charges.
6. Whether separate API credentials/entity are required for recurring (some Worldpay setups split issuing credentials).

Until all six are confirmed with a successful end-to-end test (consent → card setup → token returned → token encrypted/stored → test invoice → one MIT settled → webhook verified → invoice marked paid exactly once), the feature flag stays:

```
WORLDPAY_RECURRING_ENABLED=false
```

With the flag off:

- `/order/:token` still runs end-to-end.
- "Saved card" option is hidden (or shown as "coming soon"); customers can only pick DD setup request or manual invoice for Stage 5A live.
- No MIT charge code path runs.

---

### 1. Customer journey (kept as before, additive only)

`/order/:token` (new route, token = `order_journeys.token_hash`):

```
Quote review → Approve / Decline
  → Contract Summary generated in same journey
  → Electronic acceptance (IP/UA captured, signed PDF)
  → Cooling-off + preferred service start date
  → Payment choice:
       (a) Saved card (recurring)   [hidden until WORLDPAY_RECURRING_ENABLED=true]
       (b) DD setup request
       (c) Monthly invoice / payment link
  → Final review (immutable contractual snapshot displayed)
  → Submit
  → One master onboarding email + Order Pack PDF
  → Customer 360 / dashboard / journey synchronised
  → Manual Giacom fulfilment (admin)
  → Admin marks service active (records actual activation date)
  → Outbox: invoice job → (if saved-card) MIT job → webhook → paid
  → Receipt + dashboard update
```

Old `/pay/:token` PR flow, admin PR creation, and `worldpay-payment` HPP remain live and untouched.

---

### 2. Data model (one migration; tables created locked-down)

New tables (all `service_role` full access; `authenticated` access is **revoked** on ciphertext columns and routed through SECURITY DEFINER RPCs):

- `order_journeys` — `id`, `token_hash`, `quote_id`, `contract_summary_id`, `linked_customer_id` (nullable, set on account link), `guest_email_hash`, `state` (enum: draft/approved/declined/cs_generated/accepted/payment_chosen/submitted/cancelled/active), `preferred_start_date`, `cooling_off_ends_at`, `payment_method_choice` (saved_card/dd_setup/manual_invoice), `submitted_at`, `cancelled_at`, `cancellation_reason`.
- `order_billing_snapshots` — immutable JSON snapshot taken at acceptance: `plan_description`, `monthly_ex_vat`, `vat_rate`, `vat_amount`, `monthly_inc_vat`, `setup_fee_ex_vat`, `router_fee_ex_vat`, `term_months`, `discounts`, `price_lock_terms`, `payment_frequency`. Unique `(order_journey_id)`. Source of truth for all future invoices unless a recorded contract variation supersedes it.
- `payment_tokens` — `id`, `order_journey_id`, `provider` ('worldpay'), `token_ciphertext bytea`, `token_iv bytea`, `token_key_version int`, `token_algo_version int`, `scheme_transaction_reference_ciphertext bytea` (+ iv/version), `last4`, `card_brand`, `expiry_month`, `expiry_year`, `aad_fingerprint`, `status` (pending/active/revoked), `created_at`. **No** `authenticated` GRANT on token columns.
- `dd_intake_requests` — `id`, `order_journey_id`, `account_holder_name`, `sort_code_ciphertext bytea` + iv + version, `account_number_ciphertext bytea` + iv + version, `aad_fingerprint`, `status` (`details_received_awaiting_provider_setup` → `provider_setup_in_progress` → `active` → `cancelled`/`failed`), `provider_reference`, `created_at`. **No** `authenticated` GRANT on bank columns.
- `recurring_payment_authorisations` — `id`, `order_journey_id`, `service_id` (nullable until activation), `payment_token_id`, `status` (pending/active/revoked), `scheme_reference_ciphertext` (+ iv/version), `created_at`. Unique partial index: one `active` per `(service_id, provider)`.
- `recurring_charge_attempts` — `id`, `invoice_id`, `authorisation_id`, `idempotency_key` unique, `submitted_at`, `provider_response_status`, `settled_at`, `failure_reason`. Append-only.
- `order_packs` — `id`, `order_journey_id` unique, `storage_path`, `sha256`, `generated_at`.
- `order_journey_emails` — `id`, `order_journey_id`, `template` ('order_master'), `sent_at`. Unique `(order_journey_id, template)` to enforce one master email.
- `service_activation_outbox` — `id`, `service_id` unique-per-event-type, `event_type` ('first_invoice'|'charge_invoice'), `payload jsonb`, `status` (pending/processing/done/failed), `attempts`, `next_run_at`, `created_at`.

Extend `services`:

- `actual_activation_date date`, `activation_status` enum (`pending_activation`/`active`/`suspended`/`cancelled`), `billing_anchor_day smallint` (1–31, preserved), `next_invoice_date date`, `recurring_authorisation_id uuid null`, `order_journey_id uuid null`, `billing_snapshot_id uuid null`.
- Unique partial index: one `services` row per `(order_journey_id)` unless `is_additional_service = true`.

Extend `invoices`:

- `service_id` (already may exist), `billing_period_start date`, `billing_period_end date`, `snapshot_id uuid`, `source` ('first_activation'|'recurring').
- Unique `(service_id, billing_period_start)` to prevent double-invoicing.
- Unique `(service_id) where source='first_activation'`.

All sensitive tables: `REVOKE ALL ... FROM authenticated, anon; GRANT ALL ... TO service_role;`. RLS enabled with deny-by-default; access is only via SECURITY DEFINER RPCs listed below that return masked, allowlisted columns.

---

### 3. Encryption (Edge-Function-only AES-256-GCM)

Two **separate** secrets (request via `add_secret`):

- `WORLDPAY_TOKEN_ENC_KEY` — 32 random bytes, base64.
- `DD_FIELD_ENC_KEY` — 32 random bytes, base64.

Per encrypted value stored: `ciphertext`, `iv` (96-bit random, unique per encryption), `key_version` (int, starts at 1), `algo_version` (int, starts at 1), `created_at`. GCM auth tag is appended to the ciphertext by Web Crypto.

AAD construction (bound into encrypt and verified on decrypt):

- Tokens: `worldpay|order_journey:{id}|payment_token:{id}`
- DD: `dd|order_journey:{id}|dd_intake:{id}`

Logging rules (enforced by code review and a lint helper): raw token, scheme reference, sort code, account number, decrypted plaintext, and the enc keys must **never** appear in `console.log`, error messages, `communications_log`, emails, analytics, or any HTTP response. Decrypt only happens inside `worldpay-mit-charge` and `dd-provider-submit` (when added).

---

### 4. Guest identity & account linking

`order_journey_id` is the stable onboarding identity for tokens, DD intake, and recurring authorisations. `linked_customer_id` is nullable.

- Token namespace and Worldpay `transactionReference` use `order_journey_id`, never email.
- After the customer creates/logs into an account, a SECURITY DEFINER RPC `link_journey_to_customer(journey_token_raw, auth.uid())` (rate-limited, requires hashed token match + matching email/postcode MFA per existing standard) sets `linked_customer_id` and links documents/payment method.
- Email is only used to look up an existing journey via the same hashed-token lookup used elsewhere.

---

### 5. Service creation & activation (atomic)

No active `services` row is created at order submission. Manual fulfilment (`manual_fulfilment_orders`) remains the operational record.

Admin "Mark service active" calls one SECURITY DEFINER function `admin_activate_service(order_journey_id, actual_activation_date)` that, in a single transaction:

1. Upserts the `services` row for that journey (or updates the pending one).
2. Sets `actual_activation_date`, `activation_status='active'`, `billing_anchor_day = day_of_month(actual_activation_date)`, links `quote_id`, `contract_summary_id`, `order_journey_id`, `billing_snapshot_id`, `recurring_authorisation_id`.
3. Inserts a row into `service_activation_outbox` with `event_type='first_invoice'` (idempotent: unique `(service_id, event_type)`).
4. Returns the activation summary.

Direct invoice/charge work is **not** done in this request.

---

### 6. Outbox / billing worker

New edge function `billing-worker` (cron every 5 min + pg_net trigger on outbox insert):

1. Picks pending outbox rows.
2. For `first_invoice`: generates the first invoice using `order_billing_snapshots` (NOT the live catalogue). Period = `[actual_activation_date, actual_activation_date + 1 month)`. Inserts via the `(service_id, billing_period_start)` unique constraint (idempotent).
3. For recurring schedule: a separate daily cron `billing-schedule-tick` enqueues `first_invoice`/recurring invoice jobs based on `services.next_invoice_date` and `billing_anchor_day` (anchor preservation rule below).
4. If the service has an active `recurring_payment_authorisation` and `WORLDPAY_RECURRING_ENABLED=true`, enqueue a `charge_invoice` outbox row (idempotency_key = `invoice_id`).
5. `worldpay-mit-charge` worker (only enabled when flag on) consumes `charge_invoice` rows, calls the Worldpay endpoint **verified in step 0**, records an append-only `recurring_charge_attempts` row, and stops. Settlement is **only** asserted by `worldpay-webhook` marking the invoice paid (existing fail-closed HMAC pattern).

Retrospective activation: if `actual_activation_date` is in the past, only one first invoice is created. Admin gets a UI warning; a backfill toggle (separate, audited admin action) is required to enqueue earlier periods.

Billing anchor: store the original day. When generating the next invoice, use `min(anchor_day, last_day_of_month(target_month))` for months where the anchor doesn't exist (Feb/30/31), and restore the original anchor in later months. No permanent clamp to 28.

---

### 7. Billing snapshot

`order_billing_snapshots` is written once when the customer accepts the Contract Summary inside `/order/:token` and is read-only thereafter. `billing-worker` and `worldpay-mit-charge` always read amounts from this snapshot. Catalogue price changes never affect existing customers' bills. A future "contract variation" event will append a new snapshot version with effective date — out of scope to write here, but the schema supports it via `(order_journey_id, version)`.

---

### 8. Direct Debit (setup request, not a mandate)

`dd-intake-submit` edge function:

- Validates sort code (UK 6-digit) and account number (UK 8-digit) format only — no live bank check.
- Encrypts both fields with `DD_FIELD_ENC_KEY` + AAD.
- Inserts `dd_intake_requests` with status `details_received_awaiting_provider_setup`.
- Returns only `{ status, last2_sort_code, last4_account }`.

Customer-facing wording (locked copy constant):

> "Your bank details have been securely received so OCCTA can arrange your Direct Debit. Your Direct Debit is not active until we confirm setup."

No "first collection on…" promise. No DD Guarantee wording is shown until OCCTA's authorised Bacs/provider-approved text is added. Admin manually flips status to `active` (audited) after provider confirmation. DD invoices are **never** marked paid by mandate-active alone — only by provider settlement event (out of scope to wire the provider in 5A).

---

### 9. Single master email + Order Pack

`generate-order-pack` builds one branded PDF containing copies of: approved quote, accepted CS, electronic acceptance certificate, preferred start date, cooling-off end date, selected payment method confirmation (masked), monthly contractual charge from snapshot, next-step timeline, OCCTA contact + complaint details. Stored in `order_packs` (private bucket; signed URL with expiry).

Originals (quote, CS, acceptance evidence) remain immutable in their existing tables/storage. The Order Pack is a consolidated copy.

`send-order-master-email` is invoked once per journey (DB-unique `(order_journey_id, 'order_master')`). Contains the signed Order Pack download link (expiring) and dashboard link. No bank details, no token references, no internal data.

---

### 10. Browser-return / webhook race

After Worldpay return on the saved-card path:

- `/order/:token/confirming-card` shows a polling state: "We are securely confirming your card. Please wait…"
- Polls `order-journey-state` (token-scoped read) every 2s up to 60s.
- Final "Submit order" is **disabled** until `payment_tokens.status='active'`.
- On timeout: keep journey, show "Check again" + "Choose a different payment method", create an `admin_tasks` row of type `card_confirmation_stuck`. Never auto-create a second card-setup session.

---

### 11. Idempotency / uniqueness (DB-enforced)

- `order_journeys`: unique `(quote_id)` partial where state != 'cancelled'.
- `contract_summaries`: ensure existing pattern allows one accepted version per journey; add `(order_journey_id) where status='accepted'` unique if not already present.
- `order_journey_emails`: unique `(order_journey_id, template)`.
- `recurring_payment_authorisations`: unique `(service_id, provider) where status='active'`.
- `invoices`: unique `(service_id, billing_period_start)`; unique `(service_id) where source='first_activation'`.
- `recurring_charge_attempts`: unique `(idempotency_key)`.
- `receipts`: unique `(invoice_id) where status='settled'`.
- `service_activation_outbox`: unique `(service_id, event_type)`.

UI-level disabling is treated as belt-and-braces only.

---

### 12. Cancellation

`cancel-order-journey` (customer during cooling-off, or admin any time pre-activation):

- Sets `order_journeys.state='cancelled'`, records reason, IP/UA (customer only).
- Marks any `manual_fulfilment_orders` for the journey `cancelled` where supplier hasn't been actioned.
- Revokes `recurring_payment_authorisations.status='revoked'`.
- Marks `payment_tokens.status='revoked'` (no future MIT possible).
- Blocks activation: `admin_activate_service` refuses if journey state is `cancelled`.
- No future invoices will be generated (worker checks state).
- Preserves all signed evidence and documents.

Two distinct admin/customer actions, never combined:

1. "Cancel automatic payment authority" — revokes authorisation + token only. Service continues; future invoices go to manual payment link.
2. "Cancel the service / order" — full cancellation above.

---

### 13. New edge functions (additive; old ones untouched)

`order-journey-state` (token-scoped read; returns sanitised state + masked payment method)
`order-decision` (approve/decline)
`order-generate-cs` (wraps existing CS generation)
`order-accept-contract` (writes acceptance + `order_billing_snapshots`)
`order-set-start-date`
`order-choose-payment-method`
`worldpay-card-setup` *(gated on `WORLDPAY_RECURRING_ENABLED`; uses the exact verified token-capable endpoint from step 0)*
`worldpay-token-capture` *(webhook side; AES-GCM encrypt + store)*
`dd-intake-submit`
`order-submit` (creates outbox-free, journey-only artefacts + invokes Order Pack + master email)
`generate-order-pack`
`send-order-master-email` (idempotent on `order_journey_emails`)
`admin-activate-service` (thin wrapper around the SECURITY DEFINER RPC)
`billing-worker` + `billing-schedule-tick`
`worldpay-mit-charge` *(gated on flag, behind outbox)*
Extend `worldpay-webhook` to recognise token-setup / settlement events for new references (`OJ-{journey_id}-*`, `INV-{invoice_id}-*`). Existing `INV-`/`PR-` reference handling is preserved.

Plus customer-facing read RPCs (SECURITY DEFINER, masked):

- `customer_get_order_journey(token_raw)`
- `customer_get_payment_method_summary(order_journey_id)` → returns brand/last4/expiry only
- `admin_get_dd_intake_masked(id)` → last2/last4 only
- `admin_get_payment_token_summary(id)` → brand/last4/expiry only

---

### 14. Out of scope for 5A

- Live DD provider API submission (status flips remain admin-manual).
- Backfilling historical invoices automatically.
- Removing old `/pay/:token` PR flow or `worldpay-payment` HPP.
- Giacom API / supplier provisioning automation.
- Multi-version contract variation UI (schema supports it; UI is later).

---

### 15. Verification gate before flipping `WORLDPAY_RECURRING_ENABLED=true`

All must pass on the OCCTA test merchant in this order, recorded in an admin runbook:

1. `/order/:token` end-to-end with **manual invoice** path: no `services`/`invoices` created at submission; one after activation; webhook flips paid exactly once.
2. `/order/:token` end-to-end with **DD setup** path: intake stored encrypted, admin flip to active is audited, no invoice auto-paid.
3. Step-0 Worldpay capability call returns a token reference for a £0 / minimum-supported verification.
4. Token round-trip: encrypt → decrypt inside `worldpay-mit-charge` → AAD verified → MIT submitted → unique `recurring_charge_attempts` row → settlement webhook → invoice paid exactly once.
5. Idempotency: replay `billing-worker` and `worldpay-mit-charge` for the same invoice — no duplicate invoice, no duplicate charge attempt, no duplicate receipt.
6. Cancellation revokes auth + token; next scheduled tick does not enqueue a charge.
7. TypeScript build clean. Supabase linter clean for new tables/policies.

Only after all seven pass does the flag flip.

---

**Stop. Awaiting approval before creating the migration, edge functions, routes, and UI.**
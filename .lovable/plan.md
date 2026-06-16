Apply these corrections only. Do not rewrite or expand the full Stage 5 plan.

1. WORLDPAY WEBHOOK

Remove every reference to:

“INV-/PR- fail-closed HMAC”

OCCTA uses the verified Worldpay SMB eCommerce gateway flow. Do not introduce an HMAC requirement that the current merchant configuration does not use.

Preserve the currently verified webhook settlement logic exactly.

2. NO PAYMENT DURING ONBOARDING

The customer does not make an initial monthly service payment during the quote-to-order journey.

The payment step only records one of these choices:

- Monthly Direct Debit setup request
- Monthly invoice with secure Worldpay payment link

For invoice-link customers, create the first Worldpay payment request only after admin confirms the service is active and the first invoice becomes due.

3. CUSTOMER CHOOSES MONTHLY PAYMENT DATE

Do not automatically use the service-activation anniversary as the billing date.

During the payment-method step, the customer must choose:

- preferred monthly invoice due date, for invoice-link customers; or
- preferred monthly collection date, for Direct Debit customers.

Store this as the customer-selected billing anchor day.

Support days 1–31. For months without that date, use the last calendar day of the month.

4. FIRST INVOICE AND PRO-RATA

Billing starts only when admin manually confirms the service is genuinely active.

If activation occurs before or after the customer’s chosen billing day:

- calculate the first invoice pro-rata from the actual activation date to the next chosen billing date;
- thereafter use the customer’s selected monthly billing day.

Do not silently replace the customer’s chosen billing day with the activation date.

5. MANUAL FULFILMENT ELIGIBILITY

Do not require an upfront paid Worldpay payment request before the manual fulfilment tracker can be used.

The existing paid/payment-webhook eligibility rule conflicts with the new business model.

For this journey, readiness for manual supplier processing should require:

- final quote continued/approved;
- Contract Summary accepted;
- immutable Contract Summary PDF stored;
- order journey completed;
- preferred start date selected;
- payment method selected;
- no cancellation request;
- cooling-off period completed.

Keep creation of the manual fulfilment tracker as an explicit admin action. Do not automatically create supplier orders or trackers on customer submission.

6. LEGACY EMAIL SUPPRESSION

Do not use:

`if (!journey.consolidated_email_sent)`

as the only legacy-email gate because legacy emails could be sent before the consolidated email exists.

When a quote is using the unified journey:

- suppress Contract Summary ready email;
- suppress Contract Summary accepted email;
- suppress separate welcome email;
- suppress payment-method email;
- suppress quote-approved email;
- suppress order-submitted email.

After successful final submission, send exactly one consolidated onboarding email.

Later operational emails are still allowed:

- service activation confirmation;
- monthly invoice and payment link;
- payment receipt;
- overdue reminder;
- Direct Debit provider confirmation where required.

7. DIRECT DEBIT STATUS AND GUARANTEE

Until OCCTA’s Direct Debit provider has approved the online instruction process, wording and screens, this journey must be described as:

“Direct Debit setup request”

It must not be represented as a live Bacs Direct Debit Instruction or active mandate.

Show the formal Direct Debit Guarantee only from the configured provider-approved template. Do not invent, shorten or paraphrase it.

Initial status:

`setup_requested`

Customer wording:

“We have securely received your Direct Debit setup request. Your Direct Debit is not active yet. OCCTA LIMITED will confirm when it has been established with our payment provider.”

When admin later completes provider setup, send any provider/Bacs-required confirmation or advance notice separately. This is a required payment communication and is not considered a duplicate onboarding email.

8. READINESS AND ACTIVATION

Update readiness logic so it no longer requires a paid payment request before the order can be manually placed with the supplier.

Admin remains responsible for:

- manually placing the order in the Giacom portal;
- recording the supplier reference;
- updating fulfilment status;
- confirming actual service activation.

Only the explicit `Confirm service is active` action may enable automated billing.

9. ORDER SUBMISSION

Customer submission should create or complete the internal customer order record, but must not:

- create a Worldpay payment request;
- create an invoice;
- activate a service;
- submit a supplier order;
- mark Direct Debit active;
- begin billing.

10. APPROVAL GATES

Proceed with the build using:

- 14-day cooling-off calculation as already defined;
- Direct Debit live collection disabled;
- unified-journey legacy emails suppressed from the beginning of the journey;
- existing standalone routes redirected only after parity testing;
- existing Worldpay SMB webhook logic unchanged.  
  
  
  
Stage 5 — Unified Quote-to-Order, Manual Activation & Automated Billing

A single, resumable, professional customer journey at `/quote/:token` covering Quote → Decision → Contract Summary → Acceptance → Start Date → Payment Method → Review → Complete, plus admin manual activation and post-activation automated invoicing. No Giacom API, no auto-activation, no recurring card charging.

### What stays untouched

Existing Worldpay HPP flow, webhook (`INV-`/`PR-` fail-closed HMAC), payment_requests, receipts, immutable Contract Summary PDF + SHA, Customer 360, customer dashboard, communications_log, manual fulfilment tracker, readiness checks. All extended in place — no parallel duplicates.

### Phased delivery (each phase ships behind flags, no regression to live flow)

**Phase A — Unified journey shell & state machine**

- New route component `UnifiedJourney` at `/quote/:token` with 6-step progress UI (Quote · Agreement · Start date · Payment · Review · Complete).
- New table `order_journeys` (journey id, quote_id, contract_summary_id, customer_id nullable, token_hash, current_step, status, decline_reason, decline_notes, preferred_start_date, cooling_off_ends_at, payment_method, idempotency_key, accepted_at, completed_at, ip, ua, timestamps). Strict RLS — token-based read via SECURITY DEFINER RPC only.
- Step state persisted server-side every transition; resume picks up at `current_step`. Expired/invalid token → safe error screen.
- Existing standalone `/quote/:token`, `/quote/contract-summary/:token`, `/quote/payment/:token` remain accessible behind the scenes until Phase G verifies parity, then redirect into the unified journey.

**Phase B — Quote step + decline flow**

- Render approved quote (re-uses `get-quote-by-token`). Buttons: *Continue with this quote* / *Decline quote*.
- Decline modal: reason enum + free text → `journey_decline_events` table; updates Customer 360, creates admin task, single decline acknowledgement (re-uses existing template if present, else suppressed).

**Phase C — Auto Contract Summary + Electronic Acceptance (in-journey)**

- *Continue* calls existing `generate-contract-summary` server-side from locked quote, then renders CS + downloadable PDF inside the journey (no redirect).
- Acceptance panel: 4 separate unticked checkboxes (CS received/read, details correct, charges understood, express consent), typed legal name, confirmed email & mobile.
- Calls existing `accept-contract-summary` (immutable, hashed). Adds new `contract_acceptance_certificates` row (or extends `contract_acceptances`) with: checkbox values JSON, acceptance wording version, UTC + Europe/London timestamps, IP, UA, journey_id, session id, source route, certificate PDF storage key + hash.
- Renders downloadable Acceptance Certificate PDF.

**Phase D — Cooling-off + Start date step**

- Server computes `contract_accepted_at`, `cooling_off_ends_at = end of day 14 days after acceptance (Europe/London)`, `earliest_selectable_start_date = next day`.
- Date picker enforces server-validated minimum. Stored on `order_journeys` with timestamp/IP/UA. Clear copy: "preferred, subject to network availability".

**Phase E — Payment method step**

*Option A — Direct Debit (setup-request only, feature-gated for live collection)*

- New table `payment_methods` (customer_id, journey_id, method, billing_anchor_day, dd_setup_status, masked_account_last4, masked_sort_last2, consent_version, consent_at, ip, ua).
- New table `dd_intake_requests` with `bank_details_ciphertext bytea`, `enc_key_id`, `enc_alg='AES-256-GCM'`, `nonce`, `auth_tag`, encrypted exclusively in a new `dd-encrypt`/`dd-decrypt` edge function using `DD_FIELD_ENC_KEY` secret. **Direct `SELECT` on ciphertext columns revoked from `authenticated**`; admin retrieval only via `admin-reveal-dd-details` edge function which requires re-auth, logs reason, and writes to `audit_logs`.
- New config table `dd_provider_config` (provider name, SUN nullable, DDI template version, Guarantee version, advance-notice days, support contact, approval date, `live_collection_enabled boolean default false`).
- Customer-facing status wording: "Direct Debit setup requested" until admin marks active. Hard rule: no "active/submitted/will be charged" language unless `live_collection_enabled` and admin confirmation.
- Required consent checkbox stored with versioned wording.

*Option B — Monthly invoice + Worldpay link* (re-uses existing HPP flow per invoice; no tokenisation).

**Phase F — Review + idempotent Submit**

- Full review screen; *Submit my order* posts with `idempotency_key` (UUID minted on first render of review). Server uses `UNIQUE(idempotency_key)` on `order_journeys` to make resubmits no-ops.
- Submission creates/updates: `orders` (extended), `payment_methods`, links manual_fulfilment_orders row (existing eligibility trigger satisfied because CS is accepted + PDF stored), suppresses legacy automated emails, enqueues consolidated email.

**Phase G — Consolidated onboarding email + combined PDF pack**

- New edge function `send-order-onboarding` (idempotent on `order_journeys.id`) replaces 6 legacy mails (welcome, CS-ready, CS-accepted, payment-method, order-submitted, quote-approved) — legacy senders gated by `if (!journey.consolidated_email_sent)`.
- New edge function `generate-order-pack` builds a single PDF: Cover, Approved Quote, Official CS (re-uses stored CS PDF bytes), Contract Information reference, Acceptance Certificate, Cooling-off + start date, Payment confirmation, DD Guarantee/setup (masked), What happens next, Contacts. Stored under `order-packs` bucket with SHA + storage key on `order_journeys`.
- Email body lists order ref, approved quote ref, package, charges, term, preferred start, cooling-off end, payment method, billing anniversary, DD setup status, timeline, dashboard link, single download CTA. Attachment + tokenised fallback link.
- Once toggled live, redirect old standalone routes into the unified journey.

**Phase H — Customer account linking + Referrals (audit-first)**

- "Create your OCCTA account" CTA on the completion page. New SECURITY DEFINER RPC `link_journey_to_user(journey_id, token)` validates token + email match, atomically writes `customer_id` onto journey, orders, payment_methods, manual_fulfilment_orders, future invoices.
- Referrals: extend existing `referral_codes`/`reward_accounts`. If absent, scaffold tracking only — no auto-applied credits.

**Phase I — Admin Customer 360 extensions**

- New `AdminJourneyTimeline` panel (re-use existing component, extend with new milestones).
- "Confirm service is active" admin action: dialog (actual activation date, reference, optional supplier ref, notes, confirmation checkbox + warning). Atomic transaction: updates service → `active`, sets `actual_activation_date`, calculates `billing_anchor_day` (preserves 1–31, shorter months use last day), enqueues `service_activation_outbox` row, sends single service-activation email. Idempotent on `service_id`.
- "Reveal bank details for provider setup" gated action (re-auth, reason, audit).

**Phase J — Pro-rata engine + monthly billing scheduler**

- New deterministic `lib/billing/proRata.ts` (server + shared) using integer minor units; formula `round((monthly_minor * billable_days) / cycle_days)`. Stores inputs + result on `invoice_lines.metadata`; renders explanatory line on invoice PDF.
- New edge function `run-monthly-billing`, scheduled daily via `pg_cron` + `pg_net` with `x-cron-secret`. For each `services.status='active'`:
  - Compute next billing date from `billing_anchor_day` (Europe/London, last-day fallback for 29–31).
  - Idempotency: `UNIQUE(service_id, billing_period_start, billing_period_end, invoice_type)`.
  - Generate invoice from `order_billing_snapshots` (new immutable JSON taken at order submission, not from live catalogue).
  - For invoice-link customers: create linked Worldpay payment_request (existing flow), send 1 invoice email with PDF + Pay Now link, due = anniversary, issue = anniversary − configurable days (default 7).
  - For DD customers: mark `awaiting_direct_debit` or `dd_setup_pending`; admin records collection outcome (`pending|submitted|collected|failed|indemnity_claim|cancelled`). No auto submission to provider.
- Payment statuses still flip only via verified Worldpay webhook (no change).

**Phase K — Cooling-off cancellation, dashboard, security hardening, E2E**

- Dashboard "Request cancellation" during cooling-off → admin task; no auto-cancel.
- Dashboard tabs extended: Order, Documents (incl. combined pack), Billing (DD status, anniversary, next invoice, history), Referrals.
- Security: RLS policies on all new tables, token hashes only at rest, DB-level rate limits on token endpoints, audit_logs entries for every DD reveal / admin activation / decline.
- E2E (Playwright) for Test A (invoice path), Test B (DD path), Test C (decline), Test D (duplicate/refresh/double-click/expired token/webhook retry).

### Technical details

- **Tables added (all with `GRANT` + RLS):** `order_journeys`, `journey_decline_events`, `payment_methods`, `dd_intake_requests`, `dd_provider_config`, `order_billing_snapshots`, `service_activation_outbox`, `billing_runs`, `billing_events`, `invoice_email_events`, optional `contract_acceptance_certificates`.
- **Tables extended:** `orders` (+ journey_id, payment_method, billing_anchor_day), `services` (+ actual_activation_date, billing_anchor_day, billing_enabled, next_billing_date), `invoices`/`invoice_lines` (+ pro-rata metadata), `contract_acceptances` (+ certificate hash if not separate table).
- **Edge functions added:** `journey-state`, `journey-decline`, `journey-submit`, `dd-encrypt`, `admin-reveal-dd-details`, `generate-order-pack`, `send-order-onboarding`, `confirm-service-active`, `run-monthly-billing`, `record-dd-collection-outcome`.
- **Edge functions reused unchanged:** `worldpay-payment`, `worldpay-webhook`, `generate-contract-summary`, `accept-contract-summary`, `get-quote-by-token`, `get-contract-summary-by-token`.
- **Cron:** daily `run-monthly-billing` with `x-cron-secret`; daily anonymisation/quote-expiry unchanged.
- **Secrets needed (will request via secrets tool when build starts):** `DD_FIELD_ENC_KEY` (32-byte base64), `CRON_SECRET` (if not already set).
- **Feature flags (platform_settings):** `unified_journey_enabled`, `dd_live_collection_enabled` (default false), `legacy_onboarding_emails_suppressed`.

### Out of scope (explicitly not built)

Giacom API, auto supplier submission, auto activation, recurring card tokenisation, stored cards, auto monthly card charging, multiple onboarding emails, DD provider live submission.

### Approval gates before build

1. Confirm `DD_FIELD_ENC_KEY` will be added when prompted.
2. Confirm cooling-off interpretation (14 calendar days, end-of-day Europe/London, earliest start = day 15) is correct.
3. Confirm legacy `/quote/contract-summary/:token` and `/quote/payment/:token` may be redirected into the unified journey after Phase G parity test.
4. Confirm DD live collection stays gated off until provider approval is supplied separately.
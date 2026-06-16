Continue with Stage 5 Phase G only.

Build post-submission cooling-off cancellation and secure customer-account linking.

Keep `unified_journey_enabled` OFF by default.

CANCELLATION

Add:

- `cancelled_at`
- `cancellation_reason`
- `cancellation_notes`
- `cancellation_token_hash`
- `cancellation_token_expires_at`
- `cancellation_token_used_at`
- `linked_customer_id`
- `linked_at`

Create append-only `journey_cancellation_events`.

Customer wording:

“You can cancel this agreement during your 14-day cooling-off period, which ends on [date and time].”

Display dates in Europe/London.

The customer may cancel only while:

- journey is completed;
- journey is not already cancelled;
- current time is within `cooling_off_ends_at`;
- no status exists that requires manual compliance review.

CANCELLATION FLOW

1. Customer selects `Cancel order`.
2. Show reason choices and optional notes.
3. Require one unticked confirmation checkbox.
4. Generate a cryptographically random, single-use confirmation token.
5. Store only its SHA-256 hash.
6. Token expires after no more than 30 minutes.
7. Confirm cancellation server-side.
8. Mark journey cancelled immediately.
9. Record immutable evidence.
10. Send one cancellation confirmation email.
11. Create an urgent admin task to check any manual Giacom/off-platform action.

Do not automatically:

- cancel anything in Giacom;
- cancel or alter services;
- cancel invoices;
- cancel payment requests;
- alter Worldpay;
- alter DD provider records.

If the linked internal order cannot be updated atomically:

- preserve the cancellation evidence;
- create a high-priority reconciliation task;
- never silently discard the customer’s cancellation.

CANCELLATION EVIDENCE

Record:

- journey reference;
- order reference;
- exact confirmation wording/version;
- reason code;
- optional notes;
- UTC timestamp;
- Europe/London timestamp;
- IP address;
- user agent;
- actor type;
- journey-token hash/reference;
- cancellation-token hash;
- confirmation-email status.

Use constrained reason and actor values.

CANCELLED STATE

After cancellation:

- display `CancelledStep`;
- block all further journey transitions server-side;
- block payment-method changes;
- block review/submission;
- block fulfilment eligibility;
- block billing eligibility;
- block activation eligibility.

CANCELLATION EMAIL

Send exactly one idempotent confirmation email containing:

- customer name;
- order reference;
- cancellation date/time;
- confirmation that the request has been recorded;
- statement that OCCTA will contact them only if further action is required;
- support/dashboard link.

Do not include:

- IP address;
- tokens;
- bank details;
- supplier details;
- internal notes.

ACCOUNT LINKING

Do not store journey or linking tokens in:

- localStorage;
- sessionStorage;
- analytics;
- logs.

Use a short-lived, single-use account-linking nonce.

Requirements:

- user must be authenticated;
- JWT must be validated server-side;
- completed journey required;
- verified email must match;
- journey must not be linked to another account;
- update must be atomic;
- nonce must expire and be single-use.

If token/nonce appears in the URL:

- exchange it immediately;
- remove it using `history.replaceState`;
- never persist it in browser storage.

If already linked to the same user, return success.

If linked to another user:

- fail closed;
- create a security audit event.

RLS

For cancellation events:

- customer may read only events belonging to their linked journey;
- authorised staff may read according to role;
- clients may not insert/update/delete directly;
- insertion occurs only through server-side functions;
- evidence is append-only.

JOURNEY STATE

Extend `journey-state` to return:

- cooling-off end;
- cancellable boolean;
- cancelled timestamp;
- cancellation reason;
- linked-account status.

EDGE FUNCTIONS

Build:

- `journey-cancel-request`
- `journey-cancel-confirm`
- `journey-link-to-account`

JWT rules:

- cancel-request: secure journey token validation;
- cancel-confirm: journey token plus single-use confirmation token;
- account-link: JWT verification required.

VERIFY

Confirm:

- cancellation works within the cooling-off period;
- expired window returns safe failure;
- wrong confirmation token fails;
- confirmation token expires;
- confirmation token is single-use;
- double-click creates one event and one email;
- cancelled journey cannot continue;
- account linking rejects missing/invalid JWT;
- tokens never enter localStorage/sessionStorage;
- URL token is removed after exchange;
- journey/order states remain consistent;
- one urgent admin task is created;
- no invoice, PR, receipt, DD mandate, service, Worldpay or supplier action occurs;
- legacy flow remains untouched while the feature flag is OFF;
- TypeScript/build passes.

Stop after the Phase G verification report. Do not start Phase H.  
  
  
Phase G — Cooling-off cancellation + dashboard linkage

Scope: post-submission only. Feature flag `unified_journey_enabled` stays OFF by default. No edits to legacy checkout/Worldpay/invoice/PR/DD/fulfilment flows.

### 1. Database (new migration)

- `order_journeys`: add `cancelled_at timestamptz`, `cancellation_reason text`, `cancellation_notes text`, `cancellation_token_hash text unique`, `linked_customer_id uuid references auth.users(id)`, `linked_at timestamptz`.
- New table `journey_cancellation_events` (id, journey_id fk, reason_code, reason_text, ip, ua, created_at, actor_type). GRANT to authenticated + service_role; RLS: select via `has_role` admin OR journey owner; insert service_role only.
- Index `order_journeys_cancellation_token_hash_idx` (unique, partial where not null).
- Index `order_journeys_linked_customer_id_idx`.
- Trigger: when `order_journeys.status` flips to `cancelled`, mark linked `guest_orders` row `status='cancelled'` (best-effort, only if status currently `pending`/`submitted`). No invoice/PR/DD/service touched.

### 2. Edge functions (3 new, all `verify_jwt = false` in `config.toml`)

- `journey-cancel-request` (POST { token }): rate-limited per IP, looks up active completed journey by `token_hash`, verifies `now() <= cooling_off_ends_at`, generates one-time `cancellation_token` (returns plain, stores SHA-256 hash + 30-min TTL via separate column or reuses existing). Returns masked confirmation summary + token.
- `journey-cancel-confirm` (POST { token, cancellation_token, reason_code, reason_text? }): validates both hashes, enforces cooling-off window server-side, flips `order_journeys.status='cancelled'`, sets `cancelled_at`, inserts `journey_cancellation_events`, sends confirmation email via `sendResendEmail` (brutalist shell, escapeHtml), fires `admin-notify`. Idempotent: second call returns `{ ok: true, already: true }`.
- `journey-link-to-account` (POST, JWT-authed): authed user with completed journey token can link their `auth.uid()` to `order_journeys.linked_customer_id` + matching `guest_orders.customer_id` (email match required as secondary check). Idempotent. No data merge into existing customer profile beyond the FK.

### 3. UI

- `src/pages/quote/journey/CompletedStep.tsx` (extend existing): show cooling-off countdown ("You can cancel without penalty until DD MMM YYYY HH:mm"), "Cancel order" button → opens `CancelDialog`. Hide button once window expires.
- New `src/pages/quote/journey/CancelDialog.tsx`: 2-step (request → confirm with reason dropdown + optional notes + final consent checkbox). Reasons enum mirrors `journey-decline` set.
- New `src/pages/quote/journey/CancelledStep.tsx`: shown when `journey.status === 'cancelled'`. Confirmation copy + support contact.
- `UnifiedJourney.tsx`: route `cancelled` status to `CancelledStep`; keep `completed` → `CompletedStep` (now interactive).
- Dashboard linkage UI: extend `src/components/dashboard/CustomerJourneyTimeline.tsx` — if signed-in user has a quote token in localStorage (`pending_journey_token`) OR query param `?link=<token>`, call `journey-link-to-account` once and show "Order linked to your account" toast. Linked orders surface via existing `guest_orders.customer_id` query path (no new dashboard tab).

### 4. `journey-state` update

- Surface `cancellation_window`: `{ ends_at, cancellable: boolean, cancelled_at, cancellation_reason }` in response so the UI can render the countdown without a separate fetch.

### 5. Out of scope (explicitly untouched)

`invoices`, `payment_requests`, `receipts`, `dd_mandates`, `services`, `manual_fulfilment_orders`, `payment_attempts`, `worldpay-*`, `installation_*`, `Checkout.tsx`, `PreCheckout.tsx`, `ThankYou.tsx`, `Pay.tsx`, `accept-contract-summary`, `customer-proceed-with-quote`.

### 6. Verification (after build)

E2E (cancel inside window → status flips + email + admin notify + guest_orders cancelled), idempotency (double-cancel returns `already:true`), negative (expired window → 409, wrong cancellation_token → 401, missing reason → 400, rate-limit → 429), legacy regression (flag OFF unchanged), security (cancellation token hashed, IP/UA captured, no PII leak in email), TypeScript/build pass.

Stop after Phase G verification report. Do not start Phase H.
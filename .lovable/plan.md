Approved — proceed with Phase E Worldpay SMB HPP Webhook Mode, with the corrections below.

Worldpay has confirmed OCCTA is on SMB Worldpay eCommerce gateway, not Access Enterprise.

Set:

`WORLDPAY_GATEWAY_TYPE=smb_ecommerce`

Do not require `WORLDPAY_WEBHOOK_SECRET` in SMB mode.

Keep Access Enterprise/HMAC branch only for future compatibility.

Critical correction 1 — amount/currency validation by event type

Do not require `eventDetails.amount.value` and `eventDetails.amount.currencyCode` for every event.

Required for paid-state event:

- `sentForSettlement` must have amount.value and currencyCode.
- Amount must exactly match PR amount in minor units.
- Currency must exactly match PR currency, GBP.

For these events:

- `sentForAuthorization`
- `authorized`
- `cancelled`
- `expired`

Validate amount/currency if present. If missing, log safely and do not mark paid.

For these events:

- `refused`
- `error`

Do not reject solely because amount is missing. Worldpay examples may not include amount for these failure events. Match by `transactionReference`, then mark failed only if current PR is not already paid/completed.

Critical correction 2 — transactionReference must be unguessable

Because SMB mode has no HMAC secret, never rely on a public/simple reference.

Only accept webhook if:

- `eventDetails.transactionReference` exactly equals `payment_requests.provider_reference`
- provider_reference is the Worldpay-generated/session transaction reference, not customer-facing PR number alone
- PR is CS-linked
- PR is not already terminal unless duplicate/idempotent
- amount/currency match for `sentForSettlement`

Critical correction 3 — paid only on sentForSettlement

Do not mark paid on:

- `sentForAuthorization`
- `authorized`
- browser return
- admin manual action
- customer action

Only `sentForSettlement` can mark paid, and only after all checks pass.

Critical correction 4 — webhook acknowledgement

Return HTTP 200 for safely handled business rejects such as:

- unknown reference
- unsupported event
- duplicate event
- amount mismatch
- currency mismatch

But make sure there is no state change except safe audit/event logging.

Return 400 only for malformed JSON or invalid basic shape where no useful event can be interpreted.

Critical correction 5 — no downstream artefacts

Even after payment becomes paid:

Do not create:

- supplier orders
- services
- invoices
- DD mandates
- provisioning rows
- installation bookings
- telecom orders
- automatic emails

Phase E closes payment verification only. Supplier ordering remains a later phase.

Verification after deploy:

1. Confirm webhook URL:  
`https://oexgjmuvgdndizsufipe.functions.supabase.co/worldpay-webhook`
2. Confirm Worldpay payment events enabled.
3. Confirm:  
`WORLDPAY_GATEWAY_TYPE=smb_ecommerce`
4. Create fresh CS-linked internal test PR:  
`INTERNAL TEST — DO NOT PROCESS`
5. Complete a small Live card payment only after admin confirmation.
6. Report events received:

- sentForAuthorization
- authorized
- sentForSettlement
- refused/cancelled/expired/error if any

7. Confirm PR becomes paid only on `sentForSettlement`.
8. Run negative tests:

- wrong transactionReference rejected/no state change
- wrong amount rejected/no state change
- wrong currency rejected/no state change
- duplicate event idempotent
- browser return cannot mark paid
- customer cannot mark paid
- admin cannot manually mark paid

9. Confirm no downstream artefacts created.

Do not close Phase E until the Live SMB webhook test passes safely.  
  
  
  
  
Phase E — Worldpay SMB HPP Webhook Mode

Worldpay confirmed OCCTA is on the **SMB eCommerce gateway**, not Access Enterprise. SMB HPP does not provide an HMAC signing secret, so the current `WORLDPAY_WEBHOOK_SECRET`-gated path cannot ever succeed. We replace HMAC with strict SMB payload validation while keeping payment safety intact.

No supplier orders, services, invoices, DD mandates, provisioning, or installation bookings are created by this phase. Browser return and manual admin actions still cannot mark a PR paid.

## Scope

Only the webhook function and one new secret. No frontend or DB schema changes required. No payment_request status enum widening — `authorized_pending_settlement` (intermediate) is recorded on `payment_request_events` + `metadata`, not in `status` (which is constrained).

## Secrets

- Add: `WORLDPAY_GATEWAY_TYPE` (value `smb_ecommerce`).
- Keep: existing Worldpay Live API secrets.
- No `WORLDPAY_WEBHOOK_SECRET` required in SMB mode (HMAC path skipped when gateway type is `smb_ecommerce`). Access Enterprise path is preserved for future use.

## File: `supabase/functions/worldpay-webhook/index.ts` (rewrite)

Behaviour:

1. **Method gate** — only `POST` accepted (plus `OPTIONS` for CORS). Anything else → `405`, no state change.
2. **Mode select** — read `WORLDPAY_GATEWAY_TYPE`. Default `smb_ecommerce`. If `access_enterprise`, keep current HMAC verification path unchanged.
3. **Parse** — `await req.text()` then `JSON.parse`. On parse failure → `400`, audit `worldpay_webhook_malformed`, no state change.
4. **SMB shape validation** — require all of:
  - `eventId` (string)
  - `eventTimestamp` (string)
  - `eventDetails` (object)
  - `eventDetails.classification === 'payment'`
  - `eventDetails.transactionReference` (string)
  - `eventDetails.type` (string)
  - `eventDetails.amount.value` (number, minor units)
  - `eventDetails.amount.currencyCode` (string)
   Any missing → `400`, audit `worldpay_webhook_invalid_shape` with the missing key list (no payload PII), no state change.
5. **Allowed event types** (case-sensitive):
  - `sentForAuthorization` → log only, no status change.
  - `authorized` → record intermediate via `payment_request_events.event_type = 'authorized_pending_settlement'` + `metadata.last_provider_event = 'authorized'`. PR `status` stays `checkout_created`/`pending`. No supplier/service/invoice/DD/provisioning side effects.
  - `sentForSettlement` → the only event allowed to mark `paid` (after all matches).
  - `refused`, `cancelled`, `expired`, `error` → mark `status='failed'` (or `'cancelled'` for `cancelled`) ONLY if current status is not already a terminal `paid`/`completed`. Never override `paid`.
  - Anything else → log to `audit_logs` as `worldpay_webhook_unsupported_event` and return `200` without state change.
6. **Reference match** — `eventDetails.transactionReference` must equal an existing `payment_requests.provider_reference` exactly. No prefix fallback in SMB mode. No match → `200` with audit `worldpay_webhook_unknown_reference`, no state change.
7. **CS-linked guard** — matched PR must have `contract_summary_id IS NOT NULL`. Otherwise audit `worldpay_webhook_non_cs_linked_rejected` and return `200` without state change.
8. **Amount/currency match** — `eventDetails.amount.value === round(pr.amount * 100)` AND `eventDetails.amount.currencyCode.toUpperCase() === pr.currency.toUpperCase()` (default `GBP`). Mismatch → audit `worldpay_webhook_amount_mismatch` + `payment_request_events('webhook_amount_mismatch')`, no status change, return `200`.
9. **Idempotency**:
  - If PR already `paid`/`completed` with `webhook_verified=true`, treat as duplicate: insert a `payment_request_events('duplicate_webhook')` with `eventId`, return `200`.
  - De-dup by `eventId`: before any state change, check `payment_request_events` for an existing event row whose `metadata->>'eventId'` equals incoming `eventId`. If present, return `200` no-op.
  - Paid terminal state is immutable.
10. **Paid path** (only when event type is `sentForSettlement` AND all checks pass):
  - `UPDATE payment_requests SET status='paid', paid_at=now(), webhook_verified=true, provider_payment_id=eventDetails.transactionReference (or providerTransactionId if present), completed_at=now(), updated_at=now(), metadata = metadata || jsonb_build_object('last_provider_event','sentForSettlement','last_event_id',eventId) WHERE id=pr.id AND status NOT IN ('paid','completed')`.
    - Insert `payment_request_events('paid_via_webhook', { eventId, transactionReference, amount_minor, currency, payload_sha256 })`.
    - Insert `audit_logs('payment_received_webhook', 'payment_request', pr.id, { eventId, amount, cs_linked:true, gateway:'smb_ecommerce' })`.
    - DO NOT create invoices, services, supplier orders, DD mandates, installation bookings, provisioning rows. DO NOT send emails.
11. **Failure path** (`refused`/`cancelled`/`expired`/`error`):
  - Skip if PR already `paid`/`completed`.
    - Update `status` to `failed` (`cancelled` for `cancelled` event), set `failed_at=now()`, append to `metadata.last_provider_event` and `last_event_id`.
    - Insert `payment_request_events('failed_via_webhook' | 'cancelled_via_webhook', { eventId, type })`.
12. **Stored event summary** — only safe fields: `eventId`, `transactionReference`, `type`, `amount.value`, `amount.currencyCode`, `eventTimestamp`, and `payload_sha256` (SHA-256 of raw body) for diagnostics. Never store raw card data. Raw payload NOT echoed to customers; admin diagnostics only via `audit_logs`/`payment_request_events`.
13. **Response codes**:
  - `200` for accepted, duplicate, unknown-reference, unsupported-event, amount mismatch (still 200 so Worldpay does not retry endlessly, but no state change).
    - `400` for malformed JSON or missing required SMB fields.
    - `405` for non-POST.
14. **Browser return / admin manual** — unchanged. `worldpay-payment` `verify-payment` remains read-only; no admin endpoint may set `status='paid'` (existing constraint).

## Technical details

- New helper: `sha256Hex(body: string)` using `crypto.subtle.digest('SHA-256', …)`.
- New helper: `validateSmbPayload(payload)` returning `{ ok, missing[] } | { ok:true, data }`.
- New helper: `findEventByEventId(supabase, prId, eventId)` querying `payment_request_events` (filter `request_id=prId` and `metadata->>'eventId'=eventId`).
- Mode switch at top of `serve`: `const gateway = Deno.env.get('WORLDPAY_GATEWAY_TYPE') ?? 'smb_ecommerce';`
  - `smb_ecommerce` → new SMB pipeline (this plan).
  - `access_enterprise` → existing HMAC pipeline (kept verbatim for forward compat; still requires `WORLDPAY_WEBHOOK_SECRET`).
- Keep existing `processPaymentRequestWebhook` style helper but specialised for SMB events; remove `INV-` legacy path from the SMB branch (CS-linked PRs only). Legacy `INV-` handling stays only under `access_enterprise` mode to avoid regressing historical invoice flow under that mode.

## Verification (after deploy — Live test)

A. Config:

- Confirm Worldpay Live dashboard webhook URL = `https://oexgjmuvgdndizsufipe.functions.supabase.co/worldpay-webhook`.
- Confirm payment events enabled in Worldpay dashboard.
- Confirm `WORLDPAY_GATEWAY_TYPE=smb_ecommerce` set.

B. Live transaction (admin only):

- Admin creates fresh CS-linked PR titled `INTERNAL TEST — DO NOT PROCESS`.
- Small Live card payment completed.
- Capture and report inbound events: `sentForAuthorization`, `authorized`, `sentForSettlement`, plus any others.
- Confirm PR flips to `paid` only on `sentForSettlement` with matching ref/amount/currency.

C. Negative tests (manual curl against deployed webhook):

- Wrong `transactionReference` → 200, no state change, audit `worldpay_webhook_unknown_reference`.
- Wrong `amount.value` → 200, no state change, audit + event row recorded.
- Wrong `currencyCode` (`EUR`) → 200, no state change.
- Repeat valid `sentForSettlement` with same `eventId` → 200, no duplicate state change, `duplicate_webhook` event recorded.
- Browser return cannot mark paid (existing read-only verify endpoint).
- Customer cannot mark paid (RLS unchanged).
- Admin cannot manually mark paid (no admin update path exists for PR `status='paid'`).

D. No downstream artefacts — query before/after counts unchanged for:
`services`, `invoices`, `dd_mandates`, `provisioning_readiness`, `installation_bookings`, `orders`, supplier order tables, `draft_order_packs`. Only `payment_requests`, `payment_request_events`, `audit_logs` change.

E. Build:

- `tsc --noEmit` and Vite build pass (only edge function changed).

## What this plan does NOT do

- Does not start supplier ordering.
- Does not activate services, create invoices, DD mandates, provisioning rows, installation bookings.
- Does not change Worldpay HPP creation logic in `worldpay-payment`.
- Does not send automatic emails.
- Does not modify the `payment_requests` status enum.
- Does not close Phase E — closure only after the Live SMB webhook test above passes safely.
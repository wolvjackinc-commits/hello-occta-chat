Approved — proceed with Stage 3: Finance, Receipts, Invoices & Timeline, with the corrections below.

&nbsp;

This stage is finance visibility + payment receipt only.

&nbsp;

Do not start:

&nbsp;

- supplier automation

- service activation

- recurring billing automation

- automatic invoice generation

- automatic DD mandate creation

- provisioning

- payment status writes outside Worldpay webhook

&nbsp;

Worldpay webhook "sentForSettlement" remains the only source of truth for paid status.

&nbsp;

Correction 1 — never return or log raw receipt tokens

&nbsp;

In "send-payment-received-email":

&nbsp;

- generate raw receipt token only inside the function

- store only SHA-256 hash

- raw token may only appear inside the customer email URL

- do not return raw token in API response

- do not log raw token

- do not include raw token in final verification report

- do not expose raw token in admin UI

&nbsp;

For testing, verify by using the email link or by admin resend flow, not by printing the raw token.

&nbsp;

Correction 2 — payment route format

&nbsp;

The active payment route is:

&nbsp;

"/pay?token=..."

&nbsp;

Do not introduce "/pay/:token".

&nbsp;

In PaymentsTab, Pay button should use:

&nbsp;

"/pay?token=<token>"

&nbsp;

only if the existing secure token flow exposes a safe usable token/path.

&nbsp;

If no raw token is available to the dashboard safely, show:

"Payment link sent by email"

and allow admin to resend payment link.

&nbsp;

Correction 3 — receipt route security

&nbsp;

Receipt routes may be:

&nbsp;

- "/dashboard/receipt/:id" for authenticated customer/staff

- "/receipt/:token" for email token access

&nbsp;

The token route must:

&nbsp;

- only work for paid + webhook_verified PR

- expire

- be scoped to that payment receipt

- not expose token hash

- deny wrong/expired/unpaid token

&nbsp;

Correction 4 — no new invoice automation

&nbsp;

Invoices section is visibility-only.

&nbsp;

Do not create invoices automatically from paid payment requests.

&nbsp;

If invoices exist, display them.

If no invoices exist, show:

"Invoice automation is not enabled yet. Your card payment receipt is available in Receipts."

&nbsp;

Correction 5 — Direct Debit is status-only

&nbsp;

DD section is status/placeholder only.

&nbsp;

Do not create a mandate.

Do not send DD setup link unless there is already a safe existing manual flow.

&nbsp;

Correction 6 — webhook email idempotency

&nbsp;

If "worldpay-webhook" calls "send-payment-received-email" after paid:

&nbsp;

- call it only after the PR has been marked "paid"

- make the email function idempotent by "payment_request_id + template_name='payment_received'"

- failure to send email must not undo paid status

- log failure in communications_log

- do not retry infinitely

&nbsp;

Correction 7 — receipt PDF/source of truth

&nbsp;

Receipt must be derived from immutable paid payment data:

&nbsp;

- amount

- currency

- paid_at

- provider_payment_id

- payment_request_number

- related Contract Summary

&nbsp;

Receipt view/download must not change payment status.

&nbsp;

Correction 8 — admin resend receipt email

&nbsp;

Admin can resend payment received/receipt email only when:

&nbsp;

- PR is paid

- webhook_verified = true

- paid_at not null

&nbsp;

Resend must not change PR status.

&nbsp;

Verification target

&nbsp;

Use:

&nbsp;

"PR-260612-TZ6D9R"

&nbsp;

Verify:

&nbsp;

1. Payment receipt available.

2. Payment received email sent/logged or resend works.

3. Customer dashboard Payments & Receipts shows the paid PR.

4. Documents hub shows receipt.

5. Admin CustomerDetail Finance panel shows:

   - paid

   - webhook_verified

   - paid_at

   - provider reference

   - receipt link

   - communication log

6. No raw token is returned/logged.

7. Wrong-user/anon access denied unless valid receipt token.

8. No duplicate payment received email on retry.

9. PR status, paid_at, webhook_verified and provider_payment_id unchanged.

10. No new services, invoices, DD mandates, supplier orders, manual fulfilment orders, provisioning or installation rows.

&nbsp;

Final report must include:

&nbsp;

- files changed

- receipt result

- payment received email result

- customer Payments & Receipts result

- Documents hub result

- admin Finance panel result

- invoice visibility result

- DD status placeholder result

- timeline sync result

- RLS/wrong-user/anon result

- idempotency result

- token safety result

- no-side-effect result

- TypeScript/build result

&nbsp;

Stop after Stage 3. Do not start Stage 4.

# Stage 3 — Finance, Receipts, Invoices & Timeline

Goal: clean, branded finance visibility for customer + admin after a Worldpay-verified payment. Read-mostly: no new supplier/service/invoice/DD automation. Worldpay webhook remains sole source of truth for `paid`.

## Test target

`PR-260612-TZ6D9R` — already `paid`, `webhook_verified=true`, `paid_at` set, linked to a Contract Summary. No receipt row, no payment-received email yet.

---

## 1. Branded customer-safe receipt

New edge function `get-payment-receipt` (verify_jwt=true) — returns a sanitized payload from `payment_requests` joined with `contract_summaries`:

Exposed: receipt_ref (derived from PR number, e.g. `RCPT-<PR-number>`), payment_request_number, customer_name, account_number, amount, currency, paid_at, provider=`Worldpay`, provider_payment_id, status, related CS number + plan_name + monthly price.

Blocked: raw metadata, token_hash, supplier cost, margin, internal notes, webhook payload.

Auth modes:

- Authenticated path: `?id=<pr_id>` — caller must be owner (`user_id = auth.uid()`) or staff.
- Token path: `?token=<raw>` — SHA-256 hashed lookup, only if PR is `paid` and within `expires_at + 30 days`. Used for the receipt URL embedded in the email.

New page `/receipt/:token` + authenticated `/dashboard/receipt/:id`: brutalist branded receipt screen, print/PDF via existing `generateReceiptPdf` pattern (extend to take PR data, not just invoice).

## 2. Payment-received email (idempotent)

New edge function `send-payment-received-email` (service-role internal + admin-callable for resend):

1. Load PR; must be `paid` + `webhook_verified` + `paid_at`.
2. Idempotency: check `communications_log` for `template_name='payment_received'` + same `payment_request_id` + `status='sent'`. If found and `force=false`, return `{already_sent:true}`.
3. Mint a fresh signed receipt token (hash-stored on PR `metadata.receipt_token_hash`, raw in email only) — does NOT touch `status`/`paid_at`.
4. Render branded HTML (warm tone — thank you, amount, ref, paid date, receipt link, "we're preparing your setup", support contact).
5. Send via existing Resend wrapper, insert `communications_log` row with template_name + provider_message_id + metadata.
6. `log_event` (`system`, `payment_received_email_sent`, severity info).

Trigger: add idempotent call at the end of the existing `worldpay-webhook` flow ONLY in the branch that already flipped PR to paid (no change to paid logic, no change to settlement rules). Failure swallowed + logged — never reverses paid status.

## 3. Customer dashboard — Payments & Receipts section

New tab/section `PaymentsTab` (`src/components/dashboard/tabs/PaymentsTab.tsx`):

- Lists `payment_requests` for `user_id = auth.uid()` (RLS already in place).
- Per row: PR number, amount, status badge, related CS link, timeline pills (requested → opened → paid/failed), Pay button (if `pending`/`checkout_created` + token unexpired) → `/pay/:token`, Receipt button (if paid) → `/dashboard/receipt/:id`.
- No raw provider payload exposed.

Wire into `Dashboard.tsx` tabs list.

## 4. Documents hub

Extend `DocumentsTab` to add a "Payment receipts" group built from paid PRs (lazy signed link via `get-payment-receipt`). Final quote + CS + signed CS already present from Stage 2.

## 5. Admin Customer 360 finance panel

Update `src/pages/admin/CustomerDetail.tsx`:

- New "Finance" panel: payment requests table with status, `webhook_verified` badge, paid_at, amount, provider_payment_id, receipt link, communications subrow (payment emails for that PR).
- Buttons: "Resend payment link" (existing send flow, only if unpaid) and "Resend receipt email" (calls `send-payment-received-email` with `force=true`, only if paid). Neither button mutates PR status.

## 6. Invoices visibility

`InvoicesTab.tsx` already shows unpaid/paid/receipts. Audit + polish only (no new generation):

- If user has zero invoices AND any paid PR: show notice "Invoice automation not enabled yet — your card payment receipt is in the Receipts section."
- Admin side: add small invoices-for-customer list inside CustomerDetail Finance panel with status + send/resend if existing `send-email` invoice template exists; otherwise hide buttons.

## 7. Direct Debit / Payment Method placeholder

New small `DirectDebitStatus`-style block in dashboard:

- If `dd_mandates` row exists for user → show its status (existing component already renders this).
- Else → "Direct Debit setup is not active yet." No "create mandate" button in Stage 3.

Admin CustomerDetail: show DD status row in Finance panel (read-only). No auto-create.

## 8. Finance timeline events

Extend `CustomerJourneyTimeline.tsx` + `AdminJourneyTimeline.tsx` event maps to render icons/labels for these `activity_log` event_types (only render if rows actually exist — no fake placeholders):

- `payment_request_created`, `payment_link_opened`, `payment_checkout_created`, `payment_received`, `payment_received_email_sent`, `receipt_available`, `invoice_issued`, `invoice_paid`, `dd_mandate_setup_requested`, `dd_mandate_active`.

Insert `receipt_available` event from `send-payment-received-email` after successful send (so timeline ties to the email).

## 9. Security & RLS

- `payment_requests` RLS already restricts to owner/staff — verify with a wrong-user query in build phase.
- `get-payment-receipt` enforces ownership server-side regardless of RLS.
- Token route returns 404 on expired/invalid/unpaid.
- Email/receipt payload sanitizer is the single source of customer-facing fields — never returns full row.

## 10. Verification (PR-260612-TZ6D9R)

After build, run:

1. Manually invoke `send-payment-received-email` for the PR → expect first call sends + logs comm row + raw token in response (server-only log), second call returns `already_sent`.
2. Open `/dashboard/receipt/<id>` as the PR owner → branded receipt renders.
3. Open same URL as a different signed-in user → 403.
4. Confirm zero new rows in `services`, `orders`, `invoices` (where issued by us), `dd_mandates`, `manual_fulfilment_orders`.
5. Confirm PR `status`, `paid_at`, `webhook_verified`, `provider_payment_id` unchanged.
6. Customer dashboard Payments tab + Documents hub show the receipt; admin CustomerDetail Finance panel shows the PR + comms log.

## Out of scope (deferred)

Recurring billing, monthly invoice generation, DD auto-create, dunning, supplier orders, service activation, provisioning — all untouched. Worldpay webhook "sentForSettlement" remains the only path to `paid`.

## Files to add

- `supabase/functions/get-payment-receipt/index.ts`
- `supabase/functions/send-payment-received-email/index.ts`
- `src/components/dashboard/tabs/PaymentsTab.tsx`
- `src/pages/dashboard/ReceiptView.tsx` (auth) + `src/pages/ReceiptTokenView.tsx` (token)
- `src/lib/generatePaymentReceiptPdf.ts` (PR-aware variant)

## Files to edit

- `supabase/functions/worldpay-webhook/index.ts` — fire-and-forget payment-received email call (idempotent, post-paid only).
- `src/pages/Dashboard.tsx` — add Payments tab.
- `src/components/dashboard/tabs/DocumentsTab.tsx` — add Receipts group.
- `src/components/dashboard/tabs/InvoicesTab.tsx` — fallback copy.
- `src/pages/admin/CustomerDetail.tsx` — Finance panel.
- `src/components/dashboard/CustomerJourneyTimeline.tsx` + `src/components/admin/AdminJourneyTimeline.tsx` — new event types.
- `src/App.tsx` — new routes.
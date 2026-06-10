# OCCTA Lifecycle Blueprint

_Audit-only document. No code changes are made by this file. Used to plan the
phased path from "controlled beta" to full self-functioning operation._

---

## 1. Customer journey (target state)

1. **Postcode entry** — any valid UK postcode is accepted and used for
   personalisation / quote attachment. Live availability is consulted but
   never blocks the customer.
2. **Build Plan** — speed bucket → plan style → router → setup → optional
   extras → details → review. Estimated price is always visible.
3. **Quote request** — submission creates a `quote_request` row. No order,
   no payment, no Contract Summary, no supplier order is created yet.
4. **Admin final quote** — admin assigns the backend Giacom/rate-card
   product, runs the margin check, approves, sends a customer-ready quote.
5. **Contract Summary** — generated from the final quote, stored as a PDF
   in the contract-summaries bucket, accessible to the customer before any
   acceptance.
6. **Customer acceptance** — explicit checkbox acceptance with timestamp,
   IP, user-agent, accepted-text hash, T&C version and Contract Summary
   version. Immutable row in `contract_acceptances`.
7. **Payment / DD setup** — only after acceptance. Card via Worldpay HPP
   only; DD via approved provider. No raw card data ever touches our app.
8. **Order creation** — `orders` row created and linked to the accepted
   Contract Summary and the supplier product chosen by admin.
9. **Supplier provisioning** — admin enters supplier order reference,
   books installation/switch, tracks router dispatch and activation date.
10. **Activation** — service activates. `services` row marked active with
    activation date and billing start date.
11. **Billing** — first invoice generated on activation per the billing
    cycle. Subsequent invoices follow the cron schedule.
12. **Support** — tickets, complaints, comms all attached to the customer
    account number.

## 2. Admin journey (target state)

1. Quote request queue (`/admin/quote-requests`).
2. Assign backend Giacom / rate-card product (supplier + product + term +
   setup + margin check).
3. Approve quote.
4. Send quote.
5. Generate Contract Summary.
6. Monitor acceptance.
7. Collect payment / DD.
8. Create order.
9. Enter supplier reference.
10. Book installation / switch.
11. Activate service.
12. Start billing.

## 3. Data model audit

### Exists today (per `<supabase-tables>`)

`profiles`, `user_roles`, `quote_requests`, `quotes`, `quote_events`,
`quote_margin_checks`, `contract_summaries`, `contract_acceptances`,
`orders`, `order_messages`, `services`, `invoices`, `invoice_lines`,
`receipts`, `credit_notes`, `payment_requests`, `payment_request_events`,
`payment_attempts`, `dd_mandates`, `user_files`, `communications_log`,
`communication_threads`, `communication_messages`, `audit_logs`,
`installation_bookings`, `installation_slots`, `email_templates`.

### Confirmed gaps / weak spots

- **`quote_versions`** — `quotes` appears to be mutated in place. A
  versions table or immutable snapshot row per version is needed for
  audit, dispute and customer "previous quote" download.
- **`order_status_history`** — events live across `quote_events`,
  `payment_request_events`, `complaint_events`. No canonical
  per-order timeline. Recommend a single `order_status_history(order_id,
  status, occurred_at, source, payload)` table.
- **Account number issuance** — `src/lib/account.ts` expects a DB trigger
  generating `OCC` + 8 digits on `profiles` insert. Verify the trigger
  exists, is unique-indexed, and back-fills any pre-existing rows.
- **Quote → account linking** — `quote_requests.customer_id` is nullable.
  When a guest later signs in with the same email, no automatic backfill
  links their historic quotes / orders. Needs a trigger or sign-in hook.
- **Documents** — contract PDFs (`contract_summaries`), invoice PDFs
  (`invoices.pdf_url`), receipts (`receipts`), ID verification
  (`user_files`) live in different places. Recommend a `documents` index
  view (NOT a new table) so the dashboard can show one unified list.
- **Supplier order ref on `orders`** — verify column exists; add if
  missing in Phase F.
- **`services.activation_date` / `services.billing_start_date`** — verify
  these are present and populated by the activation flow.

## 4. Account number workflow

- Format: `OCC` + 8 digits (per `src/lib/account.ts`).
- Issuance: DB trigger on `profiles` insert. Unique constraint.
- Visible in: customer dashboard header, admin customer profile header,
  all transactional emails, quote PDFs, Contract Summary PDFs, invoice
  PDFs, payment request emails, support ticket replies, complaint
  acknowledgements.

## 5. Quote customer → dashboard customer

1. `submit-build-plan` creates `quote_request` with email + (optional)
   `customer_id`.
2. Edge function (Phase B) sends invite / magic-link email tagged with
   the `quote_request.id`. If `auth.users` row exists for the email →
   "Sign in to view your quote"; otherwise → "Create your dashboard".
3. On first successful sign-in, a `link_quote_requests_to_user` trigger
   (or hook) backfills `quote_requests.customer_id` for every row with
   matching email. Issues an account number if `profiles.account_number`
   is null.
4. RLS on `quote_requests`, `quotes`, `contract_summaries`, `orders`,
   `services`, `invoices` already scopes per `customer_id` / `user_id`.

## 6. Contract Summary + acceptance vault

- Server-side PDF generation (`generate-contract-summary` edge function,
  to be built in Phase D) from the final quote.
- Stored in a `contract-summaries` Supabase Storage bucket. Customer can
  download before acceptance.
- Acceptance writes a single immutable row to `contract_acceptances`:
  `contract_summary_id`, `version`, `accepted_at`, `accepted_text_hash`,
  `tnc_version`, `ip`, `user_agent`, `user_id`, `email_at_acceptance`.
- No payment request, no order, no supplier order may be created without
  a row in `contract_acceptances` for that quote/version.

## 7. Payment / DD workflow

- Card: Worldpay HPP only. Token + reference flow per the existing
  memory. Server-side webhook is the **only** source of truth for payment
  status. Browser return never marks paid.
- DD: approved provider mandate flow. Store only mandate reference,
  status, last 4 digits, sort code prefix. No full bank details in DB.
- Each `payment_requests` row linked to `account_number`, `order_id` or
  `invoice_id`.

## 8. Supplier provisioning workflow

- Admin order board fields: backend supplier, supplier product, supplier
  order ref, requested install date, confirmed install date, router
  dispatch date, activation date.
- Failed install / cancellation / cease / change-of-tenancy flows write
  into `order_status_history` (Phase F).

## 9. Automated billing workflow

- Activation triggers billing schedule (monthly or quarterly per
  `billing_settings`).
- Daily cron generates invoices, applies VAT per residential / business
  rules, renders the invoice PDF, emails the customer.
- Reminder cadence at 7 / 14 / 30 days per the late-fee policy.
- Successful payment writes a `receipts` row. Refunds write
  `credit_notes`.
- Finance / VAT export job (later phase) reads `invoices` + `receipts` +
  `credit_notes`.

## 10. Communications workflow

Email templates required in `email_templates` (sent via `auth-email-hook`
/ Resend):

- quote received
- final quote ready
- Contract Summary ready
- Contract Summary accepted
- payment / DD required
- payment confirmed
- order received
- supplier order placed
- installation booked
- router dispatched
- service live
- invoice generated
- payment failed
- support / complaint update

## 11. Phased plan

- **Phase A (this PR)** — National postcode display + Build Plan UX
  polish (this commit).
- **Phase B** — Quote → account linking (magic-link invite, account
  number issuance trigger, sign-in backfill).
- **Phase C** — Admin backend product assignment + final quote approval
  workflow.
- **Phase D** — Contract Summary PDF acceptance vault.
- **Phase E** — Payment / DD live readiness audit.
- **Phase F** — Supplier order / provisioning workflow +
  `order_status_history`.
- **Phase G** — Service activation → customer dashboard wiring.
- **Phase H** — Invoice / billing automation hardening.
- **Phase I** — Communications automation (template completion).
- **Phase J** — Changes / cancellations / move-home workflow.
- **Phase K** — Final security / monitoring / go-live audit.

## 12. Risks / blockers

- Quote → account linking missing → Phase B blocker for self-service
  dashboard.
- Contract Summary acceptance vault missing → Phase D blocker for
  legal-grade orders.
- No canonical `order_status_history` → Phase F blocker for ops
  visibility.
- No fully-automated invoice generation tied to service activation →
  Phase G + H blocker for hands-off billing.

## 13. Must not go live (fully) until

Until Phases B, D, F and a Phase K security / monitoring pass are
complete, OCCTA remains controlled beta only: every order must be
manually shepherded through admin. Quote requests are safe to accept
publicly now; full self-service order placement is not.
# Payment reconciliation imports

The admin pages **Billing → Payment reconciliation** (`/admin/billing/payment-reconciliation`) and **Billing → Payment details** (`/admin/billing/payment-details`) read only the tables created by `supabase/migrations/20261008201000_payment_reconciliation.sql`.

Imports do not change invoices, Direct Debit mandates, payment attempts, customer profiles or allocations, and they do not send email. Marking a draft invoice “due” records that decision on the reconciliation row only.

The same customer snapshot is shown on each customer’s admin account page when the Occta account ref matches, with a fallback to the personal name, payer name or a payer alias.

A scheduled job can upload the same files to the admin-only edge function `admin-payment-recon-import` (POST, admin or super-admin JWT). That function is in the repo. Merging this branch does not deploy it: no GitHub Actions workflow path includes it.

## Match categories

| Category | Meaning |
| --- | --- |
| `matched` | Tied to an Occta customer, a payout or a payer alias |
| `discrepancy` | Needs a human exception review |
| `genuine_unmatched` | Genuine business payment, not matched to a customer. Counted as money received. Never listed as a discrepancy |
| `unlinked` | Money received that has not been identified yet |

The status value `genuine_unmatched` (or the label `Genuine business payment, not matched to a customer`) forces the genuine category. `Unallocated` is unlinked, not a discrepancy.

The reconciliation page sections are Customers, Payments, Mandates, Matched, Unlinked, Genuine unmatched, Discrepancies, Payout batches and History. Each customer row expands to that account’s payment history and mandate list. Unlinked rows have a Link action that stores an Occta account and/or invoice number and writes an audit entry.

A daily job should upload in this order so aliases exist before the statement is matched: customer status, AccessPay daily export, bank statement. Payment events can be uploaded any time. Re-uploading the same file updates the same rows.

## Payer names

A customer can pay under a trading name. Put the personal name in `Customer`, the business name in `Payer name`, and any bank spelling in `Bank payer name` or `Name aliases` (separate several with `;`).

Example only: personal name Nina Example, payer **Harmonic Spa**, statement spelling **HAIRMONIC HEAD SPA**. The misspelling matches because it is listed as an alias. It is not guessed from the personal name.

## Dates and amounts

Dates are kept as typed. A calendar date is stored only when the text starts with an unambiguous `D Mon YYYY`, optionally with a time or a trailing note such as `(promise)` or a single `£` amount. `Monthly`, `Invoice still draft` and numeric dates such as `01/02/2026` are not parsed. Amounts may be blank or `None`.

Re-importing the same file updates the same rows and the same import-history record. It does not insert duplicates. A changed status, failure reason or lifecycle date appends one timeline event; importing that same change again does not append another.

## 1. Customer status snapshot

UTF-8. This file replaces the customer snapshot. Manual links and “draft marked due” flags are kept for rows that remain.

Required header (the `£` signs are part of the header):

```text
Customer,Occta ref,Method,Amount due £,Due date,Last payment received,Seen in,Status,Balance outstanding £,Next action
```

Optional columns, matched without case sensitivity: AccessPay status, Occta mandate status, DD status, Last DD date, Last DD amount £, Last DD result, Failure treatment, Next DD date, Next DD amount £, Bank payments, Matched payout, Invoice balance £, Invoice state, Occta recorded, Occta method, Payer name, Bank payer name, Name aliases, Balance kind, Invoiced £, Uninvoiced £, Cases, Match category, Notes.

`Status` accepts `Paid`, `Pending`, `Failed`, `Cancelled mandate`, `Overdue`, `Not yet submitted`, `Closed / do not chase`, `Unallocated` and `genuine_unmatched`. Extra words are kept (`Failed (retries exhausted)`, `Cancelled mandate / Overdue`). Unknown columns are ignored.

`Cases` is a `;` separated list:

| Code | Meaning |
| --- | --- |
| `opening_balance_uninvoiced` | Full-from-opening balance includes uninvoiced months |
| `mandate_cancelled_occta_active` | AccessPay mandate cancelled; Occta still shows active |
| `failed_attempt_existing_charge` | Failed DD was an attempt on an existing charge, not extra debt |
| `bank_receipt_not_in_occta` | Bank receipt Occta never recorded |
| `mislabeled_card_was_transfer` | Occta says card; the money was a bank transfer |
| `accesspay_only_no_occta_record` | Business DD exists only in AccessPay |
| `draft_invoice_mark_due_no_email` | Draft invoice can be marked due without sending email |
| `unallocated_no_invoice` | Unallocated payment with no matching invoice |

`Failure treatment` of `existing charge` also sets `failed_attempt_existing_charge`. Those attempt amounts are shown, and they are not added on top of the outstanding balance.

## 2. Payment events

Upserts by `payment_ref` when present, otherwise by a hash of the lifecycle fields.

```text
customer,occta_ref,payment_ref,method,amount,submitted_at,collection_date,failed_at,failure_reason,processed_at,payout_ref,bank_received_at,bank_description,status
```

Optional: invoice_number, mandate_ref, charge_kind (`invoiced` or `uninvoiced`), payer_name, bank_payer_name, name_aliases, failure_treatment, occta_recorded, occta_method, cases, match_category, balance_after.

`failure_reason` holds the BACS reason, for example an ARUDD code or an ADDACS cancellation. `status` accepts `genuine_unmatched`.

## 3. AccessPay daily export

One file for collections, failures, mandates and payouts. `record_type` is `collection`, `failure`, `payment`, `mandate` or `payout`.

```text
record_type,customer,occta_ref,payer_name,name_aliases,payment_ref,mandate_ref,invoice_number,method,amount,submitted_at,collection_date,failed_at,failure_reason,processed_at,payout_ref,fee_amount,status,accesspay_status,mandate_status,mandate_created_at,mandate_submitted_at,mandate_cancelled_at,is_test,is_duplicate,never_submitted,charge_kind,failure_treatment
```

Mandates store reference, status, created, submitted and cancelled dates, and the flags test, duplicate and never submitted. Payout rows set the AccessPay amount and fee. Collections inside a batch share `payout_ref`. Status changes are written to the timeline once.

## 4. Bank statement lines

```text
bank_date,amount,description,payer_name,reference,payout_ref
```

Auto-match order:

1. Payout reference, or the reference text, or an `APS RE OCCTA` description whose amount equals one unmatched payout.
2. Amount and date, narrowed by a payer name or alias when that identifies one customer.
3. A single payer-alias match when the statement name is listed for one customer.

Anything else is `unlinked`. Use **Link** on that section to attach an Occta account and/or invoice number. The link is stored on the reconciliation row and an audit entry is written. The invoice ledger is not updated.

A bank line that matches an AccessPay payout is linked to that payout batch. It is shown on every customer who has a collection in the batch. The batch credit is not stored as one customer's receipt.

## References when the export has no IDs

Use these patterns so the same payment or payout matches across files:

| Kind | Pattern | Example |
| --- | --- | --- |
| Direct Debit payment | `mandate_ref` + `-` + due date `YYYYMMDD` | `MAN-DEMO-21-20261008` |
| AccessPay payout | `APS-DISB-` + date `YYYYMMDD` | `APS-DISB-20261010` |
| Bank transfer | `BT-` + date `YYYYMMDD` + `-` + Occta account ref | `BT-20261006-OCC10000031` |

An upsert never replaces a stored payment value with an empty incoming value. A later file can fill blanks and can replace a value when the new cell is non-empty. Import order does not wipe `occta_recorded`, `occta_method`, `invoice_number`, bank dates, or the bank description.

Collected is the total of money received: every received payment, including `genuine_unmatched`, plus bank-matched lines that are not already represented by those payments. Unlinked money stays on the unlinked total.

A failed Direct Debit stays in the payment history. It leaves discrepancies when a later successful collection exists for the same account and charge: the same invoice, or the same mandate and amount.

## Worked example

Fictional files in `docs/examples/`:

- `payment-reconciliation-customer-status.sample.csv`
- `payment-reconciliation-payment-events.sample.csv`
- `payment-reconciliation-accesspay-daily.sample.csv`
- `payment-reconciliation-bank-statement.sample.csv`

They include an opening balance with uninvoiced months, a cancelled AccessPay mandate that Occta still shows as active, a failed DD on an existing charge, a bank receipt Occta never recorded, a card label that was a transfer, an AccessPay-only business, a draft invoice to mark due without email, an unallocated receipt with no invoice, payer Harmonic Spa / statement HAIRMONIC HEAD SPA, and a genuine unmatched business receipt for Sample Civic Hall.

`supabase/seeds/payment_reconciliation_demo.sql` is the same fictional snapshot for a local database. It is not part of the migration and CI does not run it.

## Edge function

`POST /functions/v1/admin-payment-recon-import`

```json
{ "file_kind": "bank_statement", "file_name": "statement.csv", "csv_text": "..." }
```

`file_kind` is `customer_status`, `payment_events`, `accesspay_daily` or `bank_statement`. The caller must be `admin` or `super_admin`. The function is registered in `supabase/config.toml` with `verify_jwt = true`, and it checks the role again.

## What a merge does

Merging this branch does not deploy `admin-payment-recon-import` and does not apply the migration to production. No GitHub Actions workflow path includes `supabase/functions/admin-payment-recon-import/**`, `supabase/functions/_shared/paymentReconEngine.ts`, `supabase/config.toml`, or `supabase/migrations/20261008201000_payment_reconciliation.sql`. CI still runs on the pull request and applies every migration to its local Supabase database only.

The admin screens are part of the web app. They become reachable at `/admin/billing/payment-reconciliation` and `/admin/billing/payment-details` only after a later frontend publish, and they stay empty until the migration is applied. Until then the page says reconciliation storage is not available. Imports never update `invoices`, `payment_attempts`, `dd_mandates`, `profiles`, or allocations, and they do not send email.

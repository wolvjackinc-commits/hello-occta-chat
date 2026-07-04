FINAL OCCTA BILLING POLICY CORRECTION — IMPLEMENT EXACTLY

Use this billing rule. This overrides the previous confusion.

## FINAL BILLING RULE

1. Billing starts from the actual service live date.
2. First invoice is created when admin confirms the service live.
3. First invoice includes:
  - activation/setup fee if shown in the accepted Contract Summary;
  - accepted one-off charges;
  - pro-rata service charge from actual live date to the customer’s chosen billing day;
  - VAT itemisation;
  - secure Worldpay payment link for invoice_link customers.
4. After the first invoice, all recurring monthly invoices follow the customer’s chosen billing/pay day.
5. Monthly service is billed in advance.
6. Customer payment status must be tracked as paid, unpaid, overdue or partially paid where applicable.
7. If unpaid, reminders must be sent automatically according to the approved reminder schedule.
8. No duplicate invoice, payment request, email or receipt.

## EXAMPLE

If:

- service live date = 10 July;
- chosen billing day = 25;
- monthly price = £40;
- setup fee = £67;

Then:

First invoice is created immediately on service live confirmation.

First invoice covers:

- setup fee £67;
- pro-rata service from 10 July to 24 July;
- VAT itemised;
- payment due according to payment terms.

Next recurring invoice:

- issued on 25 July;
- covers 25 July to 24 August;
- then monthly on the 25th.

Do not wait until 25 July to send the first invoice.

## FIRST INVOICE BEHAVIOUR

When Confirm Service Live is clicked:

- create/update the service;
- store actual activation date;
- create first billing job immediately if data is complete;
- first billing worker generates invoice immediately;
- create invoice PDF;
- create Worldpay payment request for invoice_link customers;
- send invoice email;
- set invoice status to sent;
- track due date;
- track payment status.

If required data is missing, block the first invoice and create an admin task explaining what is missing.

## RECURRING BILLING BEHAVIOUR

After first invoice:

- use `services.next_billing_date` as the next customer chosen billing day;
- create monthly invoice on that day;
- invoice period should run from that billing day to the next billing day;
- use anchor-day logic for 29/30/31 and short months;
- advance `services.next_billing_date` only after successful invoice creation/email workflow;
- prevent duplicate monthly invoices.

## PAID / UNPAID / OVERDUE TRACKING

Every invoice must have clear status:

- draft;
- sent;
- unpaid;
- paid;
- partially_paid if supported;
- overdue;
- cancelled;
- written_off only if admin-approved.

For invoice_link customers:

- payment request is created;
- customer pays manually using Worldpay link;
- receipt is created only after verified Worldpay settlement;
- invoice changes to paid only after verified payment.

For Direct Debit customers:

- do not mark paid until collection/settlement is confirmed;
- if DD mandate/provider is not active, create admin task and/or fallback payment link according to policy.

## REMINDERS

Add or verify automated reminders for unpaid invoices.

Reminder schedule:

- due date reminder if invoice remains unpaid;
- overdue reminder after due date;
- final reminder after configured grace period;
- admin task if still unpaid.

Do not send aggressive or misleading debt wording.

Reminder emails must include:

- invoice number;
- amount due;
- due date;
- secure payment link if invoice_link;
- support contact;
- polite wording.

Use idempotency so the same reminder is not sent twice for the same reminder stage.

## BILLING DISPLAY

Admin and customer dashboard must show:

- actual service live date;
- first invoice number/date/amount/status;
- next invoice date;
- next billing period;
- payment method;
- due date;
- paid/unpaid/overdue status;
- payment link status;
- last payment date;
- outstanding balance.

For invoice_link, show:

“The customer is not automatically charged. They receive an invoice with a secure payment link and pay manually.”

## EXISTING CUSTOMERS

Run reconciliation for all existing customers.

Classify:

- OK;
- missing first invoice;
- first invoice missing activation/setup fee;
- unpaid invoice;
- overdue invoice;
- missing payment request;
- missing invoice email;
- missing next billing date;
- recurring schedule broken;
- duplicate risk;
- manual review required.

Auto-fix only safe deterministic cases.

Do not guess.

Do not edit accepted Contract Summary PDFs/hashes.

Do not duplicate invoices.

## CHRIS HUTT

Chris Hutt already has first invoice INV-2607-0001.

Do not recreate it.

Fix only schedule display and future recurring invoices.

His next invoice should follow `services.next_billing_date`.

## FINAL REPORT

Return:

- files changed;
- first invoice trigger confirmed;
- recurring billing schedule confirmed;
- paid/unpaid/overdue tracking result;
- reminder schedule result;
- dashboard/admin billing display result;
- existing customer reconciliation result;
- Chris Hutt result;
- duplicate protection result;
- payment link result;
- build/typecheck result.

Do not change quote journey, Contract Summary acceptance, Worldpay webhook, DD encryption, cancellation/ETF, admin navigation or RLS.

  
  
  
  
OCCTA Billing — End-to-End Fix Plan

Goal: make billing correct for every existing customer and every future activation, using one canonical source of truth, without touching quote journey, Contract Summary acceptance, signed PDFs/hashes, Worldpay webhook, DD encryption, cancellation/ETF, admin nav, or RLS.

---

## 1. Canonical model (single source of truth)

Define once, use everywhere:

- **Actual activation date** → `services.actual_activation_date`
- **Preferred billing/pay day** → `services.billing_anchor_day` (customer's chosen day)
- **Next billing date** → `services.next_billing_date`
- **Invoices** → `invoices` table (issue_date, due_date, billing_period_start/end, status, total)
- **Payment method** → snapshot on `services.payment_method` (`invoice_link` | `direct_debit` | `card`)
- **CS snapshot** → `contract_summaries` (monthly_price, setup_fee, one_off_charges, vat_mode/rate)

Stop using `services.updated_at` and `billing_settings.next_invoice_date` for any customer-facing display or scheduling decision. `billing_settings` remains only for global tenant defaults (terms days, mode).

---

## 2. Fix Billing Schedule display (admin + customer)

Rewrite `src/components/admin/BillingSchedulePanel.tsx` and mirror on customer dashboard billing tab. It will read:

- **Service activated** ← `services.actual_activation_date` (fallback: earliest invoice.billing_period_start).
- **First invoice** ← earliest `invoices` row for service (number, issue, due, status, £).
- **Next invoice** ← `services.next_billing_date`; compute period `[next_billing_date, next_billing_date + 1 month on anchor)`, due = issue + `payment_terms_days`.
- **Payment method label**:
  - `invoice_link` → "Invoice link / manual card payment — you are not automatically charged."
  - `direct_debit` → shows mandate/provider status from `dd_mandates_list`.
- Removes fake computed dates when real invoices exist.

Customer dashboard `InvoicesTab` gets the same explanatory block:

> "Billing starts only once your service is confirmed live. Your first invoice may include your activation fee and a pro-rata charge from your live date to your chosen billing date. After that, your monthly service is billed in advance on your selected billing date."
> For `invoice_link`: "You are not automatically charged. We send you an invoice with a secure payment link, and you pay manually."

---

## 3. Confirm Service Live — future customer automation

`supabase/functions/confirm-service-live` + `confirm_service_live_tx`:

- Require `actual_activation_date`, activation reference.
- Snapshot from accepted CS into service/first-billing-job: monthly price, setup fee, one-off charges, VAT mode/rate, payment method, billing_anchor_day.
- Enqueue first-billing job unblocked when all required data present.
- Block (create `admin_reconciliation_tasks` row) only when a required field is genuinely missing.
- Compute `services.next_billing_date` = next occurrence of `billing_anchor_day` strictly after activation.

`process-first-billing` produces first invoice covering:

- Pro-rata: activation date → next anchor
- Activation/setup fee if in accepted CS and not previously charged
- Accepted one-off charges
- VAT itemised
- If `invoice_link`: create payment_request + Worldpay HPP link, send `invoice_sent` email including `/pay?token=…`

Then `process-recurring-billing` picks up from `services.next_billing_date`.

---

## 4. Reconciliation for existing customers

New admin page `src/pages/admin/BillingReconciliation.tsx` + edge function `billing-reconciliation` (dry-run by default).

**Report columns**: account #, name/email, order #, order status, service status, actual activation date, accepted CS id, monthly £, setup £, one-off £, payment method, anchor day, first invoice exists, activation fee invoiced, last invoice period, last payment status, payment request exists, invoice email sent, receipt exists, `services.next_billing_date`, recurring ready, classification, recommended action.

**Classifications**: OK | missing_first_invoice | first_invoice_missing_setup_fee | recurring_schedule_missing | next_billing_date_wrong | duplicate_risk | payment_link_missing | email_missing | manual_review.

**Safe auto-fix** (admin clicks Apply after review) only when ALL true: service active, CS accepted + PDF/hash present, activation date present, monthly price present, payment method present, anchor present, no conflicting/duplicate invoices, no manual hold.

Auto-fixable actions:

- Backfill `services.next_billing_date`.
- Enqueue missing first-billing job.
- Unblock previously blocked first-billing jobs.
- Create missing payment_request for an existing invoice (invoice_link only).
- Re-send missing invoice email for an existing invoice (idempotent via `message_id`).

Never auto-fix: conflicting invoices, unclear setup fee, missing CS/activation date, unclear payment method, potential overcharge, doc mismatch → create `admin_reconciliation_tasks` instead.

**Existing live customers specific rules**:

- No first invoice → generate correct invoice from live date + accepted CS (setup fee only if in CS).
- First invoice sent but setup fee missed → create correction invoice only if clearly in CS and not charged; never edit old invoice.
- Monthly stopped → produce next unbilled period only; period-dedup via `(service_id, billing_period_start, billing_period_end)` unique guard.
- Overcharge → manual review + credit note workflow (queued task only).

---

## 5. Cron / worker verification

Verify (and fix wiring only where broken, no rewrites):

- `process-first-billing` scheduled & authenticated (`x-cron-secret`).
- `process-recurring-billing` scheduled & authenticated.
- `generate-invoices` delegates to recurring (already does).
- `send-email` uses `invoice_sent` template with `/pay?token=…`.
- Invoice PDFs served via signed URLs only.
- Payment requests deduped per invoice.
- Receipts only on Worldpay settlement (webhook path untouched).

---

## 6. Guardrails

- Do not edit historical accepted CS PDFs/hashes.
- Do not duplicate invoices: enforce unique on `(service_id, billing_period_start, billing_period_end)` at fixer + DB level (add index if missing, no destructive migration).
- Idempotency keys on all email sends (`invoice-<invoice_id>`).
- All admin errors surface original backend message via existing `invokeFn` wrapper.

---

## 7. Verification

- **Chris Hutt (OCC69244673)** after fix: activated 25 Jun 2026; first invoice INV-2607-0001, £101.99, sent; next 25 Jul 2026 → 24 Aug 2026; payment method "Invoice link / manual card payment"; no new invoice created.
- **Future test activation**: Confirm Live → first invoice with setup+service+VAT → email sent → `/pay?token=…` opens without login → next monthly scheduled.
- Build + typecheck clean.

---

## Technical Details

**Files to change**

- `src/components/admin/BillingSchedulePanel.tsx` — rewrite to canonical sources.
- `src/components/dashboard/tabs/InvoicesTab.tsx` — payment-method explanation for invoice_link.
- `src/pages/admin/BillingReconciliation.tsx` — new admin page.
- `src/components/admin/CustomerActionsCard.tsx` — add "Reconcile billing" quick action linking to report row.
- `supabase/functions/billing-reconciliation/index.ts` — new (dry-run + apply modes, admin-only).
- `supabase/functions/confirm-service-live/index.ts` — ensure snapshot + unblock logic; add clear error codes if fields missing.
- `supabase/functions/process-first-billing/index.ts` — ensure setup fee + pro-rata + VAT + payment_request + email; idempotent.
- `supabase/functions/process-recurring-billing/index.ts` — ensure driven only by `services.next_billing_date`; period dedup.
- Migration: add columns if missing (`services.billing_anchor_day`, `actual_activation_date` already exist per audit); add unique index `invoices(service_id, billing_period_start, billing_period_end) WHERE type='monthly'`; add `admin_reconciliation_tasks` rows structure only if needed.
- No changes to: quote journey, CS acceptance, Worldpay webhook, DD encryption, cancellation, admin nav, RLS.

**Non-destructive rules**

- All fixer writes go through explicit admin "Apply" — never on page load.
- Every fixer action writes an `audit_logs` row.
- Duplicate protection via DB-level unique index + pre-check in worker.
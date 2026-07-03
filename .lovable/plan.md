  
Approve the Billing Fix Plan with these mandatory corrections before implementation.

## 1. Do not double-charge router/add-ons

Before adding `router_charge`, `selected_addons` or add-ons to the first invoice, classify each charge as:

- one-off setup/activation charge;
- one-off delivery/installation charge;
- recurring monthly add-on;
- already included in monthly plan price.

Do not automatically treat all router/add-ons as one-off charges.

If router is a recurring monthly add-on, it must be included in the monthly recurring charge or shown as a recurring monthly line, not charged once as a one-off.

If unclear, block billing and create an admin reconciliation task.

## 2. Use the accepted Contract Summary money units correctly

Check whether `setup_charge`, `one_off_charges_json`, `monthly_price_incl_vat`, router and add-on values are stored as:

- pounds/pence decimal;
- integer minor units;
- VAT-inclusive;
- VAT-exclusive.

Convert once only.

Do not double-convert pounds to pence or pence to pounds.

Store the snapshot values on `first_billing_jobs` in minor units with clear column names.

## 3. Existing blocked jobs must stay blocked until reviewed

The new auto-unblocked behaviour must apply only to new service-live confirmations after this fix.

Do not automatically release historical `awaiting_billing_engine_handover` jobs.

For existing blocked jobs:

- classify them;
- create admin reconciliation tasks if needed;
- release only after manual approval.

## 4. Recurring worker duplicate rule must check all existing invoices

The recurring worker must not only check for unpaid invoices.

It must check for any existing non-cancelled invoice for:

- service_id;
- billing_period_start;
- billing_period_end;
- invoice_type.

Do not create a second invoice just because the first invoice is paid, sent, overdue or awaiting payment.

## 5. Email failure must not cause billing duplication or billing cursor problems

If invoice creation succeeds but PDF/email/payment-link sending fails:

- keep the invoice;
- retry the same invoice/email/payment request idempotently;
- do not create another invoice;
- do not skip the customer permanently;
- do not advance the billing cursor in a way that loses the failed invoice.

Use invoice/outbox state clearly.

## 6. Period dates must be consistent

Use one consistent rule internally:

- `billing_period_start` inclusive;
- `billing_period_end` exclusive.

For customer-facing invoice display, show the friendly inclusive range, for example:

- internal: 1 June to 1 July;
- customer display: 1 June to 30 June.

Do not confuse customers by showing an end date that looks like the next period’s start date.

## 7. VAT source must come from the accepted agreement, not guessed customer type alone

Do not infer VAT mode only from `customer_type`.

Use the VAT/pricing basis stored in the accepted quote/Contract Summary snapshot.

If the accepted snapshot does not clearly say whether the price is VAT-inclusive or VAT-exclusive, block billing and create a reconciliation task.

## 8. First invoice should not run until final billing data is complete

Before clearing the first-billing blocker, verify:

- accepted Contract Summary exists;
- accepted PDF/hash exists;
- actual activation date exists;
- monthly price source exists;
- activation/setup fee source checked;
- one-off/add-on charges classified;
- payment method exists;
- billing anchor exists;
- VAT mode/rate exists;
- no existing invoice for the same service/period/type.

If any required data is missing, set explicit blocker and create admin task.

## 9. Direct Debit active status still must not imply collection

For DD active customers:

- invoice can be marked awaiting DD collection only if an active mandate record exists;
- no provider call is made;
- customer wording must not say “collected” or “paid” until actual confirmation exists;
- if no collection integration exists, admin task must explain the manual next step.

## 10. Contract Summary wording applies only to new documents

Add the billing wording only to newly generated Contract Summaries.

Do not alter historical accepted PDFs, hashes, receipts, invoices or payment records.

## 11. Final report must prove examples from the actual code

After implementation, report:

- files/functions changed;
- example A/B/C calculated by the updated code;
- whether activation fee appears as invoice line;
- whether one-off charges appear as invoice lines;
- whether recurring add-ons are classified correctly;
- VAT net/VAT/gross output;
- 29/30/31 billing-date test;
- duplicate worker test;
- historical blocked-job safety result;
- Worldpay webhook regression result;
- quote journey and Contract Summary acceptance regression result;
- build/typecheck result.

Proceed with implementation only after these corrections are included.  
  
  
Billing Fix Plan (approved scope only)

Fixes only apply to billing worker, invoice generation, first-billing job creation, and customer-visible billing wording. Quote journey, Contract Summary generation/acceptance, Worldpay webhook, DD encryption, service activation UI, cancellation/ETF, admin nav and RLS are not touched.

---

## 1. Extend `first_billing_jobs` to carry accepted charges

Migration: add columns

- `activation_fee_minor int not null default 0`
- `one_off_charges_minor int not null default 0`
- `one_off_lines jsonb not null default '[]'` (label + amount, snapshot for invoice lines)
- `vat_mode text not null default 'inclusive'` (`inclusive` = residential, `exclusive` = business)
- `vat_rate numeric not null default 20`

No changes to historical rows other than defaults.

## 2. `confirm_service_live_tx` — snapshot fees from accepted Contract Summary

Read from the accepted CS (source of truth, no hard-coding, no changes to the CS itself):

- `monthly_price_incl_vat` → `amount_minor` (unchanged)
- `setup_charge` → activation fee (minor)
- `one_off_charges_json` → array snapshot (label + amount) + summed one-off total
- `router_charge`, `delivery_charge`, `installation_charge`, `selected_addons` (accepted addons only) → added to one-off lines
- `customer_type` → `vat_mode` (`residential` = inclusive, `business` = exclusive)

Insert those into the new columns on `first_billing_jobs`.

Blocker policy (fix "always blocked"):

- If all required inputs present (CS accepted with PDF + hash, payment method, anchor day, actual activation date), insert with `blocker = NULL`.
- Otherwise set an explicit blocker enum and open an `admin_tasks` row describing the missing field. Manual hold flag remains supported via `blocker='manual_hold'`.

Also seed the recurring cursor (see §4): set/update `services.next_billing_date` (already done) and upsert a `billing_settings` row for the customer with `next_invoice_date = services.next_billing_date`, `billing_day = anchor`, `billing_mode='fixed_day'`, VAT fields from CS. This makes recurring pick up seamlessly.

## 3. `process-first-billing` — build the first invoice from the snapshot

Compose invoice lines from the job row:

1. `pro-rata service` line — existing pro-rata calc unchanged.
2. `activation_fee` line — if `activation_fee_minor > 0`.
3. One line per entry in `one_off_lines` — if any.

Totals:

- `subtotal_incl = pro_rata + activation_fee + sum(one_off)`
- If `vat_mode='inclusive'`: `net = subtotal_incl / 1.2`, `vat = subtotal_incl − net`, `total = subtotal_incl`. Write `subtotal = net`, `vat_total = vat`, `total = subtotal_incl`, `vat_enabled=true`, `vat_rate=20`.
- If `vat_mode='exclusive'`: `net = subtotal_ex`, `vat = net * 0.2`, `total = net + vat`.

Invoice PDF + email get updated to show a proper table (Description | Net | VAT | Line total) plus Subtotal / VAT / Total. Line descriptions include their own period where relevant.

Idempotency reused via existing `invoices_service_period_unique` (`service_id, period_start, period_end, invoice_type`).

After successful send, insert/refresh a recurring row (§4) — no monthly job written yet, that's the recurring worker's job.

## 4. Recurring monthly billing driven by services

New edge function `process-recurring-billing` (replaces the current cron target). Runs on the existing `daily-invoice-generation` cron slot.

Loop:

- Select `services` where `status='active'`, `billing_enabled=true`, `next_billing_date <= today`, and no unpaid same-period invoice exists.
- For each service:
  - `period_start = next_billing_date`
  - `period_end = next_anchor_billing_date(period_start + 1, billing_anchor_day)` (uses existing helper → correctly handles 29/30/31; if the chosen day doesn't exist in the target month it clamps to the last valid day).
  - Invoice type = `monthly`, single service line = `price_monthly` (VAT inclusive/exclusive per snapshot).
  - Same unique index prevents duplicates.
  - Create PDF + Worldpay payment request (invoice-link) OR admin task (DD not-yet-active) OR mark ready-for-collection (DD active) — same branch logic as first-billing.
  - Email once (idempotency key `invoice-monthly:<id>`).
  - Advance `services.next_billing_date := period_end`.

Legacy `generate-invoices` becomes a thin wrapper that delegates to the new worker (kept for cron URL compatibility) and no longer reads `billing_settings.next_invoice_date` as the driver. `billing_settings` is kept in sync but is informational.

## 5. Billing day 29/30/31

All date advancement goes through `public.next_anchor_billing_date`, which already clamps to month-length. Remove `Math.min(billing_day, 28)` from `generate-invoices`. New recurring worker never uses that cap.

## 6. VAT itemisation

Every invoice row (first + monthly) writes:

- `subtotal` = net
- `vat_total` = VAT
- `vat_enabled` = true, `vat_rate` = 20
- `total` = gross

Invoice PDF and email template updated to show all three. Applies to new invoices only; historical rows untouched.

## 7. Duplicate protection

Single canonical rule: `invoices_service_period_unique(service_id, period_start, period_end, invoice_type)`. Both first-billing and recurring insert through this constraint (already present).

Additional guards preserved:

- PDF: `pdf_storage_key` presence check + `upsert:true` upload.
- Payment request: lookup by `invoice_id`.
- Email: `email_sent_at` + `send-email` idempotency key per invoice.
- Receipt: only via Worldpay webhook.

Legacy `idx_invoices_user_period` remains but is no longer relied on for correctness.

## 8. Direct Debit behaviour

Invoice is always created. Then:

- `pm.method='direct_debit'` AND `pm.dd_setup_status='active'` AND a confirmed provider mandate is present (`dd_mandates` row with status `active`): mark invoice as `awaiting_dd_collection` (existing status wording preserved; no provider call — no automated collection is triggered from this repo, per approved scope).
- DD pending / no active mandate: open `admin_tasks` row and (optional per policy) attach a fallback Worldpay `payment_requests` link. Customer is never told DD has been collected.

No provider collection call is made from these workers.

## 9. Customer-facing wording

Add the exact sentence:

> "Billing starts only once your service is confirmed live. Your first invoice may include your activation fee and a pro-rata charge from your live date to your chosen billing date. After that, your monthly service is billed in advance on your selected billing date."

Locations:

- New Contract Summary PDF template (only for CSes generated after deploy — historical PDFs + hashes untouched).
- Checkout order summary block.
- Invoice email template (first + monthly).
- Invoice PDF footer note.
- Dashboard billing tab notice.
- `src/pages/seo/BillingExplained.tsx` / `FirstInvoiceExplained.tsx` cross-linked.

## 10. Historical data

No updates to existing rows in `invoices`, `contract_summaries`, `payment_requests`, `receipts`. Any correction needed for an existing customer goes through a new `admin_reconciliation_tasks` row (table already exists).

---

## Files / DB objects to change

- Migration: new columns on `first_billing_jobs`; no changes to existing invoice/CS structure.
- DB: replace `confirm_service_live_tx` body (signature unchanged) to snapshot fees, seed billing_settings, set blocker only when required.
- `supabase/functions/process-first-billing/index.ts` — multi-line invoice, VAT split, updated PDF/email.
- `supabase/functions/generate-invoices/index.ts` — replaced by delegation to new worker (kept for cron URL).
- `supabase/functions/process-recurring-billing/index.ts` — new, service-driven.
- Cron: existing `daily-invoice-generation` continues to hit `/generate-invoices` (delegates).
- `src/pages/seo/BillingExplained.tsx`, `src/pages/seo/FirstInvoiceExplained.tsx` — reinforce wording.
- Checkout summary component (presentation only).
- Dashboard billing tab (presentation only).
- New CS PDF template block (new documents only).

## Verification after implementation

- Example A: monthly £37.99 inc, activation £80.40 inc, live 26 May 2026, day 1 → pro-rata £7.59 + activation £80.40 = **£87.99 inc VAT** (net £73.33, VAT £14.66). Next invoice period: 1 Jun 2026 → 1 Jul 2026.
- Example B: monthly £42.99 inc, activation £80.40 inc, live 28 Jun 2026, day 15 → pro-rata £23.57 + activation £80.40 = **£103.97 inc VAT** (net £86.64, VAT £17.33). Next period: 15 Jul 2026 → 15 Aug 2026.
- Example C: monthly £39.99 inc, activation £0, live 10 Jul 2026, day 1 → pro-rata **£28.37 inc VAT** (net £23.64, VAT £4.73). Next period: 1 Aug 2026 → 1 Sep 2026.
- 29/30/31 tests: billing day 31, cycle Jan 31 → Feb 28 (or 29 in leap year) → Mar 31 → Apr 30 → May 31 …
- Duplicate test: run each worker twice — second run inserts nothing.
- Regression scope: no edits to quote journey, CS acceptance, Worldpay webhook, DD encryption, activation UI, cancellation/ETF, admin nav, or RLS.

## Non-goals

- No provider-side DD collection.
- No re-issuing of historical invoices.
- No changes to Worldpay webhook or verification.
- No changes to Contract Summary schema or acceptance flow.
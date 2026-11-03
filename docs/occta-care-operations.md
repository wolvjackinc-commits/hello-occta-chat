# OCCTA Care: operations guide

OCCTA Care is a **support subscription, not insurance** (Care Essentials £4.99/month, Care Plus £8.99/month, VAT included). It never pays for, repairs or replaces a customer's own device. Rules, prices and all customer wording live in `supabase/functions/_shared/careTerms.ts`; letters in `careLetters.ts`. The unit test `src/lib/care/__tests__/careTerms.unit.test.ts` blocks insurance wording, card-payment wording and any drift from the database.

## Where things are

| What | Where |
| --- | --- |
| Public pages | `/care`, `/care/how-it-works`, `/care/faq`, `/care/key-facts`, `/legal/occta-care-terms` |
| Sign-up | `/care/join` (signed-in residential customers; `?invite=` for phone-assisted links) |
| Customer portal | My OCCTA → OCCTA Care (`/dashboard?tab=care`) |
| Staff | Admin → OCCTA Care (`/admin/care`) — includes a Staff playbook tab |
| Database | `supabase/migrations/20261102200000_occta_care.sql` (all `care_*` tables, functions and two cron jobs) and `20261103100000_occta_care_hardening.sql` (terms v2 and the money-safety fixes below) |
| Functions | `care-join` (sign-up), `care-dispatch` (letters + emails, every 5 min), `care-admin` (bank reveal, invites, evidence packs, print batches) |
| Storage | private bucket `care-documents` (`letters/<customer>/`, `evidence/<subscription>/`, `batches/`) |

## Money rules the system enforces

- Care uses its **own** mandate table (`care_mandates`), never `dd_mandates`, so Care can never affect broadband billing.
- No sale activates without an append-only consent record (terms version + SHA-256, key facts hash, each tick's time, one-time code, IP, device, staff).
- Nothing is collected in the 14-day cooling-off period. First payment ≥ 15 working days after sign-up.
- A collection is only `ready` when the mandate is **active** (confirmed by staff) and the notice **reached the customer** at least 10 working days before: email sent, or letter posted + 2 working days, or handed to Stannp + 3. A letter sitting in the print queue does not count. Otherwise it is moved to the next cycle with a fresh notice.
- Runs refuse anything due within 2 working days, on an inactive mandate, or for a member who is no longer live.
- A collection is `paid` only with the date the money reached the bank, and only 3 working days after the due date (the return window). A late return (ARUDD) can still reverse it for 10 working days.
- Returned payment: ARUDD 0 (refer to payer) gets one re-try after fresh notice. Codes that end the Instruction pause Care. Any other code: no re-try; staff get a task to call the customer. A second miss pauses Care. No fees, no debt chasing, ever.
- Price changes (≥ 35 days ahead) and plan switches apply only to periods starting on or after their date. New-join prices can't change without a new terms version.
- Cancellation by any channel, effective immediately: monthly keeps the paid month; prepaid refunds unused days; anything already sent to the bank for a later period is refunded in full. Anything in a run but not yet submitted is **pulled**, and staff get an urgent task to remove it from the AccessPay file. If it was collected anyway, use **Collected anyway** (Collections → Pulled) and the full amount is refunded.
- Staff can **pause** Care (money tight, or the customer asks). A paused member can join again from My OCCTA.
- Sales are held for review for: 75+ (48-hour pause and a recorded welcome call before approval), support needs, an open vulnerability review, an account-holder name mismatch. The first payment notice goes out only on approval. Phone-assisted sales and reviewed sales get a welcome call within 5 working days. Customers who chose "no offers" can't be sold to by phone.

## Daily routine (Admin → OCCTA Care)

1. **Reviews** (75+, support needs, account-holder mismatch, open vulnerability review): call, then approve or decline.
2. **Direct Debit → mandates**: reveal bank details (finance roles, logged), lodge in the AccessPay portal under the `OCCTA CARE-` reference, mark lodged, then active. Cancel any marked *cancel requested*.
3. **AccessPay reports**: record each Care collection as paid (bank date) or returned (ARUDD code); ADDACS → *Bank cancelled*; DDICA → *Indemnity claim* (9-day challenge window).
4. **Collections → ready**: create a run, upload the CSV to AccessPay, confirm *Submitted*.
5. **Letters → to print**: print batch, post, *Mark posted* with the date (proof of posting). Braille and carer copies go by hand.
6. **Refunds**: pay by bank transfer, record the reference.
7. **Disputes**: anything ≤ 2 days left is today's job. Generate the evidence pack before challenging.

## Still needed from OCCTA

- **Sponsor approval**: ask AccessPay to approve the Care advance-notice/DD confirmation letter (Admin → Letters → open any `dd_confirmation`).
- **Automatic posting** (optional): add backend secrets `STANNP_API_KEY` **and** `STANNP_MODE=live`. Without both, letters queue for printing (Stannp test mode is never used, so nothing is ever recorded as posted when it wasn't).
- **Repairs**: Care v2 offers no repairs. If you sign a repair partner later, publish a new terms version before advertising member repair prices.
- **Router swap standard**: the terms promise every customer a replacement for faulty OCCTA-supplied kit within 5 working days (Care Plus: next working day). Make sure stock and couriers can meet that.
- **Legal review**: have a UK regulatory lawyer review the Care terms and wording against FCA PERG 6.7.
- **Complaints scheme**: confirm whether your communications ADR scheme accepts Care complaints (the terms say it may not and give the fallback).
- **Vulnerable Customers Policy**: add a Care section to the published policy (Ofcom GC C5).

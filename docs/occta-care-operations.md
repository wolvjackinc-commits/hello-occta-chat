# OCCTA Care: operations guide

OCCTA Care is a **support subscription, not insurance** (Care Essentials £4.99/month, Care Plus £8.99/month, VAT included). It never pays for, repairs or replaces a customer's own device. Rules, prices and all customer wording live in `supabase/functions/_shared/careTerms.ts`; letters in `careLetters.ts`. The unit test `src/lib/care/__tests__/careTerms.unit.test.ts` blocks insurance wording, card-payment wording and any drift from the database.

## Where things are

| What | Where |
| --- | --- |
| Public pages | `/care`, `/care/how-it-works`, `/care/faq`, `/care/key-facts`, `/legal/occta-care-terms` |
| Sign-up | `/care/join` (signed-in residential customers; `?invite=` for phone-assisted links) |
| Customer portal | My OCCTA → OCCTA Care (`/dashboard?tab=care`) |
| Staff | Admin → OCCTA Care (`/admin/care`) — includes a Staff playbook tab |
| Database | `supabase/migrations/20261102200000_occta_care.sql` (all `care_*` tables, functions and two cron jobs) |
| Functions | `care-join` (sign-up), `care-dispatch` (letters + emails, every 5 min), `care-admin` (bank reveal, invites, evidence packs, print batches) |
| Storage | private bucket `care-documents` (`letters/<customer>/`, `evidence/<subscription>/`, `batches/`) |

## Money rules the system enforces

- Care uses its **own** mandate table (`care_mandates`), never `dd_mandates`, so Care can never affect broadband billing.
- No sale activates without an append-only consent record (terms version + SHA-256, key facts hash, each tick's time, one-time code, IP, device, staff).
- Nothing is collected in the 14-day cooling-off period. First payment ≥ 15 working days after sign-up.
- A collection is only `ready` when the mandate is **active** (confirmed by staff) and written notice went out **≥ 12 working days** before. Otherwise it is moved to the next cycle with a fresh notice.
- A collection is `paid` only with the date the money reached the bank (database constraint; AGENTS.md rule).
- Returned payment: one re-try after notice; a second miss pauses Care. No fees, no debt chasing, ever.
- Cancellation by any channel, effective immediately: monthly keeps the paid month; prepaid refunds unused days; anything already sent to the bank for a later period is refunded in full.

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
- **Automatic posting** (optional): add backend secrets `STANNP_API_KEY` and `STANNP_MODE=live`. Until then letters queue for printing.
- **Repair partner**: sign a partner with a fixed member price list before customers ask for repair quotes.
- **Legal review**: have a UK regulatory lawyer review the Care terms and wording against FCA PERG 6.7.
- **Complaints scheme**: confirm whether your communications ADR scheme accepts Care complaints (the terms say it may not and give the fallback).
- **Vulnerable Customers Policy**: add a Care section to the published policy (Ofcom GC C5).

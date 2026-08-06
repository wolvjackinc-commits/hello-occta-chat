# Journey 2 production readiness

Journey 1 stays exactly as it is: enabled, default, quote-led. Journey 2 stays publicly off (kill switch on, test mode on, rollout 0%, abandoned-resume off) throughout and after this work.

## Verified starting position

- `public.platform_settings` has **no SELECT grant for authenticated** (only the sandbox role), so the admin Journey control page cannot read settings at all — this is the real cause of "Journey settings are unavailable".
- `src/pages/admin/JourneyControl.tsx` line 101 renders that generic message and never surfaces the Supabase error.
- Journey 2 today runs five session steps (address, plan, router, extras, details) then hands straight into the existing agreement/payment/review steps, so contract documents are generated **before** start date and billing — the wrong order per the spec.
- `src/components/home/PostcodeChecker.tsx` always navigates to `/build-plan`, bypassing journey assignment.
- `customer_journey_sessions` already exists with 41 columns; the twelve `customer_journey_*` settings columns exist.

## Branch note

I cannot create or push a Git branch from here — branch/PR state is managed by Lovable's GitHub sync. I will implement the work in this project; you can review and branch/merge on GitHub. If you need it strictly isolated on `fix/journey2-production-readiness` before any sync, tell me and I'll stop.

## Phase 1 — Admin control repair (small, immediate)

- Migration: `GRANT SELECT ON TABLE public.platform_settings TO authenticated;` only. RLS policies untouched, so non-admins still read nothing.
- `JourneyControl.tsx`: show the actual error code/message, a retry button, and distinguish "no row" from "permission denied".
- Confirm via query that only admin roles pass the read/update policies.

## Phase 2 — Correct Journey 2 sequence

Reorder to: address, plan, router, extras, details, start date, billing + Direct Debit, contract documents + acceptance, final review, completion.

- Move start-date and billing/DD collection into Journey-2-owned steps before any document generation.
- `journey2-prepare-contract` refuses to run until start date and billing are saved.
- After acceptance, lock commercial selections; any material change supersedes the documents and requires fresh acceptance.

## Phase 3 — Final contractual snapshot

New immutable snapshot record created after all commercial/start-date/billing selections and before document generation, containing every field listed in your spec plus pricing version, legal-document versions, journey version, checkout session id, and a SHA-256 hash. Insert-only (no update/delete triggers).

Additive `journey_version` and `checkout_session_id` columns on the relevant quote, order, contract, acceptance and payment tables, plus a unique index so one checkout session can only ever produce one completed order.

## Phase 4 — Pricing and payment treatment

- `amount_due_today = 0.00` for Journey 2; setup, activation and one-off router charges move into the estimated first bill.
- One server-side price resolver feeds review, Contract Summary, Contract Information, order record, welcome email, dashboard and first-bill schedule — no hard-coded prices, no client recomputation.
- Every customer-facing price shows ex-VAT, VAT amount, inc-VAT.

## Phase 5 — Safe test mode isolation

Test sessions are flagged end-to-end and blocked from: customer emails, DD submission to provider, supplier provisioning, live billing/reconciliation, abandoned-session emails. Test orders are visibly marked and excluded from admin production queues and reports. Admins can still run test sessions while the public kill switch is on.

## Phase 6 — No silent fallback

Remove every automatic Journey 2 redirect to `/build-plan`. Journey 2 lists only active products with complete exact pricing. Temporary failures keep the session, allow retry, log the error and raise an admin task; converting to a quote request requires an explicit customer click.

## Phase 7 — Details, Digital Voice, Direct Debit

- Details step collects and validates the full list (legal name, email, mobile, DOB, 18+ confirmation, service and billing address, existing provider and contract status/end date, number retention/porting, accessibility and vulnerability needs, marketing consent, privacy acknowledgement).
- Digital Voice selection requires explicit acknowledgement of the power/broadband emergency-call limitations and add-on-only availability.
- DD statuses: `details_received`, `pending_contract`, `setup_requested`, `submitted_to_provider`, `active`, `failed`, `cancelled`. Never shown active before provider confirmation. Bank details stay encrypted; masked everywhere else, including a masked DD Instruction confirmation generated after order creation.

## Phase 8 — Documents, email, completion

Journey 2 customer pack (signed Contract Summary, Contract Information, acceptance certificate, consolidated agreement pack, order summary, masked DD Instruction confirmation, DD Guarantee, cooling-off information, Digital Voice information when selected). Route `/order/:token/complete`. Customer and order created transactionally before success is shown, with idempotency keys and DB uniqueness so refreshes cannot duplicate anything. Welcome email sent only after order creation, through an idempotent outbox with status, retry count, last error and admin resend.

## Phase 9 — Preflight and CI

Rewrite `journey2-preflight` as real end-to-end verification of every gate you listed (pricing/VAT, assignment, kill switch, test isolation, document generation, acceptance evidence, snapshot hash, DD encryption/masking, idempotent submission, welcome pack and attachments, dashboard creation, absence of a Journey 2 quote-ready email, no silent fallback, Journey 1 regression).

GitHub Actions workflow running typecheck, production build, lint, unit tests, Journey 1 regression tests, Journey 2 integration tests, pricing/VAT tests, duplicate-submission tests and test-mode isolation tests.

## Verification and report

Typecheck plus build, the automated suites, an admin-only test-mode run through all ten steps in the browser, and a Journey 1 regression pass. Final report will list every changed file, every migration, every edge function, test and build results, known limitations, manual test instructions, and confirmation that Journey 2 was never activated and Journey 1 was not changed.

## Known limitations up front

- Availability remains assumed in Journey 2; an unserviceable line lands in manual review.
- No upfront card step exists, so anything genuinely payable on day one can only be billed on the first invoice.
- Provider DD confirmation timing is outside our control, so `active` may lag order completion.

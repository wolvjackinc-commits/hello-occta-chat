# Journey 2 production readiness — remaining work

## Critical first action (before any code change)

Current live settings are drifted from what you asked for and from safety:

```text
customer_journey_v1_enabled            = false   <-- WRONG, must be true
customer_journey_v2_enabled            = true    <-- WRONG, must be false
customer_journey_default               = v1      OK
customer_journey_v2_kill_switch        = true    OK
customer_journey_v2_test_mode          = true    OK
customer_journey_v2_rollout_percentage = 0       OK
customer_journey_v2_abandoned_resume   = false   OK
```

Step one is a data update restoring V1 enabled / V2 disabled, then a re-query to confirm all seven values before anything else is touched.

## Two things I cannot do from here (please read)

1. **Git branch and GitHub Actions runs.** Branch and commit state in this project is managed by Lovable's GitHub sync; I cannot create `fix/journey2-production-readiness`, cannot choose the commit SHA, and cannot trigger or read an Actions run. I will add the workflow file (`.github/workflows/ci.yml`) with all nine jobs so it runs on push/PR, and I will run every command locally and report real output. Creating the branch and reading the Actions result has to be done on your side (or via Labs branch switching) — I will not claim otherwise.
2. **No test/demo records.** Because you forbid creating a test customer/order/DD/email, the preflight cannot literally execute a live end-to-end Journey 2 order. It will instead run against an isolated *test-only* schema path (section 2) whose records are never operational, and it will FAIL when there is no such test evidence rather than passing on historical counts.

## Work items

### 1. Isolated test path (not a flag on live rows)
New tables `journey2_test_sessions_log`, `journey2_test_orders`, `journey2_test_documents`, `journey2_test_email_outbox`. Admin test journeys write only there. Every existing production writer (order create, DD provider submit, supplier submission, invoice/billing schedule, reconciliation, abandoned-resume, customer email) gets an explicit guard that refuses when the session is a test session. Test records carry a visible `TEST` label and are excluded from admin queues, KPIs and reports.

### 2. Pricing and VAT
Remove the hard-coded `const VAT = 0.20` in `journey2-prepare-contract` and read the configured rate. One server-side resolver produces the snapshot consumed by review, Contract Summary, Contract Information, snapshot, order, dashboard, welcome email and first-bill schedule. `amount_due_today = 0.00` and `quotes.total_due_today_gross = 0.00` for every V2 order; setup/activation/one-off router charges appear only inside the estimated first bill. Every price surface renders ex-VAT, VAT amount and inc-VAT.

### 3. No silent fallback
`src/lib/journey2/route.ts` stops redirecting to `/build-plan` on assignment failure: the session is preserved, a retryable error is shown, the failure is logged, and an admin task is raised when human attention is needed. Pricing failure no longer flips the session to `manual_review`. The banned wording ("we need to confirm your price", "our team will contact you", "continue to Build your plan", "we'll confirm the final price") is removed from the V2 surfaces. Only exactly priced active products render.

### 4. Transactional final submission
New `journey2-submit` edge function replaces the browser-triggered `journey2-finalise` path. In one server-side transaction it validates the snapshot hash, the accepted Contract Summary and Contract Information, start date and billing selection; resolves or creates the canonical customer; inserts exactly one order using the existing unique `orders.checkout_session_id` index for idempotency; links order/quote/journey/acceptance/payment method/snapshot; writes `journey_version = 'v2'` and the same `checkout_session_id` everywhere; and only returns success after commit. Unique constraints added for payment methods, DD requests, contract acceptances and welcome-email outbox rows keyed on the checkout session, so refresh or double submit cannot duplicate.

### 5. Completion route
`/order/:token/complete` loads the completed order read-only (no create/modify on open) and shows order number, plan, monthly ex-VAT/VAT/inc-VAT, one-off charges included in the first bill, estimated first bill, preferred start date, billing day, masked Direct Debit details, document links, cooling-off information and next steps.

### 6. Direct Debit lifecycle
Statuses `details_received`, `pending_contract`, `setup_requested`, `submitted_to_provider`, `active`, `failed`, `cancelled` implemented as a constrained status column with transition validation. `pending_contract` after details are stored, `setup_requested` after acceptance and internal request creation, `active` only on provider confirmation. Full bank details stay AES-256-GCM encrypted in `journey2_dd_intake`; only last-4 / sort-last-2 masks reach browser, logs, analytics, emails, PDFs and admin tables. Test sessions never reach the provider.

### 7. Document pack
After successful order creation: signed Contract Summary, Contract Information, acceptance certificate, consolidated signed agreement pack, order summary, masked DD Instruction confirmation, DD Guarantee, cooling-off information, and Digital Voice information when selected — all generated from the one immutable snapshot and its pricing values.

### 8. Welcome-email outbox
`journey2_email_outbox` with unique (order_id, email_type), status, retry count, last attempt, last error, sent date and attachment list, plus an admin resend action. The browser never sends the welcome email; test sessions never enter the live outbox.

### 9. Genuine preflight
`journey2-preflight` rewritten to assert each of your listed gates against real test-path evidence (kill switch on, admin test access works, public V2 unavailable, exact catalogue prices, configured VAT, £0 due today, first-bill one-off treatment, ten-step order, contract only after start date + billing, both documents, acceptance evidence, snapshot SHA-256 validation, DD encryption/masking, no provider submit, no customer email, no supplier provisioning, idempotent double submit, welcome pack, completion route, no V1 fallback, V1 regression). It fails when no test evidence exists, and it no longer calls the live order-number generator.

### 10. Tests and CI
Vitest suites: Journey 1 regression, Journey 2 integration (against the test path), pricing/VAT, duplicate submission, test-mode isolation. `.github/workflows/ci.yml` runs typecheck, build, lint and each suite as separate jobs.

## Final report I will give you

Changed files, migrations, edge functions, local results for typecheck/build/lint and all five suites, the workflow file added (with a clear note that the Actions run and branch creation are on your side), a re-query proving the seven settings, exact manual admin test steps, remaining limitations, and explicit confirmation that no customer email, DD instruction, supplier action or Journey 2 activation occurred and that Journey 1 is enabled and materially unchanged.

## Known limitations up front

- Branch creation, commit SHA and Actions results cannot come from me.
- No literal live end-to-end order can be produced without creating records you forbade; the isolated test path is the substitute.
- Provider DD confirmation timing is outside our control, so `active` can lag order completion.
- Availability remains assumed in Journey 2.

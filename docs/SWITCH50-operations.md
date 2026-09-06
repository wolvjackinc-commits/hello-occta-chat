# SWITCH50 operations and release gates

The feature branch adds a cash reward workflow for Essential Fibre / Price Lock 24. The £50 reward does not discount the £34.99 monthly charge or first invoice. It is a separate conditional cash payment. No bank transfer is initiated by this code. Finance records a transfer only after completing it through the approved banking process.

## Current verification and release status

This implementation is held for release until the full Supabase migration replay, real Journey 2 engine tests, and staging checks below pass. Local PostgreSQL tests exercise the three campaign migrations against a minimal production-column fixture; they do not replace replaying the entire historical schema with Supabase Auth, Storage, pg_cron, pg_net and Vault. Local Docker was unavailable during development. No live database was changed and no real customer email or payout was sent.

Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:switch50-db` and `npm run build`. The `SWITCH50 verification` workflow also checks the campaign server functions with Deno 2.2.6. The existing `CI` workflow runs the full local Supabase stack and real engine tests on a Docker-capable runner. Both workflows must be green for the release commit. Existing repository lint warnings are not treated as passed business-flow verification.

The preview at `/scripts/fixtures/switch50-preview.html` uses synthetic local data and the real payout/status components. Start it with `npm run dev -- --config vite.switch50-preview.config.ts`. It verifies layout and interactions, not production authentication or payment integration. It is not included in the production build.

### Lovable Cloud access and schema reconciliation

OCCTA uses Lovable Cloud's managed Supabase backend. Its database can be inspected through the existing Lovable connection even though the personal Supabase connector cannot access the project. Read-only inspection succeeded and returned PostgreSQL 17.6, 259 applied migrations, the actual billing schema, and confirmation that SWITCH50 tables are not yet live.

The initial February replay conflict was reconciled against that applied history. Two unapplied alternate admin-schema files are preserved outside the executable directory. A missing, already-applied email-schema migration was restored from the database's own history. Historical internal-test payment operations now require their preexisting test contract. Details and deployment implications are recorded in `supabase/reference/RECONCILIATION.md`. CI disables cron execution before replay so historical production schedules cannot run inside tests.

Local verification includes 210 unit tests and 32 PostgreSQL campaign tests. The real email HTTP handler is exercised with mocked database/provider boundaries. The PostgreSQL fixture includes the live invoice status constraint and tests full credit notes and receipt reversals. These checks send no real messages. Full CI and staging remain mandatory release gates; consult the workflow result for the exact release commit.

### Minimising Lovable credits

Coding, review, test execution and branch commits are performed locally and in GitHub. Lovable is used for project metadata and narrowly scoped read-only database queries. No Lovable `send_message` or `create_project` call was made during this continuation, and no broad AI rebuild is needed. The workspace metadata endpoint does not expose a credit balance in this connection, so an exact account-credit delta cannot be independently reported. Ordinary Cloud database usage can still incur usage charges. Lovable is rolling out a unified credit balance for Build, Cloud and AI Gateway, so avoiding AI build prompts does not guarantee zero total credits consumed; see [Lovable's current usage documentation](https://docs.lovable.dev/introduction/credits-and-usage).

Keep release operations separate from AI development. Prepare the exact reviewed migrations and function list here, then use only the necessary Cloud configuration/deployment step after verification. Do not ask Lovable to redesign or reimplement SWITCH50 from scratch. Do not migrate the business to another database merely to obtain development access.

## Finance and customer flow

1. A newly accepted order must carry an eligible immutable Journey 2 contract snapshot. The database rechecks the product, test flag, acceptance, campaign switch, dates and economics at order creation. Delayed customer-account linking preserves an already accepted offer after campaign expiry or pause.
2. The ledger reserves one reward per order and normalized service address, including apartment details. Existing rows with the older address hash are checked through their source orders without rewriting them. Rejected duplicate claims receive an audit event and a customer-visible **Needs review** outcome; they do not create another cash entitlement.
3. Activation, service, cancellation and invoice changes reevaluate rewards. The hourly evaluator handles the passage of time and catches missed transitions. Eligibility requires the real activation date plus the frozen delay (30 days), a live and unblocked broadband service, the first linked positive broadband invoice paid, no account arrears, no cancellation or cease, and no earlier activated broadband order for that customer. Later or unrelated paid invoices cannot substitute for the first bill.
4. In **Admin → Rewards & cash payouts**, finance staff filter and page through the ledger, select **Queue payout**, and review the exact order and amount. Queueing and recording payment recheck eligibility in the same database transaction as the audit entry. A stale version or repeated request cannot double-apply the action.
5. Finance completes the bank transfer using approved, separately verified payment details, then chooses **Record transfer** and enters the bank's unique transfer reference. The application records the transfer; it does not initiate it or collect bank details. Do not pay twice after a network timeout: refresh the ledger and reconcile the bank reference first.
6. Administrators can hold or release a reward with a reason. Release repeats all eligibility checks and cannot force an ineligible payout. A later cancellation flags an already paid reward for review; it does not silently undo a bank transfer. **Record recovery** is available only for issued rewards after money was actually recovered, with a reason and a distinct recovery reference retained in the audit log.
7. Order completion and My OCCTA show pending, eligible, queued, paid, review or recovered status. An eligibility date is not presented as a guaranteed payment date. Customer views omit internal reasons, bank references, other customers and staff audit data.

## Email delivery

Reward transitions atomically create an append-only audit event and a durable email intent. The worker uses Resend directly; it does not invoke Lovable's email queue or AI tools. Templates cover order recording, activation, pending conditions, eligibility, payment queue, paid, blocked, recovered and expired states. It suppresses messages whose state is no longer relevant.

At an approved deployment configuration step, supply:

- Edge secrets: `RESEND_API_KEY`, `SWITCH50_WORKER_SECRET` (at least 32 random characters), and `SWITCH50_EMAILS_ENABLED=true` only after controlled staging verification.
- Vault secret `switch50_worker_url`: the deployment's HTTPS Supabase URL ending in `/functions/v1/switch50-message-worker`.
- Vault secret `switch50_worker_secret`: exactly the same secret as the worker's edge secret.
- A verified Resend sender for `OCCTA <hello@occta.co.uk>` and an operational reply inbox.

The migration installs a five-minute dispatcher. Without both Vault entries it performs no HTTP call. With email sending disabled, the worker leaves the outbox untouched. It requires its own secret even though gateway JWT verification is disabled for this scheduled endpoint. Never put the service-role key, worker secret or provider API key in browser settings or Git.

Each worker request leases at most five messages. Frozen recipient/content and `switch50/<message UUID>` idempotency keys remain stable across retries. Retries stop after six attempts or 23 hours from first attempt, inside [Resend's documented 24-hour idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys). An ambiguous send beyond that window is failed for operator review, not blindly resent with a new key.

The payout screen flags failed communications and the reward history shows delivery attempts. Before any manual resend, an operator must reconcile the original message ID with the provider, correct the cause and record the decision. No automatic fresh-key resend or bulk historical-message replay is included. SMS and WhatsApp are not enabled: no configured delivery provider and recipient-consent flow was available in this repository.

## Analytics

The banner preserves incoming acquisition UTMs. Nonessential click identifiers are retained only with analytics consent. Promotion view, selection, terms and completed-order purchase events use the consent gate. Purchase events require a verified completed, non-test SWITCH50 order and use its order ID as the transaction ID with browser-session deduplication. Monthly price remains the purchase value; reward cash is separate. Staff source reports aggregate source/session/distinct-order counts and never return click identifiers. Funnel totals use independent aggregates to avoid multiplying rewards through joins.

## Required staging checks before production

- Replay every migration on an isolated Supabase stack with the pinned CLI. Resolve any historical schema failures; do not stamp failed migrations as applied. Verify the new migration follows both original campaign migrations. If the hardening migration is already deployed, confirm its actual view column order before proceeding.
- Compare existing reward/address hashes and transfer references. The unique bank-reference index deliberately rejects conflicting preexisting references. Reconcile conflicts explicitly; do not delete or rewrite paid ledger rows to make a migration pass.
- Place an eligible address/product order, inspect both contractual documents, accept it, link the customer, activate service, pay the first bill and advance the test clock to D+30. Verify the completion page, customer tracker, ledger and finance history agree.
- Repeat with Flex 30, other speed tiers, test sessions, duplicate address (including punctuation and apartment variants), existing customer, campaign pause/expiry, delayed linking, unpaid first bill, unrelated/later paid bill, refund, arrears, cancellation and cease. Verify the bank-recording action rejects a reward whose evidence changed after queueing.
- Use two finance sessions to attempt the same queue/payment, a stale version and the same bank reference. Verify one outcome and one request audit. The in-process PostgreSQL test harness does not simulate competing network connections.
- Verify customer, ordinary staff, finance and admin credentials against the real endpoints/RLS. The cron endpoint must reject missing/incorrect secrets. Verify public status contains no ledger or attribution details.
- Enable emails only with a controlled test account and staging sender. Simulate provider failure, timeout after acceptance, worker crash, expired lease and retry-window exhaustion. Confirm recipient/content/key stability and suppression of obsolete messages. Check Vault/pg_net/cron execution and the hourly evaluator job.
- Verify Google/Meta campaign URLs and conversion destinations with consent denied and granted. These changes do not create ad campaigns or spend ad budget.
- Confirm the business accepts manual bank transfers, recovery handling, residential/new-customer criteria and the published promotion terms before enabling the campaign for new orders.

## Deploy and rollback procedure (not executed)

After all gates pass, apply migrations before releasing code that depends on the new columns/RPCs. Deploy the changed campaign admin, message worker, session, completion and contract-preparation functions and the frontend from the same verified commit. Preserve existing billing and activation workers and explicitly review the activation-email wording change. Keep email sending disabled until the scheduler and staging delivery smoke tests pass.

For an incident, pause new campaign acquisitions in Admin → Campaigns and disable `SWITCH50_EMAILS_ENABLED`. Stop finance transfers while investigating; a campaign pause intentionally preserves existing contractual entitlements. Keep the ledger and audit tables intact. Do not roll back by deleting rewards, modifying immutable contract snapshots, or claiming that a database status change reverses real money. Prefer a forward fix after reconciliation.

Unsupported legacy `cron_jobs` TOML entries were preserved at `supabase/schedules/legacy-cron-reference.toml`; they were not executable Supabase CLI scheduling configuration. The dangling `admin-send-email` function entry was removed because its source directory does not exist and it prevented the previous CI run from starting. Neither config correction disables a live deployed function or edits live schedules.

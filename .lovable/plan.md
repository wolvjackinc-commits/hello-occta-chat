Approved with these corrections only.

1. ONE PERFORMANCE TASK, NOT FOUR NEW DEVELOPMENT PHASES

Treat this as one production performance optimisation task with four checkpoints.

Do not restart another numbered feature programme.

Do not add unrelated features or business logic.

2. MEASURE BEFORE ANY MIGRATION OR BEHAVIOUR CHANGE

Checkpoint 1 must be read-only apart from safe timing logs.

Do not add indexes, queues, document changes or async behaviour until the baseline report identifies the actual bottlenecks.

Do not create a database timing-log table unless essential. Prefer redacted edge-function/platform logs so performance monitoring does not add production database writes.

3. USE THE ACTUAL TABLE NAMES

Audit the production schema before creating indexes.

The plan references generic names that may not match the project:

- use `order_journeys`, not `journeys`, where applicable;
- use `profiles`, not `customers`, where applicable;
- confirm the actual documents/communications columns and tables;
- confirm every proposed index does not already exist.

Do not create indexes against guessed tables or columns.

4. REMOVE OUTDATED WORLDPAY HMAC LANGUAGE

Remove:

“no change to webhook fail-closed posture or HMAC verification”

OCCTA uses the currently verified Worldpay SMB eCommerce webhook flow.

Preserve the existing verified settlement logic exactly.

Do not add or reintroduce an HMAC requirement that this merchant configuration does not use.

5. REMOVE GIACOM EXTERNAL-CALL OPTIMISATION

There is no Giacom API integration.

Remove Giacom from:

“External calls (Worldpay, Giacom, Resend)”

No supplier call should be created or optimised.

6. SUPABASE CLIENT AUTH SAFETY

A module-scope service-role Supabase client may be reused safely where appropriate.

Do not reuse a module-scope client containing a customer’s Authorization header across requests.

Any user-scoped client must be created or safely configured per request.

Never allow one customer/admin JWT context to leak into another invocation.

7. DO NOT PASS RAW JWT INTO `assert_admin(jwt)`

Do not create an RPC that accepts the raw JWT as a normal database argument.

Use:

- validated Edge Function authentication;
- `auth.uid()` and trusted JWT claims;
- existing role tables/functions.

Never store, log or pass raw bearer tokens through database parameters.

8. CONTRACT SUMMARY PRE-GENERATION MUST BE SINGLE-FLIGHT

Pre-generation is approved, but guarantee:

- one job per `(quote_id, Contract Summary version)`;
- one Contract Summary row;
- one immutable PDF;
- no duplicate storage uploads;
- no duplicate emails.

If background generation is already running, the customer request must join/reuse that job.

Do not launch a second synchronous generator after six seconds.

Instead:

- continue polling the same job;
- provide a retry action;
- fall back to the existing idempotent generator only when the prior job is confirmed failed or absent.

9. CONTRACT SUMMARY LEGAL FLOW MUST REMAIN UNCHANGED

Pre-generating the document is allowed.

It must not:

- accept the contract;
- create acceptance evidence;
- start the cooling-off period;
- create a customer order;
- send the consolidated onboarding email.

Contract acceptance and cooling-off timing still begin only when the customer expressly signs and accepts.

10. PDF CACHE HEADERS

Buckets must remain private.

Do not use a long-lived public cache.

For short-lived signed URLs, use safe private caching such as:

`Cache-Control: private, max-age=300`

Do not rely on `immutable` where the signed URL itself expires or may be revoked.

The stored immutable PDF bytes and hash remain unchanged.

11. ASYNC CERTIFICATE AND ORDER PACK SAFETY

Moving non-essential PDFs to background jobs is approved only if:

- acceptance evidence is committed synchronously;
- the customer may continue immediately;
- one durable job exists;
- the download status clearly shows Preparing / Ready / Failed;
- retries reuse the same job/document row.

The consolidated onboarding email must still send exactly once and only after the final order pack is ready.

Email failure must not reverse the completed order.

12. CUSTOMER 360 SPLIT ENDPOINTS

Do not weaken the existing canonical overview security.

Use separate endpoints/RPCs:

- admin header overview — staff-authorised;
- admin tab queries — staff-authorised;
- customer overview — authenticated user derived from JWT.

Do not use a browser-supplied mode or customer ID to switch between admin and customer data.

13. PRODUCTION INDEX SAFETY

For small tables, reviewed additive indexes are acceptable.

For any large/live table:

- assess lock impact first;
- create the index concurrently outside a transaction where supported;
- schedule it safely;
- do not block live orders or payments.

Report the table size and expected impact before adding each production index.

14. FRONTEND PERFORMANCE INSTRUMENTATION

`localStorage.perf=1` may be used only as a temporary staff/debug switch.

It must record timings only.

Do not log:

- quote/customer data;
- URLs containing tokens;
- signed document URLs;
- account numbers;
- email/mobile/address;
- request or response bodies.

Remove or disable debug console output after measurements are complete.

15. EXISTING JOBS AND EMAILS

Do not cause pre-generation, certificate or pack jobs to resend existing customer emails.

Do not process historic/test rows automatically.

Every background worker must process only new, eligible, explicitly queued records.

16. ROLLOUT

Use:

- one read-only existing quote for baseline;
- one controlled internal journey with customer-email suppression;
- one real production route with the optimisation flag enabled only after regression passes.

Do not globally enable the performance flag until:

- PDF hashes match;
- Contract Summary content matches;
- order/customer/service row counts remain correct;
- Worldpay regression passes;
- no duplicate emails or documents exist.

17. FINAL SUCCESS REPORT

Report actual before-and-after numbers for:

- quote page usable time;
- Contract Summary cache miss;
- Contract Summary cache hit;
- acceptance transition;
- final submission;
- Customer 360 first paint;
- Customer 360 tab opening;
- dashboard first paint;
- cached PDF download;
- admin list search.

Do not report the optimisation complete based only on build success.

Proceed with the read-only baseline checkpoint first.  
  
OCCTA Production Performance Optimisation Plan

Goal: make the live site faster without changing any customer journey, Contract Summary wording/hashing, payment, DD encryption, lifecycle, invoice, RLS, or permission logic. No new features.

This is a 4-phase plan. Each phase ends with a checkpoint; nothing in a later phase ships before its earlier checkpoint passes regression.

---

## Phase 1 — Measure (no behaviour change)

Add lightweight, opt-in instrumentation so we have real "before" numbers and can prove "after".

Frontend:

- Shared `perfMark(name)` / `perfMeasure(name)` helper writing to a ring buffer + `console.debug` (gated by `localStorage.perf=1`).
- Wrap React Query `fetcher`s used by: `/quote/:token`, journey state, dashboard, Customer 360, admin Orders, admin Customers, admin Services, Manual Giacom Tracking.

Edge functions — add timing only, no payload logging:

- `journey-state`, `journey-generate-cs`, `journey-cs-detail`, `accept-contract-summary`, `acceptance-certificate`, `journey-submit-order`, `process-activation-outbox`, `process-first-billing`, `get_admin_customer_overview` / `get_my_customer_overview` RPCs, invoice/receipt/order PDF generators.
- Emit one JSON log line per request: `{fn, db_ms, pdf_ms, storage_ms, signed_url_ms, total_ms, cache_hit}`.
- Strictly forbid logging: tokens, hashes of secrets, bank/card/PII, request bodies.

DB:

- Capture top offenders via `supabase--slow_queries` and `EXPLAIN (ANALYZE, BUFFERS)` for the worst 10.

Deliverable: a baseline timings table for every target endpoint listed in the brief.

Checkpoint 1: timings captured for one real quote, one real Customer 360, one admin list view. No code paths altered beyond logging.

---

## Phase 2 — Reuse, don't regenerate (PDFs + storage)

Audit every PDF generator (`generateInvoicePdf`, `generateOrderPdf`, `generatePaymentReceiptPdf`, `generateReceiptPdf`, edge-function CS / certificate / consolidated pack generators).

Rules applied uniformly:

1. Each document row stores: `storage_key`, `sha256`, `version`, `generated_at`.
2. Generator becomes: `getOrCreate(documentRef)` —
  - If `storage_key` + `sha256` exist for current `version` → return signed URL only.
  - Else generate once, upload, persist metadata, return signed URL.
3. Signed URL TTL: short (e.g. 5 min) — regenerating URLs is cheap and allowed.
4. No regeneration triggered by view/download endpoints. Regeneration is gated by document `version` bumps from the existing acceptance/lifecycle logic — those rules are not touched.

Contract Summary pre-generation:

- When admin "Send final quote" succeeds, enqueue an idempotent background job (existing outbox/`pg_net` pattern) to call `journey-generate-cs` for that quote.
- `journey-generate-cs` is made fully idempotent on `(quote_id, cs_version)`: if a row + storage object already exist, no-op.
- Customer Continue → `journey-cs-detail` returns the stored PDF + signed URL; only shows "Preparing…" when the row is genuinely missing, polling 1×/s for up to 6 s before falling back to synchronous generate.

Acceptance flow (no business-logic change):

- `accept-contract-summary` commits acceptance evidence (electronic acceptance row, hash, version) synchronously — unchanged.
- Certificate PDF + consolidated pack generation are dispatched via existing outbox after commit; UI advances to Start Date immediately and the download button becomes active when the job lands.
- Final order submission already creates the canonical order synchronously; consolidated pack + single consolidated email move behind the existing outbox so the customer reaches the completion screen as soon as the DB transaction succeeds. Email is sent once the pack is ready; this preserves the "single consolidated email" rule.

Storage:

- Buckets remain private. Cache `Cache-Control: private, max-age=300, immutable` on PDFs after first generation.
- Frontend caches the safe metadata (`storage_key`, `sha256`, `version`, `signed_url_expires_at`) in React Query with a stale time matching URL TTL.

Checkpoint 2: hash diff for every PDF type before/after = identical. One controlled internal journey shows CS already exists at the Agreement step. No duplicate document rows.

---

## Phase 3 — Query & rendering optimisation

Database / RPC layer:

- Replace `select('*')` with explicit column lists on hot paths (dashboard overview, Customer 360 header, admin lists, journey state).
- Collapse N+1 detected in Phase 1 into single RPCs or batched `in()` queries. Specifically audit:
  - `get_admin_customer_overview` / `get_my_customer_overview` — split into "header" + "tabs" calls so initial paint only needs header.
  - Customer 360 tab fetchers — each tab becomes its own query key, fetched on tab open, cached for session.
  - Journey state — single RPC returning quote + cs metadata + step + payment-method summary instead of 3–5 sequential reads.
- Indexes (only after `EXPLAIN` confirms benefit and only if not already present):
  - `quotes(public_token_hash)`, `quotes(quote_number)`
  - `journeys(token_hash)`, `journeys(quote_id)`
  - `customers(account_number)`
  - `orders(customer_id, created_at desc)`, `orders(account_number)`
  - `contract_summaries(quote_id, version)`
  - `services(order_id)`, `services(lifecycle_status)`
  - `invoices(service_id, period_start)`
  - `communications(customer_id, created_at desc)`
  - `documents(customer_id)`, `documents(order_id)`
- Migrations: plain `CREATE INDEX IF NOT EXISTS`, no `CONCURRENTLY` in migration tx. Each migration in its own file, reviewed for prod lock impact (these are mostly small append-only tables; if any is large we drop to a manual concurrent index step and call it out).

Admin lists (Customers / Orders / Services / Manual Giacom Tracking / Invoices):

- Server-side pagination (`range()` + count = "estimated") and indexed server-side search on the existing universal search RPC.
- Return only list columns; detail fetched on row open.
- Debounced (250 ms) search + `AbortController` for stale requests.
- Filters preserved in URL query so back-from-detail keeps state.

Customer 360:

- Initial endpoint returns only: header, account number, current order, current service, lifecycle status, payment method summary, next billing date, key warnings.
- Tabs lazy-loaded on click and cached per session. Mutations invalidate only the affected query key (no global invalidation).
- Paginate communications / order history / invoices / tasks / notes / audit (20-row pages).

Frontend rendering:

- Audit React Query for: duplicate keys, unstable keys (objects/arrays in deps), unnecessary `refetchOnWindowFocus`, polling loops.
- Set sensible `staleTime` (60 s for dashboard overview, 5 min for documents metadata, 0 for live order status).
- Parallelise independent requests via `Promise.all` / parallel `useQuery`s in the same component.
- Route-level code splitting check: confirm admin pages remain lazy-loaded (memory: app perf standard).
- Skeleton components matching final layout for: quote page, Agreement step, Dashboard, Customer 360 header, admin lists. Buttons show immediate disabled+spinner state on click.

Edge functions:

- One module-scope Supabase client per function (no re-init per request).
- Combine auth + role check into a single RPC `assert_admin(jwt)` where currently two round-trips are used.
- Remove duplicate storage `head` checks where document metadata already proves existence.
- External calls (Worldpay, Giacom, Resend) wrapped with `AbortController` + bounded retry — no change to webhook fail-closed posture or HMAC verification.

Checkpoint 3: Phase 1 timings re-measured. Targets:

- Quote page usable < 1.5 s
- Dashboard / Customer 360 header < 2 s
- Step transitions < 1 s
- CS ready < 3 s (cache hit < 500 ms)
- PDF download (cached) < 1 s
- Tab switch near-instant after first open

---

## Phase 4 — Safe rollout & regression

- Feature flag `perf_optimisations_enabled` gating: pre-generation enqueue, async certificate/pack dispatch, split Customer 360 endpoint. Off → old behaviour. On → optimised.
- Recovery point confirmed before migration runs.
- Read-only test against one existing real quote (no writes).
- One controlled internal journey end-to-end with email suppression flag to avoid duplicate customer mail.
- Run the regression checklist from the brief (CS hash unchanged, single order, single email, lifecycle intact, Worldpay webhook unchanged, RLS unchanged).
- Compare before/after timings; produce final report exactly in the format requested (section 15).

Old code paths kept until the optimised path is verified in production for 24 h, then removed in a follow-up cleanup PR (out of scope of this plan).

---

## Explicit non-goals (will NOT change)

Customer journey steps · Contract Summary wording / compliance / legal text · electronic acceptance evidence and hashing · Worldpay HPP / webhook / 3DS handling · Direct Debit encryption · order lifecycle rules · service activation logic · invoice calculations · cancellation / ETF rules · customer/admin RLS and permissions · signed-document hashes · immutable PDF content.

---

## Files / areas expected to change (indicative, finalised in Phase 1 from real timings)

- `src/lib/perf.ts` (new) — perf helper.
- `src/lib/generate*Pdf.ts` — wrap in `getOrCreate` cache layer.
- `src/pages/quote/journey/*` — skeletons + parallel queries (no logic).
- `src/pages/admin/{Customers,Orders,Services,ManualFulfilment,Billing}.tsx` — server-side pagination + debounced search wiring.
- `src/pages/admin/CustomerDetail.tsx` — split header vs tab queries, lazy tabs.
- `src/pages/Dashboard.tsx` + `src/components/dashboard/tabs/*` — same split + per-tab queries.
- `supabase/functions/journey-state` / `journey-generate-cs` / `journey-cs-detail` / `accept-contract-summary` / `acceptance-certificate` / `journey-submit-order` / `process-activation-outbox` / `process-first-billing` / invoice & receipt generators — idempotency guards, module-scope clients, timing logs, async dispatch of non-essential PDFs.
- New migrations: timing-log helper (optional), idempotency unique constraints on `(quote_id, cs_version)` etc. if missing, and the index list above.

---

## Reporting

Final report will contain, per section 15 of the brief: baseline timings, bottlenecks, files/functions changed, indexes added, queries removed/combined, PDFs now reused, Customer 360 / admin list / frontend improvements, post-optimisation timings, regression-test results, PDF hash comparison, TypeScript/build result, security/RLS check result. Plan stops there — no further features.
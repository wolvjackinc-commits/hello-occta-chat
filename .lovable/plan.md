
# Final Controlled Launch Smoke Test — Plan

Read-only verification only. No new features, no schema changes, no payment/supplier/service/invoice/DD/provisioning writes. All checks below are either static code/SQL reads or HTTP GETs to public routes.

## 1. Public route load check
HTTP GET each route against the preview origin and confirm 200 + non-empty HTML (prerendered or SPA shell):
`/`, `/broadband`, `/landline`, `/business`, `/about`, `/support`, `/faq`, `/build-plan`, `/terms`, `/privacy`, `/complaints`.
Record status + page `<title>` for each. Note: console shows a recent client-side 404 for `/build-plan` — re-check route registration in `src/App.tsx` and report whether it's a stale log or a real regression.

## 2. Customer journey trace (code + DB read-only)
Walk the journey by reading code paths and querying recent rows (no inserts):
- Quote request creation → `submit-quote-request` / `quote_requests` row shape.
- Customer link/create → `CreateCustomerDialog`, `link-account` paths.
- Admin approve quote → `quotes.status` transitions, `AdminQuotes` actions.
- Contract Summary generation → `contract_summaries` row + `pdf_storage_key`.
- CS acceptance → `contract_acceptances` row.
- Payment request creation → `payment_requests` insert path.
- Worldpay HPP open → `WorldpayCheckout` / `create-worldpay-session`.
- Dashboard status reflection → `Dashboard.tsx` queries.

Sample 1 recent record from each table via `supabase--read_query` to confirm linkage (PR ↔ CS ↔ quote ↔ profile) is intact. No writes.

## 3. Payment safety audit (static review)
Grep + read to confirm `paid` / `webhook_verified` only set by `worldpay-webhook`:
- `rg "status:\s*['\"]paid|webhook_verified\s*:\s*true|paid_at" supabase/functions src` — only hits should be inside `worldpay-webhook/index.ts` and read sites.
- Confirm `verify-payment-return` and `PayInternalReturn` do NOT mutate `payment_requests.status` to `paid`.
- Confirm no admin UI mutates `payment_requests` to `paid` (no `.update({ status: 'paid' })` in `src/pages/admin/**`).
- Verify HMAC fail-closed in `worldpay-webhook` (already in memory standard — re-confirm presence).

## 4. Manual fulfilment safety
- Read `manual_fulfilment_orders` RLS + row shape via `supabase--read_query`.
- Confirm `CreateTrackerDialog` only inserts into `manual_fulfilment_orders`; `TrackerRow.updateStatus` only updates `manual_fulfilment_orders.status`.
- Grep tracker code for any side-effect writes to `services`, `invoices`, `dd_mandates`, `installation_bookings`, `provisioning_readiness`, or supplier tables — expect none.
- Confirm eligibility filter requires `status='paid' AND webhook_verified=true AND contract_summary_id NOT NULL AND accepted_at NOT NULL AND pdf_url NOT NULL`.

## 5. Admin pages load check
Use Playwright (headless, restoring `LOVABLE_BROWSER_SUPABASE_SESSION_JSON` for the admin preview session) to load:
`/admin`, `/admin/quotes`, `/admin/payment-requests`, `/admin/readiness`, `/admin/manual-fulfilment`, `/admin/tasks`, `/admin/launch-safety`, `/admin/customers`, `/admin/suppliers`, `/admin/services`, `/admin/installations`.
For each: capture screenshot, record console errors, confirm header + table render. No buttons clicked that mutate.

## 6. Security checks
- Anon route check: with no auth, GET `/admin` and confirm redirect/login gate (no admin HTML leaks).
- Customer-role check: read `ProtectedAdminRoute` to confirm it enforces `has_role(uid, 'admin')`.
- RLS spot-check via `supabase--read_query` on `supplier_products`, `margin_rules`, `quote_margin_checks`, `journey_internal_notes`, `manual_fulfilment_orders` — confirm policies require admin role.
- Network payload scan: from Playwright HAR, grep responses on public routes for `service_role`, `SUPABASE_SERVICE_ROLE`, `worldpay`, secret-shaped strings — expect none.

## 7. No-unintended-writes check
Snapshot row counts before & after the smoke test (counts only, no PII) for:
`services`, `invoices`, `dd_mandates`, `installation_bookings`, `provisioning_readiness`, `manual_fulfilment_orders`, `supplier_products`.
Assert deltas == 0.

## 8. Build verification
The harness runs `tsc --noEmit` + `vite build` automatically after edits. Since this turn introduces no edits, rely on the most recent green harness result and re-confirm via `sqlite3 /tmp/sandbox-state.db` daemon-log tail for any errors emitted by Vite since last run.

## 9. Final report
Deliver one structured report:
- Routes tested (table: path → status → title)
- Customer journey: PASS/FAIL per stage with evidence
- Payment safety: PASS/FAIL + grep evidence
- Manual fulfilment: PASS/FAIL + write-surface list
- Admin pages: PASS/FAIL + screenshot refs
- Security: PASS/FAIL per check
- No-unintended-writes: row-count deltas
- Build: tsc/vite status
- **Final launch verdict**: GO / GO-WITH-CAVEATS / NO-GO + blockers list.

## Out of scope (will not run)
- Any insert/update/delete against `payment_requests`, `services`, `invoices`, `dd_mandates`, supplier APIs, provisioning rows, installation bookings.
- Real Worldpay payment.
- Any edge function that mutates state (only read-only or already-idempotent verification reads).

Approve to switch to build mode and execute.

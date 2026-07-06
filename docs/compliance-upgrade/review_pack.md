# OCCTA Two-Document Compliance — Reviewable Evidence Pack

**Global flag:** `platform_settings.two_document_contract_flow_enabled = false` (unchanged).
**Pilot allowlist:** `public.two_doc_pilot_allowlist` — empty on ship.
**Live customer traffic on new flow:** none.
**Worldpay webhook / signature verification:** not modified.
**Direct Debit encryption / provider logic:** not modified.
**Accepted legacy `contract_summaries` / `contract_acceptances` / stored PDFs / hashes:** not modified.

---

## 1. Security / RLS / linter report

### 1.1 Supabase linter — full run

**Total findings: 167.** All findings are pre-existing patterns in the wider
app (SECURITY DEFINER views and functions callable by anon/authenticated).
**None are introduced by the compliance upgrade.** Breakdown:

| Rule                                                    | Level | Count | Notes                                        |
|---------------------------------------------------------|-------|-------|----------------------------------------------|
| `security_definer_view` (0010)                          | ERROR |   7   | Pre-existing helper views (`*_list` masks)   |
| `anon_security_definer_function_executable` (0028)      | WARN  |  ~80  | Pre-existing — public token endpoints, etc.  |
| `authenticated_security_definer_function_executable` (0029) | WARN | ~80 | Pre-existing has_role/is_staff helpers       |

The one new function added by this upgrade — `public.is_two_doc_flow_enabled_for(uuid)` — is `SECURITY DEFINER` for RLS-bypass on `two_doc_pilot_allowlist` lookups, `EXECUTE` **revoked from anon**, granted only to `authenticated` and `service_role`. It appears in the 0029 list, which is intentional and matches the app's existing helper pattern.

### 1.2 RLS review — compliance tables

| Table                        | RLS  | Read policies                                                                                                                    | Write policies                                                              |
|------------------------------|------|----------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| `contract_summaries`         | ✅   | `cs_staff_select_all` (staff)                                                                                                    | `cs_staff_update` (staff). INSERT: **service_role only** via edge function. |
| `contract_acceptances`       | ✅   | `ca_staff_select_all` (staff)                                                                                                    | INSERT: **service_role only** via `accept-service-aware-cs`.                |
| `contract_information_packs` | ✅   | Customers: `customer_id = auth.uid()`. Admins: `has_role admin|super_admin`.                                                     | INSERT/UPDATE: **service_role only**.                                       |
| `acceptance_certificates`    | ✅   | Customers: `customer_id = auth.uid()` OR they are the acceptor. Staff: `is_staff(auth.uid())`.                                   | INSERT: **service_role only**.                                              |
| `acceptance_audit_records`   | ✅   | **Admin/super_admin only.** IP, user-agent, session id, security-event id are NEVER visible to customers.                        | INSERT: **service_role only**.                                              |
| `two_doc_pilot_allowlist`    | ✅   | Admins full CRUD. Users can only see their own row (to know they're enrolled).                                                   | Admins only.                                                                |
| `two_doc_pilot_events`       | ✅   | Admins only.                                                                                                                     | INSERT: **service_role only** (via helper).                                 |

### 1.3 Fixed during this review

**Critical finding — silent 403 risk:** the five new compliance tables had **no `GRANT` statements to `authenticated` / `service_role`**. RLS policies would have allowed reads but PostgREST would have returned permission-denied errors on every client-side query (e.g. customer viewing own acceptance certificate). Fixed in migration `20260706_grants_pilot`.

### 1.4 Storage access review — signed PDFs

- Bucket: `contract-documents` (private, RLS-controlled at object level as before).
- Signed URLs are issued **only** by `get-two-doc-bundle` and `two-doc-generate-samples`, both of which pass the flow gate. TTL: 600s for customer bundles, 3600s for admin sample review.
- No public-bucket exposure introduced.

### 1.5 Customer cross-access test (analytical)

A signed-in customer B calling PostgREST for customer A's `acceptance_certificates` row is blocked because the policy requires `customer_id = auth.uid()`. Same for `contract_information_packs`. `acceptance_audit_records` is unreachable at any level below admin — customer A cannot even see their own audit metadata (by design — only the certificate).

### 1.6 Admin-only audit record test (analytical)

`acceptance_audit_records` policies: only `has_role(admin|super_admin)`. Confirmed via `pg_policies`. Customers are entirely excluded.

### 1.7 Customer endpoint leak review

`get-two-doc-bundle` returns a hand-picked projection: `id, cs_number, version, status, customer_name_snapshot, customer_email_snapshot, service_address, plan_name, customer_type, monthly_price_incl_vat, body_snapshot, terms_version, privacy_version, accepted_at, token_expires_at, pdf_ready`. It **does not** return `accepted_ip`, `accepted_user_agent`, session ids, DD mandate fields, supplier references, wholesale margins, admin/internal notes.

---

## 2. Staff pilot toggle

### 2.1 What was built

| Component                              | File / object                                                    |
|----------------------------------------|------------------------------------------------------------------|
| Allowlist table                        | `public.two_doc_pilot_allowlist`                                 |
| Event log                              | `public.two_doc_pilot_events`                                    |
| Resolver function                      | `public.is_two_doc_flow_enabled_for(_user_id uuid)`              |
| Shared gate helper (edge)              | `supabase/functions/_shared/twoDocFlowGate.ts`                   |
| Wired into `generate-service-aware-cs` | ✅ — logs `access_denied` / `pdf_issued`                          |
| Wired into `generate-contract-information-pack` | ✅ — logs `access_denied`                                 |
| Wired into `get-two-doc-bundle`        | ✅ — logs `access_denied`                                         |
| Admin management API                   | `supabase/functions/two-doc-pilot-admin`                         |

### 2.2 How the gate resolves

```
enabled = platform_settings.two_document_contract_flow_enabled
          OR EXISTS(pilot_allowlist WHERE user_id = auth.uid() AND active)
```

Global flag stays `false`. Only allowlisted users can trigger PDF generation, read bundles, or reach the acceptance endpoint via the new flow. The legacy customer journey does not consult this gate and is unaffected.

### 2.3 How to run the pilot (admin)

```bash
# Add yourself to the pilot allowlist (admin JWT required)
POST /functions/v1/two-doc-pilot-admin
{ "action": "add", "user_id": "<staff auth.uid>", "note": "internal test" }

# List enrolled users
POST /functions/v1/two-doc-pilot-admin { "action": "list" }

# View pilot events (last 100)
POST /functions/v1/two-doc-pilot-admin { "action": "events", "limit": 100 }

# Remove a user
POST /functions/v1/two-doc-pilot-admin { "action": "remove", "user_id": "<uuid>" }
```

---

## 3. Sample PDFs — how to generate

**Actual sample generation was not run in this build** because it requires
staging quote rows for each scenario, which only the operator can prepare
safely without touching production data. The generator function is ready:

```bash
POST /functions/v1/two-doc-generate-samples
{
  "scenarios": {
    "flex_broadband_only":            "<staging quote_id>",
    "fixed_broadband_only":           "<staging quote_id>",
    "broadband_plus_digital_voice":   "<staging quote_id>",
    "sim_only":                       "<staging quote_id>",
    "broadband_plus_sim_bundle":      "<staging quote_id>",
    "mixed_flex_fixed_bundle":        "<staging quote_id>"
  }
}
```

Response includes for each scenario: `contract_summary.{id, cs_number, version, body_snapshot}` and `contract_information_pack.{id, cip_number, version, pdf_hash, pdf_storage_path, pdf_signed_url_1h}` for legal review. All PDFs land in the private `contract-documents` bucket. The signed URLs expire in 1 hour.

The Acceptance Certificate for any of these can be produced by walking one
staging quote through `/quote/two-doc/:token`, checking the 4 boxes, and
POSTing to `accept-service-aware-cs`.

### Confirmations built into the generator

- Only the components attached to that staging quote appear in the CS + Pack (`buildServiceComponentsSnapshot` is per-quote).
- No supplier / wholesale / margin / internal-note fields exist in either the CS body snapshot or the Pack body snapshot.
- Every generated document is issued with `document_status = 'issued'` (not `accepted`), so the immutability lock does not fire.

---

## 4. Billing-gate wiring plan (PATCH PLAN ONLY — NOT WIRED)

`supabase/functions/_shared/billingGate.ts::assertServiceLive(orderId)` is
available but is **not called from any live billing function**. This section
lists every function that must call it before the flag flips.

| # | Function                                    | Current trigger                                                   | Proposed insertion point                                                                                              | Idempotency                                                                     | Rollback                                                | Test case                                                                                       |
|---|---------------------------------------------|-------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------|---------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| 1 | `first-billing-job`                         | pg_cron / manual admin call                                       | Top of `run()`, before selecting orders → filter out orders where `assertServiceLive` fails and log skipped ones      | Uses `first_billing_jobs.run_key` unique — safe to re-run once service-live      | Remove the filter; existing behaviour restored          | Fixture order with `actual_service_live_at_utc = null` → assertServiceLive returns `allowed:false` → no invoice created |
| 2 | `create-first-invoice`                      | called from journey activation                                    | Immediately after order fetch, before `insert into invoices`                                                          | Existing `orders.first_invoice_id` uniqueness prevents duplicate                | Comment out the guard                                   | POST with null `actual_service_live_at_utc` → 409 `service-not-live`, no row in `invoices`      |
| 3 | `recurring-billing`                         | daily pg_cron                                                     | Inside per-order loop, before invoice+charge                                                                          | `billing_runs.run_date + order_id` unique                                        | Remove per-order guard, keep global run                 | Set one active order's `actual_service_live_at_utc = null` → that order skipped, others billed  |
| 4 | `send-invoice-email`                        | trigger on `invoices.insert`                                      | Not applicable — email is *downstream* of invoice creation. Guard the invoice creators (rows 1-3) instead              | n/a                                                                              | n/a                                                     | Covered by rows 1-3 (no invoice → no email)                                                     |
| 5 | `create-worldpay-payment-request`           | admin action + auto after invoice                                 | Guard the auto-after-invoice path (already covered by rows 1-3). Admin path stays ungated — admin overrides deliberately | `payment_requests.reference` unique per invoice                                  | Remove the auto-path guard                              | Auto-create against service-not-live order → 409, admin-created still succeeds                  |
| 6 | `dd-collection-prep` / any DD collection    | pg_cron                                                           | Before scheduling any collection, filter orders through `assertServiceLive`                                          | `dd_intake_requests.reference` unique per invoice                                | Remove the pre-schedule filter                          | Order in DD but service not live → collection is deferred, not cancelled                        |
| 7 | `admin-manual-invoice`                      | admin UI                                                          | **No gate.** Admin manual invoices deliberately bypass — but log `two_doc_pilot_events { event_type: "manual_invoice_pre_live", metadata: {reason} }` when `actual_service_live_at_utc IS NULL` | n/a                                                                              | n/a                                                     | Admin creates invoice with null service-live → succeeds, audit event recorded                   |
| 8 | Any recurring/quarterly cron that can charge| pg_cron                                                           | Same pattern as row 3                                                                                                | Existing per-cycle unique keys                                                   | Remove per-order guard                                  | Same as row 3                                                                                   |

**Rollout order when approved:** 2 → 1 → 3 → 6 → 5 → 8 → 7 (audit-only). One
function per deploy, with pilot-account fixtures verifying skip behaviour
before merge.

---

## 5. Files changed / added in this review-package build

**Added:**
- `supabase/migrations/20260706_grants_pilot.sql` (via migration tool — GRANTs, pilot allowlist, pilot events, resolver function)
- `supabase/functions/_shared/twoDocFlowGate.ts`
- `supabase/functions/two-doc-pilot-admin/index.ts`
- `supabase/functions/two-doc-generate-samples/index.ts`
- `docs/compliance-upgrade/review_pack.md` (this file)

**Modified (flow-gate wiring only, no behaviour change for non-pilot users):**
- `supabase/functions/generate-service-aware-cs/index.ts`
- `supabase/functions/generate-contract-information-pack/index.ts`
- `supabase/functions/get-two-doc-bundle/index.ts`

**Unchanged (explicit confirmation):**
- `supabase/functions/worldpay-webhook/*` — not touched
- `supabase/functions/worldpay-*` — not touched
- Any DD encryption / provider function — not touched
- `src/integrations/supabase/client.ts` — auto-gen, not touched
- Legacy `generate-contract-summary`, `accept-contract-summary`, `journey-generate-cs` — not touched
- Legacy `/quote/contract-summary/:token` route + acceptance page — not touched

---

## 6. Final confirmations

- [x] Global flag `two_document_contract_flow_enabled` remains **false**.
- [x] Pilot allowlist ships **empty**. No user currently has access to the new flow.
- [x] No accepted `contract_summaries` / `contract_acceptances` row was updated or overwritten. Query to verify: `SELECT count(*) FROM contract_acceptances WHERE updated_at > '2026-07-06'` → 0 new rows expected on this build.
- [x] No stored PDF hash was recomputed against an accepted document (the two generators refuse to overwrite `status = 'accepted'` — enforced by explicit check in `generate-service-aware-cs`).
- [x] Worldpay webhook / signature-verification code was not modified.
- [x] Direct Debit encryption internals were not modified.
- [x] Customer endpoints do not return IP, UA, session, supplier, wholesale margin, or internal-note fields.
- [x] Billing-gate wiring is a plan only. No live billing function was modified.

---

## 7. What is still deferred (needs your sign-off to proceed)

1. Legal review of `_shared/twoDocLegalText.ts` and `src/lib/legal/twoDocCopy.ts`.
2. Prepare 6 staging quotes and run `two-doc-generate-samples` to produce the review PDFs.
3. Walk one sample through acceptance in the pilot to produce a sample Acceptance Certificate.
4. Execute the billing-gate wiring plan (§4) one function at a time.
5. KB / long-form marketing editorial pass for price-change wording.
6. Ops runbook: who flips the flag, monitoring dashboards, 60-second rollback path.

No customer traffic will hit the new flow until steps 1-4 are signed off and the operator explicitly adds the first non-staff user to `two_doc_pilot_allowlist`.
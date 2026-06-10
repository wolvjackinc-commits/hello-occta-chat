Approved to proceed with Phase 3D only, but apply these corrections first.

Do not start Phase 7.  
Do not touch Worldpay HPP/webhook, invoice generation, DD mandates, /pay, /pay-invoice, checkout gate, rewards, campaigns, complaints, finance exports, SEO setup or AI chat.

Corrections before coding:

1. Include 36-month terms

Update `min_term_months` to support:

- 1
- 12
- 24
- 36

The Giacom broadband ratecard includes 36-month pricing for some Sky Business Wholesale and BT Wholesale products, so 36 must not be excluded.

2. Add missing product fields

Add these fields if they do not already exist:

- `technology` text: FTTP / SOGEA / SOADSL / FTTC / ADSL / CityFibre FTTP
- `source_document` text
- `source_page` text or int
- `source_section` text
- `supplier_router_net` numeric nullable
- `router_required` bool default false
- `router_notes` text nullable

Every imported row should show where it came from in the ratecard.

3. Do not create any guessed rows

If the actual Giacom Broadband Ratecard is not uploaded inside the Lovable workspace, do not seed representative pricing.

Use this order:

- best: parse the re-uploaded ratecard and seed real rows
- fallback: build schema + admin import UI with zero rows
- avoid: guessed starter rows

All imported rows must be `active=false` by default until admin reviews them.

4. Resolver must use only active rows for customer pricing

Live `/build-plan` pricing must use only:

`active = true`  
`quote_only = false`  
`bucket_hint IS NOT NULL`  
Giacom broadband products only

Inactive rows may be visible in admin and test mode only, clearly labelled inactive/test.

5. Gigabit handling

Keep the public website as 3 main customer cards:

- Essential
- Superfast
- Ultrafast

Gigabit can exist internally as a bucket or upgrade, but do not create a confusing fourth public card unless it is shown as:  
“Gigabit upgrade where available.”

6. CSV importer safety

`admin-import-supplier-products` must:

- require admin/super_admin role server-side
- validate every numeric field
- use an allowlist of accepted columns
- reject unknown dangerous fields
- mark imported rows active=false by default
- add source document/page/section
- log import activity
- never expose imported supplier costs publicly

7. Test mode safety

`/build-plan?test=1&postcode=TEST` must be admin-only.

In test mode:

- no real customer email
- no normal admin email unless clearly marked TEST
- no real order
- no payment link
- no live Contract Summary
- quote_request/quote, if created, must be labelled TEST / INTERNAL
- test quote must not proceed to payment

8. Remove or replace `mem://pricing/giacom-supplier-catalogue`

Do not rely on `mem://` memory for the application.

Instead, create normal project documentation:

- `docs/giacom-supplier-catalogue.md`
- `docs/build-plan-test-mode.md`

The source of truth must remain database rows + uploaded ratecard + admin import page.

9. Contract Summary warnings

Good: add customer-safe ETF/disconnection wording.

But do not show wholesale fee values to the customer.

Use:  
“Cease, disconnection or early termination charges may apply depending on your selected service and when it ends. Any known charges are shown before you order.”

10. Data leak protection

Use an explicit response allowlist in every public edge function.

Public responses must never include:

- supplier cost
- supplier product ID
- supplier selected internally
- margin
- margin floor
- ratecard values
- admin notes
- source document/page
- internal fields

11. Verification required

After Phase 3D:

- migration applies cleanly
- `/admin/suppliers/giacom-import` works
- imported rows are visible but inactive by default
- admin can activate one Essential, Superfast, Ultrafast and Gigabit test row
- resolver uses active real rows
- Price Lock prefers 24/36-month eligible products
- Flex 30 prefers 1-month products
- quote-only fallback works
- `/build-plan?test=1&postcode=TEST` works only for admin
- no supplier data appears in browser/network responses
- Contract Summary warning appears where ETF/disconnection risk exists
- `/`, `/quote/start`, `/quote/thank-you`, `/checkout`, `/pay`, `/pay-invoice`, `/admin/fair-pricing`, `/admin/quotes` still work
- build passes

Stop after Phase 3D and report.  
  
  
Phase 3D — Giacom Product Import + Real Availability Mapping

Scope is limited to `supplier_products`, `buildPlanResolver`, the four pricing edge functions already touched in 3C-bis, one new admin page, and one new admin-only test fixture. Worldpay HPP/webhook, invoice generation, DD mandates, `/pay`, `/pay-invoice`, checkout gate, rewards, campaigns, complaints, finance exports, SEO setup and AI chat are not touched. Phase 7 is not started.

---

### 1. Schema additions (one migration)

Add columns to `public.supplier_products` to capture the ratecard fields the resolver needs:

- `network` text — `'BT Wholesale' | 'CityFibre' | 'Sky Business Wholesale' | 'Vodafone'`
- `download_speed_mbps` int, `upload_speed_mbps` int
- `min_term_months` int (1, 12, 24)
- `connection_fee_net` numeric, `migration_fee_net` numeric
- `care_level` text, `care_level_uplift_net` numeric
- `router_compatible` text
- `etf_applies` bool, `disconnect_fee_in_12m_net` numeric, `disconnect_fee_after_12m_net` numeric
- `quote_only` bool default false
- `bucket_hint` text nullable — `'essential'|'superfast'|'ultrafast'|'gigabit'`
- `tags` text[] default '{}'

Plus a Giacom row in `supplier_profiles` (idempotent). No RLS changes — existing admin-only policies still apply. No new GRANTs needed (table already has them).

Update `src/integrations/supabase/types.ts` consumers only by waiting for regenerated types after the migration is approved.

---

### 2. Ratecard ingest

User is re-uploading **Giacom Broadband Ratecard V3.8.1**. Once present at `/mnt/user-uploads/...`, build mode will:

1. Parse it with `document--parse_document` (PDF) or pandas (XLSX).
2. Generate a deterministic seed migration that upserts rows into `supplier_products` keyed by `(supplier_id, supplier_product_id)` with `active = false`, mapped fields above, and an inferred `bucket_hint` per the mapping table below.
3. Never expose any of these values in client code.

Speed → bucket mapping used during seed and at resolve time:


| Bucket    | Download speeds matched             |
| --------- | ----------------------------------- |
| essential | 40, 80                              |
| superfast | 150, 160, 220, 330                  |
| ultrafast | 500, 550, 900, 1000 (non-CityFibre) |
| gigabit   | 900, 1000 CityFibre 1Gb FTTP        |


WLR/ISDN and Mobile/SIM rows are **not** imported. Only a documented `bucket_hint = null, quote_only = true, tags = ['wlr_placeholder' | 'mobile_placeholder']` stub row per category for admin visibility.

---

### 3. Resolver upgrade — `supabase/functions/_shared/buildPlanResolver.ts`

Replace the hard-coded `supplierMonthlyEstimate(bucket)` with a DB-driven selector. Resolver signature gains an optional `supplierProducts` array (callers pass it; resolver stays pure).

Selection algorithm (server-side only):

1. Filter `active = true` Giacom broadband rows.
2. Filter by `bucket_hint = input.speed_bucket`.
3. Filter by address: `download_speed_mbps <= input.max_download` when `max_download` is known (per the "Max speed + technology only" decision); when `primary_technology` is known, prefer matching `technology`.
4. Filter by term: Price Lock 24 → prefer `min_term_months = 24`, then 12; Flex 30 → prefer `min_term_months = 1`, then 12.
5. Run existing margin guard against each candidate's `supplier_monthly_net + care_level_uplift_net` plus current buffers.
6. Choose the lowest customer price that passes the floor. Ties broken by best absolute margin.
7. If none pass, run the existing `nextSafe99` auto-bump loop against the cheapest candidate; if still unsafe or no rows match, return `quote_only`.
8. Strip everything supplier-shaped from the returned object — only the existing public fields and the existing `internal` block remain. Add `internal.supplier_product_id` and `internal.supplier_monthly_ex` for persistence by callers; existing code already deletes `safe.internal` before responding.

Fallback when no rows exist for a bucket (empty catalogue): keep the current literal `supplierMonthlyEstimate` so dev/preview doesn't break, but tag the result `internal.using_fallback = true` and admins see a warning banner on `/admin/fair-pricing`.

Edge functions already calling the resolver (`resolve-build-plan-price`, `submit-build-plan`, `create-quote`, `generate-contract-summary`) get a small change: they read candidate `supplier_products` via service-role client and pass them in. No public response shape changes.

---

### 4. Address availability mapping

Per decision, ICUK currently returns max speed + technology only. Behaviour:

- Pass `max_download` and `primary_technology` from existing availability response into the resolver.
- `bucketEligibleForAddress` stays as-is.
- When availability is missing/errored: keep existing fail-soft behaviour — buckets render but resolver returns `quote_only` with the message *"subject to address confirmation"* if no supplier row matches the bucket safely.
- Never invent network coverage. Network/provider filtering is left for a later phase when ICUK exposes it.

---

### 5. Router & setup mapping

- `own` router stays £0 customer-side (no change).
- `standard`/`premium` continues to read from `platform_settings.fair_pricing.router`. Internal `supplier_router_net` (now per-product) is included in margin calc when the chosen supplier product mandates a specific router; if `router_compatible = 'supplier_only'`, the `own` option is downgraded to `quote_only` for that product.
- Setup: when chosen supplier row has `connection_fee_net IS NULL` or unknown install type, customer-side setup is forced to `quote_only` with wording *"Setup confirmed before order."*

---

### 6. Contract Summary warnings

`generate-contract-summary` already re-runs the resolver. Add:

- If chosen supplier product has `etf_applies = true` OR a non-zero `disconnect_fee_in_12m_net`, append the standard customer-safe paragraph:
  > "Cease, disconnection or early termination charges may apply depending on your selected service and when it ends. Any known charges are shown before you order."
- If `quote_only` path was taken, append: *"Final price confirmed in writing before order."*
- Wholesale fee values are **never** written to customer-facing fields.

---

### 7. Admin import/review page — `/admin/suppliers/giacom-import`

New page `src/pages/admin/SuppliersGiacomImport.tsx`, route added to `src/App.tsx`, link added to the Suppliers nav in `AdminLayout`. Features:

- Table of Giacom rows with filters: network, technology, bucket_hint, term, active, quote_only.
- Inline activate/deactivate, mark quote-only, edit notes.
- Warning badges for `etf_applies` and `disconnect_fee_in_12m_net > 0`.
- "Re-import staged CSV" action that calls a new admin-only edge function `admin-import-supplier-products` (service-role, requires admin role check) that accepts a CSV body and upserts rows. CSV format documented in-page.
- No customer-facing surface.

Admin-only via existing `is_admin()` check pattern.

---

### 8. Test-mode fixture (minimal)

Per decision — admin-only documented test path, no settings UI:

- Add `?test=1&postcode=TEST` query-param recognition to `/build-plan`.
- When set AND user is admin (verified client-side then re-verified server-side), `resolve-build-plan-price` and `submit-build-plan` accept a `test_availability` body block (`{ max_download, primary_technology }`) and short-circuit the ICUK call.
- `submit-build-plan` in test mode: skips customer email + admin email, prefixes `quote_request.notes` with `[TEST]`, never creates an order or payment.
- Test path documented in a new `docs/build-plan-test-mode.md` (reference only, not user-facing).

---

### 9. WLR / Mobile placeholders

Admin-only. Two seed rows tagged `wlr_placeholder` and `mobile_placeholder`, `quote_only = true`, never returned by the public resolver (filtered by `bucket_hint IS NOT NULL`). No public UI.

---

### 10. Files changed

Migrations

- `supabase/migrations/<ts>_supplier_products_giacom_fields.sql` (schema + Giacom supplier row)
- `supabase/migrations/<ts>_seed_giacom_broadband.sql` (generated after ratecard parsed)

Edge functions

- `supabase/functions/_shared/buildPlanResolver.ts` — DB-driven selector
- `supabase/functions/resolve-build-plan-price/index.ts` — load supplier_products, pass to resolver, accept `test_availability` for admin
- `supabase/functions/submit-build-plan/index.ts` — same, plus test-mode email suppression
- `supabase/functions/create-quote/index.ts` — pass supplier_products
- `supabase/functions/generate-contract-summary/index.ts` — pass supplier_products + ETF warning wording
- `supabase/functions/admin-import-supplier-products/index.ts` — new admin-only CSV importer

Frontend

- `src/pages/admin/SuppliersGiacomImport.tsx` — new
- `src/components/admin/layout/AdminLayout.tsx` — nav link
- `src/App.tsx` — route
- `src/pages/BuildPlan.tsx` — read `?test=1`, pass `test_availability` when admin

Docs

- `docs/build-plan-test-mode.md`

Memory

- `mem://pricing/giacom-supplier-catalogue` — new reference memory describing the supplier_products usage and the do-not-expose rule.

---

### 11. Verification after build

1. Apply migration; confirm columns present and types regenerated.
2. Hit `/admin/suppliers/giacom-import`, confirm seeded rows visible and filter chips work.
3. Set one Essential, one Superfast, one Ultrafast and one Gigabit row to `active = true`.
4. On `/build-plan` walk through Essential 80/20 + Price Lock 24 + own router + remote setup — confirm price renders, network responses show no supplier cost / supplier_product_id / margin fields.
5. Repeat for Flex 30 — confirm a 1-month product is selected internally.
6. Force an empty bucket (deactivate all Gigabit rows) — confirm Gigabit returns `quote_only`.
7. `?test=1` flow as admin: change `test_availability.max_download` to 35 — confirm Superfast/Ultrafast/Gigabit return `quote_only` with the "subject to address confirmation" wording.
8. Generate a contract summary for an active ETF product — confirm the disconnect warning appears.
9. Smoke check unchanged routes: `/`, `/quote/start`, `/quote/thank-you`, `/checkout`, `/pay`, `/pay-invoice`, `/admin/fair-pricing`, `/admin/quotes`.
10. `bun run build` passes cleanly.

---

### Risks & mitigations

- **Ratecard not yet uploaded:** without the file I cannot generate the seed migration. If it doesn't arrive before build, I will ship steps 1, 3–9 against the existing literal fallback and stop before step 2's seed migration, then report back asking for the file.
- **Resolver regression:** all four callers re-run server-side, fallback keeps the literal table so `/build-plan` never goes blank.
- **Data leak risk:** explicit allowlist of public fields in each edge function response, plus a unit-style assertion in `resolve-build-plan-price` that the serialized response contains none of: `supplier_`, `margin`, `floor`, `ratecard`.
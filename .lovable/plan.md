## Scope

Hotfix only for the Phase 3D resolver safety bug. No Phase 7, no new pages, no pricing copy changes, and no changes to Worldpay, invoices, DD mandates, `/pay`, `/pay-invoice`, checkout gate, rewards, campaigns, complaints, finance exports, SEO, or AI chat.

## Bug to fix

The resolver currently gates empty buckets, but it still ranks term-ineligible active rows:

- `Flex 30` can choose 12/24/36-month rows because `termRank()` treats them as fallback candidates.
- `Price Lock 24` can choose 36-month, 12-month, or other term rows by ranking instead of strict eligibility.
- Loader failures currently return `[]`, which is safe in effect but indistinguishable from a genuine empty match and does not use the required manual-confirmation message.
- The preview endpoint has no admin/test resolver version marker to prove the deployed function is using the hotfix code.

## Implementation plan

1. Update `supabase/functions/_shared/buildPlanResolver.ts`
   - Add `RESOLVER_VERSION = "phase_3d_hotfix"`.
   - Extend candidate typing to include `active`, `service_type`, and optional `tags`.
   - Add strict term eligibility:
     - `flex_30`: only `min_term_months === 1`.
     - `price_lock_24`: only `min_term_months === 24`.
     - Allow `min_term_months === 36` for Price Lock 24 only when `tags` explicitly contains `allow_price_lock_24_from_36m`.
   - Replace term ranking fallback with a hard `isTermAllowed()` filter before pricing.
   - Ensure the eligible filter confirms all required safety gates before any price calculation:
     - `active === true`
     - `quote_only === false`
     - `bucket_hint` matches request
     - allowed term
     - address `max_download` supports product speed
     - `service_type === "broadband"`
     - valid supplier monthly cost
   - If eligible candidates are empty, immediately return `quote_only`.
   - Preserve the existing public response shape and `stripInternal()` behaviour.

2. Update candidate loading in `_shared/buildPlanResolver.ts`
   - Select `active`, `service_type`, and `tags` from `supplier_products`.
   - Keep DB-side filtering for Giacom, active, non-quote-only, bucket, and broadband for performance.
   - Change loader error handling so query/profile errors return a safe quote-only signal instead of silently behaving like legacy fallback data.

3. Update resolver callers for loader failure safety
   - `resolve-build-plan-price`
   - `submit-build-plan`
   - `create-quote`
   - `generate-contract-summary`

   Each caller will treat supplier product load failure as quote-only/manual-confirmation, never as a priced result.

4. Add admin/test deployment parity marker
   - In `resolve-build-plan-price`, add `resolver_version: "phase_3d_hotfix"` only when the request used admin-authorised `test_availability`.
   - Do not expose supplier identifiers, supplier cost, supplier/network names, margins, source documents, or ratecard values.

## QA plan

1. Re-run hotfix scenarios with admin test availability:
   - F1: Essential / Flex 30 with `BT-SOGEA-80-1M` deactivated → expected `quote_only`.
   - F2: Essential / Flex 30 with all Essential rows deactivated → expected `quote_only`.

2. Reactivate the approved starter rows and re-run regressions:
   - A: Essential / Price Lock 24 / own / remote.
   - B: Essential / Flex 30 / own / remote.
   - C: Superfast / Price Lock 24 / standard router monthly.
   - D: Ultrafast / Price Lock 24 / premium router monthly.
   - E: Gigabit / Price Lock 24 / own / remote.

3. Security verification
   - Confirm responses do not include supplier cost, supplier product ID, supplier name/network, margin, margin floor, internal block, source document/page, or Giacom/ratecard values.

4. Build/check validation
   - Run the project’s relevant checks after edits.

## Final report

I will stop after the hotfix and report:

- Exact resolver bug found.
- Files changed.
- F1/F2 results.
- A–E regression results.
- Supplier-data security result.
- Whether checks passed.
- What remained untouched.
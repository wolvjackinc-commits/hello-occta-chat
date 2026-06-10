# Giacom Supplier Catalogue

Source of truth: rows in `public.supplier_products` linked to the `Giacom`
row in `public.supplier_profiles`. Managed via `/admin/suppliers/giacom-import`.

## Visibility rule

Supplier monthly cost, supplier product IDs, supplier name, margin numbers,
ratecard values, admin notes and source document/page metadata are **never**
exposed to public callers. Edge functions strip the `internal` block (and any
`supplier_*`, `margin*`, `ratecard*` fields) via `stripInternal()` in
`supabase/functions/_shared/buildPlanResolver.ts` before returning to the
browser.

## Resolver selection

`resolveBuildPlanPrice` accepts a `candidates` array loaded by
`loadGiacomCandidates()`. The selector:

1. Filters `active = true`, `quote_only = false`, `bucket_hint = <bucket>`,
   `service_type = 'broadband'`, supplier = Giacom.
2. Drops rows whose `download_speed_mbps` exceeds the available `max_download`
   for the address (+ 5 Mbps tolerance).
3. Ranks by term preference (Price Lock 24 → 24/36/12; Flex 30 → 1/12),
   then lowest supplier monthly net + care uplift, then lowest ETF risk.
4. If no candidates match → returns `quote_only` (no literal fallback price
   is shown to customers).
5. If `router_required` is true and the customer picked BYO → `quote_only`.

## CSV import

CSV import is admin-only via the `admin-import-supplier-products` edge
function. Allowlist headers documented in the admin page. Rows are always
imported with `active = false` and `quote_only = false`; admin reviews and
activates explicitly before any customer can see derived pricing.

## WLR / Mobile

WLR/ISDN and Mobile/SIM are intentionally **not** imported by the public
Build Plan path. Add them only as admin-only reference rows with
`bucket_hint = NULL` and appropriate `tags`; the resolver ignores them.
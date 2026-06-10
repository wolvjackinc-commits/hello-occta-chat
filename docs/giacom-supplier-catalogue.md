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
## Seed Manifest — Giacom Broadband Ratecard v3.8.1 (1 Apr 2026)

Seeded via migration on 2026-06-10. All rows `active = false` pending admin activation in `/admin/suppliers/giacom-import`.

| Network    | Broadband rows | Install rows |
|------------|---------------:|-------------:|
| BT         | 28             | 12           |
| Sky        | 18             | 12           |
| CityFibre  | 3              | 3            |
| Vodafone   | 10             | 5            |
| **Total**  | **59**         | **32**       |

- Source: `giacom_broadband_ratecard_v3.8.1` (pages 3–9, termination fees page 11)
- Bucket mapping: 80→essential, 115–220→superfast, 330–550→ultrafast, 1000→gigabit. Anything <40Mbps → `bucket_hint = NULL, quote_only = true`.
- ETF flags from page 11 termination table (BT/Sky/CityFibre/Vodafone disconnect fees in/after 12m).
- WLR and Mobile ratecards intentionally not seeded in Phase 3D.

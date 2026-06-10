## Phase 3D Seed: Giacom Broadband Ratecard v3.8.1

Parsed the uploaded broadband ratecard. Only broadband rows are seeded — WLR and Mobile rate cards are out of scope for Phase 3D (resolver only consumes broadband). Mobile/WLR can be ingested in a later phase via the same admin import UI.

All rows seeded as `active = false`, `source = 'giacom_ratecard_v3.8.1'`, `source_version = '2026-04-01'`. Admin enables them in `/admin/suppliers/giacom-import` after sanity check.

### Seed migration content

**Sky Business Wholesale** (network `Sky`)
- FTTP 80/20, 160/30, 330/50, 550/75, 1000/115 — 1m / 24m / 36m tiers
- SOGEA 80/20 — 1m / 24m / 36m
- Connection fees: No Site Visit / Standard / Premium / Advanced (FTTP + SOGEA)

**CityFibre** (network `CityFibre`)
- FTTP 160Mb (25.50), 1Gb (31.75), 1Gb Premium (37.00) — 1m only
- Install: Standard 59.00, Non-Standard 119.00, Migration 56.00

**BT Wholesale** (network `BT`)
- FTTP 0.5/0.5, 40/10, 80/20, 115/20, 160/30, 220/30, 330/50, 550/75, 1000/115 — 12m / 24m / 36m
- SOGEA 0.5/0.5, 40/10, 80/20 — 1m / 24m / 36m where available
- Connection fees per install type

**Vodafone** (network `Vodafone`)
- FTTP 0.5/0.5 through 1000/115 — 1m only
- SOGEA 0.5/0.5, 40/10, 80/20 — 1m only
- Install: NSV / Standard 69 / Premium 105.50 (SOGEA), 110.50 (FTTP)

**Termination / ETF flags** populated from the ratecard's Termination Fees section (page 11): all rows flagged `etf_applies = true`, with `disconnect_fee_in_12m_net` and `disconnect_fee_after_12m_net` from the published table (e.g. Vodafone 75 / 25).

**Care levels** stored as `tags` (Standard included, Enhanced/Premium uplift values) — not separate rows, since resolver already maps care via `platform_settings.fair_pricing.care`.

**bucket_hint** derived from download_speed_mbps using existing bucket boundaries (Essential 80/20, Family 160-220, Power 330-550, Ultra 1000). Rows below 40Mbps marked `bucket_hint = null, quote_only = true`.

### What this delivers (full Phase 3D summary)

**Products seeded:** ~55 broadband rows across 4 networks, all `active = false` pending admin review. Zero WLR/Mobile rows (deferred).

**Supplier networks added:** Giacom profile + BT, Sky, CityFibre, Vodafone tagged via `network` column.

**Resolver behaviour:** DB-driven, term-aware, ETF-risk-aware, no literal fallback. `quote_only` when no match.

**Availability mapping:** Filters by `max_download` and `primary_technology` from ICUK. Network filtering deferred.

**Router/setup mapping:** Own router £0; standard/premium read from `platform_settings.fair_pricing.router`; connection fees pull from seeded `connection_fee_net` per install type with `quote_only` fallback.

**Warning behaviour:** Contract Summary auto-appends ETF/disconnect warnings and "subject to address confirmation" / "final price confirmed in writing" copy where flags trigger.

**Customer data security:** `stripInternal()` enforced in all four resolver edge functions — no supplier IDs, costs, margin, or `internal` block ever reaches the browser. Verified by allowlist response schema.

**Untouched:** Worldpay HPP, webhooks, invoices, DD mandates, `/pay`, `/pay-invoice`, checkout gate, rewards, campaigns, complaints, finance exports, SEO setup, AI chat.

**Verification:** Apply migration → confirm rows present → activate one row per bucket via admin UI → smoke /build-plan with priced bucket (returns matched price) and empty bucket (returns quote_only) → smoke `?test=1` with fake postcode → confirm `/quote/start`, `/checkout`, `/pay`, `/pay-invoice`, `/admin/fair-pricing`, `/admin/quotes` unchanged → `bun run build` passes.

**Warnings/errors:** None expected from seed migration. WLR + Mobile ratecards intentionally not seeded — flagged for separate phase.

### Files to change

- `supabase/migrations/<new>_seed_giacom_broadband_v3_8_1.sql` — single seed migration, ~55 INSERT rows, idempotent via `ON CONFLICT (supplier_id, supplier_product_id) DO UPDATE`.
- `docs/giacom-supplier-catalogue.md` — append seed manifest + source version.

No other files change. Resolver, edge functions, admin UI from prior Phase 3D commit already handle the seeded rows.

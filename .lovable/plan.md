# Audit — Intended OCCTA retail prices after Giacom Ratecard V4.0 (10 Aug 2026)

Read-only audit. No files or data changed.

## 1) The governing user instruction

Source: user message #2320, **2026-08-10 17:15 UTC** ("PRODUCTION-SAFETY PLANNING ONLY — DO NOT EDIT, DO NOT DEPLOY, DO NOT PUBLISH"), section "Wholesale/rate-card facts to preserve internally only". Exact wording:

> "Latest user-provided Giacom Broadband Ratecard v4.0 has e.g. BTW FTTP 80/20 rental £25.00 12m, £24.50 24m, £24.00 36m; 220/30 £28.50/£27.50/£27.00; 330/50 £30.50/£30.00/£29.50; 550/75 £36.50/£36.00/£35.50; 1000/115 £41/£40.50/£40; SOGEA 80/20 £23.75/£23.25/£22.75. Connection and termination/ancillary charges vary by product/install/migration and termination fees may apply in addition. These are internal cost/risk inputs, NOT customer-facing prices."
>
> "Customer-facing retail must continue to be resolver/final-quote-driven and margin guarded; do NOT rebase or alter prices in this task."

Reinforcing constraints in the same message and in #2324 (2026-08-10 17:20):
- "Customer pricing must remain exactly as final quote/service snapshot says. Contract template upgrades must NEVER reprice a customer." (#2320, constraint 5)
- "Preserve ALL current journeys, routing, quote/pricing resolver, margin logic…" (#2320, constraint 1)
- "Do not change customer pricing… quote resolver, supplier margin logic" and "Never expose supplier/Giacom IDs, wholesale rates, costs, margins" (#2324)
- "Price/margin resolver unchanged and no new public supplier leakage." (#2320 test criteria)

Intent: V4.0 was an **internal cost/ETF input refresh only**. Public headline prices stay as already live; per-customer prices come from the resolver / final quote snapshot.

## 2) Intended public prices by band and term (incl. VAT, residential)

Authoritative store: `platform_settings.fair_pricing.headline` (display fallback mirror in `src/lib/pricing/fairPricing.ts` → `FAIR_PRICING_DEFAULTS`). Current values match the V4 migration and the code mirror:

| Public band | Speed shown | Price Lock 24 | Flex 30 |
|---|---|---|---|
| Essential Fibre | Up to 80Mbps | £34.99 | £37.99 |
| Superfast Fibre | Up to 330Mbps | £43.99 | £45.99 |
| Ultrafast Fibre | Up to 550Mbps | £51.99 | £52.99 |
| Gigabit Fibre | Up to 1000Mbps | £57.99 | £58.99 |

"From" price on public cards = the **Price Lock 24** value (`src/lib/pricing/engine.ts` line 56), so the site-wide starting price is **£34.99**.

Bucket → public band mapping (internal buckets and public bands share the same four names; `supplier_products.bucket_hint` in production):
- `essential` — 80Mbps rows (14 active) → "Essential Fibre, up to 80Mbps"
- `superfast` — 115–330Mbps rows (21 active) → "Superfast Fibre, up to 330Mbps"
- `ultrafast` — 550Mbps rows (7 active) → "Ultrafast Fibre, up to 550Mbps"
- `gigabit` — 1000Mbps rows (9 active) → "Gigabit Fibre, up to 1000Mbps"
- rows below 40Mbps → `bucket_hint = NULL`, quote-only, never public

Note: `docs/giacom-supplier-catalogue.md` still documents the older v3.8.1 mapping "330–550 → ultrafast", which contradicts live data (330 sits in `superfast`). Documentation-only conflict.

## 3) Intended equipment / setup retail values

From `platform_settings.fair_pricing` (same values mirrored in `fairPricing.ts`):

- Router standard: **£94.99 one-off** or **£4.99/mo** (monthly recovery refused on Flex 30 — resolver returns quote_only)
- Router premium: **£129.99 one-off** or **£7.99/mo**
- Bring your own router: **£0**
- Setup: remote **£0**, standard **£49.99**, engineer **£134.99**, complex → quote-only
- Add-ons: priority support £6.99/mo, static IP £5.00/mo, digital voice £5.99/mo, paper billing £2.50/mo

V4 changed only `router.standardOneOff` → 94.99 and `setup.engineer` → 134.99 (plus supplier ETF/disconnect costs). Everything else was intentionally left as-is.

## 4) What `retail_price_floors` is for

A **separate safety guard, not the headline price list**. `quote_below_retail_floor(quote_id)` compares a quote's `monthly_gross` with `floor_monthly_gross` for (service_type, speed_bucket, plan_term) and flags it; `admin_override_quote_floor` records an explicit admin override with a reason. Staff-read-only under RLS, never shown to customers.

Distinct from `fair_pricing.floors` (essentialLockByo 1.50, essentialFlex 3.50, superfast 3.50, ultrafast 4.50, gigabit 4.50), which are **minimum £ margins per month** used by the resolver's auto-bump loop.

Current state: the V4 migration set every `retail_price_floors.floor_monthly_gross` **equal to the headline price** (previously lower — superfast lock24 39.99 vs headline 43.99, ultrafast 49.99, gigabit 52.99). Floor == headline removes all discount headroom: any quote a penny below card price now trips the flag and needs an admin override. A floor slightly below headline is the safer reading of the table's purpose.

## 5) Values that currently conflict

Backend / data:
1. **`fair_pricing.priceLockEnabled = false` and `flex30Enabled = false`** in production. `buildPlanResolver` lines 191–192 turn *both* terms into `quote_only` ("Price Lock 24 is currently unavailable" / "Flex 30 is currently unavailable here"), so no Build Plan configuration can return a price at all, whatever the headline values say. Most material live conflict.
2. **`retail_price_floors` == headline** (section 4) — no margin/discount headroom left.
3. `docs/giacom-supplier-catalogue.md` still describes the v3.8.1 mapping and seed manifest; no V4.0 section.

Public-facing copy contradicting the intended headline set:
4. `src/pages/seo/BroadbandPlans.tsx` — "Essential … £34.99, Superfast estimated 150/30Mbps £37.99, Ultrafast estimated 500/75Mbps £42.99, Gigabit estimated 900/110Mbps £46.99 … free standard install". Superfast/Ultrafast/Gigabit prices and "free standard install" all conflict (£43.99 / £51.99 / £57.99; standard setup £49.99).
5. `src/pages/NoContractBroadbandComparison.tsx` — "From £22.99/mo" in hero, comparison table row, an FAQ answer, and a Cuckoo comparison line.
6. `src/pages/RollingVsFixedBroadbandComparison.tsx` — "From £22.99/mo (OCCTA)" for both Flex 30 and Price Lock 24, plus an FAQ repeating £22.99.
7. `src/data/guides.ts` — "FTTC from £34.99/mo and FTTP from £49.99/mo" (line 501); several passages claim the router is "included as standard" and "no setup fees", contradicting BYO/router-purchase policy and £49.99/£134.99 setup.
8. `src/data/locations.ts` — city pages use £34.99 (consistent) but also state "Every OCCTA plan includes … a Wi-Fi router, Setup from £0" (lines 85, 109 and similar), contradicting router policy.
9. `src/data/comparisons.ts` line 67 — OCCTA "Setup fees: Free".
10. `src/lib/businessData.ts` — business broadband cards hardcoded £24 / £34 / £54 with "WiFi 6 router" included; not derived from the engine or the V4-era catalogue.
11. `src/lib/pricing/catalogue.ts` retailMonthly values (£22.99–£43.95) are pre-V4 ICUK retail numbers. They surface only if a `fair_pricing.headline` value is missing (`engine.ts` line 56 fallback), so a partial settings row would silently show old, now sub-cost prices (e.g. £22.99 against a £23.25 SOGEA 24m cost).

Consistent, no action implied: `src/lib/pricing/constants.ts` `SEO_PRICES.broadband = '34.99'`, `src/pages/CoverageAreas.tsx`, `src/data/keywordPages.ts` (`price: "34.99"`), `KeywordLanding.tsx` default.

## Answer in one line

Intended post-V4 public retail is unchanged from the live Fair Pricing set — £34.99/£37.99, £43.99/£45.99, £51.99/£52.99, £57.99/£58.99, with router £94.99/£4.99 (standard), £129.99/£7.99 (premium), BYO £0, setup £0/£49.99/£134.99 — all per-customer pricing resolver/final-quote-driven, `retail_price_floors` acting only as an override guard, and the term toggles plus the SEO copy above being the live contradictions.
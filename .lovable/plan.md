# Dynamic Pricing Engine — Final Revised Plan

## Summary

Replace all hardcoded pricing with a central ICUK-based catalogue and pricing engine. The current UI stays identical — same 4 broadband cards, same 4 SIM cards, same 1 landline card, same layout, same copy structure. All visible prices derive from one helper function.

## Architecture

```text
src/lib/pricing/
├── types.ts              ← All TypeScript types
├── catalogue.ts          ← Every ICUK wholesale row (broadband, voice, PSTN, ISDN, CPS, numbers, porting, SMS, care, setup, add-ons)
├── retailCards.ts        ← Public card definitions + mapping rules
├── engine.ts             ← Price calculations, "from" price helpers, bundle/setup/summary logic
├── availability.ts       ← Postcode filtering, supplier mapping
├── index.ts              ← Re-exports

src/lib/
├── plans.ts              ← Adapter (same exports, reads from engine)
├── addons.ts             ← Adapter (same exports, reads from engine)
├── businessData.ts       ← Adapter (same exports, reads from engine)
```

---

## Step 1 — `src/lib/pricing/types.ts`

All types:

- `**ProductStatus**`: `'public' | 'internal_only' | 'quote_only' | 'disabled'`
- `**CustomerType**`: `'residential' | 'business' | 'both'`
- `**CatalogueProduct**`: id, slug, name, supplier, technology (SOGEA/FTTP/SOGFast/SOADSL/PSTN/ISDN2/ISDN30/CPS), speedDown, speedUp, wholesaleMonthly, retailMonthly, wholesaleContractTerm (1/12/18), retailContractLabel, productStatus, customerType, networkType, installTypeSupported[], freeInstallEligible, rebateClawbackMonths, ceaseFee, priorityScore, marginMonthly, marginOneOff, visibility, notes, disclaimers
- `**RetailCardDef**`: id, publicTitle, category, tagline, description, features[], speedLabel, eligibleProductIds[], popular, serviceType, mappingPriority
- `**InstallScenario**`: id, label, retailCharge, wholesaleCharge, rebateAmount, effectiveCost
- `**CareLevelConfig**`: id, label, monthlyUplift, internalSLA
- `**VoiceCatalogueProduct**`: id, name, type (home/business/sip), variant (payg/bundle), wholesaleMonthly, retailMonthly, minutesIncluded, productStatus, customerType
- `**NumberType**`: id, tier, wholesaleMonthly, retailMonthly
- `**PortingOption**`: id, type, wholesaleCharge, retailCharge, multiCap?
- `**SmsTier**`: minVolume, maxVolume, retailPerMessage, internationalFormula
- `**CallTariff**`: type, retailPerMinute, internationalMarkup?
- `**AddonCatalogueItem**`: id, name, wholesaleMonthly, retailMonthly (or retailOneOff), serviceType, productStatus, icon, description
- `**BundleConfig**`: id, name, discount, requiredServices (broadband + voice type), eligibleBroadbandFamilies, voiceType, includesFreeBronzeNumber, stackable, addonDiscountRules
- `**OrderSummary**`: productSelected, supplierMapping, installScenario, monthlySubtotal, oneOffSubtotal, bundleDiscount, bundleName, addons[], portingCharges, numberCharges, notes[], internalMarginSnapshot, rollingMonthly

---

## Step 2 — `src/lib/pricing/catalogue.ts`

Every ICUK row from the uploaded data. Exact prices, no placeholders.

**Broadband catalogue (~30+ rows):**
Each row is a `CatalogueProduct` with exact wholesale/retail from uploaded data.

Residential 1-month (public, rolling):

- `sogea-40-10-1m`: SOGEA 40/10, w25.00, r29.95, tech SOGEA, supplier Openreach, 1mo
- `sogea-80-20-1m`: SOGEA 80/20, w26.00, r30.95, tech SOGEA, supplier Openreach, 1mo
- `fttp-80-20-tt`: FTTP 80/20, w22.00, r26.95, tech FTTP, supplier TalkTalk, 1mo
- `fttp-160-tt`: FTTP 160, w27.00, r32.95, tech FTTP, supplier TalkTalk
- `fttp-220-tt`: FTTP 220, w30.00, r34.95, tech FTTP, supplier TalkTalk
- `fttp-330-tt`: FTTP 330, w31.00, r35.95, tech FTTP, supplier TalkTalk
- `fttp-500-tt`: FTTP 500, w28.00, r33.95, tech FTTP, supplier TalkTalk
- `fttp-550-cf`: FTTP 550, w35.00, r40.95, tech FTTP, supplier CityFibre
- `fttp-1000-tt`: FTTP 1000, w30.00, r35.95, tech FTTP, supplier TalkTalk
- `fttp-1000-cf`: FTTP 1000, w38.00, r43.95, tech FTTP, supplier CityFibre
- `fttp-2500-cf`: FTTP 2500, w39.00, r49.95, tech FTTP, supplier CityFibre

Business variants (productStatus: `internal_only` or `public` depending on business page):

- Business-grade versions of above speeds where applicable, with `customerType: 'business'`

Legacy / quote-only:

- `pstn-line`: PSTN, productStatus `quote_only`
- `isdn2-line`: ISDN2, productStatus `quote_only`
- `isdn30-channel`: ISDN30, productStatus `quote_only`
- `cps-line`: CPS, productStatus `quote_only`
- SOADSL variants: productStatus `internal_only`
- SOGFast variants: where applicable, with correct wholesale/retail

12-month and 18-month term variants where applicable, with `wholesaleContractTerm: 12` or `18`, productStatus `internal_only` (not shown on public cards since public = rolling monthly only).

**Setup/install scenarios:**

- `sogea-engineer`: retail 79.95, wholesale 117.10, rebate 64.50
- `sogea-no-engineer`: retail 59.95, wholesale 106.30, rebate 64.50
- `sogea-migrate-fttc`: retail 9.95, wholesale 8.71, rebate 8.55
- `sogea-migrate-adsl`: retail 19.95, wholesale 67.20, rebate 64.50
- `fttp-standard`: retail 0 (where supplier allows free install)
- Global cease fee: 36.00
- Rebate clawback: 12 months

**Care levels:**

- Standard: +0, CL1/CL2 internal SLA
- Priority: +9, CL2.5/CL3 internal SLA
- Enhanced: +14, CL3/CL4 internal SLA

**Voice products (exact uploaded prices):**

- Home Digital Phone PAYG: w2.00, r4.95
- Home Digital Phone 1000min: w4.00, r7.95
- Business VoIP PAYG: w3.00, r6.95
- Business VoIP 2000min: w6.00, r11.95
- SIP Trunk PAYG: w3.00, r5.95
- SIP Trunk 2000min: w6.00, r9.95
- Enhanced SIP: w1.00, r2.50

**Numbers:**

- Bronze: w0.25, r1.25
- Silver: w1.50, r2.95
- Gold: w10.00, r14.95
- Platinum: w20.00, r29.95
- Non-geo: w0.50, r1.95

**Porting:**

- Single: w11.00, r15.00
- Multi: w11.00, r12.00/number, cap 72.00
- Change/resubmission: w11.00, r15.00
- Validation: w5.00, r7.00
- Export: w10.00, r15.00

**SMS tiers:**

- UK 1-1999: 0.06
- UK 2000-4999: 0.05
- UK 5000+: 0.045
- International: wholesale × 1.25, min 0.10

**Call tariffs:**

- UK landline: 0.015/min
- UK mobile: 0.035/min
- UK 03: 0.015/min
- International: wholesale × 1.30

**Add-ons (only those from uploaded data + existing website):**

- Static IP: existing on website (broadband addon)
- Call recording 12m: w5.00, r8.95
- Call recording 24m: w10.00, r14.95
- Call recording 36m: w15.00, r19.95
- Conference: w5.00, r9.95
- Mobile app: w1.00, r1.95
- Desktop app: w1.50, r2.95
- WiFi Extender: existing 3.99 (already on site)
- Mesh WiFi Node: existing 5.99 (already on site)
- Security Suite: existing 2.99 (already on site)
- Parental Controls: existing 1.99 (already on site)
- Home phone handset: existing 29.00 one-off (already on site)

**Bundles:**

- Home Sweet Internet: broadband + home phone, -£2, includes 1 free bronze number, non-stackable
- Startup Pack: broadband + 1 business VoIP, -£3, non-stackable
- Team Pack: broadband + 3 business VoIP, -£7, non-stackable
- SIP Saver: broadband + SIP trunk, -£3, non-stackable

---

## Step 3 — `src/lib/pricing/retailCards.ts`

Public card definitions that map to catalogue products. Each card has: `publicTitle`, `category`, `tagline`, `description`, `features[]`, `speedLabel`, `eligibleProductIds[]`, `popular`, `serviceType`, display fields for setup text.

**4 broadband cards** (matching current card count exactly):

1. **"ESSENTIAL"** — category Essentials, speed "Up to 80Mbps", eligible: `sogea-40-10-1m`, `sogea-80-20-1m`, `fttp-80-20-tt`. Features: same 6 features as current card but "Free installation" becomes conditional on tech. Tagline: "Perfect for light browsing and the occasional Netflix binge"
2. **"SUPERFAST"** — category Everyday Fibre, speed "Up to 330Mbps", popular: true, eligible: `fttp-160-tt`, `fttp-220-tt`, `fttp-330-tt`. Tagline: "For households that actually use the internet properly"
3. **"ULTRAFAST"** — category Ultra Fibre, speed "Up to 550Mbps", eligible: `fttp-500-tt`, `fttp-550-cf`. Tagline: "For gamers, streamers, and people who work from home"
4. **"GIGABIT"** — category Gigafast, speed "Up to 1Gbps", eligible: `fttp-1000-tt`, `fttp-1000-cf`. Tagline: "The fastest internet money can buy. Period."

Note: The FTTP 2500 CityFibre product exists in catalogue but is NOT mapped to a public card (no 5th card — preserving current 4-card layout). It can be surfaced later or in business context.

Each card resolves its "from" price by taking the cheapest eligible product's retail monthly.

**1 landline card** (same as current):

- "Digital Voice Line" — maps to home-phone-payg voice product, price from catalogue (4.95)

**4 SIM cards** (unchanged — no ICUK SIM data uploaded, keep current prices):

- Starter, Essential, Plus, Unlimited — prices stay 7.99, 11.99, 17.99, 27.99

**Mapping rules** per card: filter eligible products by postcode availability → sort by priorityScore → pick best match. Without postcode: use cheapest eligible product's retail monthly as "from" price.

---

## Step 4 — `src/lib/pricing/engine.ts`

Functions:

- `getFromPrices()` → `{ broadband: string, sim: string, landline: string }` — returns cheapest "from" price for each service type from retail cards. This is the ONE helper all UI reads from.
- `getRetailBroadbandCards()` → returns 4 card objects with resolved "from" price, features, etc.
- `getRetailLandlineCard()` → returns landline card with price from catalogue
- `calculateSetupCharge(productId, scenarioId)` → one-off charge
- `calculateCareLevelUplift(levelId)` → monthly uplift
- `calculateBundleDiscount(selectedServices)` → { discount, bundleName, valid }
- `calculateAddonTotal(addonIds)` → { monthly, oneOff }
- `calculatePortingTotal(selections)` → total with multi-cap
- `calculateNumberTotal(selections)` → total
- `getSmsPricing(volume)` → rate
- `getCallRate(type)` → rate
- `buildOrderSummary(selections)` → full OrderSummary object
- `getSOGEANote()` → fairness note string for SOGEA products

---

## Step 5 — `src/lib/pricing/availability.ts`

- `checkPostcodeAvailability(postcode)` → available technologies (stub for now, returns all)
- `resolveCardProduct(cardId, availableTechs)` → picks best catalogue product
- `getAvailableCards(postcode?)` → cards with resolved products

---

## Step 6 — Rewrite `src/lib/plans.ts` as adapter

Same exports: `Plan`, `ServiceType`, `broadbandPlans`, `simPlans`, `landlinePlans`, `allPlans`, `getPlanById`, `getPlansByService`, `calculateBundleDiscount`.

- `broadbandPlans`: generated from `getRetailBroadbandCards()` — 4 plans, same shape, new prices (from £26.95 up)
- `simPlans`: unchanged (no ICUK SIM data)
- `landlinePlans`: price from catalogue (4.95 instead of 4.99)
- `calculateBundleDiscount`: uses named bundle logic from engine (flat £ discounts) but keeps same return shape for backward compat. Since current BundleBuilder uses percentage display, adapt the return to still include `discountPercentage` (set to 0) and `savings` (from flat discount).

---

## Step 7 — Rewrite `src/lib/addons.ts` as adapter

Same exports. Reads from catalogue add-on items. Prices updated to match catalogue where data was uploaded (e.g. call recording tiers added to landline addons). Existing addons that were already on the site (WiFi extender, mesh, etc.) keep their current prices since no ICUK wholesale was uploaded for those — they stay as-is.

Landline addon price updates:

- "Unlimited UK Calls" → maps to home-phone-1000min bundle at +£3.00/mo (price stays £3, maps to 1000min bundle internally)
- "International Calls Pack" → stays £5 (already on site, no contradicting uploaded price)

---

## Step 8 — Rewrite `src/lib/businessData.ts` as adapter

Same exports. Business plan prices updated to derive from catalogue business-grade products. Business VoIP price updated to £6.95/seat (from uploaded data). Other existing services (Managed WiFi, Secure DNS, M365 Setup, Business Continuity, Leased Line Lite) keep current prices — no contradicting uploaded data for those.

---

## Step 9 — Make all UI "from" prices config-driven

Every file that currently hardcodes `£22.99`, `£7.99`, or `£4.99` will import `getFromPrices()` from the engine and use template literals instead.

**Files to update (text replacements only, zero layout changes):**

1. `**src/components/home/HeroSection.tsx**` — line 33-35: `services` array prices → `getFromPrices()` values
2. `**src/components/home/ServicesSection.tsx**` — lines 12, 22, 32: price fields → `getFromPrices()` values
3. `**src/pages/Index.tsx**` — line 55, 58: SEO description/price → `getFromPrices().broadband`
4. `**src/pages/Broadband.tsx**` — lines 100, 124-127, 228, 413, 446: all `22.99`/`4.99` → config values
5. `**src/pages/Landline.tsx**` — lines 55-57, 63, 78-81: all `4.99` → config value
6. `**src/pages/SimPlans.tsx**` — line 90: `7.99` → config value
7. `**src/pages/LocationBroadband.tsx**` — lines 25, 77: `22.99` → config value
8. `**src/pages/NoContractBroadband.tsx**` — lines 97, 109, 137, 408: `22.99` → config value
9. `**src/components/seo/SEO.tsx**` — line 22: default description `22.99` → config value
10. `**src/components/seo/StructuredData.tsx**` — line 16: `22.99` → config value
11. `**src/components/app/AppWelcome.tsx**` — line 25-27: prices → config values
12. `**src/pages/Broadband.tsx**` lines 59-60: voice dialog call plan prices → from catalogue
13. `**src/pages/Landline.tsx**` lines 33-34: call plan prices → from catalogue
14. `**vite-plugin-prerender.ts**` — lines 122, 162, 191: SEO prices → will need to be static since it's a build-time file, so set to match the config values at time of build
15. `**src/data/guides.ts**` — inline content prices → import from engine

`**src/components/bundle/BundleBuilder.tsx**` — update discount display from percentage to flat £ savings, show bundle name. Same visual layout.

---

## Step 10 — Broadband card setup display

In the features array for each broadband card:

- FTTP-eligible cards: keep "Free installation"
- SOGEA-eligible cards (Essentials): show "Setup from £9.95" (cheapest migration scenario)
- Add SOGEA fairness note as a disclaimer field on the card, rendered in existing feature list slot as small text

---

## Files created (6 new)

1. `src/lib/pricing/types.ts`
2. `src/lib/pricing/catalogue.ts`
3. `src/lib/pricing/retailCards.ts`
4. `src/lib/pricing/engine.ts`
5. `src/lib/pricing/availability.ts`
6. `src/lib/pricing/index.ts`

## Files modified (14)

1. `src/lib/plans.ts` — adapter
2. `src/lib/addons.ts` — adapter
3. `src/lib/businessData.ts` — adapter
4. `src/components/home/HeroSection.tsx` — config-driven prices
5. `src/components/home/ServicesSection.tsx` — config-driven prices
6. `src/pages/Index.tsx` — config-driven SEO prices
7. `src/pages/Broadband.tsx` — config-driven prices + setup text
8. `src/pages/Landline.tsx` — config-driven prices
9. `src/pages/SimPlans.tsx` — config-driven SEO price
10. `src/pages/LocationBroadband.tsx` — config-driven prices
11. `src/pages/NoContractBroadband.tsx` — config-driven prices
12. `src/components/seo/SEO.tsx` — config-driven default description
13. `src/components/seo/StructuredData.tsx` — config-driven price
14. `src/components/bundle/BundleBuilder.tsx` — named bundle logic

## Constraints preserved

- 4 broadband cards, 4 SIM cards, 1 landline card — no new cards
- No new visible sections, routes, or UI elements
- No supplier names shown publicly
- Legacy PSTN/ISDN/CPS in catalogue as `quote_only`, never rendered
- All "from" prices from `getFromPrices()` — single source
- "No contracts / 30-day rolling / cancel anytime" preserved
- Null-safe rendering throughout
- No invented products or add-ons beyond uploaded data + existing site  
  
Final corrections before implementation:
  1. Do not display “Setup from £9.95” on public broadband cards. Replace with “Setup may apply depending on line status” and show exact setup only after scenario selection.
  2. Re-add a dedicated orderSummary module/schema for future checkout and internal ops.
  3. Populate catalogue with the exact uploaded ICUK rows and prices, not grouped approximations.
  4. Mark existing website-only add-ons separately from ICUK-derived products using a source field such as source: 'website_existing'.
  5. Add publicDisplay fields for every visible retail card/product: publicPricePrefix, publicSetupText, publicTagline, publicFeatures, publicDisclaimer.
  6. For build-time SEO/prerender files, read prices from one shared exported pricing constant, not repeated literals.
  7. Preserve current visible card structure, labels, spacing, CTA placement, and copy hierarchy exactly.
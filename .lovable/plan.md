# Live Homepage + Postcode Fallback Fix

Scope-limited cleanup. No new features, no redesign, no backend/payment/resolver changes.

## 1. Postcode fallback UI (hero error state)

**File:** `src/components/home/HeroSection.tsx`

Replace the red destructive error block (lines ~141–159) with a fallback card matching `PostcodeChecker`'s pattern:

- Title: "Broadband options available to view"
- Body: "We couldn't confirm live availability online right now, but you can still choose the plan you're interested in. We'll confirm the final availability, speed, setup and price before you order."
- Small note: "No payment is taken until your final quote and Contract Summary are confirmed."
- Primary button: "View plans" → calls `triggerFallback(postcode)` then `navigate('/build-plan?availability=fallback&postcode=...')`
- Secondary line: "Prefer to speak to us? Call 0800 260 6626." (plain text + tel link)

Trigger on `status === "error"` for error types `backend-unavailable | availability-failed | no-addresses` (keep `invalid-postcode` as a small inline message — that one is user input, not API failure).

Pull `triggerFallback` from `useAvailability()` (already exported).

`PostcodeChecker.tsx` already renders this fallback correctly when used standalone — no change needed there. The hero passes `externalAddressSelect`, so the hero must render its own fallback card to match.

## 2. Homepage hero copy

**File:** `src/components/home/HeroSection.tsx`

- **Eyebrow** (line 94): replace with `PRICE LOCK 24 • FLEX 30 • CLEAR FIRST BILL • UK-BASED SUPPORT`
- **H1** (lines 97–103): replace with two lines: `FINALLY.` / `BROADBAND WITHOUT THE PRICE-RISE NONSENSE.`
- **Subheading** (lines 105–107): `Choose Price Lock 24 for a fixed monthly broadband price for the agreed term, or Flex 30 where available. See your first bill before you order.`
- **Benefit chips** (lines 27–33): replace array with:
  - Price Lock 24
  - Flex 30 where eligible
  - No confusing mid-contract rises on Price Lock
  - First bill before order
  - UK-based support
- **Idle right-panel card** (lines 351–353, 327): replace `No contracts • No annual price hikes` lines with `Price Lock 24 or Flex 30 • Final price confirmed before order` and similar safe wording. Remove `No contracts` from the per-plan feature pills (line 296) → replace with `Price Lock or Flex 30`.

**File:** `src/components/home/PostcodeChecker.tsx`

- Helper line (lines ~165–168): replace `✓ Real availability` with `✓ Final availability confirmed before order`.

## 3. Fair Broadband Promise grid

**File:** `src/components/home/FairBroadbandPromise.tsx`

- Update intro block:
  - Eyebrow: keep "The OCCTA Fair Broadband Promise"
  - H2: `BROADBAND BUILT AROUND YOU.`
  - Body: "Choose the plan style that suits you. Price Lock 24 keeps your monthly broadband price fixed for the agreed term. Flex 30 gives you a rolling option where available. We show your first bill before you order."
- Replace `promises` array (5 items, leaves empty grid cell) with 6 items in this order:
  1. Shield · NO CONFUSING MID-CONTRACT PRICE RISES — "Choose Price Lock 24 and your monthly broadband price stays fixed for the agreed term."
  2. Calendar · PRICE LOCK OR FLEX 30 — "Pick a fixed Price Lock plan or a 30-day rolling option where available."
  3. Receipt · NO HIDDEN FIRST BILL — "We show your monthly price, router, setup and add-ons before you order."
  4. CheckCircle2 · FINAL PRICE CONFIRMED BEFORE ORDER — "Availability, speed, setup and final price are confirmed before you proceed."
  5. Router · ROUTER CHOICE — "Use your own compatible router for £0, or choose a router only if you need one."
  6. LifeBuoy · NO SUPPORT BLACK HOLE — "Track support tickets, complaints and documents in your OCCTA dashboard."
- Simplify the border-divider class logic so 6 items fill a 3-col grid cleanly with no empty cell.

## 4. Build Plan fallback (verify only)

`BuildPlan.tsx` already handles `?availability=fallback`:
- All 4 buckets returned (line 67)
- Headline uses `FAIR_PRICING_DEFAULTS.headline[bucket][term]` for both `lock24` and `flex30`
- `quote_only: true` synthesised, server submission sends `force_quote_only: true`

No change required unless verification finds a gap. The "Subject to confirmation" pill and "Final availability, speed, setup and price confirmed before order" line already exist in the bucket meta badges.

## 5. Forbidden wording sweep

After edits, `rg` these in `src/components/home/`, `src/pages/Index.tsx`, `src/pages/Broadband.tsx`:
- "No contracts", "No annual price hikes", "cancel anytime"
- "free router", "free installation", "router included"
- "guaranteed speed", "Full Fibre available" (must be "appears available")

Replace any remaining hits with the approved phrasing from the request.

## 6. Untouched

Worldpay/HPP, `/pay`, `/pay-invoice`, invoices, DD mandates, rewards, campaigns, complaints, finance exports, AI chat, supplier_products, quote resolver, Contract Summary logic, server-side pricing resolver, `submit-build-plan` edge function, `AvailabilityContext` actions.

## Verification

- `tsc` passes
- Manual: bad/unreachable postcode in hero → fallback card with View plans button visible
- View plans navigates to `/build-plan?availability=fallback&postcode=...`
- Build Plan shows all 4 buckets with Price Lock 24 + Flex 30 from-prices and "Subject to confirmation"
- Grep sweep returns no forbidden phrases in customer-facing home/broadband copy
- Promise grid renders 6 filled boxes, router is box 5

## Files changed

- `src/components/home/HeroSection.tsx`
- `src/components/home/FairBroadbandPromise.tsx`
- `src/components/home/PostcodeChecker.tsx` (helper line only)
- Possibly `src/pages/Index.tsx` SEO description (replace "No contract broadband" wording if present)

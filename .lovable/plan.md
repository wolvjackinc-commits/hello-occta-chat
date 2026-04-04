# Customer Pricing Visibility, VAT, Billing, Hardware & Order Consent

## Summary

Wire the pricing engine's `buildOrderSummary()` into both checkout flows (PreCheckout + Checkout) with a full itemised breakdown, install scenario selector, care level selector, order consent checkboxes, and VAT mode support. No visual redesign — uses existing `card-brutal`, `Select`, `Checkbox` component patterns.

## Architecture Changes

### 1. Add `catalogueProductId` to Plan interface (`src/lib/plans.ts`)

Add optional `catalogueProductId?: string` field to `Plan`. Populate it for broadband plans using the cheapest eligible catalogue product ID from each retail card. This lets checkout resolve the product's technology (SOGEA vs FTTP) to determine which install scenarios apply.

### 2. Add VAT utility to engine (`src/lib/pricing/engine.ts`)

Add:

- `const VAT_RATE = 0.20`
- `applyVAT(amount: number, inclusive: boolean): number` — if inclusive (residential), amount stays as-is (prices already include VAT). If exclusive (business), returns amount as net.
- `formatPriceWithVAT(amount: number, mode: 'residential' | 'business'): string` — returns formatted price with "(inc. VAT)" or "(ex. VAT)" suffix.
- Add `vatMode` field to `buildOrderSummary` params and `OrderSummary` type.

### 3. Add proration config (`src/lib/pricing/engine.ts`)

Add:

- `calculateProration(monthlyAmount: number, activationDate: Date, billingCycleDay: number): number` — returns prorated amount for partial first month.
- Export `PRORATION_ENABLED = true` constant (configurable flag).

### 4. Update `src/lib/pricing/types.ts`

Add to `OrderSummary`:

- `vatMode: 'residential' | 'business'`
- `hardwareCharges: { name: string; amount: number }[]`
- `consentRequired: string[]` — list of consent labels the user must confirm

### 5. Rewrite `src/pages/PreCheckout.tsx` (guest checkout)

**New state:**

- `installScenarioId: string | null` — selected install scenario
- `careLevelId: string` — default `'standard'`
- `orderConsent: boolean` — master consent checkbox (all 4 conditions)

**New imports:** `installScenarios`, `careLevels`, `catalogueProducts` from pricing catalogue; `buildOrderSummary`, `getSOGEANote`, `getFromPrices` from engine.

**Technology resolution logic:**
When broadband plan is selected, look up its `catalogueProductId` in `catalogueProducts`. Read `technology` and `installTypeSupported[]`. If SOGEA → show install scenario selector. If FTTP with `freeInstallEligible: true` → auto-set `fttp-standard` (£0). If no broadband → hide install section entirely.

**New UI sections (inserted into existing form area, same `card-brutal` styling):**

a) **Installation Type card** — appears after Address section when broadband is selected and product is SOGEA. Uses existing `Select` component. Options filtered from `installScenarios` based on `installTypeSupported[]`. Each option shows label + retail charge (e.g. "Engineer Visit — £79.95", "No Engineer — £59.95", "Migration from FTTC — £9.95", "Migration from ADSL — £19.95").

b) **Support Level card** — appears below install type when broadband is selected. Three options using existing styling: Standard (Included), Priority (+£9/mo), Enhanced (+£14/mo). Uses radio-style buttons or `Select`.

c) **Order Consent card** — appears above the submit button. Contains a single `Checkbox` with grouped text:

- "I understand this service is 30-day rolling with no fixed contract"
- "Setup charges may apply depending on my line status"
- "I accept all charges shown above"
- "Service is subject to availability at my address"

Submit button is disabled until `orderConsent === true` AND existing `gdprConsent` + `termsConsent` are true.

**Sidebar totals rewrite (lines 1076-1097):**
Replace simple monthly total with full itemised breakdown:

```
Monthly charges:
  [Plan name]                    £XX.XX
  Care level uplift              +£X.XX   (only if not standard)
  [Addon 1 name]                 +£X.XX   (each addon)
  Bundle discount ([name])       -£X.XX   (if applicable)
  ─────────────────────────────
  ONGOING MONTHLY                £XX.XX/mo

One-off charges:
  Setup/install ([scenario])     £XX.XX   (or FREE for FTTP)
  [One-off addon name]           £XX.XX   (if any)
  ─────────────────────────────
  TOTAL DUE TODAY                £XX.XX

  30-day rolling — no contracts
  [SOGEA fairness note if applicable]
```

All values computed from `buildOrderSummary()` called reactively when selections change.

**Mobile summary (lines 1130-1186):** Mirror the same breakdown — show ongoing monthly AND total due today.

**Fix upsell price (line 584):** Replace hardcoded `£4.99/mo` with `£${getFromPrices().landline}/mo`.

**Submit validation additions:**

- If broadband + SOGEA and no install scenario selected → toast error "Please select an installation type"
- If `orderConsent` is false → toast error "Please confirm the order terms"

**Order payload enrichment:** Include `installScenarioId`, `careLevelId`, setup charge amount, and full breakdown in the order data sent to DB and admin notification.

### 6. Rewrite `src/pages/Checkout.tsx` (logged-in checkout)

Same pattern but simpler (single plan, no multi-plan bundles):

**New state:** `installScenarioId`, `careLevelId`, `orderConsent`.

**Step 1 (Address):** Add install scenario selector and care level selector below address fields when broadband plan is selected.

**Step 2 (Review) price breakdown (lines 498-511):** Replace hardcoded "Installation fee: FREE" / "DUE TODAY: £0.00":

```
Monthly subscription              £XX.XX
Care level uplift                  +£X.XX  (if selected)
─────────────────────────────
ONGOING MONTHLY                    £XX.XX/mo

Setup/install                      £XX.XX  (or FREE)
─────────────────────────────
TOTAL DUE TODAY                    £XX.XX
```

**Order consent:** Add consent checkbox before "Place Order" button. Block submission if unchecked.

**Sidebar (lines 561-601):** Add setup charge line. Replace "Free install" trust tag with conditional text based on technology.

**Order confirmation screen (lines 254-270):** Replace hardcoded "Installation: Included" with actual setup charge from selection.

**Submit validation:** Same as PreCheckout — require install scenario for SOGEA, require consent.

### 7. Hardware display logic

No new hardware products. Current broadband cards already show "Router included" or similar in their features array from `retailCards.ts`. If a catalogue product or addon has a one-off hardware charge (e.g. existing "Home Phone Handset" addon at £29.00), it appears in the one-off section of the breakdown as it already does via `addonCatalogue`. No changes needed beyond ensuring one-off addons render in the "One-off charges" section of the new breakdown.

## Files modified (4)

1. `src/lib/plans.ts` — add `catalogueProductId` to Plan interface and broadband plan mapping
2. `src/lib/pricing/types.ts` — add `vatMode`, `hardwareCharges` to OrderSummary
3. `src/lib/pricing/engine.ts` — add VAT helpers, proration utility, update buildOrderSummary
4. `src/pages/PreCheckout.tsx` — install selector, care level, full breakdown, consent, fix upsell price
5. `src/pages/Checkout.tsx` — install selector, care level, full breakdown, consent, fix hardcoded values

## Constraints preserved

- Zero visual redesign — all new elements use existing card-brutal, Select, Checkbox patterns
- Same grid layout, same step flow, same animations
- No new routes or pages
- No supplier names shown
- "No contracts / 30-day rolling" preserved and reinforced in consent
- Residential prices shown inc. VAT (current behaviour preserved)
- No invented hardware products
- Existing router/hardware logic unchanged  
All prices shown include VAT (where applicable)


# Fix Digital Home Phone Purchase Flow

## Problem
1. "Add to Broadband" on the Home Phone page links directly to pre-checkout, which shouldn't happen since voice requires broadband
2. Broadband plan selection goes straight to pre-checkout without offering Digital Voice add-on
3. Call plans on the Home Phone page are single-select but should allow multiple (e.g., Unlimited UK + International)

## Changes

### 1. `src/pages/Landline.tsx` — Block direct purchase, allow multi-select call plans
- Replace `Link to={checkoutUrl}` buttons with an `onClick` that opens a **Dialog** saying: "Digital Home Phone cannot be purchased without an OCCTA broadband plan" with a "View Broadband Plans" button linking to `/broadband`
- Change call plan state from `selectedCallPlan: string | null` to `selectedCallPlans: string[]` (array) for multi-select
- Update call plan selector UI to toggle items on/off (checkbox-style) instead of radio-style
- PAYG becomes the default (no addon selected) — selecting Unlimited UK and/or International adds those addons
- Update price display to show total (base £4.99 + selected call plan addons)

### 2. `src/pages/Broadband.tsx` — Add Digital Voice upsell dialog on plan selection
- Instead of `<Link to="/pre-checkout?plans=...">`, each broadband plan's "Choose Plan" button opens a **Dialog** asking "Would you like to add Digital Home Phone?"
- Dialog shows: Digital Voice Line £4.99/mo with call plan options (multi-select checkboxes for Unlimited UK +£3, International +£5)
- Two CTAs: "Yes, add Home Phone" → navigates to `/pre-checkout?plans=broadband-xxx,landline-digital-voice&addons=...` and "No thanks, continue" → navigates to `/pre-checkout?plans=broadband-xxx`
- Apply this to both the hero plan preview cards AND the "All Plans" grid
- Store the selected broadband plan ID in state when dialog opens

### 3. `src/pages/PreCheckout.tsx` — Handle pre-selected addons from URL
- Read `addons` query param (already partially handled via URL but need to pre-select them in the addons state on mount)
- The existing landline-without-broadband blocker stays as a safety net

## Technical Details
- Use existing `Dialog` component from `src/components/ui/dialog.tsx`
- Use `useNavigate` for programmatic navigation from dialog buttons
- Call plan addons already exist in `src/lib/addons.ts` (`addon-unlimited-uk-calls`, `addon-intl-calls-pack`)
- No database changes needed
- No route/SEO changes


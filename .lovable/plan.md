

# Checkout UI Final Refinements — Presentation Only

## Summary
Six targeted visual refinements to PreCheckout.tsx and Checkout.tsx. Zero logic, validation, calculation, or backend changes.

## Changes

### 1. Compact selected-plan confirmation strip (PreCheckout.tsx)
Replace the full plan cards in the sidebar (lines 1150-1166) with a compact inline strip at the top of the left column, below the page heading. Each plan renders as a single row: icon + name + speed/data badge + price. Add a "Change plan" link back to /broadband. Remove the duplicate plan cards from the sidebar — the sidebar keeps only the pricing breakdown.

In Checkout.tsx, the sidebar already has a compact plan card — keep it but remove any redundant plan detail repetition in the review step.

### 2. Progress indicators — visual only (PreCheckout.tsx)
Add a horizontal progress bar below the page heading showing: Plan → Details → Setup → Review. These are static labels only — no scroll-reactive highlighting, no click handlers, no step navigation logic. Just four labels with dots/connectors where the first one is always filled (since the plan is already selected). Purely decorative visual context.

In Checkout.tsx, the existing 2-step progress indicator stays as-is (it already has click-back behaviour which is existing logic — don't change it).

### 3. Add-ons: main flow + compact sidebar summary (PreCheckout.tsx)
Move the full add-on selection UI (lines 1168-1221) from the sidebar into the left column as a new section between "Support Level" and "Installation Scheduling". Group addons into two sub-sections:
- "Recommended" — first 2 addons per service type
- "Optional extras" — remaining addons

In the sidebar, replace the removed add-on toggles with a compact "Selected add-ons" list showing only the names and prices of currently selected addons (read-only summary, no toggle buttons). If none selected, show "No add-ons selected" in muted text.

### 4. Selective border reduction (both files)
- Form section cards: reduce from `border-2 border-foreground/20` to `border border-foreground/10`
- Sidebar order summary: keep `border-2 border-foreground/20` (bold framing on key container)
- Primary CTA button: keep existing `variant="hero"` with full border weight
- Consent block: keep `border-2` on the outer card
- Inputs: reduce from `border-2 border-foreground/30` to `border border-foreground/20`
- Mobile summary bar: reduce to `border-t border-foreground/15`

### 5. Price hierarchy in summary (both files)
- "Ongoing monthly" label: bump to `text-base font-semibold` with the price at `text-2xl` (from `text-xl`)
- "Due today" inverted block: keep but make the price `text-2xl` as well
- VAT lines: reduce to `text-[11px]` and `text-muted-foreground/70` for lower visual weight
- Subtotal (ex VAT) lines: same `text-[11px]` treatment
- Monthly charge line items stay at `text-sm`

### 6. De-duplicate trust/reassurance copy (both files)
Current state has overlapping trust copy in: trust badges below CTA, sidebar footer text, consent block items, and "What Happens Next". Remove redundancy:
- Remove the standalone "256-bit encrypted · Ofcom regulated" badge below the CTA (lines 1097-1108 in PreCheckout) — these appear again in the sidebar
- Remove "30-day rolling · no contracts" from the sidebar footer (line 1323) — this is already stated in the consent block
- Keep the sidebar's "Prices include VAT where applicable" (unique, not repeated elsewhere)
- Keep the 14-day cooling off notice in sidebar (unique)
- Keep trust badges in sidebar only (single location)

In Checkout.tsx, apply the same de-duplication: remove any duplicate trust text that already appears in the consent or sidebar.

## Files modified (2)

1. **`src/pages/PreCheckout.tsx`** — plan strip, progress labels, addon relocation + grouping, compact sidebar addon summary, border reduction, price hierarchy, trust copy de-duplication
2. **`src/pages/Checkout.tsx`** — border reduction, price hierarchy, trust copy de-duplication

## Constraints
- Zero logic, state, handler, validation, or calculation changes
- Same components, same imports (no new files)
- OCCTA brutalist identity preserved on key containers and CTAs
- All existing fields, consent, and pricing data remain


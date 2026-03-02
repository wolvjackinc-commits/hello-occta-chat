
# Checkout Pages UI Polish

Targeted visual improvements across all three checkout pages, using existing components and the brutalist design system. No new dependencies or structural changes needed.

## 1. PreCheckout (Guest Checkout) - `/pre-checkout`

**Form field spacing and visual hierarchy**
- Add section dividers between "Your Details" and "Switching Details" address fields for clearer grouping
- Add a subtle security badge row (padlock icon + "256-bit encrypted") beneath the submit button for trust
- Make the "Additional Notes" textarea collapsible by default to reduce visual clutter

**Mobile order summary bar**
- Add the plan name(s) to the sticky bottom bar so users know what they're buying without expanding
- Increase touch target size on the "View/Hide" toggle

**Add-ons sidebar**
- Show a "Popular" or "Recommended" tag on the most common add-on to guide users

## 2. Checkout (Authenticated) - `/checkout`

**Progress stepper**
- Add a connecting line between steps that fills with the primary color as the user progresses (currently just a static grey bar)
- Make completed steps clickable to navigate back

**Review step (Step 2)**
- Add the user's email from their profile beneath the address summary so they can confirm their contact info
- Add a subtle "Order placed at [time]" timestamp at the bottom -- this already exists, just move it inside the order card for better grouping

**Order complete screen**
- Add a reference number to the success screen (currently shows plan details but no order ID)
- Add a "Track your order" link pointing to `/dashboard` with clearer copy

**Sidebar**
- Add trust indicators (e.g., "No contract", "Free installation", "UK support") as small tags beneath the price to reinforce key selling points

## 3. BusinessCheckout - `/business-checkout`

**Form inputs**
- Switch the native `<select>` for team size to the project's `<Select>` component for consistent styling (currently uses a plain HTML select which breaks the brutalist border style)
- Add `border-4 border-foreground` to all Input fields (currently missing the thick brutalist border that PreCheckout uses)

**Hero section**
- The hero currently sits in a `grid-pattern` background while the form section uses `stripes` -- consider using one consistent background treatment

**Summary card**
- Add a total estimate row showing "From [plan price]/mo + add-ons" to give users a ballpark before submitting

## Technical Details

| File | Changes |
|------|---------|
| `src/pages/PreCheckout.tsx` | Add plan name to mobile summary bar; add security text under submit button; add "Recommended" badge to first add-on |
| `src/pages/Checkout.tsx` | Animated progress connector; show order ID on success screen; add trust tags to sidebar; show user email on review step |
| `src/pages/BusinessCheckout.tsx` | Replace native `<select>` with `<Select>` component; add `border-4 border-foreground` to all inputs; add estimated total to summary |

All changes use existing UI components (`Button`, `Select`, `Badge`, icons from `lucide-react`) and follow the brutalist design tokens already defined in the project. No new dependencies required.

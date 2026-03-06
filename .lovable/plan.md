

# Digital Home Phone Migration Plan

## Summary
Restructure the Landline service to reflect the UK PSTN switch-off reality: voice becomes a broadband add-on ("Digital Home Phone") at £4.99/mo with optional call plans, rather than a standalone £7.99 service.

## Files to Modify

### 1. `src/lib/plans.ts` — Restructure landline plans
- Replace 4 standalone landline plans with a single "Digital Voice Line" plan at £4.99/mo
- Add new call plan add-on tiers (PAYG £0, Unlimited UK +£3, International +£5)
- Keep `ServiceType = 'landline'` unchanged for compatibility
- Update `landlinePlans` array to reflect new pricing
- Add `requiresBroadband: boolean` field to Plan interface

### 2. `src/lib/addons.ts` — Add call plan add-ons + handset upsell
- Replace old landline addons with call plan add-ons:
  - "Unlimited UK Calls" — £3/mo
  - "International Calls Pack" — £5/mo
- Add optional handset upsell addon: "Home Phone Handset" — £29 one-time (flagged as one-time)
- Keep existing broadband/SIM addons untouched

### 3. `src/pages/Landline.tsx` — Full page redesign
- Rename all visible text from "Landline" to "Digital Home Phone"
- Add broadband requirement notice banner at top (alert component)
- Restructure hero: "DIGITAL HOME PHONE" heading, "From £4.99/month" pricing, "Requires OCCTA broadband" subtitle
- Replace plan grid with single Digital Voice Line card + call plan selector (PAYG/Unlimited/International as toggleable options)
- Add "Equipment Needed" section (broadband, router, standard handset)
- Add optional handset upsell mention (£29 one-time)
- Add power cut legal notice at bottom
- Keep BundleBuilder at bottom

### 4. `src/pages/Broadband.tsx` — Add "Add a Home Phone" section
- Insert new section after the "All Plans" grid and before BundleBuilder
- Title: "Add a Home Phone"
- Content: Digital Home Phone from £4.99/mo with bullet points (works with broadband, keep number, standard phones, optional call plans)
- CTA button linking to `/landline`
- Add "Router Included" info section explaining phone-into-router setup

### 5. `src/components/layout/Header.tsx` — Rename nav label
- Change `{ name: "Landline", path: "/landline" }` to `{ name: "Home Phone", path: "/landline" }`
- Keep path unchanged for SEO

### 6. `src/components/layout/Footer.tsx` — Rename footer link
- Change `{ name: "Landline", path: "/landline" }` to `{ name: "Digital Home Phone", path: "/landline" }`

### 7. `src/components/home/ServicesSection.tsx` — Rename service card
- Change title from "LANDLINE" to "HOME PHONE"
- Update subtitle: "Digital voice, no old copper"
- Update description to reference Digital Voice + broadband requirement
- Update price: "From £4.99/mo"

### 8. `src/components/app/AppHome.tsx` — Rename quick action
- Change label from "Landline" to "Home Phone"

### 9. `src/components/bundle/BundleBuilder.tsx` — Rename label
- Change service label from "Landline" to "Home Phone"
- Add validation: if landline selected without broadband, show warning

### 10. `src/pages/PreCheckout.tsx` — Add checkout validation
- Add validation: if cart contains a landline plan but no broadband plan, show blocking alert: "Digital Home Phone requires an OCCTA broadband plan"
- When only broadband is selected, show a subtle add-on prompt to add Digital Voice

### 11. `vite-plugin-prerender.ts` — Update SEO metadata for `/landline`
- Change title to "Digital Home Phone UK - Add to Broadband | OCCTA"
- Update description: "Add Digital Home Phone from £4.99/mo to your OCCTA broadband. Crystal clear digital voice, keep your number. No contracts."
- Update keywords to include "digital home phone", "digital voice UK", "VoIP home phone"
- Update JSON-LD service name to "OCCTA Digital Home Phone", price to "4.99"
- Keep path as `/landline` — no URL change

### 12. `src/components/seo/StructuredData.tsx` — Update description strings
- Change "landline services" references to "digital home phone" in organization/website schema descriptions

## Files NOT Modified
- `src/App.tsx` — route stays as `/landline`
- `public/sitemap.xml` — URL unchanged
- `public/_redirects` — no change needed
- Admin pages — untouched
- Auth pages — untouched
- `src/integrations/supabase/*` — untouched
- `supabase/*` — no database changes needed (service_type column values remain 'landline')

## Key Design Decisions
- The internal `serviceType` value stays `'landline'` everywhere to avoid breaking database records, order processing, and admin panels
- Only user-facing labels change to "Digital Home Phone" / "Home Phone"
- The URL remains `/landline` for SEO continuity
- Call plans are modeled as add-ons in `addons.ts` rather than separate plans, matching how BT/Sky/Vodafone structure Digital Voice
- Checkout validation blocks purchase of voice without broadband


Approved — proceed with Postcode Availability Fallback Mode, with one critical correction.

This is a temporary fallback safety fix, not a new phase.

Do not start Phase 7.  
Do not touch Worldpay, /pay, /pay-invoice, invoice generation, DD mandates, rewards, campaigns, complaints, finance exports, AI chat, supplier resolver, quote resolver, Contract Summary logic or supplier_products.

Critical correction:

Server-side submit-build-plan must explicitly honour fallback mode.

When request body includes:

- force_quote_only: true
- availability_mode: "fallback"

Then submit-build-plan must:

- create quote_request only
- mark request as manual review / fallback availability
- not create customer-ready quote
- not create order
- not create payment link
- not generate Contract Summary
- not send wording that implies confirmed availability
- show customer: “Thanks — we’ll confirm availability and send your final quote before order.”

Do not rely only on “no max_download” to cause quote_only. Make fallback/manual-review behaviour explicit and safe.

Everything else in the plan is approved:

1. Postcode checker fallback

If live availability fails, times out, returns no addresses, or throws:  
Show:

Title:  
“Broadband options available to view”

Body:  
“We couldn’t confirm live availability online right now, but you can still choose the plan you’re interested in. We’ll confirm the final availability, speed, setup and price before you order.”

Note:  
“No payment is taken until your final quote and Contract Summary are confirmed.”

CTA:  
“View plans” → /build-plan?availability=fallback

2. Build Plan fallback

In /build-plan?availability=fallback:

- show all 4 buckets: Essential, Superfast, Ultrafast, Gigabit
- show Price Lock 24 and Flex 30
- show router options
- show setup options
- show first bill preview as estimate only
- clearly label everything “Subject to confirmation”
- do not call it confirmed availability
- do not create customer-ready quote automatically

Use:  
“Estimate — subject to confirmation”

3. Fallback pricing display

Use current Fair Pricing display values:

Essential:

- Price Lock 24 from £34.99/month
- Flex 30 from £37.99/month

Superfast:

- Price Lock 24 from £39.99/month
- Flex 30 from £42.99/month

Ultrafast:

- Price Lock 24 from £49.99/month
- Flex 30 from £52.99/month

Gigabit:

- Price Lock 24 from £52.99/month
- Flex 30 from £54.99/month

Add on each card:  
“Subject to availability at your address.”

4. Do not mislead

In fallback mode, never say:

- Full Fibre available
- guaranteed availability
- guaranteed speed
- confirmed installation
- order now
- pay now

Use:

- subject to confirmation
- final availability confirmed before order
- final price confirmed before order
- no payment until Contract Summary

5. Dashboard Add Service

If there is no confirmed availability in session:  
Dashboard Add Service should route to:  
/build-plan?availability=fallback

Not old checkout.

6. Verification

After implementation:

- enter bogus postcode
- fallback card appears
- View plans opens /build-plan?availability=fallback
- all 4 plan buckets show
- Price Lock 24 and Flex 30 are visible
- all cards say subject to confirmation
- first bill preview says estimate only
- submission creates manual quote_request only
- no customer-ready quote/order/payment is created
- no old prices appear
- no customer is sent to old checkout
- TypeScript and build pass

7. Final report

Stop after this fix and report:

- files changed
- fallback behaviour
- Build Plan fallback behaviour
- submit-build-plan server safety behaviour
- manual quote request result
- old checkout gating result
- build result
- whether the public site is safe while postcode API is unavailable  
  
  
Postcode Availability Fallback Mode

When the live availability API fails / times out / returns no result, customers must not be blocked. Show the main broadband plans in a "subject to confirmation" mode and route them to `/build-plan?availability=fallback`, which submits as a manual quote request rather than a confirmable order.

## Files to change

1. `**src/contexts/AvailabilityContext.tsx**`
  - Add a new status `"fallback"` and a `triggerFallback(postcode?)` action.
  - On `backend-unavailable` / `availability-failed` / `no-addresses` (or postcode lookup throw), keep `errorType` for diagnostics but also persist a fallback flag in session so `/build-plan` knows it's a fallback flow.
  - Add helper `isFallback` derived from status or session.
2. `**src/components/home/PostcodeChecker.tsx**`
  - When status is `error` (any of the fallback-eligible error types), replace the bare error block with the approved fallback card:
    - Title: "Broadband options available to view"
    - Body: "We couldn't confirm live availability online right now, but you can still choose the plan you're interested in. We'll confirm the final availability, speed, setup and price before you order."
    - Small note: "No payment is taken until your final quote and Contract Summary are confirmed."
    - Primary CTA "View plans" → `navigate('/build-plan?availability=fallback')` (also calls `triggerFallback`).
  - On confirmed success (FTTP): "Full Fibre appears available at your address. Final speed, setup and price are confirmed before order."
  - On confirmed success (non-FTTP): "Broadband options found for your address. Choose your plan and we'll confirm the final speed, setup and price before order."
  - Remove any wording that asserts "available" without confirmation.
3. `**src/pages/BuildPlan.tsx**`
  - Read `searchParams.get('availability') === 'fallback'` → `isFallback`.
  - Change the gate at line 148: if `isFallback` (or test mode) is true, allow rendering even without `result`.
  - In `eligibleBuckets`: when `isFallback`, return `['essential','superfast','ultrafast','gigabit']` — all shown, none disabled.
  - Render gigabit card in step 1 list (extend `["essential","superfast","ultrafast","gigabit"]`).
  - Show a banner above the wizard when `isFallback`:
    - "Subject to availability at your address. Final availability, speed, setup and price will be confirmed before order."
  - On each plan card in fallback mode, render a small "Subject to confirmation" pill.
  - In the resolver `useEffect`: when `isFallback`, skip the resolver call and synthesise a `Resolved` with `quote_only: true`, `message: "We'll confirm the final price after we verify availability at your address."`, and show the headline from `FAIR_PRICING_DEFAULTS.headline[bucket][term]` as estimate-only in the summary panel (clearly labelled "Estimate — subject to confirmation").
  - In `submitBuildPlan`: when `isFallback`, pass `force_quote_only: true` and `availability_mode: 'fallback'` in the body so the server creates a quote_request / manual review record instead of an actionable order.
  - After submit success in fallback mode, toast/redirect copy: "Thanks — we'll confirm availability and send your final quote before order."
4. `**src/pages/Dashboard.tsx**` (Add Service)
  - Already routes to `/build-plan`. Update to `/build-plan?availability=fallback` only when no confirmed availability exists in session; otherwise leave as `/build-plan`.
5. **Server safety (no edge function change required)**
  - The fallback submission relies on `submit-build-plan` honouring `quote_only`/no max_download. Current resolver already produces `quote_only: true` when availability is unknown, so behaviour is preserved. We pass `availability_mode: 'fallback'` for logging only — no schema change.

## Wording rules enforced

Allowed: "appears available", "subject to confirmation", "final price confirmed before order", "no payment until Contract Summary".
Forbidden in fallback: "Full Fibre available" (unconfirmed), "guaranteed availability", "guaranteed speed", "confirmed installation", "order now", "pay now".

## Verification

- `rg "Full Fibre available"` must only appear inside the confirmed-FTTP branch.
- `rg "£22.99|£32.95|£33.95|£27.59"` returns nothing in customer-facing files.
- Manual flow: enter bogus postcode → fallback card → click "View plans" → `/build-plan?availability=fallback` shows all 4 buckets with "Subject to confirmation" → submit creates quote_request (not order) → user sees thank-you with quote messaging.
- Build + TypeScript pass.

## Untouched

Worldpay, `/pay`, `/pay-invoice`, invoice generation, DD mandates, rewards, campaigns, complaints, finance exports, AI chat, supplier resolver, quote resolver, Contract Summary logic, `supplier_products`.
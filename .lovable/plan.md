
# Controlled Beta Publish + Live Verification

No new features. No redesign. No changes to Worldpay, /pay, /pay-invoice, invoices, DD mandates, supplier_products, resolvers, Contract Summary, rewards, campaigns, complaints, finance exports or AI chat.

## 1. Pre-publish checks
- Run TypeScript / production build to confirm green.
- Run `rg` sweep across `src/`, `index.html`, `public/`, `docs/` (excluding `supabase/`, `src/lib/pricing/catalogue.ts` and other clearly-internal catalogue files) for forbidden customer-facing strings:
  - `£22.99`, `£32.95`, `£33.95`, `£27.59`
  - `No contracts`, `No annual price hikes`, `cancel anytime`, `free router`, `free installation`, `guaranteed speed`, `Full Fibre available`, `Router included`
- Report any matches with file + line and whether they render publicly. Stop and ask before publishing if a public-facing match is found.

## 2. Pre-publish site-info preflight
- Verify `index.html` and `SEO.tsx` defaults: title, meta description, og:title/description/image, twitter card, favicon, canonical.
- Update only if stale; do not overwrite existing relevant copy.

## 3. Publish
- Call `preview_ui--publish` with `website_info_status` and `website_info_summary` describing what was verified/updated.
- Confirm to user that publish is scheduled (~1 min to go live), not already live.

## 4. Live verification on https://www.occta.co.uk
Use browser tools (desktop 1366x768, then mobile 390x844). For each, screenshot and report PASS/FAIL.

### A. Postcode checker (homepage)
- Valid normal postcode (e.g. `HD3 3WU`): expect route to `/build-plan`, 4 buckets, Price Lock 24 + Flex 30 visible, no red error.
- Valid random UK postcode (e.g. `SW1A 1AA`): same expectation.
- Invalid format (e.g. `XYZ123`): expect only postcode-correction message, no destructive error card.

### B. Build Plan (`/build-plan`)
- Nothing pre-selected; Next disabled until a choice is made.
- All 4 buckets visible (Essential, Superfast, Ultrafast, Gigabit) with "Subject to confirmation" pill in fallback mode.
- Desktop sticky right estimate present; mobile sticky bottom bar present.
- Estimate updates when speed / term / router / setup / add-ons change.
- Next scrolls to top and focuses next heading (verify focus + scroll position).
- Review step appears before submit (7-step flow).

### C. Thank-you page
- Submit a test quote request end-to-end.
- Verify visible: quote reference, speed bucket, Price Lock 24 / Flex 30 label, router, setup, add-ons, postcode, estimated monthly, estimated first bill, "No payment has been taken", dashboard/home CTA.
- Verify NOT visible: supplier name, "Giacom", supplier cost, margin, internal product IDs.

### D. Admin quote request
- Sign in as admin and open the newly-created quote in `/admin/quote-requests`.
- Confirm: quote ref, customer name/email/phone, postcode, speed bucket, term, router/setup/add-ons, estimate, manual review status.
- Confirm DB side: no live order row, no payment link, no supplier order, no auto Contract Summary tied to this submission (read-only `supabase--read_query`).

### E. Mobile pass (390x844)
- Re-run homepage postcode journey, Build Plan, sticky bottom estimate, Review step, thank-you page.

## 5. Final report
Single consolidated report covering:
- Published URL verified
- Valid postcode result (x2)
- Invalid postcode result
- Build Plan UX result (each sub-check)
- Thank-you page result (visible + must-not-show)
- Admin quote request result
- Wording / price sweep result with any remaining locations
- Mobile result
- TypeScript / build result
- Verdict: whether live site is safe for controlled beta quote capture

## What I will NOT do
- No code changes unless a forbidden public string or a clearly-broken flow blocks the beta; in that case I stop and report before fixing.
- No changes to payments, resolvers, Contract Summary, or any excluded subsystem.
- No real-money submissions.

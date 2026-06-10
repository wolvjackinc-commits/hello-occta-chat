Approved — proceed with OCCTA National Postcode Plan Display + Build Plan UX Polish + Lifecycle Blueprint.

Important final guardrails:

1. Every valid UK postcode must show plans

OCCTA has confirmed with Giacom that the broadband rate-card plans can be shown across UK postcodes.

Therefore:

- Valid UK postcode = show plans
- Invalid postcode format = show correction message only
- API failure must not block customer
- API timeout must not block customer
- No-address response must not block customer

Customer wording must be:

“Broadband plans available to view”

Use:  
“Final speed, setup and order details confirmed before you proceed.”

Do not say:

- unavailable
- no plans available
- try later
- Full Fibre available
- guaranteed speed
- confirmed installation

2. Do not call it “fallback” to the customer

Internal route can use:  
`/build-plan?availability=fallback`

But customer-facing copy should not feel like an error or fallback.

Customer should see:  
“Choose your plan. We’ll confirm final speed, setup and order details before you proceed.”

3. Build Plan must always show all 4 main plan buckets

For every valid UK postcode, show:

- Essential Fibre
- Superfast Fibre
- Ultrafast Fibre
- Gigabit Fibre

Each must show:

- Price Lock 24 price
- Flex 30 price
- estimate wording
- final details confirmed before proceed

4. Everything must start unselected

Do not preselect:

- speed bucket
- Price Lock 24 / Flex 30
- router
- setup/install
- Digital Voice
- add-ons
- support level

Customer must actively choose.

5. Sticky estimate must always show

Desktop:

- sticky right-side price summary

Mobile:

- sticky bottom price summary

It must update as customer builds the plan.

It must show:

- selected plan
- selected term
- router
- setup
- add-ons
- VAT where applicable
- estimated monthly total
- estimated first bill

Always label:  
“Estimate — final details confirmed before you proceed.”

6. Next button behaviour

Next must be disabled until the required option is selected.

When customer clicks Next:

- validate current step
- save selection
- scroll to top of next section
- focus the next heading

7. Thank-you page must show customer-selected details

After submission, the thank-you page must show:

- quote reference
- selected speed bucket
- Price Lock 24 or Flex 30
- estimated monthly price
- router/setup/add-ons
- postcode
- “No payment has been taken”
- “We’ll confirm speed, setup and final order details before you proceed”
- dashboard/login CTA where available

Do not show:

- supplier name
- Giacom name
- supplier cost
- margin
- internal product ID

8. Submission behaviour

Until later phases are built, Build Plan submission should create a quote request/manual review record.

Do not create:

- live order
- payment link
- automatic Contract Summary
- supplier order
- active service

9. Lifecycle blueprint is audit only

Create:  
`docs/lifecycle-blueprint.md`

Do not build Phase B onwards yet.

The blueprint must clearly explain:

- quote to account linking
- admin backend product assignment
- Contract Summary PDF acceptance vault
- payment/DD workflow
- supplier provisioning
- service activation
- billing automation
- communications
- remaining phases
- blockers before full public go-live

10. What must not go live fully yet

Until these are built and verified, OCCTA remains controlled beta only:

- quote-to-account linking
- legal-grade Contract Summary PDF acceptance vault
- payment/DD live readiness
- supplier order/provisioning workflow
- service activation wiring
- billing automation
- final security/monitoring audit

11. Final verification required

After changes, verify:

- latest published codebase was used
- TypeScript passes
- production build passes
- any valid UK postcode shows all plans
- invalid postcode shows only correction message
- no API failure blocks the customer
- all 4 buckets visible
- Price Lock 24 and Flex 30 visible
- sticky estimate visible desktop and mobile
- nothing pre-selected
- Next button scrolls/focuses correctly
- thank-you page shows selected details
- no old prices appear
- no old checkout route is used for broadband

Search sweep must be clean for:

- £22.99
- 22.99
- £32.95
- 32.95
- £33.95
- 33.95
- £27.59
- 27.59
- No contracts
- No annual price hikes
- cancel anytime
- free router
- free installation
- guaranteed speed
- Full Fibre available
- Router included

Stop after this work and report:

- files changed
- national postcode behaviour
- Build Plan UX changes
- thank-you page result
- TypeScript/build result
- lifecycle blueprint location
- data model gaps
- remaining phases
- risks/blockers
- whether the site is safe for controlled beta  
  
  
OCCTA: National Postcode Plan Display + Build Plan UX Polish + Lifecycle Blueprint

Latest codebase confirmed: `/build-plan` exists with `?availability=fallback` mode, `FAIR_PRICING_DEFAULTS` already at the new prices (£34.99 / £39.99 / £49.99 / £52.99), hero already shows Price Lock 24 / Flex 30 copy, postcode fallback card exists. No stale £22.99 in customer-facing pricing constants. Some stale numbers may live in `src/data/*` (keywordPages, comparisons, locations, guides) and SEO copy — a sweep is included in Part A.

This plan is split into **(A) ship now**, **(B) ship now**, **(C) blueprint only**. No payment/Worldpay/DD/invoice/resolver/Contract Summary logic changes.

---

## Part A — National postcode behaviour (ship now)

### A1. Promote every valid UK postcode straight to plans

`src/components/home/HeroSection.tsx` + `src/components/home/PostcodeChecker.tsx`:

- Replace error gating with a single positive path. Trigger states that route to `/build-plan?postcode=<pc>`:
  - `error` with type `backend-unavailable | availability-failed | no-addresses` → already routes to fallback. Keep.
  - `success` with `available=false` (edge case) → also route to fallback rather than dead-end.
- Treat `invalid-postcode` as the **only** customer-facing failure. Message stays: "That doesn't look like a proper postcode — please check and try again."
- Remove any user-visible "Unavailable" / "Try later" / "No plans" wording in hero + checker.
- Helper line: "Final speed, setup and order details confirmed before you proceed."

`src/contexts/AvailabilityContext.tsx`:

- No behaviour change to API calls — they still run for personalisation when they work. Add a new convenience action `proceedWithPostcode(pc)` that validates the postcode shape and, if valid, sets `status = "fallback"` + `postcode = pc` and resolves. Used by a "View plans" CTA so a customer with a valid postcode is never blocked even before the API responds.
- API success continues to feed `result.maxDownload` / `eligibleOcctaPlans` for internal personalisation, but plan visibility on `/build-plan` is no longer gated by it.

### A2. `/build-plan` shows all 4 buckets for every valid UK postcode

`src/pages/BuildPlan.tsx`:

- Change `eligibleBuckets`: if `isFallback` OR `result` is missing OR `result.eligibleOcctaPlans` empty → return all 4 buckets. Today this works only when `isFallback` is true.
- Remove the "Check your address first" gate (lines 166–177). Replace with: if no `result` and no `postcode` query param, surface a small inline postcode field at the top of step 1; otherwise proceed straight to step 1.
- Bucket cards already render `FAIR_PRICING_DEFAULTS.headline[b].lock24 / .flex30` with "Subject to confirmation" pill in fallback mode — extend the pill to non-fallback when no `result` is available.
- Hide any supplier name, Giacom name, supplier cost, margin or internal product ID from the UI (already absent — verify with grep).

### A3. Sticky estimated price summary

`src/pages/BuildPlan.tsx` (right column `<aside>` already exists):

- Add `lg:sticky lg:top-24` to the right column wrapper for desktop.
- Add a mobile sticky bottom bar (`fixed bottom-0 left-0 right-0 lg:hidden` with `safe-area-inset-bottom`) that mirrors the same fields:
  - bucket label, plan style label, broadband estimate, router, setup, add-ons, VAT line where applicable, estimated monthly total, estimated first bill.
- Label every figure with "Estimate — final details confirmed before you proceed."
- Re-use the existing `resolved` state. In fallback mode, show the headline from `FAIR_PRICING_DEFAULTS` and a clear "Estimate only" tag.

### A4. Nothing pre-selected + Next button rules

`src/pages/BuildPlan.tsx`:

- Today: `router = "own"`, `setup = "remote"`. Change defaults to `null` and tighten the union types:
  - `bucket: SpeedBucket | null` (already null)
  - `term: PlanTerm | null` (already null)
  - `router: RouterChoice | null` (was `"own"`)
  - `routerPay: RouterPaymentType` (stays — only relevant once router selected)
  - `setup: SetupChoice | null` (was `"remote"`)
- Update `canNext()` to require an explicit selection at every step.
- On Next click:
  - validate (already covered by `canNext`)
  - call `window.scrollTo({ top: 0, behavior: "smooth" })`
  - move focus to the next step's `<h2>` heading via a `ref` set on `Step` title. Add `tabIndex={-1}` so it can receive focus.

### A5. Section order

Re-arrange so the order matches the spec exactly. Current order is Speed → Plan style → Router → Setup → Add-ons → Details (6 steps). Spec adds **Step 7 Review**:

1. Choose speed
2. Plan style
3. Router
4. Setup / install
5. Optional extras (Digital Voice / Static IP / WiFi extender / support level)
6. Your details
7. Review — selected choices + estimated monthly total + estimated first bill + "Final details confirmation" wording, then Submit.

Add-on "WiFi extender / mesh" needs to be added to `ADDON_DEFS` as `wifi_mesh` (quote-only — display "Available by quote.") since the server resolver may not price it; do not wire pricing on the client. "Support level" already exists as `priority_support`.

For any add-on flagged as not auto-purchasable, render "Available by quote." instead of a £ figure. Mark `wifi_mesh` and `business` router that way.

Step indicator updates `Step {step} of 7`.

### A6. Thank-you page

`src/pages/quote/QuoteThankYou.tsx` (verify file exists — Quote thank-you route is used by BuildPlan submission via `nav('/quote/thank-you?ref=...')`):

- Display: quote/reference number, selected speed bucket label, plan style, estimated monthly price (from server response or defaults), selected router/setup/add-ons, customer postcode.
- Banners: "No payment has been taken." / "We'll confirm speed, setup and final order details before you proceed." / next-step expectation.
- Dashboard CTA: "Sign in to your dashboard" if the email matches an existing auth user, otherwise "Create your dashboard account".
- Strip any supplier or internal IDs.

The thank-you page must read from the quote_request the edge function created (lookup by `ref`). If that data fetch fails, render submitted client-side selections passed via location state as a fallback so the page is never empty.

### A7. Forbidden wording + price sweep

Run `rg` across `src/components/home/`, `src/pages/`, `src/data/`, `public/llms.txt`, `index.html` for:

- `£22.99`, `22.99`, `£32.95`, `32.95`, `£33.95`, `33.95`, `£27.59`, `27.59`
- `No contracts`, `No annual price hikes`, `cancel anytime`
- `free router`, `free installation`, `router included`
- `guaranteed speed`, `Full Fibre available`

Replace each customer-facing hit with the approved wording. SEO/structured-data prices in `src/data/comparisons.ts`, `src/data/keywordPages.ts`, `src/data/locations.ts`, `src/data/guides.ts`, `src/lib/businessData.ts`, `public/llms.txt` must align with the new from-prices (£34.99 essential, £39.99 superfast, £49.99 ultrafast, £52.99 gigabit). Internal admin pricing rules / supplier configs untouched.

### A8. Files changed (Part A)

- `src/contexts/AvailabilityContext.tsx`
- `src/components/home/HeroSection.tsx`
- `src/components/home/PostcodeChecker.tsx`
- `src/pages/BuildPlan.tsx`
- `src/pages/quote/QuoteThankYou.tsx`
- `src/data/comparisons.ts`, `src/data/keywordPages.ts`, `src/data/locations.ts`, `src/data/guides.ts` (price/wording sweep)
- `public/llms.txt`, `index.html` (sweep only if hits)

### A9. Untouched

Worldpay / `/pay` / `/pay-invoice` / invoices / DD mandates / supplier_products / supplier resolver / quote resolver / `resolve-build-plan-price` edge function (read only) / `submit-build-plan` (read only — schema already supports `force_quote_only` + `availability_mode`) / Contract Summary logic / rewards / campaigns / complaints / finance exports / AI chat.

### A10. Verification

```
tsc --noEmit
rg -n "22.99|32.95|33.95|27.59|No contracts|No annual price hikes|cancel anytime|free router|free installation|router included|guaranteed speed|Full Fibre available" src public index.html
```

Both must come back clean (or only flag internal admin/non-customer-facing surfaces). Manual:

- Enter a bad postcode in hero → only correction message.
- Enter a valid postcode + force API failure → "View plans" routes to `/build-plan?availability=fallback&postcode=...`.
- `/build-plan` always shows 4 buckets with Price Lock 24 + Flex 30 from-prices and "Subject to confirmation".
- Nothing pre-selected. Next disabled until selection. Next scrolls + focuses heading.
- Sticky summary visible desktop and mobile.
- Submit → `/quote/thank-you?ref=...` shows ref, selected bucket/style/router/setup/add-ons/postcode, "no payment taken", dashboard CTA.

---

## Part B — Build Plan UX polish

Covered inside Part A (A3–A6). No separate workstream.

---

## Part C — Lifecycle blueprint (audit only, no code changes)

Deliverable: a markdown doc `docs/lifecycle-blueprint.md` with the sections below. No DB migrations, no edge functions, no UI in this part.

### C1. Customer journey

postcode → Build Plan → quote request → admin final quote → Contract Summary → acceptance → payment / DD → order → supplier provisioning → activation → billing → support.

### C2. Admin journey

quote request queue → assign backend rate-card product → margin check → approve → send quote → generate Contract Summary → monitor acceptance → collect payment/DD → create order → enter supplier ref → book install → activate → start billing.

### C3. Data model gap audit

Tables to confirm and document (already exist per `<supabase-tables>`): `profiles`, `quote_requests`, `quotes`, `contract_summaries`, `contract_acceptances`, `orders`, `services`, `invoices`, `invoice_lines`, `receipts`, `payment_requests`, `dd_mandates`, `user_files`, `communications_log`, `audit_logs`.

Specifically check for and list as gaps:

- `quote_versions` history table (currently `quotes` may be mutated in place — needs a version snapshot row per version).
- `order_status_history` (currently events scattered across `quote_events` / `payment_request_events` / `complaint_events` — no canonical order timeline).
- `account_numbers` issuance: confirm trigger generating `OCCxxxxxxxx` on profile insert (per `src/lib/account.ts` it's expected from a DB trigger — verify).
- Link table or FK between `quote_requests.user_id` and an account when a guest later signs in.
- `documents` consolidation: contract PDFs, invoice PDFs, receipts, ID verification — currently spread across `contract_summaries`, `invoices`, `receipts`, `user_files`. Recommend a unified `documents` index view rather than a new table.
- Supplier order ref column on `orders` (verify; add if missing).
- Service activation date + billing start date columns on `services`.

### C4. Account number workflow

Auto-generate on `profiles` insert (DB trigger, `OCC` + 8 digits, unique). Display in: customer dashboard header, admin customer profile header, all transactional emails, quote PDFs, Contract Summary PDF, invoice PDFs, payment request links, support tickets, complaints.

### C5. Quote customer → dashboard customer

1. `submit-build-plan` already accepts email + creates `quote_request`.
2. Add (Phase B): after submission, send a magic-link / invite email tied to that email. If `auth.users` row exists → "Sign in to view your quote"; else → "Create your dashboard".
3. On first sign-in: link `quote_requests.email` → `profiles.user_id`, backfill `quote_requests.user_id` for all matching rows, issue account number if not yet present.
4. RLS already scopes per-row by `user_id` — verify policies on `quote_requests`, `quotes`, `contract_summaries`, `orders`, `services`, `invoices`.

### C6. Contract Summary + acceptance vault (blueprint only)

- Final quote → generate Contract Summary PDF server-side, store in `user_files` (or `contract-summaries` bucket).
- Customer downloads before acceptance.
- Acceptance: explicit checkbox + timestamp + IP + user-agent + accepted-text-hash + T&C version + Contract Summary version → write immutable `contract_acceptances` row.
- Downloadable record in dashboard and admin.
- No payment requested before acceptance row exists.

### C7. Payment / DD workflow (no code change)

Card via Worldpay HPP only, no raw card storage, webhook server-side verification only, browser return never marks paid (already enforced per memory). DD via approved provider; store mandate reference + status only. Each `payment_requests` row joined to account/order/invoice.

### C8. Supplier provisioning workflow

Admin order board fields: backend supplier product, supplier order ref, install/switch date, router dispatch, activation date, failed-install handling, cancellation/cease/change flow. Map to `orders` + `installation_bookings` + a new (Phase F) `order_status_history`.

### C9. Automated billing workflow

Service activation triggers billing schedule → cron generates invoices → VAT line per memory rules → PDF stored → reminders at 7/14/30 days per existing late-fee policy → receipts on payment → credit notes for refunds → finance export (Phase later).

### C10. Communications workflow

Email templates required (use `email_templates` + `auth-email-hook` per memory):
quote received, final quote ready, Contract Summary ready, Contract Summary accepted, payment/DD required, payment confirmed, order received, supplier order placed, installation booked, router dispatched, service live, invoice generated, payment failed, support/complaint updates.

### C11. Phased plan

- **Phase A (this PR):** national postcode display + Build Plan UX polish.
- **Phase B:** quote → account linking (magic-link, account number on profile, backfill).
- **Phase C:** admin backend product assignment + final quote approval workflow.
- **Phase D:** Contract Summary PDF acceptance vault.
- **Phase E:** Payment / DD live readiness audit.
- **Phase F:** Supplier order / provisioning workflow + `order_status_history`.
- **Phase G:** Service activation → customer dashboard wiring.
- **Phase H:** Invoice/billing automation hardening.
- **Phase I:** Communications automation (template completion).
- **Phase J:** Changes / cancellations / move-home workflow.
- **Phase K:** Final security / monitoring / go-live audit.

### C12. Risks / blockers

- Stale prices in `src/data/*` SEO pages — fixed in Part A.
- BuildPlan currently soft-gates on availability — fixed in Part A.
- Quote → account linking missing — Phase B blocker for self-service dashboard.
- Contract Summary acceptance vault missing — Phase D blocker for legal-grade order.
- No canonical `order_status_history` — Phase F blocker for ops visibility.

### C13. Must not go live until

Phases B (account linking), D (Contract Summary acceptance), F (supplier order ref + status history), and a Phase K security/monitoring pass are complete. Until then, controlled beta only: every order must be manually shepherded through admin.

---

## Final report (delivered after build mode)

- Confirmation latest codebase was used.
- Build Plan UX changes made.
- National postcode display behaviour.
- Files changed.
- TypeScript / build result.
- Lifecycle blueprint (committed as `docs/lifecycle-blueprint.md`).
- Data model gap list.
- Remaining phases.
- Risks / blockers.
- What must not go live until completed.
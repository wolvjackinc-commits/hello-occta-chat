Approved — proceed with OCCTA Phase C: Admin Product Assignment + Final Quote Approval, with the critical security corrections below.

This is Phase C only.

Do not start Phase D.  
Do not start Phase 7.  
Do not build payments.  
Do not create orders.  
Do not create supplier orders.  
Do not generate Contract Summary.  
Do not build Contract Summary acceptance.  
Do not touch Worldpay, /pay, /pay-invoice, invoices, DD mandates, services activation, supplier ordering, rewards, campaigns, complaints, finance exports, AI chat or magic-link auth.

Critical correction 1 — customer quote visibility must not use raw quotes table

The quotes table contains admin/internal fields such as:

- supplier_name
- supplier_product_id
- supplier_reference
- supplier costs
- margin_status
- margin data
- admin/internal notes

RLS protects rows, not columns. Therefore, if authenticated customers can SELECT directly from quotes, they may be able to query internal columns for their own quote.

Before Phase C customer quote visibility is enabled:

- audit grants/RLS on quotes
- prevent normal customers from reading raw quotes table directly if supplier/internal columns exist
- expose customer quote data only through a safe RPC or safe view, for example:
  - get_customer_quotes()
  - get_customer_quote_by_id()
  - get_public_quote_by_token()
  - customer_quotes_public view

Customer-safe output may include only:

- quote id/reference
- quote request reference
- customer/account number
- package name
- Price Lock 24 or Flex 30
- monthly customer price
- setup price
- router price
- add-ons customer price
- VAT/customer totals
- estimated first bill
- validity date
- quote status
- customer-facing notes
- “No payment has been taken”
- “Contract Summary will follow before you can order”

Customer-safe output must not include:

- supplier name
- Giacom name
- supplier_product_id
- supplier_reference
- supplier cost
- wholesale cost
- margin
- margin_status if it reveals internal margin state
- admin notes
- override reason
- ratecard/source document
- internal product IDs

Admin/staff can continue to access raw quotes table through admin/staff RLS.

Critical correction 2 — final quote must be linked cleanly to quote_request

When admin approves a final quote, the customer dashboard must know which quote to show.

Use one of these safe approaches:

Option A:  
Add `quote_requests.final_quote_id uuid references quotes(id)` and set it during approval.

Option B:  
Derive latest approved quote from `quotes.quote_request_id`, if that relationship already exists and is reliable.

Do not make the customer dashboard guess from message text.

The “View final quote” CTA must open the correct safe quote view.

Critical correction 3 — approval must not mean contract acceptance

Use clear status wording.

Quote approval in Phase C means:

- admin has approved the final quote for customer viewing
- margin check passed or authorised override was logged
- customer can view final quote

It does NOT mean:

- customer accepted the quote
- customer accepted a contract
- Contract Summary was generated
- payment can be taken
- order can be placed

Customer-facing wording must say:  
“Final quote ready”  
“Contract Summary will be provided before you can order”  
“No payment has been taken”

Do not show:

- Accept contract
- Pay now
- Place order
- Start order
- Continue to payment

Critical correction 4 — approved quote immutability

The approved quote immutability trigger is good.

But make sure:

- approving the quote can still stamp `approved_at`, `approved_by`, `final_snapshot`
- after approval, customer-facing financial/core fields cannot be changed silently
- if a price/detail changes, admin must create a new quote or revision
- final_snapshot includes the customer-facing quote values and relevant internal assignment reference for audit
- final_snapshot must never be sent to customer raw if it contains internal fields

Critical correction 5 — public token safety

If using quote token pages:

- never expose `public_token_hash`
- only return safe quote fields from the token edge function
- token should not allow listing or guessing other quotes
- token should not expose supplier/cost/margin/admin fields
- token page must not contain payment/accept buttons in Phase C

Phase C approved scope:

1. Migration

Add/verify:

- quote_request_status values:
  - in_review
  - needs_info
  - draft_quote_created
  - final_quote_ready
  - closed
  - rejected

Keep legacy statuses new/quoted if already used.

Add/verify quote_status:

- approved

Add:

- quote_requests.customer_facing_message text
- quotes.approved_at timestamptz
- quotes.approved_by uuid
- quotes.final_snapshot jsonb

Add approval RPC:  
admin_approve_final_quote(_quote_id uuid)

It must:

- be SECURITY DEFINER
- have search_path = public
- require staff/admin role
- require can_send_quote(id) = true or equivalent margin gate
- set quote.status = approved
- set quote_request.status = final_quote_ready
- link final quote to quote_request
- write quote_events
- write audit/activity log
- create no order/payment/CS/invoice/service/supplier order

Add RPC:  
admin_request_more_info(_qr_id uuid, _message text)

It must:

- staff only
- set quote_request.status = needs_info
- store customer_facing_message
- write audit/activity log
- expose only customer-safe message

Add RPC:  
admin_reject_quote_request(_qr_id uuid, _reason text)

It must:

- staff only
- set rejected/closed
- write audit/activity log
- not expose internal rejection notes unless marked customer-facing

2. Admin ReviewQuoteRequestDialog

Build one admin review dialog from QuoteRequests page.

Sections:

- Customer & selection
- Backend product assignment
- Customer-facing price
- Margin check
- Actions

Admin can:

- view customer details and account number
- view customer Build Plan selections
- assign active broadband supplier product
- filter supplier products by bucket and term
- see supplier cost/speed/term/setup/admin-only data
- set customer-facing final price
- calculate VAT/first bill
- run margin check
- save draft quote
- request more info
- reject
- approve final quote

3. Backend product assignment

Show active broadband supplier_products only.

Admin-only fields allowed:

- supplier
- supplier product
- speed
- term
- supplier cost ex VAT
- setup cost
- quote_only
- active status
- internal notes/source

Customer must never see these.

If admin assigns a product outside the customer-selected bucket/term:

- show warning
- require bucket_override_reason
- write quote_events/audit log

4. Margin check

Before final approval:

- run margin check
- block red/below-margin approval
- allow override only for authorised admin/super_admin/finance role
- reason required
- quote_margin_checks record required
- audit log required

Do not expose margin result/customer cost comparison to customer.

5. Customer dashboard

Quote Requests tab:

- show final_quote_ready pill
- show “View final quote” CTA
- show needs_info customer_facing_message if present

Quotes tab:

- show approved/final quotes using safe customer quote RPC/view only
- show package, monthly price, first bill, validity, status
- show:  
“No payment has been taken”  
“Contract Summary will follow before you can order”

Do not use raw quotes table for customer display if it exposes internal columns.

6. Public/customer QuoteView

QuoteView must display only safe fields:

- quote reference
- account number if linked
- package
- Price Lock 24 / Flex 30
- monthly price
- setup
- router
- add-ons
- first bill
- validity
- next step: Contract Summary will follow

No:

- Pay button
- Accept contract button
- supplier/Giacom/cost/margin/internal IDs/admin notes

7. Request more info

Admin can set needs_info with a customer-safe message.

Customer dashboard shows:  
“We need a little more information to finalise your quote.”

Do not expose internal admin notes.

8. Verification tests

Test A — admin assigns product:

- open QR-2606-20fa0e58
- assign suitable active broadband backend product
- set/confirm final customer price
- run margin check
- save draft quote

Test B — approve final quote:

- approve final quote
- quote_request status becomes final_quote_ready
- quote status becomes approved
- final_quote_id or equivalent relationship is set
- customer dashboard shows Final quote ready
- customer can view final quote

Test C — data safety:

- customer quote page/dashboard shows no supplier/Giacom/cost/margin/internal IDs
- inspect network response, not only UI

Test D — raw quotes table security:

- normal customer cannot directly query raw quote internal columns
- customer quote visibility uses safe RPC/view
- admin can still see internal columns

Test E — margin safety:

- below-margin approval is blocked unless authorised override with reason
- quote_margin_checks/audit log written

Test F — wrong user:

- wrong customer cannot see another user’s quote

Test G — downstream artefacts:  
Confirm zero created:

- orders
- payment_requests
- Contract Summaries
- invoices
- DD mandates
- services
- supplier orders

9. Build checks

Run:

- TypeScript
- production build

10. Final report

Stop after Phase C and report:

- audit findings
- files changed
- migrations added
- raw quotes security fix/result
- safe customer quote view/RPC used
- admin review workflow
- backend product assignment behaviour
- margin check behaviour
- override/audit behaviour
- approved quote immutability result
- final quote approval behaviour
- quote_request to final quote linking result
- customer dashboard final quote view
- public/token QuoteView safety result
- network response safety result
- RLS/security test result
- no downstream artefacts confirmation
- TypeScript/build result
- what was untouched
- remaining blockers before Phase D  
Phase C — Admin Product Assignment + Final Quote Approval

### Audit summary (what already exists, reusable)

- `quote_requests` (27 cols, statuses incl. `new`, `quoted`) + `qr_staff_*` / `qr_customer_select_own` RLS — reusable.
- `quotes` (52 cols incl. `supplier_name`, `supplier_product_id`, `supplier_reference`, `monthly_*`, `setup_*`, `router_*`, `margin_status`, `public_token_hash`, `expires_at`, `status` enum draft/sent/viewed/expired) + `q_staff_*` / `q_customer_select_own` RLS — reusable.
- `quote_events` (append-only history) + `quote_margin_checks` (with `can_send_quote()` gate + green/amber/red) — reusable.
- `supplier_products` (40 cols incl. bucket, term, cost, active, quote_only) — admin-only RLS already enforced.
- Edge functions present: `create-quote`, `run-quote-margin-check`, `override-quote-margin`, `get-quote-by-token`, `send-quote-email`, `submit-quote-request`.
- Admin pages: `src/pages/admin/QuoteRequests.tsx` (365 lines, queue + LinkQuoteRequestDialog), `src/pages/admin/Quotes.tsx` (342 lines, list).
- Customer dashboard: `QuoteRequestsTab.tsx`, `QuotesTab.tsx`, public `pages/quote/QuoteView.tsx`.

**Gaps to fill in Phase C (no greenfield rebuild needed):**

1. `quote_requests.status` enum lacks `in_review`, `needs_info`, `draft_quote_created`, `final_quote_ready`, `closed`, `rejected`.
2. `quotes.status` enum lacks `approved`.
3. No admin "Review request → assign product → approve quote" flow in one place.
4. No backend product picker UI scoped to bucket/term.
5. No bucket-override audit when admin picks a product in a different bucket than the customer chose.
6. `customer_notes` field exists on quotes but no `needs_info` message channel on `quote_requests`.
7. Customer dashboard has no "Final quote ready" pill / CTA → QuotesTab link.

### Plan

**Part 1 — Migration (single file)**

- Extend `quote_request_status` enum: add `in_review`, `needs_info`, `draft_quote_created`, `final_quote_ready`, `closed`, `rejected` (keep `new`, `quoted` as legacy aliases).
- Extend `quote_status` enum: add `approved`.
- Add `quote_requests.customer_facing_message text` (shown to customer when `needs_info`/`final_quote_ready`).
- Add `quotes.approved_at timestamptz`, `quotes.approved_by uuid`, `quotes.final_snapshot jsonb` (immutable snapshot written at approval).
- Trigger on `quotes` UPDATE: when `status` transitions to `approved`, require `can_send_quote(id) = true`, stamp `approved_at`/`approved_by`, write `final_snapshot` and a `quote_events` row; reject mutation of approved quote core fields (price, plan_name, supplier_*) — admin must clone to a new quote.
- New SECURITY DEFINER RPC `admin_approve_final_quote(_quote_id uuid)`: staff-only, sets quote.status=`approved`, parent quote_request.status=`final_quote_ready`, emits `quote_events` + `audit_logs`.
- New RPC `admin_request_more_info(_qr_id uuid, _message text)`: staff-only, sets status=`needs_info`, stores `customer_facing_message`, audit log.
- New RPC `admin_reject_quote_request(_qr_id uuid, _reason text)`: staff-only, sets status=`rejected`/`closed`, audit log.
- Update `get_customer_quote_requests()` to also return `customer_facing_message` and the new statuses.

**Part 2 — New admin component: `ReviewQuoteRequestDialog.tsx**`
Single dialog opened from `QuoteRequests.tsx` rows. Tabs/sections:

1. **Customer & selection** (read-only): name, email, phone, account_number (via profiles join), guest/linked badge, postcode, customer_type, bucket, term, router, setup, addons, build-plan estimate, source.
2. **Backend product assignment**: dropdown of active `supplier_products` filtered by service_type=broadband, with bucket and term filters defaulting to customer's selection. Shows supplier cost ex VAT, setup, contract term, speeds, `quote_only`/`active` flags. If admin picks a product in a different bucket than the customer's choice → warning + mandatory `bucket_override_reason` textarea.
3. **Customer-facing price**: editable monthly_net, setup_net, router_net, addons. Live VAT calc using existing `is_vat_active()` + `vat_default_rate`. Live first-bill estimate.
4. **Margin check**: button calling `run-quote-margin-check` edge function. Shows green/amber/red + reason. Red block unless override via `override-quote-margin` (admin/super_admin only, reason ≥10 chars).
5. **Actions**: Save Draft (calls existing `create-quote`, sets qr → `draft_quote_created`), Approve Final (calls `admin_approve_final_quote` RPC), Request More Info (RPC), Reject (RPC).

**Part 3 — `QuoteRequests.tsx` updates**

- Add status filter pills for new statuses.
- Replace existing "Build Quote" stub with "Review" → opens `ReviewQuoteRequestDialog`.
- Show linked customer badge + account_number column.

**Part 4 — Customer dashboard**

- `QuoteRequestsTab.tsx`: render `final_quote_ready` as a yellow "Final quote ready" pill with "View final quote" CTA → `/quotes/:token` (or `/dashboard?tab=quotes`). Render `needs_info` with the `customer_facing_message`.
- `QuotesTab.tsx`: surface approved quotes with reference, package, monthly, first bill, validity, status badges, "No payment has been taken" + "Contract Summary will follow" notes.
- `pages/quote/QuoteView.tsx`: strip any supplier_name/supplier_product_id/supplier_reference/admin_notes/margin info from the public view (verify current shape and the `get-quote-by-token` edge function returns only safe fields).

**Part 5 — Safety guarantees (must remain untouched)**

- No new payment, order, invoice, DD, service, Contract Summary, supplier order code paths.
- `QuoteView.tsx` shows no Pay/Accept buttons in Phase C (only "Contract Summary will follow").
- RLS untouched on quotes/quote_requests beyond enum extension; new RPCs are SECURITY DEFINER + `is_staff()` gated.

**Part 6 — Verification (after implementation)**

- TypeScript + production build.
- Live tests A-F per the spec on `QR-2606-20fa0e58`: assign product, margin green, approve → customer sees "Final quote ready" → QuoteView token page shows no supplier/cost/margin data; below-margin attempt blocked without override; wrong-user isolation; confirm zero orders/payments/CS/invoices/DD/services/supplier orders created.

### Technical notes

- Approved-quote immutability is enforced via the new trigger; admin who needs to change a price after approval must create a new quote (versioning lite — `final_snapshot` jsonb on approval is the audit artefact, no separate `quote_versions` table per spec).
- All status transitions write a `quote_events` row (already append-only) and `log_event(...)` to `activity_log` plus `audit_logs` for sensitive ones (override, bucket override, rejection).
- VAT, fair pricing, build-plan resolver and `can_send_quote()` gate are reused as-is — no business-logic forks.

### What stays untouched

Worldpay, `/pay`, `/pay-invoice`, invoices, DD mandates, supplier ordering, services activation, supplier_products write paths, supplier resolver, build-plan resolver internals, Contract Summary tables, rewards, campaigns, complaints, finance exports, AI chat, magic-link auth, all Phase B code.

### Remaining blockers expected after Phase C → Phase D

- Contract Summary generation from an approved quote.
- Contract Summary acceptance + customer "Accept & continue" CTA.
- Linking approved+accepted quote to Worldpay setup payment.
- Supplier order placement once contract accepted and payment cleared.
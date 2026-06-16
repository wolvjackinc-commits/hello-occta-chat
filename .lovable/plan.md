&nbsp;

## Approved — proceed with Stage 4: Admin Customer 360 Consolidation.



## This is admin UI consolidation only.



## Do not touch:



## - Worldpay webhook paid logic

## - payment status writes

## - supplier API submission

## - automatic service creation

## - automatic invoice creation

## - automatic DD mandate creation

## - provisioning automation

## - customer-facing supplier/internal data visibility



## Mandatory safety corrections:



## 1. No automatic writes on page load.

##    Customer 360 must not create, update, send, or mutate anything just by opening the page.



## 2. Manual fulfilment tracker creation must be admin-click only.

##    Even if customer is eligible, do not auto-create a tracker.

##    Show button:

##    "Create manual fulfilment tracker"

##    and require admin click.



## 3. Communications tab must be read-only unless admin explicitly clicks resend.

##    Do not automatically resend failed emails.



## 4. Billing / DD tab must be visibility only.

##    Do not create invoice/DD/service/provisioning actions in Stage 4.

##    If buttons are shown, they must be disabled with:

##    "Not automated yet — use manual process."



## 5. Customer-facing dashboard must not be touched in Stage 4.



## Proceed with the proposed 8-tab Customer 360 layout:



## Overview

## Quote & Contract

## Payments & Receipts

## Documents

## Communications

## Fulfilment

## Tasks & Notes

## Billing / DD



## Add cross-links from:



## - PaymentRequests

## - Quotes

## - QuoteRequests

## - ManualFulfilment

## - Tasks

## - Readiness



## Verification required for the customer linked to:



## - "QT-2606-a294fe6a"

## - "CS-2606-484f39b8"

## - "PR-260612-TZ6D9R"



## Before/after opening Customer 360, confirm zero row-count changes in:



## - services

## - invoices

## - dd_mandates

## - orders

## - manual_fulfilment_orders

## - installation_bookings

## - provisioning_readiness

## - payment_requests

## - communications_log



## Confirm Customer 360 shows:



## - quote row

## - customer proceeded timestamp

## - Contract Summary accepted timestamp

## - PDF download

## - payment paid + webhook verified

## - receipt link

## - communications log

## - readiness state

## - tasks/notes area

## - billing/DD placeholder



## Final report must include:



## - files changed

## - 8 tabs added/updated

## - cross-links added

## - test customer data shown

## - no-side-effect result

## - TypeScript/build result

## - what remains for Stage 5



## Stop after Stage 4. Do not start Stage 5 yet.

## Stage 4 — Admin Customer 360 Consolidation

Reorganise `src/pages/admin/CustomerDetail.tsx` (`/admin/customers/:accountNumber`) into a single 8-section workspace, wire safe admin actions, and add cross-links from related admin pages back to Customer 360. No automation, no schema changes.

### Tab structure (replaces current 7 tabs)

```text
Overview · Quote & Contract · Payments & Receipts · Documents
Communications · Fulfilment · Tasks & Notes · Billing / DD
```

### Per-tab content

**1. Overview**

- Existing header (name, account, email) + new compact card: phone, service address/postcode, current journey stage (derived from latest CS/PR/order), latest status badge, warnings (no CS / CS unaccepted / PR unpaid > 7d / missing DOB or postcode).
- Pull stage from existing `journey/milestones.ts` helpers; no new writes.

**2. Quote & Contract**

- Quote requests list (read from `quote_requests` by `user_id` / `account_number`) → View, Resend final quote email (calls existing `send-quote-email` if present; otherwise button disabled with tooltip).
- "Customer proceeded" timestamp from `quote_events` (`proceed_clicked`).
- Contract Summary rows (existing `AdminCsRow`) + "Generate Contract Summary" button when an accepted/proceeded quote exists and no active CS (calls existing `generate-contract-summary`).
- "Send / Resend CS email" → existing `send-contract-summary-email`.
- Accepted timestamp + signed PDF download (existing).

**3. Payments & Receipts**

- Existing `AdminPrRow` (PR #, status, amount, due/expiry, webhook_verified badge, paid_at, provider ref, receipt link, comms log, resend-receipt).
- Add "Resend payment link" button on unpaid/non-expired PRs → existing `send-payment-request-email` (or equivalent). If not found, render disabled with "Not wired yet".

**4. Documents**

- Unified table: final quote PDF, CS PDF, signed CS, payment receipt, invoices (if any). Source from existing CS/PR/invoice queries already in `data`. Reuses existing PDF-open handlers.

**5. Communications**

- New section reading `communications_log` for `user_id` (extends current PR-only query to all rows for this customer). Columns: template, channel, status, sent_at, recipient, related entity link (PR/CS/quote). Resend only for templates already exposed elsewhere; otherwise read-only.
- Reuse `CustomerCommunicationsTimeline` if it already covers this; otherwise add a simple table.

**6. Fulfilment**

- Read `provisioning_readiness` (status) and `manual_fulfilment_orders` for this customer.
- "Create manual fulfilment tracker" button when CS accepted + PR paid + none exists → inserts a `manual_fulfilment_orders` row (admin-explicit click only).
- "Update tracker status" select on existing tracker.
- Locked notice: "Supplier API submission is not automated yet — use manual process."

**7. Tasks & Notes**

- Embed existing `JourneyInternalNotes` component (already admin-only with RLS).
- Tasks list from `admin_tasks` filtered by `related_customer_id = profile.id`. Buttons: "Create task" (open existing task dialog or simple insert), "Update status" inline. Reuses existing task suggestions.

**8. Billing / DD**

- Existing `CustomerBillingSettings` + `CustomerDDSection` + invoices table (already present).
- Add disabled buttons with tooltip "Not automated yet — use manual process." for: Create monthly invoice, Create DD mandate, Activate service, Submit supplier order, Trigger provisioning. Placeholder copy when none exist.

### Cross-links to Customer 360

Add a small "View customer" link/button on existing rows in:

- `src/pages/admin/PaymentRequests.tsx`
- `src/pages/admin/Quotes.tsx` and `QuoteRequests.tsx`
- `src/pages/admin/ManualFulfilment.tsx`
- `src/pages/admin/Tasks.tsx`
- `src/pages/admin/Readiness.tsx`

Each link uses `navigate(\`/admin/customers/${accountNumber})`resolving the account number from the row's`user_id`/profile join. No route deletions.

### Data fetching changes

Extend the existing `useQuery` in `CustomerDetail.tsx` to also fetch:

- `quote_requests`, `quotes`, `quote_events` (proceed_clicked)
- `communications_log` for `user_id` (not only PR-linked)
- `provisioning_readiness`, `manual_fulfilment_orders`
- `admin_tasks` where `related_customer_id = profile.id`

All read-only. No mutations on mount. All queries scoped to the resolved `profile.id` — same RLS path already in use.

### Safety rules enforced

- No automatic writes anywhere in this page or its children on mount/refetch.
- Customer-facing surfaces (`src/components/dashboard/**`, `/dashboard/*`, public CS/receipt views) are not touched.
- Admin-only fields kept server-side: supplier cost, margin, supplier SKU, raw webhook payload, token hashes never leave existing edge functions. UI only renders fields already returned by sanitised endpoints (`get-payment-receipt`, CS PDF signed URL).
- All new admin actions call existing edge functions; if a function does not exist yet, the button is rendered disabled with the "Not automated yet" copy.

### Verification (manual + DB read-only)

For customer linked to `QT-2606-a294fe6a` / `CS-2606-484f39b8` / `PR-260612-TZ6D9R`:

1. Snapshot row counts in `services, invoices, dd_mandates, orders, manual_fulfilment_orders, installation_bookings, provisioning_readiness, payment_requests, communications_log` for this `user_id`.
2. Open Customer 360, click through each of the 8 tabs.
3. Re-snapshot — diff must be zero.
4. Confirm visible data: quote row + proceeded timestamp, CS accepted timestamp + PDF download, PR paid + verified badge + receipt link, comms log rows, readiness state, tasks/notes area, billing/DD placeholder.
5. TypeScript build clean.

### Files

**Edit:**

- `src/pages/admin/CustomerDetail.tsx` (tab reshape + new sections + extended query)
- `src/pages/admin/PaymentRequests.tsx`, `Quotes.tsx`, `QuoteRequests.tsx`, `ManualFulfilment.tsx`, `Tasks.tsx`, `Readiness.tsx` (cross-links only)

**New (small components, only if extraction helps readability):**

- `src/components/admin/customer360/OverviewCard.tsx`
- `src/components/admin/customer360/QuoteContractTab.tsx`
- `src/components/admin/customer360/CommunicationsTab.tsx`
- `src/components/admin/customer360/FulfilmentTab.tsx`
- `src/components/admin/customer360/TasksTab.tsx`

No new edge functions, no migrations, no changes to webhook / payment / supplier / provisioning code.

### Out of scope (Stage 5+)

Auto invoice generation, auto DD mandate creation, supplier API submission, auto service activation, provisioning automation, dunning.
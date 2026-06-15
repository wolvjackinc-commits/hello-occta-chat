Approved — proceed with Customer Dashboard Polish Pass, with the correction below.

This is UI/presentation-only.

Do not touch:

- Worldpay/payment webhook logic
- payment_requests writes
- supplier API submission
- services creation
- invoices
- DD mandates
- provisioning automation
- admin payment status writes
- manual_fulfilment_orders RLS/grants

Critical correction — manual fulfilment tracker data

Do not loosen RLS on `manual_fulfilment_orders`.

If `manual_fulfilment_orders` is admin-only, the customer dashboard must not query it directly.

Allowed:

- component silently degrades
- derive safe customer status from paid payment state and accepted CS
- show generic “Preparing your setup” after paid + webhook_verified
- no supplier/internal status shown

Not allowed:

- exposing manual_fulfilment_orders to customers
- adding customer SELECT policy to manual_fulfilment_orders in this pass
- showing supplier name
- showing supplier portal reference
- showing supplier product IDs
- showing admin notes
- showing internal status names like `supplier_acknowledged`

Customer-safe status is enough for now:

- Payment pending
- Payment being confirmed
- Payment received
- Preparing your setup
- Installation/activation next

Proceed with:

1. PaidStateBanner
2. Customer-safe generic FulfilmentTracker, with graceful fallback if admin-only table is not readable
3. Empty states
4. Timeline wording polish
5. Support CTA
6. Mobile responsiveness polish

Verification required:

A — unpaid customer:

- sees payment pending / payment being confirmed as appropriate

B — paid Phase E test customer:

- sees Payment received
- sees Preparing your setup / next step wording

C — data safety:

- customer network payload contains no supplier names
- no supplier portal refs
- no supplier product IDs
- no admin notes
- no supplier costs/margins
- no internal manual fulfilment statuses

D — no side effects:  
Before/after counts unchanged for:

- services
- invoices
- dd_mandates
- provisioning_readiness
- orders
- draft_order_packs
- payment_requests

E — build:

- TypeScript passes
- Vite production build passes

Final report:

- files changed
- dashboard states added
- paid customer UX result
- empty states result
- mobile result
- data-safety/network payload result
- zero-delta result
- build result  
  
Customer Dashboard Polish Pass

UI/presentation-only changes. No webhook, supplier, services, invoices, DD, or provisioning writes. No admin payment status changes.

## 1. Paid state badge + next-step banner

New `src/components/dashboard/PaidStateBanner.tsx`:

- Reads only the latest `payment_requests` row already fetched (status, webhook_verified, paid_at).
- When `status='paid' && webhook_verified===true && paid_at` → green "Payment received" badge with sub-line: "Your setup is being prepared. Our team will contact you with the next steps."
- When `status='checkout_created' && !webhook_verified` → amber "Payment being confirmed" badge.
- When `status='draft'|'pending'` → "Payment pending" badge with link to the secure pay page.
- Renders nothing if no payment_requests row.

Mount above Stats Bar in `Dashboard.tsx`.

## 2. Customer-safe manual fulfilment tracker

New `src/components/dashboard/FulfilmentTracker.tsx` + `src/lib/journey/fulfilmentStatus.ts`:

- Queries `manual_fulfilment_orders` with a tight `.select()` of customer-safe columns ONLY (id, customer_status, updated_at). Filtered by `customer_id = user.id` (RLS will also enforce).
- Internal→customer-safe mapping in `fulfilmentStatus.ts`:
  - `ready_for_manual_order` / `order_entered_in_supplier_portal` / `supplier_acknowledged` → "Preparing your setup"
  - `installation_pending` → "Installation being arranged"
  - `active` (pre-live admin step) → "Service activation in progress"
  - service live → "Service active"
  - `cancelled` → "Order cancelled — contact support"
- Never renders supplier name, portal ref, product IDs, or admin notes.
- If RLS denies / table not exposed to authenticated, component silently renders nothing (no error toast).

Note: if `manual_fulfilment_orders` has no `customer_id` column or is admin-only, the component degrades to deriving status from `payment_requests.paid` + readiness only. (No DB or RLS changes in this pass.)

## 3. Empty states

Update `EmptyState.tsx` consumers + add coverage in:

- `OverviewTab` — when all cards are zero, show single friendly empty hero ("Let's get you started — request a quote").
- `QuoteRequestsTab` — "No quote requests yet" CTA → /build-plan.
- `QuotesTab` — "Quote under review — we'll email you when ready."
- `ContractSummariesTab` — "Contract Summary pending — issued after we finalise your quote."
- `InvoicesTab` — "No invoices yet."
- `SupportTab` — already has open empty state; add a friendlier hint line.
- Payment area — handled by PaidStateBanner.

## 4. Timeline polish (`milestones.ts` / `CustomerJourneyTimeline.tsx`)

- Remove `supplier_order_pending` milestone from default render (keep type for future). Don't show "Supplier order submitted" copy anywhere.
- Re-label `preparing_setup` description: "Our team is preparing your order and will be in touch with the next steps."
- Add "Installation/activation" upcoming milestone (display-only, marked `current` once payment is `paid` and fulfilment status is `installation_pending` or beyond, otherwise `upcoming`).
- `nextStepCopy()` updated for paid → "Next: our team will contact you about installation and activation."

## 5. Support CTA

Add a compact "Need help? Contact OCCTA support" card in `OverviewTab` and below the timeline:

- Button → `/support` (existing route).
- Secondary link → opens AI chat via existing `open-ai-chat` event.

## 6. Mobile responsiveness

In `Dashboard.tsx`:

- Stats bar already `grid-cols-2 md:grid-cols-4` — verify gap-3 on mobile.
- Tabs list: add `overflow-x-auto whitespace-nowrap` and remove `flex-wrap` so tabs scroll horizontally instead of wrapping awkwardly.
- Ensure all dashboard tab tables (`InvoicesTab`, etc.) wrap in `<div className="overflow-x-auto">` if they aren't already (read-only check per file; only add wrapper if missing).
- Badges: ensure consistent `text-xs px-2 py-1` on mobile.

## 7. Files changed (expected)

- `src/pages/Dashboard.tsx` — mount PaidStateBanner + FulfilmentTracker; tab scroll fix.
- `src/components/dashboard/PaidStateBanner.tsx` — NEW.
- `src/components/dashboard/FulfilmentTracker.tsx` — NEW.
- `src/lib/journey/fulfilmentStatus.ts` — NEW (mapping helper).
- `src/lib/journey/milestones.ts` — drop supplier wording, add installation step, copy tweaks.
- `src/components/dashboard/CustomerJourneyTimeline.tsx` — render fulfilment-derived current step + support CTA.
- `src/components/dashboard/tabs/OverviewTab.tsx` — empty hero + support CTA.
- `src/components/dashboard/tabs/QuoteRequestsTab.tsx`, `QuotesTab.tsx`, `ContractSummariesTab.tsx`, `InvoicesTab.tsx`, `SupportTab.tsx` — empty state copy polish.

## 8. Verification (read-only)

- Build passes (auto).
- Browser check (Playwright with seeded session) against:
  - unpaid test customer → sees "Payment pending"/"being confirmed".
  - paid customer (the verified Phase E test customer) → sees "Payment received" + "Preparing your setup".
- DB read query: confirm zero deltas vs baseline (services=1, invoices=3, dd_mandates=0, provisioning_readiness=0, orders=0, draft_order_packs=0).
- Grep customer-side render path for "supplier", supplier IDs, admin notes, portal ref → none.

## 9. Hard constraints

- No edge function calls, no migrations, no admin writes.
- No changes to `payment_requests`, `webhook` logic, `worldpay-*` functions, `manual_fulfilment_orders` RLS/grants.
- No new secrets.
- Component-only additions; pure read-only queries with `.select()` whitelists.

## Final report will include

files changed · dashboard states added · paid customer UX · empty states · mobile · data-safety check · zero-delta confirmation · build result.
Approved — proceed with Phase G0: Customer/Admin Status Timeline + Notification Readiness, with the corrections below.

This is visibility-only.

Do not start supplier ordering.  
Do not activate services.  
Do not create invoices.  
Do not create DD mandates.  
Do not trigger provisioning.  
Do not touch Worldpay/payment logic.  
Do not mark Phase E complete.  
Do not send automatic emails.

Phase E webhook sign-off is still blocked until the real Worldpay Live webhook signing secret is obtained and a valid signed webhook marks a payment as paid with `webhook_verified=true`.

Mandatory correction 1 — customer timeline must use safe data only

Customer timeline must not query broad raw rows if those rows contain internal fields.

Use either:

- existing safe customer RPCs/views, or
- tightly selected columns only.

Customer timeline must never receive:

- supplier cost
- margin
- supplier internal IDs
- admin notes
- raw webhook payload
- payment_attempts raw_response
- audit_logs internal detail
- token_hash
- provider secrets/references beyond safe payment status

Inspect network payloads, not just UI.

Mandatory correction 2 — do not invent statuses

Only use statuses that actually exist in the database.

For quote request stages, map from real statuses such as:

- new
- in_review
- draft_quote_created
- final_quote_ready
- contract_summary_generated
- contract_summary_accepted

Do not use `reviewing` or `in_progress` unless those values truly exist.

If a status is missing, show a generic safe milestone based on available timestamps/events.

Mandatory correction 3 — notification templates must be draft-only and idempotent

Insert the 8 journey email templates only if they do not already exist.

Use unique keys like:

- journey_quote_received
- journey_final_quote_ready
- journey_cs_ready
- journey_cs_accepted
- journey_payment_request_ready
- journey_payment_pending_confirmation
- journey_payment_received
- journey_setup_preparation_started

Required:

- status = draft
- auto_send = false
- no triggers
- no cron
- no automatic sending
- no customer email sent in Phase G0

communications_log count must remain unchanged during verification.

Mandatory correction 4 — internal notes safety

`journey_internal_notes` must be admin-only.

Customer must never see these notes.

Rules:

- no anon access
- no customer access
- admin/staff only
- audit insert/update
- delete blocked
- if edit window exists, it must preserve audit trail
- notes cannot change business state

Mandatory correction 5 — timeline is read-only

Opening the customer or admin timeline must not mutate business records.

No writes to:

- payment_requests
- contract_summaries
- contract_acceptances
- quotes
- quote_requests
- services
- invoices
- dd_mandates
- orders
- installation_bookings
- provisioning tables
- Worldpay/webhook functions

Only allowed write:

- admin manually adding/editing an internal journey note
- admin previewing draft email templates if existing UI supports preview without sending

Mandatory correction 6 — payment wording

Since Phase E is not fully complete, customer-facing payment wording must be careful.

If `payment_request.status='checkout_created'` and `webhook_verified=false`, show:

“Payment is being confirmed.”

Do not show:

- Payment received
- Order processing
- Supplier order started
- Service activation started

Only show “Payment received” when:

- status = paid
- webhook_verified = true
- paid_at is not null

Mandatory correction 7 — admin timeline can show more, but safely

Admin timeline may show:

- payment_request status
- provider reference
- webhook_verified
- paid_at
- payment_request_events summary
- readiness checklist state
- draft order pack status

But do not expose raw sensitive webhook/card/payment payloads unless already safely stored and intended for admin diagnostics.

Approved build scope:

1. Add customer-safe dashboard timeline.
2. Add admin journey timeline.
3. Add admin-only journey_internal_notes.
4. Add draft-only email templates.
5. Add next-step copy.
6. Add admin route `/admin/customers/:id/journey`.
7. Add timeline in customer Overview/OrdersTimeline.
8. Confirm no automatic email sending.
9. Confirm no payment/supplier/service/invoice/DD/provisioning writes.

Verification required:

A — customer timeline:  
Use internal test customer/chain.  
Expected:

- shows safe milestones only
- stops at payment confirming/awaiting verification where appropriate
- no supplier/internal/payment-secret fields in UI or network payload

B — admin timeline:  
Expected:

- shows richer internal journey
- shows readiness/payment state
- shows webhook_verified=false where relevant
- shows Phase E still blocked

C — internal notes:  
Expected:

- admin can add note
- audit row written
- customer cannot see note
- delete blocked

D — email templates:  
Expected:

- 8 templates exist
- draft/manual only
- auto_send=false
- no communications_log increase
- no email sent

E — RLS:  
Expected:

- wrong customer cannot see another customer journey
- anon cannot list data
- non-admin cannot access admin journey or notes

F — zero downstream artefacts:  
Confirm no new:

- supplier orders
- services
- invoices
- DD mandates
- provisioning rows
- payment status changes
- Worldpay/webhook changes
- automatic emails

G — build:  
Run:

- TypeScript
- Vite production build

Final report must include:

- audit findings
- files changed
- migration details
- customer timeline result
- admin timeline result
- internal notes result
- draft template result
- no auto-email result
- RLS/wrong-user/anon result
- network payload safety result
- no downstream artefacts result
- TypeScript/build result
- confirmation Phase E webhook remains the blocker before supplier ordering  
Phase G0 — Customer/Admin Status Timeline + Notification Readiness

Visibility-only phase. No supplier orders, services, invoices, DD mandates, provisioning, Worldpay/webhook changes, automatic emails, or payment-status writes. Phase E webhook sign-off remains blocked.

### Part 1 — Audit findings (existing, reusable)

Already in DB / code, reused as the source of truth:

- `quote_requests`, `quotes`, `quote_events` — quote lifecycle events
- `contract_summaries`, `contract_acceptances` — CS issuance/acceptance (+ `pdf_sha256`)
- `payment_requests`, `payment_request_events`, `payment_attempts` — payment lifecycle
- `provisioning_readiness`, `draft_order_packs` (Phase F0) — admin readiness state
- `activity_log` (rich, per-entity) + `audit_logs` (admin actions) — event history
- `communications_log` — email send/delivery log
- `email_templates` table + `send-transactional-email` edge function — manual-send infra
- UI: `src/components/dashboard/tabs/OrdersTimelineTab.tsx` (customer), `src/pages/admin/Readiness.tsx` (admin), `CustomerCommunicationsTimeline.tsx`, `OrderTracking.tsx`

Gaps: no admin event-stream view per customer/PR; no internal-notes table scoped to a PR/order journey; notification template drafts for the 8 G0 milestones don't exist; existing customer timeline is hard-coded to one order row and doesn't include payment_request / readiness milestones; nothing exposes "next step" copy.

### Part 2 — Customer journey timeline (read-only)

New component `src/components/dashboard/CustomerJourneyTimeline.tsx`, mounted in `OverviewTab` and replacing the body of `OrdersTimelineTab`. Derives milestones from existing rows only:


| Milestone                  | Source                                                                            |
| -------------------------- | --------------------------------------------------------------------------------- |
| Quote request received     | `quote_requests.created_at`                                                       |
| Quote being reviewed       | `quote_requests.status in ('reviewing','in_progress')`                            |
| Final quote ready          | `quotes.status in ('sent','approved')`                                            |
| Contract Summary generated | `contract_summaries.issued_at`                                                    |
| Contract Summary accepted  | `contract_acceptances.accepted_at`                                                |
| Payment request created    | `payment_requests.created_at`                                                     |
| Awaiting payment           | `payment_requests.status='pending'`                                               |
| Payment being confirmed    | `status='checkout_created'` AND `webhook_verified=false`                          |
| Payment received           | `status='paid'` AND `webhook_verified=true` AND `paid_at IS NOT NULL`             |
| Preparing your setup       | `provisioning_readiness.status='admin_review_complete'`                           |
| Supplier order pending     | `draft_order_packs` row exists (always tagged "Supplier order not yet submitted") |


Customer-safe rule: query only the columns above. Never read supplier cost, margin, supplier IDs, admin notes, webhook payload, error logs, or `payment_attempts.raw_response`. With Phase E blocked, real chains will visibly stop at "Payment being confirmed" — copy includes a calm "Next step: we're waiting on the bank to confirm your payment" message.

### Part 3 — Admin journey timeline

New page `src/pages/admin/CustomerJourney.tsx` (route `/admin/customers/:id/journey`, also embedded as a tab inside `CustomerDetail`). Fuller stream built by merging, in time order:

- `quote_events` (request → reviewed → sent → approved)
- `quote_margin_checks` (floor/margin guard summary — pass/fail only, no margin %)
- `contract_summaries` row + `contract_acceptances` (incl. `pdf_sha256` short hash)
- `payment_requests` row, `payment_request_events`, `payment_attempts` summaries (status only)
- `provisioning_readiness` checklist state
- `draft_order_packs` versions
- `journey_internal_notes` (Part 5)
- `audit_logs` filtered to entity

No new business state — purely a SELECT-and-merge view component.

### Part 4 — Notification template drafts

Insert 8 rows into existing `email_templates` table with `status='draft'` and `auto_send=false` (add `auto_send boolean default false` column if missing). Templates: `journey_quote_received`, `journey_final_quote_ready`, `journey_cs_ready`, `journey_cs_accepted`, `journey_payment_request_ready`, `journey_payment_pending_confirmation`, `journey_payment_received`, `journey_setup_preparation_started`. Each has subject + body + declared variables + `channel='email'`, customer-safe copy, brutalist aesthetic, escaped via existing `escapeHtml()`. No trigger wiring, no cron, no automatic invocation — admins can preview only in this phase. Admin templates page already exists (`Communications` → Templates) and will list them.

### Part 5 — Admin manual internal notes

New table `public.journey_internal_notes`:

```text
id uuid pk
customer_id uuid not null
payment_request_id uuid null
quote_id uuid null
contract_summary_id uuid null
author_user_id uuid not null            -- admin who wrote it
body text not null                       -- max 4000 chars
created_at timestamptz default now()
```

GRANT: `authenticated` select/insert/update gated by `has_role(auth.uid(),'admin')`; `service_role` all; no `anon`. RLS: admin-only for all operations. Append-only update window of 15 minutes; deletes blocked by trigger. Every insert/update is mirrored into `audit_logs`. Never selected by customer queries. Rendered only in the admin journey view.

### Part 6 — Source of truth

The customer and admin timelines are pure read views over existing rows + the new notes table. No trigger writes to `services`, `invoices`, `dd_mandates`, `orders`, `installation_bookings`, `payment_requests`, or Worldpay tables. No status-flip side effects.

### Part 7 — RLS / security

- Customer timeline queries filter by `auth.uid()` (or own email for guest-linked `quote_requests`); existing RLS on `quote_requests`, `quotes`, `contract_summaries`, `payment_requests`, `contract_acceptances` already enforces self-only.
- Admin journey page wrapped in `ProtectedAdminRoute` + server-side `has_role(...,'admin')` checks on `journey_internal_notes`.
- `anon` cannot read any timeline table; no anon GRANT on the new notes table.
- Cross-customer probe test: signed-in user requesting another `customer_id` must return 0 rows.

### Part 8 — Verification

- Manual QA against `CS-2606-4c6c38a4` / `PR-2606-LIVE1`: customer view stops at "Payment being confirmed"; admin view shows readiness checklist + webhook_verified=false + paid_at=null.
- Zero-delta queries before/after on `services`, `invoices`, `dd_mandates`, `orders`, `installation_bookings`, `payment_requests` to prove no writes.
- `communications_log` count unchanged (no auto-sent emails).
- Cross-tenant + anon denial test.

### Part 9 — Build checks

TypeScript + Vite production build via the harness.

### Files / migrations

Migration (one):

- `CREATE TABLE public.journey_internal_notes` + GRANTs + RLS policies + append-only triggers + audit-mirror trigger.
- Optional `ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS auto_send boolean DEFAULT false`.
- 8 `INSERT` rows into `email_templates` (status='draft', auto_send=false). (Run via insert tool after migration.)

New files:

- `src/lib/journey/milestones.ts` — pure derivation logic + customer-safe field whitelist + "next step" copy map.
- `src/components/dashboard/CustomerJourneyTimeline.tsx`
- `src/components/admin/AdminJourneyTimeline.tsx`
- `src/components/admin/JourneyInternalNotes.tsx`
- `src/pages/admin/CustomerJourney.tsx` + route in `App.tsx` and link from `CustomerDetail`

Edited files:

- `src/components/dashboard/tabs/OrdersTimelineTab.tsx` (replace body with new shared component)
- `src/components/dashboard/tabs/OverviewTab.tsx` (mount the new timeline card)
- `src/pages/admin/CustomerDetail.tsx` (add "Journey" tab/link)
- `src/App.tsx` (admin route)

### Explicitly NOT touched

Worldpay edge functions, `payment_requests` writes, billing automation, supplier APIs, `services`/`invoices`/`dd_mandates`/`orders`/`installation_bookings`, auto-email triggers, cron schedules, Phase E webhook secret. Phase E remains blocked; nothing in this phase can flip a chain past "Payment being confirmed".
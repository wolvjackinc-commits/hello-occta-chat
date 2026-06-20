# Admin & Customer Journey Simplification Plan

A large cleanup + feature pass across the quote → contract → order → service → billing → support lifecycle. Grouped into phases so we can ship and verify incrementally.

---

## Phase 1 — Remove unused/confusing surfaces

Delete pages, routes, nav entries, components, edge functions and DB cron tied to:

- **Launch Safety** (`src/pages/admin/LaunchSafety.tsx`, `src/components/admin/launch/*`, `src/lib/launchSafety/*`, `supabase/functions/launch-safety-report`)
- **Readiness** (`src/pages/admin/Readiness.tsx`, `provisioning_readiness` admin UI, related cards)
- **Admin Tasks** (`src/pages/admin/Tasks.tsx`, `src/lib/tasks/*`, `admin_tasks` / `admin_task_notes` UI surfaces, suggestions)
- **Manual Fulfilment tab** (`src/pages/admin/ManualFulfilment.tsx` + nav link). Keep the underlying `manual_fulfilment_orders` table untouched for now; just remove the UI.
- Any "checking" / pre-quote validation button on the QuoteRequests queue.

DB tables stay (non-destructive) — only UI/edge code is removed to avoid breaking historical data.

---

## Phase 2 — Quote creation flow (admin)

In `src/pages/admin/QuoteRequests.tsx` + quote dialog:

1. Remove the "check" action on incoming requests; keep View / Create Quote / Decline.
2. In the create-quote dialog:
   - Auto-compute **VAT-inclusive** prices alongside ex-VAT, with a toggle "Prices entered are: ex VAT / inc VAT".
   - Show **supplier charges including VAT** as a read-only reference panel.
   - Add an **"Extra line items"** repeater (name + price, taxable flag).
   - Add **speed fields**: `download_estimate` (e.g. "80–100 Mbps") and `upload_estimate` (e.g. "20–30 Mbps"), with a fixed disclaimer stored on the quote:
     *"Speeds are estimates and depend on line length, internal wiring, peak-time contention and Wi-Fi conditions."*
3. After save: **Run Margin Check** button (existing `run-quote-margin-check`).
4. After margin pass: **single** "Send Quote to Customer" button. Remove all other actions (preview-only OK).
5. On send: lock the quote (`status = 'sent'`, `locked_at`, `sent_at`). No edits allowed.
6. Locked quotes get one action: **"Edit & Resend"** → creates a new revision (`parent_quote_id`), locks original, sends new.
7. Quote list shows timestamps: **Sent at / Opened at / Completed at** (track email open + customer view).

---

## Phase 3 — Customer journey extras

- Add **DOB capture** step in `UnifiedJourney` (allow at quote acceptance, contract summary, or checkout — whichever is first reached without DOB on profile). Validates 18+.
- After contract summary signed: persist the signed summary onto the customer's dashboard **and** admin Customer 360 → Contracts tab.
- Customer dashboard "Services" tab must **hide live service widgets** until admin marks the service `status = 'live'`. Show order status badges only: *Order Placed → Processing → Committed → Live* driven by admin.

---

## Phase 4 — Customer 360 (admin) actions

In `src/pages/admin/CustomerDetail.tsx`:

- **Payment Request**: generate Worldpay link → email + customer dashboard entry. Timestamps: created/sent/opened/paid/voided. Resend if unpaid. Void action.
- **DD Mandate Request**: pick customer email → send branded DD setup email (DD Guarantee, dates, link). On completion, link mandate to billing. Admin can manually update DD status (paid / not paid / cancelled). Status syncs across customer dashboard, billing, invoices.
- **Invoice send / resend** with timestamps (sent / opened).
- **Direct communication**: free-text email composer to that customer; logged in `communications_log` with sent/opened.

All these write to `communications_log` / `payment_request_events` / `invoice_email_events` with timestamps already in schema.

---

## Phase 5 — Billing & payments

- Editable invoice amount/line items post-issue (for engineer visit, fault charges). Add adjustment lines rather than mutating originals; mark as `adjustment` with reason. One-off vs permanent flag (permanent = added to recurring billing schedule).
- Auto reminders every 7 days while invoice unpaid (extend existing reminder cron).
- Advance-notice email before DD collection (existing pattern in `automated-billing-standard`).
- Cancellation rules:
  - **Flex**: 30-day notice — UI shows computed termination date.
  - **Contract**: ETF = remaining months × monthly + outstanding charges; show breakdown to customer + admin before confirming.

---

## Phase 6 — Support, complaints, chat

- Admin can **create a ticket and assign to a customer** → customer notified via dashboard + email.
- Customer can raise ticket from dashboard and from AI chat (when logged in) — chat escalation auto-creates a ticket with full transcript attached.
- Complaints: anyone can file. Customer filers get email + dashboard entry.
- **Chat transcripts** admin page: full transcript view, download (PDF/TXT), email-to-customer action.

---

## Technical notes

- Migrations needed:
  - `quotes`: add `download_estimate`, `upload_estimate`, `speed_disclaimer`, `extra_line_items jsonb`, `locked_at`, `parent_quote_id`, `opened_at`, `completed_at`.
  - `profiles`: ensure `date_of_birth` exists + capture point.
  - `invoices`: `adjustment_of_invoice_id`, `adjustment_reason`, `is_permanent_addition`.
  - `services`: ensure `status` enum includes `placed | processing | committed | live | cancelled`.
- New edge functions: `send-dd-mandate-request`, `send-customer-direct-email`, extend `worldpay-payment-request` with resend/void.
- Email templates (brutalist + brand): DD mandate setup, payment request, payment reminder, invoice adjustment, ticket assigned, complaint received, contract summary signed.
- All sent emails go through `email_send_log` (already standard) so open tracking populates timestamps shown in admin.

---

## Out of scope for this pass

- No changes to ICUK availability / pricing engine logic.
- No changes to existing Worldpay HPP webhook security model.
- Historical data in `admin_tasks`, `provisioning_readiness`, `launch_safety` left intact in DB.

---

## Execution order

1. Phase 1 (deletions) — fastest, unblocks UI confusion.
2. Phase 2 (quote flow) — biggest behaviour change.
3. Phase 3 (journey + DOB + service status gating).
4. Phase 4 (Customer 360 actions).
5. Phase 5 (billing edits + reminders + cancellation math).
6. Phase 6 (support/chat/complaints).

Each phase ends with a build check and a quick Playwright smoke on the affected admin screen.


# Customer 360 & Quote Lifecycle Overhaul

Eight connected issues. Grouped into 4 workstreams so they ship coherently.

---

## A. Customer Overview accuracy (Image 1)

**Problem:** Overview shows "Date of birth missing" and "Postcode missing" even though the customer supplied them at quote/checkout.

**Fix:**
- Compliance flag logic currently only reads `profiles.date_of_birth` / `profiles.postcode`. Extend `useComplianceFlags` (and the server `compliance_flags` view if used) to also resolve from: latest accepted `quote_requests` row, latest `orders.service_address` JSON, and `customer_services.service_address`.
- When any source has the value, backfill `profiles` (one-shot edge function `backfill-profile-from-quote` triggered on customer view load if missing). This way the warning disappears and admin doesn't have to re-key.
- Add a small "Source: quote QR-…" hint next to the auto-filled value in Edit Customer.

---

## B. Service-Live customer experience + admin in-life controls (Images 2, 6)

**Problem:** Service went live, but no welcome comms; admin Operations page is cluttered and lacks proper in-life suspend/cancel with the right termination maths.

**1. Welcome / Service-Live email pack (auto-triggered on `confirm_service_live_tx`):**
- New email templates in `supabase/functions/_shared/transactional-email-templates/`:
  - `service-live-welcome.tsx` — account number, login link, plan summary, activation date, first-bill date & amount, payment method, how to pay, support contact, link to "Getting started" guide.
  - `getting-started-tips.tsx` — sent 24h later (cron) — router placement, speed test, digital voice setup, app links.
- Trigger from `confirm-service-live` edge function after RPC success: enqueue both emails (second with `send_after` timestamp).

**2. Reimagined Operations + Services & Orders page (merge):**
- Single page **"Service & Lifecycle"** combining current OrderOperationsCard (Image 2) and Services & Orders (Image 6).
- Sections:
  1. **Live Service Card** — plan, address, monthly price, next bill date, Giacom ref, router/tracking.
  2. **Lifecycle Actions** (context-aware buttons that swap based on status):
     - Pre-live: Record in Giacom / Mark Processing / Committed / Hold / Resume / Mark Failed / Confirm Live.
     - Live: **Suspend service**, **Reactivate**, **Start Cancellation** (opens new dialog below).
  3. **Status history timeline** (kept as-is).
  4. **In-life cancellation cases** (kept, populated by dialog).

**3. Cancellation dialog with correct ETF logic:**
- Detect plan type from `orders.plan_type` (`flex` vs `contract_saver` / contract).
- **Flex:** notice = 30 days from request date → show "Service ends DD MMM YYYY (30 days notice)". No ETF.
- **Contract:** compute `remaining_months = months between today and contract_end_date`, ETF = `remaining_months * monthly_price + (89 * 1.20)` = `remaining_months * price + £106.80`. Show breakdown.
- Persist into `cancellation_cases` (new table if missing) with `type`, `effective_date`, `etf_amount`, `reason`, `requested_by`.
- Generate cancellation invoice when ETF > 0 (reuse invoice pipeline).
- Email customer "Cancellation confirmed" with terms relevant to flex/contract.

**4. Contract terms parity:** update `src/lib/legal/fullContractTerms.ts` & contract summary generation so the issued contract embeds the matching clause (Flex 30-day vs Contract ETF formula) based on `plan_type`.

---

## C. Billing transparency + DD/Billing page fix (Images 3, 5)

**Problem:** Customer/admin don't know when first bill lands; Billing/DD page renders broken (yellow highlight everywhere = focus/contrast bug).

**1. Billing explainer (admin + customer):**
- New `BillingSchedulePanel` component on customer Dashboard Billing tab AND admin Billing/DD tab.
- Shows: Activation date, Billing mode (Anniversary/Calendar), Billing day, **First invoice date** (= activation + 30 days, or next anniversary, per mode), **First payment due** (invoice date + payment_terms_days), recurring cycle thereafter, payment method.
- Plain-English line: "Service went live 22 Jun 2026. First invoice will be raised on 22 Jul 2026 and is due by 29 Jul 2026 via invoice link / Direct Debit."

**2. Fix Billing/DD page styling (Image 5):**
- Audit `src/pages/admin/CustomerDetail.tsx` Billing tab + `BillingSettings` components: all `bg-yellow-*` / `text-yellow-*` selected-state classes are leaking. Replace with brutalist tokens (`bg-background`, `border-foreground`, `data-[state=active]` only).
- Save button should be neutral; remove yellow fill, use `variant="default"` brutalist.

---

## D. Communications hub + Quote real-time status + Quote action lifecycle (Images 4, 7, 8)

**1. Communications tab (Image 4):**
- Query `email_send_log` filtered by `recipient_email = customer.email` AND/OR `metadata->>customer_id`. Deduplicate by `message_id` (latest status). Render: template, subject, sent timestamp, status badge, "View" (opens rendered email preview drawer).
- **All system emails must log here** — audit triggers (quote sent, contract summary, payment receipt, welcome, etc.) to ensure they pass `metadata: { customer_id }` to `send-transactional-email`.
- Header buttons:
  - **Send Email** → dialog: subject + rich text body, uses standard OCCTA email template wrapper (`occta-admin-message.tsx` — new template using existing brutalist email shell). Logs to `email_send_log` with template_name `admin-direct-message`.
  - **Create Ticket** → dialog: category dropdown (Billing, Technical, Account, Complaint, Cancellation, Other), priority, subject, message. Inserts into `support_tickets` linked to customer; sends `ticket-created` email; appears in customer dashboard Support tab + admin Tickets queue.

**2. Quote Requests real-time status (Image 7):**
- Replace static `status` column with a computed `journey_stage` resolved server-side via new view `quote_request_status_v` that joins:
  - `quote_requests` → `customer_services.status` → `orders.status`.
- Status ladder shown as a single badge with color:
  `Draft → Quote Sent → Opened → Accepted → Order Submitted → Processing → Committed → **Live** → Suspended / Cancelled / Failed`.
- "Opened" derived from `quote_email_events` (add `opened_at` via Mailgun open webhook or a pixel in the quote email).
- Subscribe via Supabase Realtime on `quote_requests`, `customer_services`, `orders` so admin list updates without refresh.

**3. Quote action panel lifecycle (Image 8):**
- After a quote is sent, replace "Create Quote" with:
  - **Edit & Resend** (creates new revision; old revision archived with reason).
  - **View Quote** (opens customer-facing link).
  - **Revoke Quote** (with reason).
- New `quote_events` table (`quote_id`, `event_type`, `actor`, `metadata`, `occurred_at`) capturing: `created`, `sent`, `opened`, `viewed_page_N`, `accepted`, `declined`, `expired`, `revised`, `revoked`, `payment_requested`, `paid`, `order_submitted`, `processing`, `committed`, `live`, `cancelled`.
- Render as timeline below the action buttons: "Sent 22 Jun 16:48 → Opened 22 Jun 17:02 → Accepted 22 Jun 17:10 → Closed by customer at Payment step 22 Jun 17:14".
- Hook tracking points in: `send-quote` function, contract summary view route loader, payment page mount, payment success webhook, journey cancel dialog.

---

## Technical layout

**New / changed files (high level):**
- `src/hooks/useComplianceFlags.ts` — multi-source resolution.
- `supabase/migrations/*` — `quote_events`, `cancellation_cases`, `quote_request_status_v`, `quote_email_events.opened_at`, GRANTs + RLS.
- `supabase/functions/confirm-service-live/index.ts` — enqueue welcome + delayed tips emails.
- `supabase/functions/_shared/transactional-email-templates/` — `service-live-welcome`, `getting-started-tips`, `admin-direct-message`, `ticket-created`, `cancellation-confirmed-flex`, `cancellation-confirmed-contract`.
- `supabase/functions/send-quote/`, `quote-open-pixel/`, `cancel-service/` (ETF maths server-side).
- `src/pages/admin/CustomerDetail.tsx` — merge Operations + Services & Orders, fix Billing tab styling, add Comms hub buttons.
- `src/components/admin/customer/*` — `BillingSchedulePanel`, `CancellationDialog`, `CommunicationsLog`, `SendEmailDialog`, `CreateTicketDialog`, `QuoteActionPanel`, `QuoteTimeline`.
- `src/pages/admin/QuoteRequests.tsx` — switch to status view + realtime subscription.
- `src/lib/legal/fullContractTerms.ts` — flex vs contract clauses.

**Order of execution:**
1. DB migrations (events, cases, status view, RLS, GRANTs).
2. Edge functions (welcome pack, cancel-service, quote tracking).
3. Email templates + registry.
4. Admin UI refactor (Operations merge, Comms hub, Billing fix, Quote pages).
5. Customer Dashboard surfacing (billing panel, tickets, welcome content links).

Estimated to land in 3 implementation passes; I'll ship A+C first (quick wins), then B, then D.

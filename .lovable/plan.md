Approved — start Phase 4 only.

Apply these corrections before coding:

1. Do not change any database schema or RLS in Phase 4.

If a dashboard query fails because RLS blocks access, show a safe empty state and report it in the closing summary. Do not weaken RLS in this phase.

2. Quotes / Contract Summary token safety:

Do not expose public_token_hash or token hashes anywhere.

Do not try to recreate quote or Contract Summary links from hashes.

If a safe public link is not available, show:

“Contact OCCTA to resend this secure link.”

Do not show broken buttons.

3. Email-matched quote_requests:

Only use email matching if the logged-in user’s email is available and existing RLS allows it.

If not allowed, only show records linked by customer_id.

Do not change policies in Phase 4.

4. Invoice payment link:

Use the existing invoice payment route exactly as it currently works.

Do not invent `/pay-invoice/:id` if the project uses `/pay-invoice?invoice=...` or another existing format.

Keep current invoice payment flow untouched.

5. Account Settings:

Only show fields that already exist in `profiles`.

Do not add new profile columns.

If marketing/contact preference columns do not exist, show a placeholder and report it.

6. Vulnerable Customer Support:

Do not store health/medical details in Phase 4.

Use supportive wording and CTA to support only.

If a form is added, keep it minimal and avoid sensitive health data.

7. Chat History:

Only show chat history if the existing table and user filter are safe.

If not, show empty state.

Do not create Communications Centre in Phase 4.

8. Documents:

Show only customer-safe documents:

- invoices

- receipts

- Contract Summaries

- quotes

- uploaded customer documents if already linked to the logged-in user

Never show supplier costs, margin data, admin notes, internal logs, token hashes or other customer data.

9. Activity logging:

Only log low-risk actions:

dashboard_view, tab_view, quote_view_from_dashboard, contract_summary_view_from_dashboard, invoice_view_from_dashboard, support_cta_click, vulnerable_support_view.

Do not log full address, phone, email, invoice contents, tokens, or sensitive support information.

10. Keep AppDashboard untouched.

Only the desktop/web dashboard in Layout mode should be upgraded.

11. Do not touch:

Worldpay webhook, HPP, invoices generation, DD mandates, AI chat engine, SEO pages, /pay, /pay-invoice, public /quote/* flow, admin pricing/margin pages, rewards engine, campaign engine.

12. Stop after Phase 4 and report:

- files changed

- tabs added

- data sources used

- what showed real data vs placeholder

- any RLS/permission issues

- security checks

- what was untouched

- verification result

- warnings/errors

Start Phase 4 only.

  
  
Phase 4 — Customer Dashboard Expansion

Refactor `/dashboard` into a tabbed portal while preserving all current functionality. No DB schema or admin/pricing changes.

### Scope guardrails

- Untouched: Worldpay webhook, invoices generation, DD mandates, AI chat engine, SEO pages, `/pay`, `/pay-invoice`, public `/quote/*`, admin pricing/margin pages, rewards/campaign engines.
- No new tables. Rewards, Complaints, Communications Centre = placeholders only.
- App-mode (`AppDashboard`) untouched; tabbed UI is for desktop/web `Layout` mode.

### File changes

New components under `src/components/dashboard/tabs/`:

- `OverviewTab.tsx` — summary cards (active services, pending quotes, latest order, unpaid invoices, next payment, open tickets, rewards placeholder, important notices) with safe empty states.
- `ServicesTab.tsx` — list from `services` + active `orders`/`guest_orders`; shows plan, address, status, activation date, contract type (Flex/Contract Saver inferred from plan), digital voice warning if applicable.
- `OrdersTab.tsx` — timeline per order using `quote_requests` → `quotes` → `contract_summaries` → `orders`/`guest_orders` → `invoices`/`receipts`. Reuses existing `OrderTracking` where useful.
- `QuotesTab.tsx` — lists `quotes` for `customer_id = auth.uid()` (and email-matched `quote_requests`). Shows plan, status badge, monthly gross (residential) or ex+incl VAT (business), expiry, "View quote" button only if `token_expires_at > now()` (calls `get-quote-by-token` only via stored last-known link — otherwise hides the button). Never selects `public_token_hash`.
- `ContractSummariesTab.tsx` — lists `contract_summaries` for `customer_id = auth.uid()`. Shows plan, address, status, version, issued/accepted dates, monthly incl VAT, contract length, "View/Download" via existing `ContractSummaryView` route or `pdf_url`. Accepted rows shown as locked.
- `InvoicesTab.tsx` — wraps existing `PaymentHistory` + new sections: Unpaid (with "Pay" → `/pay-invoice/:id`), Paid, Receipts, Failed attempts, Credit notes from `credit_notes`. Existing flow preserved.
- `SupportTab.tsx` — existing tickets list (open/closed), "Create ticket" CTA → `/support`, AI chat CTA dispatches `open-ai-chat` event, human escalation note.
- `ChatHistoryTab.tsx` — reads `chat_analytics` rows for the user if any; otherwise empty state copy.
- `ComplaintsTab.tsx` — placeholder: how to raise, link to `/legal/complaints-code`, 6-week ADR explanation. No table writes.
- `RewardsTab.tsx` — placeholder cards (referral link, points, Contract Saver benefits) with "coming soon" copy. No values hard-coded.
- `DocumentsTab.tsx` — aggregates `user_files`, `contract_summaries.pdf_url`, `invoices.pdf_url`, `receipts` download links.
- `AccountSettingsTab.tsx` — basic edit of `profiles` (name, phone, billing address, service address, marketing/contact prefs if columns exist; otherwise hidden). Logs `marketing_preference_change` via `log-event` if changed.
- `VulnerableSupportTab.tsx` — static supportive content + CTA that opens a pre-filled support ticket (subject "Extra support request") via existing `support_tickets` flow. No new health-data storage.

Edits:

- `src/pages/Dashboard.tsx` — keep header/account card + app-mode branch; wrap body in `Tabs` (shadcn) with the 13 tabs. Lift existing data fetches into the page and pass as props. Existing dialogs (`TicketDetailDialog`, `OrderTracking`) retained.
- `src/lib/activityLog.ts` — extend `LowRiskEventType` union with `dashboard_view`, `quote_view_from_dashboard`, `contract_summary_view_from_dashboard`, `invoice_view_from_dashboard`, `support_cta_click`, `vulnerable_support_view`, `marketing_preference_change`.

### Data sources (read-only from client, scoped by RLS)

- `profiles`, `orders`, `guest_orders`, `services`, `support_tickets`, `user_files`, `invoices`, `receipts`, `payment_attempts`, `credit_notes` — existing.
- `quotes` — filter `customer_id = auth.uid()`. Select only customer-safe columns (no `public_token_hash`, no supplier_product/cost/margin fields).
- `quote_requests` — filter `customer_id = auth.uid()` OR `email = user.email`.
- `contract_summaries` — filter `customer_id = auth.uid()`. Select no `public_token_hash`.
- `chat_analytics` — filter by `user_id` if column exists; otherwise empty state.

### RLS verification (no migration this phase)

Confirm existing policies on `quotes`, `quote_requests`, `contract_summaries` already restrict to `customer_id = auth.uid()`. If a permission error surfaces during verification, the fix is deferred to Phase 5 and flagged in the closing report — no policy changes in Phase 4.

### Activity logging

Wire `logClientEvent` on tab mount and on view/download CTAs. Server-side sensitive events untouched.

### UI/design

- shadcn `Tabs` with brutalist styling (4px border, sharp corners, black/yellow).
- Sticky tab bar on desktop; horizontal scroll on mobile.
- Summary cards reuse existing `card-brutal` pattern.
- Empty states with consistent copy.

### Verification checklist

- `/dashboard` renders all 13 tabs; existing features still operate.
- Quotes/Contract Summaries tabs list only the logged-in user's records.
- Invoices tab keeps Pay Now flow → `/pay-invoice/:id`.
- No supplier/cost/margin/token-hash fields appear in network responses.
- `/admin/*` Phase 3 pages, `/quote/*`, `/checkout`, `/pay`, `/pay-invoice`, `/`, `/admin/overview`, `/track-order` still render.
- App-mode dashboard unchanged.

### Stop point

After Phase 4, report files changed, tabs added, data sources, RLS behaviour, what was untouched, and verification result. Do not start Phase 5.
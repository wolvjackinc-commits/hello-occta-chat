# Business Operations v2

Extend the newly launched B2B section so business customers can transact, get support, and request quotes — and staff can manage the pipeline.

## 1. Enrich lead intake

**DB (migration):** add columns to `business_leads`:
- `sla_preference` (text: standard | priority | enhanced)
- `billing_contact_name`, `billing_contact_email`, `billing_contact_phone`
- `site_address_line1`, `site_address_line2`, `site_city`, `site_postcode`
- `secondary_contact_name`, `secondary_contact_email`, `secondary_contact_phone`
- `assigned_rep_id` (uuid, references auth.users)
- `internal_notes` (text)
- `status` already exists — extend allowed values via CHECK: new, contacted, qualified, quoted, won, lost

**Frontend:** upgrade `LeadForm.tsx` with a stepped layout (Company → Contacts → Site → SLA & requirements). Reuse in `BusinessHub`, `BusinessContactSales`, industry pages.

## 2. Business support tickets

Reuse existing `support_tickets` table (adds a `business_account` boolean via migration) so residential ticket UI and admin can share code.

**New page:** `src/pages/business/BusinessSupport.tsx` — list existing tickets, "Raise a ticket" (subject, category, priority, description) with attachment upload to a `business-ticket-attachments` storage bucket. Show status timeline.

**Admin:** existing Tickets page filters gain a "Business only" toggle.

## 3. Business invoices & billing history

Reuse `invoices` + `communications_log`. Add a business dashboard tab:
- `src/pages/business/BusinessBilling.tsx` — invoice list, filters, download PDF, view payment status.
- Automatic invoice emails: reuse existing daily billing cron; add branded business template `business-invoice.tsx` under `_shared/transactional-email-templates/`, and pick it in `send-transactional-email` when `profiles.business_account = true`.

Migration: `profiles.business_account boolean default false`; backfill from `orders.is_business` where present.

## 4. Admin CRM for leads

Rebuild `src/pages/admin/BusinessLeads.tsx`:
- Columns: company, contact, SLA, status, assigned rep, updated
- Row actions: assign rep (dropdown of admin users via `user_roles`), change status, add internal note
- Detail dialog with full record, notes timeline (new table `business_lead_notes`: id, lead_id, author_id, body, created_at)
- CSV export button (client-side generation from filtered rows)
- Filter: status, rep, date range, search

## 5. Business quote request flow

New page: `src/pages/business/BusinessQuote.tsx` — multi-step:
1. Pick services (checkboxes: Broadband, Voice, SIM, Bundle, Leased Line)
2. Per-service requirements (seats, speed, sites)
3. Contact + SLA + notes

Submits into new `business_quote_requests` table (id, company, contact, email, phone, services jsonb, requirements jsonb, sla, status, assigned_rep_id, created_at). Triggers internal alert via `submit-business-lead` extended, or new `submit-business-quote` edge function (reuse send-email).

Admin page: `src/pages/admin/BusinessQuotes.tsx` — list, detail, mark "Quoted", link to convert into a customer.

## Technical details

- All new tables: GRANT authenticated + service_role, RLS: user-owned (business_account users see their own tickets/invoices via existing policies); admins via `has_role`.
- Storage bucket `business-ticket-attachments` (private, RLS by owner).
- Routes wired in `App.tsx`: `/business/support`, `/business/billing`, `/business/quote`; admin routes for BusinessQuotes.
- Nav: add "Support", "Billing", "Get a quote" under Business in header/footer, sitemap.
- Type regeneration happens after migration approval.

## Out of scope

- No card checkout for business (still lead → sales → manual quote).
- No SSO / multi-user business accounts (single primary contact drives the account).
- Ticket SLA timers / auto-escalation.

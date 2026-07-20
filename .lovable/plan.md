# Business Operations v3 Plan

Five deliverables, all scoped to the B2B surface. Residential flows untouched.

## 1. Business support tickets — CSV export + admin activity log

- New table `business_ticket_activity` (ticket_id, actor_id, actor_type, event_type, from_value, to_value, metadata, created_at) with RLS: owners read own, admins read all, service_role writes.
- Triggers on `support_tickets` where `category` is business-scoped: log status changes and assignment changes.
- Attachments recorded via edge function that inserts activity rows when a file is added to a business ticket.
- Admin ticket detail (`src/pages/admin/Tickets.tsx` / business filter) gets a timeline panel.
- `/business/support`: "Export CSV" button — id, subject, status, priority, created_at, last_update, attachment_count.

## 2. Multiple named business contacts

- New table `business_contacts` (business_user_id, name, role: primary|billing|technical|other, email, phone, receives_invoices bool, receives_updates bool, is_default_billing bool).
- Migration seeds from existing `business_users` / `profiles` billing fields.
- New page `src/pages/business/BusinessContacts.tsx`: list, add, edit, delete; toggles for who receives invoices and service updates.
- Enforced via edge function `manage-business-contact` (validated writes, audit log).

## 3. Business quote PDF

- New `src/lib/generateBusinessQuotePdf.ts` using existing jsPDF pattern (matches invoice PDF style).
- Customer-facing download button on quote confirmation and `/business/quote` success screen.
- `submit-business-quote` edge function: renders PDF server-side (or generates data payload, PDF built client-side on confirmation email) and attaches PDF to the business contact's confirmation email via `send-email` with `attachment_base64`.

## 4. Ticket notifications (email + in-app)

- DB trigger on `support_tickets` status changes and on `ticket_messages` inserts for business-owned tickets → enqueue via `pg_net` to `notify-business-ticket` edge function.
- Edge function sends email to receiving business contacts (branded, brutalist template, secure `/business/support` link) + inserts row into existing in-app notifications feed.
- In-app: dashboard bell/badge already exists on business support tab; wire new events into `ticket_read` map so unread counts include status/attachment events.

## 5. Automatic invoice emailing to business billing contact

- `invoices` INSERT/UPDATE trigger where profile.account_type = 'business' and status = 'issued': enqueue `send-business-invoice-email` edge function.
- Function: generates invoice PDF (reuse `generateInvoicePdf` server variant / existing `send-invoice-email` pattern), sends to all `business_contacts` where `receives_invoices = true`, falls back to primary billing contact. Body includes secure magic dashboard link (short-lived signed token → `/business/billing`).
- Logged to `communications_log` with `body_html` so admin timeline "View email" works.

## Technical Notes

- All new tables: `GRANT SELECT/INSERT/UPDATE/DELETE ... TO authenticated; GRANT ALL ... TO service_role;` + RLS scoped by `auth.uid()` via `business_users` join.
- New edge functions: `manage-business-contact`, `notify-business-ticket`, `send-business-invoice-email`. All use `verify_jwt = false` with in-code JWT validation, CORS headers, Zod input validation.
- PDFs use existing brutalist jsPDF style (mono headings, sharp borders, VAT lines ex-VAT for B2B).
- All secure links use SHA-256 hashed tokens per project token standard.
- Admin routes get audit_log entries for contact edits and manual invoice resends.

## Files to add
- `supabase/migrations/*` — 3 migrations (activity, contacts, invoice trigger)
- `src/pages/business/BusinessContacts.tsx`
- `src/lib/generateBusinessQuotePdf.ts`
- `src/components/business/BusinessTicketTimeline.tsx`
- `supabase/functions/{manage-business-contact,notify-business-ticket,send-business-invoice-email}/index.ts`

## Files to edit
- `src/pages/business/BusinessSupport.tsx` — CSV export button
- `src/pages/business/BusinessQuote.tsx` — PDF download on success
- `src/pages/admin/Tickets.tsx` — timeline for business tickets
- `supabase/functions/submit-business-quote/index.ts` — attach PDF to confirmation email
- `src/App.tsx` + `Header.tsx` — `/business/contacts` route
- `src/components/app/AppHeader.tsx` — in-app notification counter includes ticket events

Approve to build.

# Business Operations v4

Five deliverables, one coordinated build. All new tables get GRANTs + RLS in the same migration.

## 1. Admin roles & permissions page

**DB**
- Extend `app_role` enum with `business_admin`, `ticket_admin`, `sales_admin` (keep existing `admin`, `moderator`, `user`).
- Reuse `user_roles` + `has_role()`; add helper `has_any_admin_role(uid)` for guard checks.

**Frontend**
- New `/admin/roles` page (super-admin only): list staff, assign/revoke roles via `user_roles`, audit each change into `audit_logs`.
- Update `ProtectedAdminRoute.tsx` to accept a `requiredRole` prop; gate `BusinessLeads`, `BusinessQuoteRequests`, business ticket admin pages by matching role.

## 2. Business ticket activity log — filter, search, export

**Frontend**
- New admin view `/admin/business/activity` reading `business_ticket_activity` joined with `support_tickets` and profiles.
- Filters: ticket ID/subject search, assignee dropdown, event type multiselect (status_change, priority_change, assignment, message, attachment, access), date range.
- Filters persisted in URL, CSV export of filtered rows.

## 3. Attachment preview / download / access log

**Storage**
- Signed URLs from existing `business-ticket-attachments` bucket (60s).

**Frontend**
- In `BusinessSupport.tsx` ticket detail: list attachments with preview (image/PDF inline in dialog) and download buttons.
- Every preview/download inserts a `business_ticket_activity` row with `event_type = 'attachment_access'` and file name via a new `log-ticket-attachment-access` Edge Function (uses `getClaims` for auth).

## 4. Auto invoice emailing to business billing contact

**Edge Function** `send-business-invoice-email`:
- Trigger: DB trigger on `invoices` insert where `business_profile_id is not null` fires `pg_net` POST.
- Function fetches invoice, generates PDF server-side (reuse jsPDF pattern), resolves recipient = first `business_contacts` row with `receives_invoices=true`, falls back to profile billing_email.
- Sends via `send-transactional-email` with new template `business-invoice-ready` (PDF as link, not attachment — per rules, use signed dashboard link + hosted PDF URL).
- Log to `communications_log` with `body_html`.

## 5. Ticket notifications (email + in-app)

**DB**
- New `notifications` table (user_id, type, title, body, link, read_at, created_at) with RLS.
- Trigger on `business_ticket_activity`: for events `status_change`, `message`, `attachment_uploaded`, insert notification row and fire `pg_net` to `notify-business-ticket` edge function.

**Edge Function** `notify-business-ticket`:
- Resolves ticket owner + assignee, sends via `send-transactional-email` (new template `business-ticket-update`).

**Frontend**
- Bell icon in header (business + admin) reading `notifications` with realtime subscription; mark-as-read on click.

## Technical notes

- New tables: `notifications`. New enum values on `app_role`. New templates: `business-invoice-ready`, `business-ticket-update`.
- New pages: `src/pages/admin/RolesPermissions.tsx`, `src/pages/admin/BusinessActivityLog.tsx`.
- New components: `src/components/NotificationBell.tsx`, `src/components/business/TicketAttachmentList.tsx`.
- New edge functions: `send-business-invoice-email`, `notify-business-ticket`, `log-ticket-attachment-access`.
- All migrations follow CREATE → GRANT → RLS → POLICY order.
- Realtime enabled on `notifications`.

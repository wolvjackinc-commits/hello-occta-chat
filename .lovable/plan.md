Approved — start Phase 6 only, but apply these corrections before coding.

1. support_tickets safety

Before altering support_tickets, inspect the existing table and enum/check constraints.

Do not break existing ticket statuses or categories.

If status is a PG enum, only ADD values; do not rename or remove existing values.

If category is text, use a safe check/validation layer only if it will not reject existing rows.

2. Internal notes/messages must never be customer-visible

ticket_internal_notes must be staff-only.

communication_messages with direction='internal' must never be returned by customer RPCs.

Customer-safe RPCs must filter out internal notes/messages at the SQL level, not only in frontend.

3. Complaint records must be append-first

Do not delete complaint records.

Do not edit complaint_events.

If correction is needed, add a new event.

Complaint status changes must create complaint_events.

4. Six-week ADR date

six_week_adr_eligible_at must be automatically set to opened_at + 42 days / 6 weeks.

Do not use 8-week wording anywhere.

5. Complaint reference generation

Make complaint_reference unique and human-readable.

If sequence generation is risky, use a safe format like CMP-YYYYMMDD-XXXXXX.

Do not depend on a fragile monthly counter unless transaction-safe.

6. Evidence pack is placeholder only

Generate Evidence Pack should list linked items only:

quote, Contract Summary, invoice/payment, ticket, communication, order/service.

Do not build full PDF export in Phase 6.

7. Communications centre body handling

communication_messages may store message body, but activity_log must not store full message body.

activity_log details should contain IDs/status/channel only.

No passwords, tokens, bank/card details, full medical details or unnecessary sensitive data.

8. Vulnerable customer support

Do not ask for medical diagnosis or detailed health information.

Use operational wording only:

“Tell us what support you need from OCCTA.”

For Digital Voice, include power-cut and emergency-calling warning.

9. AI Knowledge Base

Do not rebuild or weaken the AI chat engine.

Add approved-KB support and handoff rules only.

AI must not:

- guess prices

- guess availability

- give legal conclusions

- resolve formal complaints automatically

- promise compensation

- promise engineer dates

- create hidden complaints without customer confirmation

AI should escalate:

complaints, cancellations, vulnerable customer issues, emergency-call/power-cut issues, payment hardship, legal/ADR requests, and customer requests for a human.

10. AI handoff action safety

If AI creates a ticket/complaint via handoff, it must:

- show the user what is being created

- create a visible customer record

- log the event

- not create duplicate complaints repeatedly from the same conversation

11. Customer-safe RPCs

Customer dashboard must use customer-safe RPCs:

- get_customer_tickets

- get_customer_ticket_messages

- get_customer_complaints

- get_customer_complaint_events

- get_customer_communication_messages

- get_public_kb_articles

Do not let customers directly query admin/internal tables where internal fields exist.

12. Public complaint/support forms

Forms must be rate-limited.

They should return safe confirmation only.

Do not expose internal IDs, staff assignment, or admin notes.

13. Complaint letters

Letters can be draft/sent.

Only sent letters should appear in customer Documents tab.

Draft letters are admin-only.

14. Role restrictions

support_agent:

- support tickets and communications

- complaints read-only unless converted/escalated by compliance/admin

compliance_admin:

- complaints, complaint letters, evidence, KB compliance content

marketing_admin:

- no complaint management access

auditor:

- read-only

admin/super_admin:

- full access

15. RLS

Use deny-by-default.

Test:

- customer cannot see another customer’s ticket/complaint/messages

- customer cannot see internal notes

- customer cannot see internal/support_only KB articles

- customer cannot see draft complaint letters

16. Do not touch these systems

Do not touch:

- Worldpay webhook/HPP

- invoice generation

- DD mandates

- /pay

- /pay-invoice

- checkout gate

- public /quote flow

- pricing/margin pages

- rewards engine

- campaign engine

- finance exports

- SEO pages

AI chat core may only receive a small read-only KB/handoff hook if absolutely needed.

17. Verification

After build, test:

- /admin/support

- /admin/complaints

- /admin/communications

- /admin/knowledge-base

- customer Support tab

- customer Complaints tab

- customer Chat History tab

- public support form

- public complaint form

- complaint ADR date = opened_at + 6 weeks

- internal note not visible to customer

- draft complaint letter not visible to customer

- sent complaint letter visible to customer Documents

- KB approved article visible, internal/support_only hidden

- /quote/start, /checkout, /pay, /pay-invoice still work

Stop after Phase 6 and report:

- tables added

- functions/RPCs added

- admin pages added

- dashboard changes

- public page/form changes

- complaint SLA/ADR behaviour

- communication centre behaviour

- AI KB behaviour

- RLS/policies

- activity logs

- what was untouched

- verification result

- warnings/errors

Start Phase 6 only.  
  
  
Phase 6: Support, Complaints, Communications & AI Knowledge Base

Build a record-first, customer-safe support operations layer. Do not touch Worldpay/HPP, invoice generation, DD, /pay, /pay-invoice, checkout gate, public /quote flow, pricing/margin pages, rewards engine, campaign engine, finance exports or SEO pages.

### 1. Database migrations

**Migration A — extend existing `support_tickets**` (preserve current columns):

- Add: `vulnerable_customer_flag bool default false`, `related_order_id`, `related_invoice_id`, `related_quote_id`, `related_service_id` (uuid, nullable), `first_response_due_at`, `resolution_due_at`, `closed_at` (timestamptz, nullable).
- Widen `category` text to accept the new enum values (text already, no change required); enforce via trigger that values are in the allowed list.
- Widen `status` enum to include `waiting_customer`, `waiting_occta` (add to existing PG enum if user-defined; otherwise use a text check). Keep current values working.
- New table `ticket_internal_notes` (id, ticket_id, author_id, body, created_at) — never readable by customers, even via RLS. RLS: staff only.
- Trigger to auto-set `first_response_due_at` = created_at + 4h (urgent), 1d (high), 2d (normal), 5d (low); `resolution_due_at` = created_at + 5/10/20 working-day equivalents.

**Migration B — complaints**:

- `complaints` (all fields per spec). Trigger sets `six_week_adr_eligible_at = opened_at + interval '6 weeks'`. `complaint_reference` generated as `CMP-YYMM-NNNN` via sequence-style function (mirrors `generate_invoice_number`).
- `complaint_events` — append-only (trigger blocks UPDATE/DELETE for all non-service roles).
- `complaint_evidence_links`.
- `complaint_letters`.
- Status transitions enforced by trigger (no jumping past `deadlock_issued` without an event row, etc.).

**Migration C — communications centre**:

- `communication_threads`, `communication_messages` per spec.
- `direction='internal'` messages strictly admin-only (RLS).
- Keep existing `communications_log` (email tracking) untouched; new tables sit alongside.

**Migration D — knowledge base**:

- `kb_categories`, `kb_articles` (with `slug` unique), `kb_article_versions` (snapshot on every approve), `ai_handoff_rules`.
- Trigger: on `status='approved'` insert a version row and stamp `approved_at`/`approved_by`.

**Migration E — RLS / GRANTs / roles**:

- GRANT pattern per project standard for every new table.
- Customers: own tickets/complaints, own non-internal communication_messages via thread membership; cannot see `ticket_internal_notes`, internal messages, or `support_only`/`internal` KB articles.
- `support_agent`: tickets + communication threads CRUD; complaints read-only.
- `compliance_admin`: complaints, complaint_letters, evidence, KB compliance articles.
- `marketing_admin`: read public KB only; no complaints access.
- `auditor`: read-only everywhere.
- `admin`/`super_admin`: full.
- Customer-safe read RPCs (SECURITY DEFINER, search_path=public): `get_customer_tickets`, `get_customer_ticket_messages(_ticket_id)`, `get_customer_complaints`, `get_customer_complaint_events(_complaint_id)`, `get_customer_communication_messages(_thread_id)`, `get_public_kb_articles`. These strip internal fields (assigned_to, internal notes, fraud refs, etc.).
- Customer-safe write RPCs: `customer_create_ticket(...)`, `customer_create_complaint(...)`, `customer_add_ticket_message(...)` — each writes an `activity_log` row.

### 2. Edge functions

- `submit-support-ticket` — public+auth form ingress; creates thread+message+ticket; rate-limited (5/15min per email).
- `submit-complaint` — creates complaint + initial event + acknowledgement letter (draft) + linked thread; logs `complaint_created`; rate-limited.
- `submit-callback-request` — creates thread + ticket (category=general, priority=high).
- `submit-vulnerable-support` — ticket category=`vulnerable_support`, flag=true; copy explicitly avoids medical detail capture; logs `vulnerable_support_requested`.
- `add-complaint-event` — admin/compliance only; inserts append-only event; updates complaint status transitions; can issue deadlock (sets `deadlock_issued_at`, creates letter draft).
- `send-complaint-letter` — moves letter draft → sent; reuses existing email infra; logs activity.
- `kb-approve-article` — admin/compliance only; snapshots version + flips status.
- `generate-evidence-pack` — admin-only stub returning JSON list of linked Contract Summary, quote, invoice/payment, tickets, communications, order/service. No PDF in this phase.

AI chat engine: untouched. Add KB read helper in `ai-chat` (read-only SELECT on public KB only — single small additive change), and consult `ai_handoff_rules` to decide when to insert a ticket/complaint via existing RPCs. No prompt/personality changes.

### 3. Admin pages (new, wired into `App.tsx` + `AdminLayout.tsx` nav)

- `/admin/support` — ticket list (filters: status/category/priority/assigned/vulnerable), detail drawer with reply, internal note, assign, link to order/invoice/quote/customer, "Create complaint from ticket" action, SLA badges (overdue / due soon / on track) derived from `first_response_due_at`/`resolution_due_at`.
- `/admin/complaints` — register, filters incl. ADR-eligible date; detail page with timeline, evidence links, status transitions, deadlock draft, resolution notes, "Generate Evidence Pack" button (calls stub).
- `/admin/communications` — unified inbox grouped by thread, channel filter, customer search, link panel; internal toggle hides/shows internal messages (admin-only).
- `/admin/knowledge-base` — categories CRUD, articles with draft/approve/archive workflow, version history viewer, visibility selector, AI handoff rules CRUD.

All admin dialogs follow `mem://style/admin-dialog-layout-standards` (flex-col, max-h-[90vh], internal scrolling).

### 4. Customer dashboard tab updates (Phase 4 surfaces)

- `SupportTab.tsx` — show real open/closed lists from `get_customer_tickets`, click row → side drawer with `get_customer_ticket_messages` and reply box (calls `customer_add_ticket_message`). AI chat CTA + "Request human" CTA (creates ticket with priority=high).
- `ComplaintsTab.tsx` — replace placeholder: list customer's complaints with status badge + six-week ADR date; "Raise complaint" opens form; detail drawer shows timeline (`get_customer_complaint_events`); link to /legal/complaints-code.
- `ChatHistoryTab.tsx` — already exists; switch to `get_customer_communication_messages` filtered to non-internal AI/human chat threads owned by the customer.
- `DocumentsTab.tsx` — append complaint letters where `status='sent'` and linked to the customer.
- `VulnerableSupportTab.tsx` — CTA invokes `submit-vulnerable-support`; copy includes Digital Voice power-cut warning; no medical data fields.

### 5. Public pages / forms

- `/support` (existing) — refactor submit path to `submit-support-ticket`.
- `/complaints` — add explicit "Raise a complaint" form (link to a new `ComplaintForm` component) invoking `submit-complaint`. Update copy to six-week ADR wording (replace current "8 weeks").
- `/legal/complaints-code` — copy refresh to match six-week ADR wording.
- `/legal/vulnerable-customers` — add Digital Voice warning block + CTA to vulnerable support request.
- `/digital-voice` (if route exists; if not, copy lives on `/landline`/`/sim-plans` digital-voice section) — add power-cut/emergency-calling block per spec.

### 6. Activity logging

All edge functions and RPCs emit `log_event` rows with the exact event types listed in the brief. Details JSON contains IDs/statuses only — no medical info, card/bank/payment data, passwords, tokens, or message bodies for complaint events (subject only).

### 7. Verification (after build)

- Each new admin page renders, gated by role.
- Customer dashboard tabs read only from safe RPCs.
- Insert a test complaint → `six_week_adr_eligible_at` exactly opened_at + 42 days.
- Internal note created in a ticket → not returned by `get_customer_ticket_messages`.
- KB draft → approve → version row created, customer sees only `visibility='public'`.
- Spot-check that /quote/start, /checkout gate, /pay, /pay-invoice, /admin/rewards, /admin/campaigns still render (route smoke).
- Run supabase linter; resolve any new findings.

### What is NOT touched

Worldpay webhook/HPP, invoice generation, DD mandates, /pay, /pay-invoice, checkout gate, public /quote flow, pricing/margin admin pages, rewards engine, campaign engine, finance exports, SEO pages, AI chat engine core (only read-only KB hook + handoff rule consult added).

### Stop point

Stop after Phase 6 and report: tables added, functions added, admin pages added, dashboard changes, public page changes, complaint SLA/ADR behaviour, communication centre behaviour, AI KB behaviour, RLS/policies, activity logs, what was untouched, verification result, warnings/errors. Do not start Phase 7 until approved.
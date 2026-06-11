Approved — proceed with Phase I0: Admin Support & Manual Task Queue, with the corrections below.

This phase is operational tracking only.

Do not start supplier ordering.  
Do not activate services.  
Do not create invoices.  
Do not create DD mandates.  
Do not trigger provisioning.  
Do not change Worldpay/payment logic.  
Do not send automatic emails.  
Do not mark Phase E complete.

Phase E webhook sign-off remains blocked until the real Worldpay Live webhook signing secret is obtained and a valid signed webhook marks a test PR as paid with `webhook_verified=true`.

Mandatory correction 1 — admin-only task queue

`admin_tasks` and `admin_task_notes` must be admin-only.

Required:

- no anon access
- no customer access
- ProtectedAdminRoute for `/admin/tasks`
- RLS using the project’s existing admin helper
- no customer dashboard imports or queries
- normal customer direct SELECT must return no rows / be denied

Mandatory correction 2 — no business-state side effects

Creating, editing, resolving, cancelling, assigning, or adding notes to a task must not update:

- payment_requests
- quotes
- quote_requests
- contract_summaries
- contract_acceptances
- services
- invoices
- dd_mandates
- orders
- installation_bookings
- provisioning_readiness
- draft_order_packs
- Worldpay/webhook state
- communications_log

Task updates are workflow-only.

Mandatory correction 3 — no automatic task creation

Suggestions are allowed, but they must be read-only.

Opening `/admin/tasks` must not insert task rows.

Allowed:

- show suggested tasks
- admin clicks “Create task”
- form prefilled from suggestion

Not allowed:

- auto-create task on page load
- cron-created tasks
- webhook-created tasks
- payment-status-created tasks
- email-trigger-created tasks

Mandatory correction 4 — task notes safety

`admin_task_notes` should be append-only.

Required:

- admin can INSERT note
- admin can SELECT note
- no customer access
- no anon access
- no DELETE
- avoid UPDATE if possible; if update is allowed, use a short edit window and audit every change

Note body max length should be enforced, for example 4000 characters.

Mandatory correction 5 — task deletion blocked

Do not physically delete tasks.

Use:

- `status='cancelled'`
- `cancelled_at=now()`

For resolved:

- `status='resolved'`
- `resolved_at=now()`

No DELETE policy.

Mandatory correction 6 — audit logs

Audit:

- task created
- task updated
- task status changed
- task assigned
- note added
- task cancelled
- task resolved

Audit must not include unnecessary customer PII or secrets.

Mandatory correction 7 — status wording

Task status `waiting_supplier` is allowed only as an internal manual task label.

It must not imply supplier order has been submitted.

If shown, use helper copy:  
“Waiting on supplier/admin action — no supplier order has been submitted.”

Mandatory correction 8 — links are navigation only

Links to customer journey, quote, Contract Summary, or payment request must be read-only navigation.

Clicking a link must not mutate any row.

Approved build scope:

1. Add `admin_tasks`.
2. Add `admin_task_notes`.
3. Add `/admin/tasks`.
4. Add task filters by status, priority, assignee, and related customer.
5. Add create/edit task dialog.
6. Add task detail drawer.
7. Add manual internal notes.
8. Add suggestion panel with no auto-create.
9. Add sidebar link.
10. Add customer detail link to filtered tasks view.

Verification required:

A — admin task actions:

- admin can create task
- admin can update task
- admin can assign task
- admin can add note
- admin can resolve task
- admin can soft-cancel task

B — no automatic creation:

- opening `/admin/tasks` creates zero task rows
- suggestions appear but do not persist unless admin clicks create

C — access control:

- anon denied
- normal customer denied
- customer cannot SELECT from `admin_tasks`
- customer cannot SELECT from `admin_task_notes`

D — audit:

- task create/update/status/note actions create audit rows
- audit payload contains no secrets

E — no side effects:  
Before/after counts unchanged for:

- payment_requests
- quotes
- quote_requests
- contract_summaries
- services
- invoices
- dd_mandates
- orders
- installation_bookings
- provisioning_readiness
- draft_order_packs
- communications_log

F — no emails:

- no automatic email sent
- communications_log unchanged unless unrelated manual action occurred

G — build:

- TypeScript passes
- Vite production build passes

Final report must include:

- audit findings
- migration summary
- files changed
- task queue behaviour
- suggestions behaviour
- notes behaviour
- RLS/admin-only result
- customer/anon denial result
- audit-log result
- no-side-effect result
- no downstream artefacts result
- no automatic-email result
- TypeScript/build result
- confirmation Phase E remains blocker before supplier-order planning  
  
Phase I0 — Admin Support & Manual Task Queue

Operational tracking only. No supplier orders, no provisioning, no invoices, no DD, no payment writes, no automatic emails. Phase E webhook remains the sole payment blocker.

## Part 1 — Audit findings

Existing tables relevant to support / queues:

- `support_tickets` — customer-facing ticketing (replies, statuses). Not a fit for internal staff task queue (mixes customer messages).
- `complaints` — formal complaint workflow with regulatory implications. Separate concern.
- `communications_log` — log of comms sent/received. Read-only history.
- `activity_log` / `audit_logs` — append-only audit trails.
- `journey_internal_notes` (Phase G0) — per-customer free-form notes, not a workflow queue.
- No `tasks` / `admin_tasks` table exists.

Conclusion: there is no existing admin task queue. A new dedicated `admin_tasks` table is needed; existing tables are not reshaped.

## Part 2 — New table `public.admin_tasks`

Columns:

- `id uuid pk`
- `task_number text unique` (generated, e.g. `TSK-000123`)
- `title text not null`
- `description text`
- `priority text` check in (`low`,`medium`,`high`,`urgent`), default `medium`
- `status text` check in (`open`,`in_progress`,`waiting_customer`,`waiting_supplier`,`resolved`,`cancelled`), default `open`
- `related_customer_id uuid` (profiles.id, nullable)
- `related_account_number text` (optional convenience)
- `related_quote_id uuid` (nullable)
- `related_contract_summary_id uuid` (nullable)
- `related_payment_request_id uuid` (nullable)
- `assigned_to uuid` (auth user, nullable)
- `due_date timestamptz`
- `created_by uuid not null` (auth user)
- `created_at`, `updated_at` (trigger)
- `cancelled_at`, `resolved_at`

Plus `public.admin_task_notes`:

- `id`, `task_id fk`, `author_id`, `body text`, `created_at`

### GRANTs + RLS

- `GRANT SELECT, INSERT, UPDATE ON public.admin_tasks TO authenticated; GRANT ALL TO service_role;` (no `anon`).
- RLS: all policies gated by `public.has_role(auth.uid(),'admin')`.
- No DELETE policy — cancellation is soft via `status='cancelled'`.
- Same pattern for `admin_task_notes`.

### Triggers

- `updated_at` trigger.
- `task_number` generator (sequence-backed, `TSK-` + zero-padded id).
- AFTER INSERT/UPDATE → write to `audit_logs` (entity `admin_task`).

No triggers touch payments, services, invoices, DD, provisioning, or send emails.

## Part 3 — Suggestion helpers (no auto-create)

Pure client-side derivation in `src/lib/tasks/suggestions.ts` that reads existing journey state (quotes pending acceptance, payment_requests awaiting confirmation, missing readiness items) and returns suggestion objects `{ title, description, prefill }`. Admin must click **Create task** to persist — nothing inserts on page load.

## Part 4 — Files to create

- `supabase/migrations/<ts>_admin_tasks.sql` — table, grants, RLS, triggers
- `src/lib/tasks/types.ts` — TS types/enums
- `src/lib/tasks/suggestions.ts` — derivation only, pure
- `src/pages/admin/Tasks.tsx` — list, filters (status/priority/assignee), Create-task button
- `src/components/admin/tasks/TaskListTable.tsx`
- `src/components/admin/tasks/TaskFilters.tsx`
- `src/components/admin/tasks/TaskFormDialog.tsx` — create/edit, links to customer/quote/CS/PR
- `src/components/admin/tasks/TaskDetailDrawer.tsx` — status update, notes, links out to Customer Journey / Quote / Payment Request
- `src/components/admin/tasks/TaskSuggestionsPanel.tsx` — non-persistent suggestions

## Part 5 — Files to edit

- `src/App.tsx` — register `/admin/tasks` route + lazy import
- `src/components/admin/layout/AdminLayout.tsx` — sidebar entry "Tasks" (ClipboardList icon)
- `src/pages/admin/CustomerDetail.tsx` — add header link "Open tasks for this customer" (filter param only, read-only nav)

## Part 6 — Customer visibility

None. No customer route, no public RLS, no surfaced fields in `Dashboard`. Suggestion strings stay admin-only.

## Part 7 — Side-effect guarantees

No code path in this phase writes to: `payment_requests`, `quotes`, `quote_requests`, `contract_summaries`, `services`, `invoices`, `dd_mandates`, `orders`, `installation_bookings`, `provisioning_readiness`. No edge functions added. No `pg_net` calls. No `email_templates` invoked.

## Part 8 — Verification plan

- Admin: create / update status / add note / soft-cancel a task — works.
- Customer auth: `select from admin_tasks` → RLS denies.
- Anon: denied.
- Wrong-user RPC: denied.
- DB row counts before/after I0 actions for restricted tables → unchanged.
- Inbox / edge-function logs → no email sends triggered.
- `tsc --noEmit` and Vite production build → pass.

## Part 9 — Final report shape

Will report: audit findings, migration summary, files changed, task queue behaviour, RLS results, audit-log result, no-side-effect result, no downstream artefacts result, build result, and explicit confirmation that Phase E webhook signing secret remains the only blocker before supplier-order planning.
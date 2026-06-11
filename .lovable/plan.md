Approved — proceed with Phase H0: Admin Launch Safety Dashboard / System Readiness Audit.

This phase is read-only visibility only.

Do not start supplier ordering.  
Do not activate services.  
Do not create invoices.  
Do not create DD mandates.  
Do not trigger provisioning.  
Do not change Worldpay/payment logic.  
Do not send automatic emails.  
Do not mark Phase E complete.

Mandatory corrections before build:

1. Secret masking

The launch-safety-report edge function must return booleans only.

Allowed:

- worldpay_live_mode true/false
- worldpay_entity_id_present true/false
- worldpay_api_username_present true/false
- worldpay_api_password_present true/false
- worldpay_webhook_secret_present true/false
- contract_pdfs_bucket_exists true/false
- supplier_submission_enabled false

Do not return:

- API username
- API password
- Entity ID value
- webhook secret
- Authorization header
- Worldpay checkout URL secrets
- customer PII

2. VAT masking

If VAT number is shown, mask it.

Allowed:

- VAT active true/false
- VAT number present true/false
- masked VAT like `GB*******789`

Do not show full VAT number if avoidable.

Also include a warning if VAT looks like a placeholder/test value.

3. Webhook status wording

Even if `WORLDPAY_WEBHOOK_SECRET` is present, do not mark Payment as ready unless there is proof that:

- a valid signed webhook marked a test PR paid
- `webhook_verified=true`
- amount/currency matched
- invalid signature/wrong amount was rejected

Until then, payment card must show:

`Blocked — live signed webhook verification pending`

4. No side effects

Opening `/admin/launch-safety` must not write anything.

No inserts.  
No updates.  
No deletes.  
No payment state changes.  
No email sends.  
No webhook calls.  
No supplier/service/invoice/DD/provisioning writes.

5. Counts only, no PII

Audit cards may show counts only.

Do not show:

- customer names
- emails
- phone numbers
- addresses
- account numbers
- payment tokens
- provider references
- raw webhook/payment data

6. Admin-only access

The page and edge function must be admin-only.

Required:

- ProtectedAdminRoute on frontend
- edge function verifies JWT
- edge function checks admin role
- normal customer blocked
- anon blocked

Approved build scope:

- `/admin/launch-safety`
- readiness cards
- blocker list
- go-live warning banner
- config presence checks
- masked VAT check
- safe operational counts
- sidebar link
- edge function `launch-safety-report`

Verification required:

A — admin access:

- admin can open `/admin/launch-safety`
- all cards render
- banner shown
- blockers shown

B — customer/anon denial:

- normal customer blocked
- anon blocked
- launch-safety-report denied without admin JWT

C — secret safety:

- network payload contains no secret values
- only booleans/masked values

D — card accuracy:

- Quote Capture ready
- Account Linking ready
- Quote Approval ready
- Contract Summary ready
- Payment blocked
- Provisioning Readiness prepared but locked
- Supplier Ordering locked
- Service Activation locked
- Billing/Invoices/DD locked
- Communications draft-only

E — no side effects:  
Before/after counts unchanged for:

- payment_requests
- orders
- services
- invoices
- dd_mandates
- installation_bookings
- communications_log
- provisioning_readiness
- draft_order_packs

F — build:

- TypeScript passes
- Vite production build passes

Final report must include:

- files changed
- edge function result
- readiness cards result
- blocker list result
- config checks result
- secret masking result
- admin-only access result
- customer/anon denial result
- no-side-effect result
- no downstream artefacts result
- TypeScript/build result
- confirmation that Phase E webhook remains the blocker before supplier-order planning  
  
Phase H0 — Admin Launch Safety Dashboard

Read-only, admin-only visibility page that aggregates operational readiness, configuration checks, blockers, and audit counts. No writes, no emails, no payment/supplier/service changes. Phase E webhook remains the gating blocker.

## Scope

- Adds one admin page `/admin/launch-safety`.
- Adds one Supabase Edge Function `launch-safety-report` for safe config/secret presence checks (returns booleans only).
- No DB migration, no schema change, no business state writes.

## Part 1 — New files

- `src/pages/admin/LaunchSafety.tsx` — page shell, cards, banner, blocker list, counts. Wrapped by existing `ProtectedAdminRoute` via App.tsx route registration.
- `src/components/admin/launch/ReadinessCard.tsx` — small card primitive (title, status pill: ready / blocked / locked / draft-only / prepared, bullet facts).
- `src/components/admin/launch/BlockerList.tsx` — hard-blocker list.
- `src/components/admin/launch/GoLiveBanner.tsx` — "safe for controlled testing only" banner.
- `src/lib/launchSafety/checks.ts` — pure derivation helpers (statuses + labels). No DB writes.
- `supabase/functions/launch-safety-report/index.ts` — admin-gated edge function (verifies JWT + `has_role(...,'admin')`). Returns:
  - `worldpay_live_mode`: boolean (from `WORLDPAY_LIVE_MODE`)
  - `worldpay_entity_id_present`, `worldpay_api_username_present`, `worldpay_api_password_present`, `worldpay_webhook_secret_present`: booleans
  - `expected_webhook_url`: fixed string
  - `contract_pdfs_bucket_exists`: boolean (storage.list bucket)
  - `supplier_submission_enabled`: false (mirrors `SUPPLIER_SUBMISSION_ENABLED`)
  - No secret values ever returned.

## Part 2 — Edited files

- `src/App.tsx` — lazy route `<Route path="launch-safety" element={<LaunchSafety/>}/>` inside the existing admin protected branch.
- `src/components/admin/layout/AdminLayout.tsx` — add sidebar link "Launch Safety" (admin only, already gated).

## Part 3 — Data sources (read-only)

Counts via `supabase.from(...).select('id', { count: 'exact', head: true })` against:

- `quote_requests`
- `quotes` filtered `status in ('approved','sent')`
- `contract_acceptances`
- `payment_requests`
- `payment_requests` filtered `status='paid' AND webhook_verified=true AND paid_at IS NOT NULL`
- `provisioning_readiness`
- `draft_order_packs`
- `services`, `invoices`, `dd_mandates`

Latest/most-recent for Quote Capture card: `quote_requests` max `created_at`. VAT info via existing `usePlatformSettings()` (`vatActive`, masked VAT number — only show last 4 chars). No PII columns selected.

## Part 4 — Card statuses (hard-coded business truth this phase)


| Card                    | Status              | Source                              |
| ----------------------- | ------------------- | ----------------------------------- |
| Quote Capture           | ready               | count + last date                   |
| Account Linking         | ready               | static facts                        |
| Quote Approval          | ready               | static (margin guard live)          |
| Contract Summary        | ready               | bucket check + counts               |
| Payment                 | blocked             | Phase E pending                     |
| Provisioning Readiness  | prepared but locked | `SUPPLIER_SUBMISSION_ENABLED=false` |
| Supplier Ordering       | locked              | not built                           |
| Service Activation      | locked              | not built                           |
| Billing / Invoices / DD | locked              | not built                           |
| Communications          | draft-only          | journey templates `auto_send=false` |


## Part 5 — Hard blockers list (static)

Real Live Worldpay webhook signing secret · valid signed webhook PR transition · invalid webhook/wrong amount rejection · supplier order phase · service activation phase · billing/DD/invoice automation.

## Part 6 — Banner

Fixed copy: "OCCTA is safe for controlled quote/contract/payment-page testing only. It is not yet safe for full live customer provisioning."

## Part 7 — Security

- Page wrapped by existing `ProtectedAdminRoute`.
- Edge function: verify `Authorization` Bearer JWT → `auth.getUser()` → `has_role(user.id,'admin')`; deny otherwise. CORS headers per project standard.
- No secret values returned, only `*_present` booleans.
- No PII fields selected anywhere on this page.

## Part 8 — Verification

- Admin opens `/admin/launch-safety` → all cards render, banner shown, blockers shown, counts shown.
- Customer + anon hit page → access denied (existing `ProtectedAdminRoute`).
- Network payload inspection: no secret values; only booleans + counts.
- Zero-delta check: before/after row counts unchanged on `services`, `invoices`, `dd_mandates`, `payment_requests`, `orders`, `installation_bookings`, `communications_log`.
- `tsc --noEmit` + Vite build pass.

## Explicitly NOT touched

Worldpay edge functions, payment_requests writes, billing, supplier APIs, services/invoices/dd_mandates/orders/installation_bookings, auto-email triggers, cron, Phase E webhook secret. Phase E remains the sole payment blocker before supplier-order planning.
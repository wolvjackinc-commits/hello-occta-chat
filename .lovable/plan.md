Approved — proceed with Phase F0: Post-Payment Readiness Pack / Admin Provisioning Checklist, with the corrections below.

This is preparation only.

Do not start supplier ordering.  
Do not submit supplier orders.  
Do not activate services.  
Do not create live telecom orders.  
Do not create DD mandates.  
Do not trigger provisioning.  
Do not create invoices.  
Do not touch Worldpay/payment logic.  
Do not mark Phase E complete.

Current blocker:  
Phase E is still on hold until the real Worldpay Live webhook signing secret is obtained and a valid signed webhook marks a payment as paid with `webhook_verified=true`.

Therefore, Phase F0 must only prepare admin readiness views and must not allow any real progression beyond readiness display.

Mandatory correction 1 — DB-level draft pack guard

Do not rely only on frontend checklist logic.

Add a DB-level guard/trigger on `draft_order_packs` insert.

Draft Order Pack insertion must require:

- payment_request exists
- payment_request.status = `paid`
- payment_request.webhook_verified = true
- payment_request.paid_at is not null
- contract_summary.status = accepted
- contract_acceptance row exists
- accepted PDF exists with pdf_storage_key and pdf_sha256
- quote.status = contract_summary_accepted
- quote_request.status = contract_summary_accepted

If these do not pass:

- block insert
- return clear error:  
`verified payment required before draft order pack generation`

Because Phase E is not fully complete, current live/internal records should not be able to generate a Draft Order Pack.

Mandatory correction 2 — append-only draft packs

`draft_order_packs` should be append-only.

- admins can INSERT
- admins can SELECT
- no UPDATE
- no DELETE
- service_role only for controlled maintenance if needed
- version increments per payment_request_id

If a pack must change later, create a new version. Do not silently edit old packs.

Mandatory correction 3 — admin-only RLS

Use the project’s existing staff/admin helper consistently.

If the project uses `is_staff(auth.uid())`, use that.  
If it uses `has_role(auth.uid(),'admin')`, confirm it includes the intended admin/staff roles.

Required:

- anon no access
- normal customer no access
- admin/staff access only
- customer dashboard must not import or query readiness/order-pack tables

Mandatory correction 4 — no supplier/provisioning handler

The disabled “Submit to supplier” button is allowed only as a disabled placeholder.

Required:

- no working onClick
- no edge function
- no DB function
- no API call
- no supplier order table creation
- no service creation
- no provisioning write
- no invoice/DD write

Keep `SUPPLIER_SUBMISSION_ENABLED = false`.

If any future handler exists, it must immediately throw and write no data.

Mandatory correction 5 — read-only view must not mutate

Opening `/admin/readiness` must not create records automatically.

Allowed:

- read computed checklist data
- admin manually saves checklist ticks into `provisioning_readiness`

Not allowed:

- auto-create draft packs
- auto-create provisioning rows
- auto-create service rows
- auto-change payment status
- auto-change quote/CS status

Approved build scope:

1. Add admin-only `/admin/readiness`.
2. Show accepted CS/payment chain readiness checklist.
3. Show current records as “Awaiting verified payment” when payment is not webhook-verified.
4. Allow admin checklist ticks only in `provisioning_readiness`.
5. Allow Draft Order Pack generation only after DB guard confirms verified payment.
6. Keep supplier submission locked and disabled.
7. Add admin-only printable Draft Order Pack view.
8. Confirm customer/no-auth access blocked.
9. Confirm no supplier/service/invoice/DD/provisioning writes.

Verification required:

A — open readiness page as admin:

- page loads
- unpaid/unverified records show “Awaiting verified payment”
- PR-2606-LIVE1 / PR-2606-0007 style records do not qualify for draft pack

B — try generating Draft Order Pack before webhook-verified payment:

- blocked by DB guard
- no pack row created

C — admin checklist ticks:

- admin can save installation/router/internal review ticks
- normal customer cannot

D — disabled supplier button:

- visible only as locked/disabled placeholder
- no handler creates anything

E — access control:

- non-admin redirected/blocked
- anon direct table access returns no rows
- customer cannot query readiness/order pack data

F — no downstream artefacts:  
Confirm zero new:

- supplier orders
- services
- provisioning rows
- telecom orders
- invoices
- DD mandates
- installation bookings unless manually unrelated

G — build:

- TypeScript passes
- Vite production build passes

Final report must include:

- files changed
- migrations added
- DB draft-pack guard result
- append-only draft pack result
- readiness checklist behaviour
- “Awaiting verified payment” behaviour
- admin checklist tick behaviour
- disabled supplier button result
- admin-only RLS result
- customer/anon denial result
- no downstream artefacts result
- TypeScript/build result
- confirmation that Phase E webhook sign-off remains the blocker before real supplier ordering  
  
  
Phase F0 — Post-Payment Readiness Pack (Preparation Only)

Pure preparation layer. Adds an admin-only view that surfaces the accepted-quote → accepted-CS → payment-request chain, runs a readiness checklist, and generates a read-only "Draft Order Pack". **No supplier orders, services, invoices, DD mandates, provisioning rows, or activations are created or mutated.**

## Part 1 — Audit findings (already gathered)

What exists today:

- `orders` (legacy customer-initiated orders), `services` (admin-write only), `installation_bookings`, `installation_slots`, `technicians`.
- `supplier_profiles`, `supplier_products`, plus 3 admin import edge functions (`admin-import-supplier-products`, `admin-upsert-supplier`, `admin-upsert-supplier-product`). These are catalogue-management only — no order submission.
- `quotes`, `quote_requests`, `contract_summaries` (+ `contract_acceptances` append-only), `payment_requests`, `payment_attempts`, `payment_request_events`.
- Admin pages: `Orders.tsx`, `Services.tsx`, `Installations.tsx`, `PaymentRequests.tsx`, `Quotes.tsx`, `Suppliers.tsx`, `SuppliersGiacomImport.tsx`.

What does NOT exist (and stays that way for F0):

- No `supplier_orders` table, no `order_status_history`, no provisioning tables.
- No DB functions matching `%supplier%`, `%provision%`, `%activate%`.
- No edge function that submits to Giacom/DWS/ICUK or activates a service.

Reusable: `payment_requests`, `contract_summaries`, `contract_acceptances`, `quotes`, `supplier_products`, `installation_slots`.
Untouched: Worldpay functions, webhook verification, billing automation, DD code, invoice generation, rewards, campaigns.

Conclusion: nothing in the codebase can currently submit a supplier order or auto-activate a service. Safe to add a read-only readiness layer.

## Part 2 — Readiness checklist (admin-only)

New admin page `**/admin/readiness**` ("Provisioning Readiness") listing every accepted Contract Summary with its linked payment request, newest first. Each row expands into a checklist:

```text
[x] Customer profile exists
[x] Account number assigned
[x] Quote request linked
[x] Final quote approved
[x] Contract Summary accepted
[x] Accepted CS PDF present (storage_key + sha256)
[x] Payment request exists
[ ] Payment status = paid
[ ] webhook_verified = true
[ ] paid_at not null
[x] Supplier product assigned (from quote.supplier_product_id)
[ ] Installation/setup choice confirmed (admin tick)
[ ] Router choice confirmed (admin tick)
[x] Address/postcode confirmed
[x] Customer contact confirmed
[ ] Internal admin notes reviewed (admin tick)
[ ] Admin final review complete (admin tick)
```

Computed checks come from existing rows. The five admin-tick items are stored in a new `provisioning_readiness` table (see Technical section). A row is "ready" only when **all** checks pass — but for F0 we never submit, we just display.

Top-of-row status label (Part 6):

- payment not verified → **"Awaiting verified payment"**
- payment verified, ticks incomplete → **"Payment verified — ready for admin review"**
- ticks complete, no draft pack → **"Admin review complete"**
- draft pack generated → **"Draft order pack prepared"**
- always show secondary tag: **"Supplier order not yet submitted"**

Because the Live webhook secret isn't in place, virtually every real row will sit at "Awaiting verified payment" — that is expected and correct.

## Part 3 — Draft Order Pack (read-only)

When all checklist items pass, admin can click **"Generate Draft Order Pack"**. This inserts one row into `draft_order_packs` (snapshot JSON) and renders a printable pack containing:

- customer name, account number, service address, postcode, email, phone
- quote_number, cs_number, payment_request_number
- selected package (plan_name, plan_type, monthly £ inc/ex VAT, contract length)
- supplier product assignment (supplier_name, supplier_product_id, internal SKU)
- router/setup choice, installation notes, customer notes
- admin checklist snapshot + reviewer name/timestamp

No supplier API call, no service row, no invoice, no DD mandate, no provisioning row. Pack is regenerable (versioned) and downloadable as HTML/print.

## Part 4 — Data safety

- `provisioning_readiness` and `draft_order_packs`: RLS allows `authenticated` only via `has_role(auth.uid(),'admin')`; `service_role` full. No `anon` grant. No customer-facing routes, hooks, or RPCs read these tables.
- Pack rendering uses an admin-only React route under `ProtectedAdminRoute`. Customer dashboard untouched.
- Supplier cost, margin, supplier internal IDs, admin notes, and pack contents never appear in any customer query or component.

## Part 5 — Future-proof guard

Any "Submit to supplier" / "Activate service" / "Provision" button shipped now (in the new readiness page only) is rendered **disabled** with tooltip + label:

> "Supplier order is locked until verified payment is received."

There is no handler wired up — the button literally has no onClick that performs supplier/service/invoice/DD writes. A code-level constant `SUPPLIER_SUBMISSION_ENABLED = false` is exported from `src/lib/provisioning/flags.ts` and asserted in the (placeholder) handler so any future regression throws.

## Part 6 — Status labels

Centralised in `src/lib/provisioning/status.ts`:
`awaiting_verified_payment | payment_verified_ready_for_review | admin_review_complete | draft_order_pack_prepared`.
Forbidden labels (`order_submitted`, `service_active`, `provisioned`, `live`) are not introduced.

## Part 7 — Verification

Manual QA against current data:

- Existing unpaid/unverified PRs (incl. `PR-2606-LIVE1`) appear with **"Awaiting verified payment"**, checklist greys out admin-tick items.
- `SELECT count(*)` before/after on `services`, `invoices`, `dd_mandates`, `orders`, `installation_bookings` to confirm zero deltas after exercising the new UI.
- Log into a non-admin session → `/admin/readiness` redirects (existing `ProtectedAdminRoute`); direct table SELECT via anon key returns 0 rows.

## Part 8 — Build checks

TypeScript + Vite production build run automatically by the harness after changes.

## Part 9 — Final report (delivered after build)

Will cover: audit findings, files added/changed, migration summary, checklist behaviour, draft-pack behaviour, payment-gate behaviour, admin-only access proof, customer no-access proof, zero supplier/service/invoice/DD/provisioning writes confirmation, TS/build result, and explicit note that everything past "Draft order pack prepared" remains blocked until the real Worldpay Live webhook secret lands and Phase E closes.

---

## Technical section

**Migration** (`supabase/migrations/<ts>_provisioning_readiness.sql`):

1. `CREATE TABLE public.provisioning_readiness` — `id`, `payment_request_id` (FK, unique), `contract_summary_id` (FK), `installation_confirmed bool`, `router_confirmed bool`, `internal_notes_reviewed bool`, `admin_review_complete bool`, `reviewer_user_id uuid`, `reviewer_notes text`, `created_at`, `updated_at`.
2. `CREATE TABLE public.draft_order_packs` — `id`, `payment_request_id` (FK), `contract_summary_id` (FK), `version int`, `snapshot jsonb`, `generated_by uuid`, `generated_at`, `created_at`.
3. GRANTs: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`; `ALL` to `service_role`. No `anon`.
4. `ENABLE ROW LEVEL SECURITY` on both.
5. Policies: `USING (has_role(auth.uid(),'admin'))` (and `WITH CHECK` same) for all ops; `draft_order_packs` is insert-only for admins (no UPDATE/DELETE policy → effectively append-only).
6. `update_updated_at_column` trigger on `provisioning_readiness`.

**Frontend**:

- `src/lib/provisioning/flags.ts` — `SUPPLIER_SUBMISSION_ENABLED = false`.
- `src/lib/provisioning/status.ts` — status enum + label map.
- `src/lib/provisioning/checklist.ts` — pure computation from PR + CS + quote + profile.
- `src/pages/admin/Readiness.tsx` — list + detail dialog + checklist toggles + "Generate Draft Order Pack" (gated) + disabled "Submit to supplier" button.
- `src/components/admin/readiness/DraftOrderPackView.tsx` — printable read-only render.
- Route registered in `App.tsx` under `ProtectedAdminRoute`; nav entry added to `AdminLayout` sidebar.

**Explicitly NOT touched**: `services`, `invoices`, `dd_mandates`, `orders`, `installation_bookings`, `payment_requests` (no status writes), Worldpay edge functions, billing automation, AI chat, complaints, rewards, campaigns, finance exports.
&nbsp;

```

```

```
Approved — start Phase 3 only.

Apply these corrections before coding:

1. Do not duplicate existing enums
Check existing Phase 2 enums first. If `margin_status_kind` already exists, reuse it or create a clearly separate enum like `quote_margin_check_status`. Do not create conflicting enum names such as `margin_status` if it causes migration errors.

2. Quote/product linking
Do not assume the `quotes` table already has a proper FK to `supplier_products`.

If you need to link a quote to a supplier product, either:
- use the existing `quotes.supplier_product_id` field only if it matches the current schema safely, or
- store supplier/product/cost snapshot inside `quote_margin_checks`.

Do not add risky quote-table changes unless absolutely necessary.

3. Margin unknown should not hard-block
If no supplier product, pricing rule, or margin rule exists yet, margin status should be `unknown`, not `red`.

Rules:
- `red` = known bad margin or missing critical data after a margin rule is expected.
- `unknown` = not enough data yet.
- Only `red` blocks sending.
- `unknown` should show warning but still allow admin/sales process in this early setup.

4. Red override
Only `admin` and `super_admin` can override red margin.
`finance_admin` can manage VAT/pricing/margin rules but should not override a red quote unless you explicitly add that permission later.

5. VAT settings
VAT settings must be updated only through `admin-update-vat-settings`, not direct client table writes.

If `is_vat_active()` is not callable from the frontend because of RPC permissions, use an admin edge function to return VAT status safely.

6. VAT number logging
VAT number is business information, but still do not over-log it repeatedly. Activity log can record that VAT settings changed and old/new field names, but avoid unnecessary full snapshots if not needed.

7. Pricing rule activation
Do not allow `active=true` pricing rule if VAT settings are incomplete.

8. Send quote margin check
Update `send-quote-email` so:
- red latest margin check blocks sending unless override exists.
- amber allows sending but shows warning.
- unknown allows sending with warning.
- green allows sending.

9. Scope
Do not touch:
- Worldpay webhook/HPP
- invoices
- DD mandates
- AI chat
- SEO pages
- /pay
- /pay-invoice
- customer dashboard
- public /quote/* flow
- rewards
- campaign engine
- finance export centre
- live supplier API integration

10. Phase 3 stop point
After Phase 3, stop and report:
- migration/tables added
- functions added/changed
- admin pages added
- quote builder changes
- VAT settings behaviour
- margin guard behaviour
- RLS/policy summary
- activity logs added
- what was not touched
- verification result
- warnings/errors

Start Phase 3 only.
```

  
Phase 3 — Admin Pricing, Suppliers, VAT Settings & Margin Guard

Scope strictly Phase 3. No changes to Worldpay webhook, invoices, DD mandates, AI chat, SEO pages, `/pay`, `/pay-invoice`, customer dashboard, or `/quote/*` public flow. Manual Mode stays default ON.

## 1. Database migration (single migration)

New tables (all in `public`, with GRANT to `authenticated` + `service_role`, RLS enabled, `updated_at` trigger):

- `supplier_profiles` — fields as specified (supplier_name, supplier_type, status, contact_*, portal_url, api_mode, vat_treatment_notes, reverse_charge_possible, notes).
- `supplier_products` — FK `supplier_id → supplier_profiles`, fields as specified (product_name, service_type, supplier_product_id, technology, speed labels, cost fields nullable, vat rate, reverse_charge, active, notes).
- `plan_categories` — name, service_type, plan_type, description, active, display_order.
- `pricing_rules` — FK `plan_category_id`, optional `supplier_product_id`, all sell/VAT/gross fields, price_rise_policy, notice_period, active.
- `margin_rules` — service_type, plan_type, customer_type, margin floors + cost buffers, active.
- `quote_margin_checks` — FK `quote_id → quotes`, computed margins, status enum `unknown|green|amber|red`, reason, checked_at, checked_by.

Two new enums: `margin_status` and `supplier_api_mode`. Other categorical fields kept as TEXT with CHECK constraints to stay flexible.

RLS policies via existing helpers (`has_role`, `has_finance_access`):

- super_admin/admin/finance_admin: full read/write on suppliers, products, plan_categories, pricing_rules, margin_rules, quote_margin_checks.
- sales_agent: SELECT on suppliers/products/plan_categories/pricing_rules; INSERT on quote_margin_checks; no UPDATE on VAT/margin/pricing/supplier rows.
- support_agent/auditor: SELECT only.
- marketing_admin/compliance_admin: no access to these tables (auditor read still applies).

New DB functions (SECURITY DEFINER, `search_path = public`):

- `can_override_red_margin()` — true for super_admin/admin only.
- `compute_quote_margin(_quote_id uuid)` — pulls supplier_product cost from linked pricing_rule (if any) vs quote sell fields, applies active `margin_rules` buffers, inserts a `quote_margin_checks` row, returns status. Used by edge function.
- `can_send_quote(_quote_id uuid)` — returns boolean: blocks if latest margin check is `red` and no override row exists.

No changes to existing tables. `platform_settings` already has every VAT field needed.

## 2. Edge functions (new)

- `admin-update-vat-settings` — validates role (super_admin/admin/finance_admin), updates `platform_settings`, writes `vat_settings_updated` to `activity_log` with old/new diff (excluding nothing sensitive — VAT data only).
- `admin-upsert-supplier` / `admin-upsert-supplier-product` — role-checked, logs `supplier_*` events.
- `admin-upsert-pricing-rule` — role-checked, refuses to set `active=true` when `is_vat_active()` is false, logs `pricing_rule_*`.
- `admin-upsert-margin-rule` — role-checked, logs `margin_rule_*`.
- `run-quote-margin-check` — invokes `compute_quote_margin`, logs `quote_margin_checked`.
- `override-quote-margin` — super_admin/admin only, requires `reason` string ≥ 10 chars, inserts override row (a new `quote_margin_checks` row with status `green` + `reason` prefixed `OVERRIDE:` + `checked_by`), logs `quote_margin_override`.
- Existing `send-quote-email` updated to call `can_send_quote`; if false, returns 409 and logs `quote_blocked_low_margin`.

All functions: explicit CORS, JWT validation, Zod input validation, no secret/PII logging.

## 3. Admin pages (new, wrapped by `AdminLayout` + `ProtectedAdminRoute`)

- `src/pages/admin/VatSettings.tsx` — form for every listed `platform_settings` field. VAT scheme dropdown limited to "Standard VAT Accounting". Residential display locked to inclusive, business to "ex VAT + incl VAT" preview. Warning banner when VAT incomplete. Edit disabled for non-finance roles.
- `src/pages/admin/Suppliers.tsx` — list + create/edit dialogs for supplier_profiles, expand row to manage supplier_products (add/edit/pause/archive). No price-book upload yet (placeholder button disabled with tooltip "Coming in Phase 4").
- `src/pages/admin/PricingRules.tsx` — list + create/edit dialog. Selects plan_category + optional supplier_product. Auto-computes VAT amounts from `vat_default_rate` (override per row). Residential preview gross, business preview net+VAT+gross. Publish toggle disabled when VAT incomplete.
- `src/pages/admin/MarginRules.tsx` — list + create/edit dialog for margin floors and buffers per service_type/plan_type/customer_type.

Sidebar (`AdminLayout.tsx`) adds: VAT Settings, Suppliers, Pricing Rules, Margin Rules (grouped under a "Commercial" section above Quotes).

## 4. Quote Builder upgrade (`src/pages/admin/Quotes.tsx`)

In the create/edit quote dialog:

- Optional Supplier → Supplier Product → Plan Category cascading selects.
- "Auto-fill from supplier" button populates supplier cost fields on the quote (using `supplier_*_net` columns added to `quotes`? — NO new columns; we store cost snapshot inside `quote_margin_checks` only, leaving `quotes` schema untouched).
- "Auto-calc VAT" button computes `monthly_vat_amount` and `monthly_gross` from `monthly_net` × active VAT rate.
- "Run margin check" button → invokes `run-quote-margin-check`, displays Green/Amber/Red badge with reason.
- Red badge disables "Send Quote" for non-admins; admin/super_admin sees "Override & Send" requiring a reason textarea (≥10 chars) → calls `override-quote-margin` then `send-quote-email`.
- VAT inactive banner remains.
- Customer dual preview: residential incl VAT / business ex+incl VAT.

Supplier/product fields are **optional** — manual quotes without them simply yield margin status `unknown` (not red).

## 5. Admin Overview cards (`src/components/admin/overview/KPICards.tsx`)

Append (do not remove existing):

- VAT settings status (Active / Incomplete) → links `/admin/vat-settings`.
- Suppliers active count → `/admin/suppliers`.
- Supplier products active count → `/admin/suppliers`.
- Pricing rules active count → `/admin/pricing-rules`.
- Low-margin quotes (latest check amber) → `/admin/quotes?margin=amber`.
- Quotes blocked by margin (latest check red, not overridden) → `/admin/quotes?margin=red`.
- API mode (manual/live) → `/admin/vat-settings`.
- SIM checkout mode → `/admin/vat-settings`.

KPICards grid stays brutalist; switch to wrap layout to fit the new cards.

## 6. Routes (`src/App.tsx`)

Add inside `/admin/*` above catch-all:

- `vat-settings` → `AdminVatSettings`
- `suppliers` → `AdminSuppliers`
- `pricing-rules` → `AdminPricingRules`
- `margin-rules` → `AdminMarginRules`

## 7. Activity logging

All sensitive writes call `log_event` server-side with the event types listed in the request. Client never logs supplier costs, VAT numbers, margin amounts, or override reasons — only low-risk "page_view"/"cta_click" via existing `logClientEvent`.

## 8. Verification (post-build smoke test)

- New admin routes render under AdminLayout.
- VAT settings save round-trip + warning visibility.
- Supplier + product CRUD + pause/archive.
- Pricing rule CRUD + publish gate when VAT incomplete.
- Margin rule CRUD.
- Quote builder: auto-VAT, margin check, red block + admin override.
- `send-quote-email` rejects red quotes without override.
- Existing `/quote/start`, `/quote/:token`, `/quote/contract-summary/:token`, `/checkout` gate, `/pay`, `/pay-invoice`, `/`, `/dashboard`, `/admin/overview`, `/track-order` untouched and rendering.

## What is NOT touched

Worldpay HPP/webhook, invoices, DD mandates, AI chat, SEO pages, `/pay`, `/pay-invoice`, customer dashboard, public `/quote/*` flow, rewards engine, campaign engine, finance export, ICUK live integration, existing edge functions other than `send-quote-email`.

## Files

- Migration: `supabase/migrations/<ts>_phase3_commercial.sql`
- Edge functions: `admin-update-vat-settings`, `admin-upsert-supplier`, `admin-upsert-supplier-product`, `admin-upsert-pricing-rule`, `admin-upsert-margin-rule`, `run-quote-margin-check`, `override-quote-margin` + edit `send-quote-email`.
- New pages: `VatSettings.tsx`, `Suppliers.tsx`, `PricingRules.tsx`, `MarginRules.tsx`.
- Edits: `App.tsx`, `AdminLayout.tsx`, `KPICards.tsx`, `Quotes.tsx`.
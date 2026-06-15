
# OCCTA Website Completion Sprint

Goal: ship a launch-ready site with verified payment flow and a **manual** fulfilment model. No supplier API calls, no auto-services, no auto-invoices, no auto-DD, no auto-provisioning.

---

## 1. Public website polish

Audit + tighten each page, fix copy/CTA/responsive issues. No structural rewrites unless broken.

- **Home** (`src/pages/Index.tsx`) — hero CTAs (Check availability / Get quote / Contact), trust signals, services strip.
- **Broadband** (`src/pages/Broadband.tsx`) + `broadband/Flex.tsx`, `ContractSaver.tsx`, `NoContractBroadband.tsx`, `LocationBroadband.tsx`.
- **SIM** (`src/pages/SimPlans.tsx`) — keep if live, otherwise hide from nav.
- **Digital Voice / Home Phone** (`src/pages/Landline.tsx`) — reframe as Digital Voice; emergency-call wording; remove "standalone landline" framing.
- **Business** (`src/pages/Business.tsx`, `BusinessOffers.tsx`, `BusinessSales.tsx`).
- **About** (`src/pages/About.tsx`), **Support/Contact** (`src/pages/Support.tsx`), **FAQ** (`src/pages/Faq.tsx`).
- **Header/Footer** — ensure Digital Voice replaces "Home Phone" where it implies standalone; legal links present in footer.

**Rule:** landline appears **only** as a Digital Voice add-on in checkout/bundle UI, never as a standalone purchase path.

## 2. Customer journey polish

- **Dashboard** (`src/pages/Dashboard.tsx` + `src/components/dashboard/tabs/*`):
  - Overview, Quotes, Contract Summaries, Invoices, Services, Timeline, Documents, Support, Account.
  - Fix empty states with friendly copy + next-step CTAs.
  - Surface Quote status → CS status → Payment status → "Awaiting fulfilment" badge after paid.
- **Post-payment confirmation**: `/pay/_internal` already safe; ensure invoice success screen + Dashboard reflect "Payment received — we'll contact you with next steps".
- **No internal data leak**: hide supplier name, wholesale cost, margin, internal notes from all customer views. Audit `ServicesTab`, `InvoicesTab`, `ContractSummariesTab`, `OrderTracking`.

## 3. Admin dashboard polish

Confirm sidebar links + each page renders and is usable:

- Overview, Quotes, Quote Requests, Contract Benefits, Customers, Customer Detail/Journey, Orders, Payment Requests, Payments/DD, Services, Installations, Suppliers, Suppliers Giacom Import, Plans, Pricing Rules, Margin Rules, VAT, Fair Pricing, Compliance, Complaints, Tickets, Communications, Campaigns, Chat Transcripts, KB, Audit Log, Readiness, Launch Safety, Tasks, Settings.
- Add the new **Manual Fulfilment** entry (section 4).
- Fix table usability (empty states, loading, mobile horizontal scroll).

## 4. Manual Fulfilment / Supplier Order Tracker (NEW, admin-only)

A tracking-only record. **Never** touches suppliers, services, invoices, DD, or provisioning.

### New table `manual_fulfilment_orders`
Fields: `id`, `customer_id`, `account_number`, `payment_request_id`, `contract_summary_id`, `selected_product_label`, `supplier_product_ref`, `supplier_name`, `supplier_portal_reference`, `notes`, `status` enum (`ready_for_manual_order` | `order_entered_in_supplier_portal` | `supplier_acknowledged` | `installation_pending` | `active` | `cancelled`), `created_by`, `created_at`, `updated_at`, `activated_at`.

RLS:
- `service_role` full.
- `authenticated` `SELECT/INSERT/UPDATE` only when `has_role(auth.uid(), 'admin')`.
- No anon, no customer access.

### Eligibility guard (DB function + UI guard)
`can_create_manual_fulfilment(payment_request_id)` returns true only when:
- linked CS exists, `accepted_at not null`, `accepted_pdf_url not null`
- `payment_requests.status = 'paid'` AND `webhook_verified = true` AND `paid_at not null`
- `provisioning_readiness` checklist for CS marked complete
- admin "final review" flag set (new boolean on CS or readiness row — pick the least invasive)

Insert trigger calls the guard and raises if false.

### Admin UI
New page `src/pages/admin/ManualFulfilment.tsx` + row drawer:
- List with filter by status + customer search.
- "Create tracker" dialog: pick paid PR → auto-fills customer/CS/product → admin enters supplier choice + portal ref + notes.
- Status transitions via dropdown (audit-logged).
- Read-only "Mark service active" button: only flips tracker status to `active` and writes audit log. **Does not** create a `services` row, invoice, or DD unless an existing safe path already does so — to be confirmed by audit in section 6 before wiring.

### Hard guarantees
- No edge function calls Giacom/ICUK supplier APIs from this flow.
- No `services`, `invoices`, `dd_mandates`, `provisioning_readiness`, `installation_bookings`, `orders`, or `draft_order_packs` rows are written by tracker create/update.

## 5. Legal / compliance polish

Verify pages exist and are linked from footer + checkout consent: Terms, Privacy, Cookie, Acceptable Use, Complaints Code, Code of Practice, Switching, Vulnerable Customers, Price Transparency, Network Management, Modern Slavery, Accessibility. Ensure Digital Voice emergency-call wording is on Landline page + checkout. VAT display rules: residential incl. VAT, business excl. + explicit VAT line.

## 6. Service activation audit (read-only first)

Before exposing "Mark active" anywhere beyond the tracker, grep + read: any code path that, on a status flip, creates `services` / `invoices` / `dd_mandates` / calls supplier edge functions. Document findings. If unsafe automation exists, leave tracker status as cosmetic only and report.

## 7. Security sweep

- Confirm `ProtectedAdminRoute` wraps every `/admin/*`.
- RLS on new table + GRANTs (`authenticated`, `service_role`; no `anon`).
- Re-check customer-facing queries don't select supplier cost/margin/internal-note columns.
- No secrets in client; payment tokens remain hashed (existing standard).
- Run `supabase--linter` after migration.

## 8. UX fixes pass

Broken links, 404s, dashboard empty states, button clarity, mobile responsive (test 360/768/1280), readable success/error toasts, admin table overflow.

## 9. Build & verification

- TypeScript compile clean.
- Vite production build.
- Smoke route check: `/`, `/broadband`, `/business`, `/landline`, `/sim-plans`, `/about`, `/support`, `/faq`, `/auth`, `/dashboard`, `/admin/overview`, `/admin/manual-fulfilment`, `/pay/_internal`.
- Read-only DB sweep confirming zero downstream artefacts created by tracker.

## 10. Final report

Pages completed (public/admin/customer), tracker capabilities, what stays manual, what remains blocked, files changed, migrations added, RLS/lint results, build result, **launch readiness verdict**.

---

### Technical notes (for reviewer)

- New files: `src/pages/admin/ManualFulfilment.tsx`, `src/components/admin/manualFulfilment/{TrackerTable,CreateTrackerDialog,TrackerDetailDrawer}.tsx`, migration for `manual_fulfilment_orders` + enum + guard function + trigger + RLS + GRANTs, sidebar link in `AdminLayout`, route in `App.tsx` under `ProtectedAdminRoute`.
- Edits: minor copy/CTA tweaks on public pages; dashboard tab empty states; footer legal link audit; `Landline.tsx` framing.
- No edits to: `supabase/functions/worldpay-webhook`, `verify-payment`, billing automation, provisioning, supplier import functions.

### Out of scope (intentionally deferred)

Supplier API submission, automatic service creation, automatic invoicing on activation, automatic DD setup, automatic provisioning triggers — all remain locked until a future phase.

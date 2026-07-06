APPROVE SIM-ONLY SINGLE PRODUCTION PASS — WITH FINAL SIMPLIFICATION RULES

This plan is approved, but apply these final rules while implementing.

## Do not overbuild

Do not create phases, loops, placeholder pages, duplicate billing systems or unnecessary test infrastructure.

Build the SIM-only journey once, simply, production-ready, and seeded OFF until admin enables real SIM plans.

## Use existing billing worker names

Do not create or refer to a new `automated-billing` system if the live OCCTA billing uses:

- `process-first-billing`
- `process-recurring-billing`
- `generate-invoices` delegation

Extend the existing live billing pattern safely for SIM orders/services.

Do not fork billing.

## Keep Worldpay webhook safe

Only add a minimal `SIM-` reference branch to the existing Worldpay webhook.

Do not alter:

- HMAC verification;
- secrets;
- fail-closed behaviour;
- existing invoice/payment request handling;
- broadband payment logic.

## Keep checkout simple

SIM checkout must include only:

1. plan confirmation;
2. eSIM or physical SIM;
3. PAC/STAC/new number;
4. customer details;
5. payment method;
6. review and consent.

No unnecessary screens.

## Go-live safety

Keep:

- `standalone_enabled = false`
- no public active SIM plans seeded
- no fake SIM prices
- no fake network claims

Admin will create real SIM plans and enable checkout later.

## Verification

Run only necessary production-safe checks:

- typecheck/build;
- static check that SIM plan buttons do not route to broadband checkout;
- RLS check;
- one safe checkout flow check using non-live/test settings only;
- Ira guardrail check.

Do not create fake live customers.  
Do not charge real cards.  
Do not waste time on unnecessary Playwright loops if build/static/manual safe checks prove the flow.

## Final report required

Return only:

- files changed;
- routes created;
- tables/views created;
- SIM checkout result;
- admin fulfilment result;
- Worldpay result;
- DD result;
- billing result;
- Ira guardrail result;
- RLS/security result;
- build/typecheck result;
- what still requires real supplier/admin setup.

Proceed without asking for more approval unless there is a genuine blocker.

  
  
  
SIM-Only Build — Single Production Pass

Simple, additive, reuses every existing OCCTA subsystem. Nothing broadband/Contract Summary/Worldpay-webhook/DD-encryption/cancellation gets touched. Seeded OFF so nothing goes public until admin flips visibility.

---

## 1. One migration (additive, RLS + grants)

**Tables**

- `sim_settings` (singleton): `standalone_enabled` (default false), `esim_enabled`, `physical_sim_enabled`, `pay_monthly_enabled`, `payg_enabled`, `dispatch_lead_time_days` (4), timestamps.
- `sim_plans`: `slug`, `name`, `network_display_name` (nullable, customer-safe only), `plan_type` (`pay_monthly`|`payg`), `data_label`, `calls_label`, `texts_label`, `monthly_price_minor`, `first_payment_minor`, `setup_fee_minor`, `delivery_fee_minor`, `min_term_months`, `is_rolling`, `esim_available`, `physical_sim_available`, `vat_mode`, `vat_rate`, `is_active`, `checkout_visible`, `sort_order`, `terms_url`.
- `sim_orders`: `customer_id` nullable, `plan_id`, snapshot columns (`plan_name_snapshot`, `monthly_price_minor_snapshot`, `first_payment_minor_snapshot`, `vat_rate_snapshot`), `sim_type`, `esim_device_brand`, `esim_device_model`, `esim_eid`, `delivery_*`, `billing_*`, `number_choice` (`keep`|`new`|`new_with_stac`), `current_msisdn`, `current_provider`, `pac_code`, `pac_expiry`, `stac_code`, `preferred_transfer_date`, `payment_method` (`card`|`direct_debit`), `status`, `first_payment_paid_minor`, `first_payment_credit_minor`, `service_live_date`, `billing_anchor_day`, `iccid`, `provisioned_msisdn`, `provisioned_plan_name`, `port_requested_at/scheduled_at/completed_at`, `admin_notes`, `supplier_ref`, `worldpay_payment_request_id` (FK to `payment_requests`).
- `sim_esim_deliveries`: `order_id`, `qr_storage_path` (private bucket), `activation_code`, `sent_at`, `sent_by`.
- Private storage bucket `sim-esim-qr` (admin write, signed URL read).

**Public views** (only surface exposed to client): `sim_plans_public` (excludes admin fields, filters `is_active AND checkout_visible`), `sim_settings_public`.

**Grants + RLS**

- `sim_plans_public`, `sim_settings_public`: `SELECT` to `anon, authenticated`.
- `sim_orders`: `SELECT` own row (`customer_id = auth.uid()` or guest link), full to admin roles via `has_role`. `INSERT/UPDATE` via edge fns only (service_role). Admin-only columns (`admin_notes`, `supplier_ref`, cost fields) never appear in `sim_orders_customer` view exposed to dashboard.
- `sim_esim_deliveries`: admin-only; customer reads QR through signed URL emailed to them.

Statuses: `draft`, `awaiting_payment`, `payment_failed`, `paid`, `dd_mandate_pending`, `admin_review`, `esim_ready`, `esim_sent`, `physical_sim_pending`, `physical_sim_dispatched`, `pac_required`, `stac_required`, `port_requested`, `port_scheduled`, `port_completed`, `live`, `on_hold`, `failed`, `cancelled`.

## 2. Customer checkout (reuses existing UI kit and Worldpay flow)

**Routes added to `App.tsx**`:

- `/sim` — plan grid rebuilt from `sim_plans_public`. Legacy `/sim-plans` redirects to `/sim`.
- `/sim/checkout` (accepts `?plan_id=`)
- `/sim/order-success/:orderId`

**Plan cards** on `/sim` link to `/sim/checkout?plan_id=<id>` — never to `/pre-checkout` or `/checkout`. Remove `simPlans` usage from `SimPlans.tsx` (kept as thin marketing page reading catalogue) and delete the SIM plan buttons that point at `/pre-checkout`.

**Wizard** (`src/components/sim/checkout/*`, single page with stepper state):

1. Plan confirm — from `sim_plans_public`, change-plan link.
2. SIM type — options gated by `sim_settings_public`; eSIM collects brand/model + optional EID + Wi-Fi/QR-after-approval notice; physical collects delivery address + dispatch wording using `dispatch_lead_time_days`.
3. Number choice — keep / new / new+STAC / provide later. PAC copy "…text PAC to 65075", STAC copy "…text STAC to 75075". Missing code → status `pac_required` / `stac_required`. No exact port date promised.
4. Customer details — name, email, mobile, billing address (reuses `AddressAutocomplete`). Links existing account if logged in.
5. Payment method — card or DD (gated by existing platform settings + `sim_settings_public`).
  - Card: creates `payment_requests` row via new `sim-create-order` edge fn with ref `SIM-<orderId>`, then Worldpay HPP via the existing `worldpay-payment` builder + `WorldpayCheckout` component; returnUrl uses `getPaymentReturnOrigin()`.
  - DD: reuses existing DD encryption helpers (`dd_intake_requests` / `dd_mandates`). Only masked confirmation shown back. DD Guarantee + mandate consent required. Never collected at checkout; admin task auto-created on submit.
6. Review — full summary + required checkboxes (details correct, SIM T&Cs, first payment understanding, PAC/STAC consent if provided, DD Guarantee if DD).

**Order success page** shows chosen path (eSIM vs physical, PAC/STAC state, payment state) and next-steps content from the KB helper links table.

Guest checkout allowed for card path only (linked via `guest_orders`). DD requires an account.

## 3. Payment, invoice, receipt (reuses existing tables + Worldpay webhook)

**Edge functions** (new, minimal):

- `sim-create-order` — zod-validated. Recomputes price from `sim_plans` (never trusts client). Inserts `sim_orders` + (for card) `payment_requests` row; returns HPP URL from the existing Worldpay builder.
- `sim-dd-submit` — writes DD via existing encryption path; opens `admin_tasks` row `sim_dd_activation`.
- `sim-payment-verify` — called by `PaymentResult` when returning with ref `SIM-…`; marks order `paid`, sets `first_payment_paid_minor`, sends `sim-payment-success` email.

**Worldpay webhook**: existing `worldpay-webhook` HMAC-verified fail-closed path is extended with a `SIM-` branch that updates `sim_orders` + writes receipt via the existing helper — **no change to signature verification, secrets or fail-closed semantics**.

**Invoicing**: use existing `invoices`/`invoice_lines`/`receipts` tables. For card first payment: on `payment.completed` webhook write a receipt against a `SIM setup / first payment` invoice line (paid). For DD: no invoice until service live.

## 4. Admin fulfilment (single new admin area, one nav item)

- `src/pages/admin/SimPlans.tsx` — CRUD over `sim_plans` (list, edit, toggle `is_active`/`checkout_visible`) + `sim_settings` toggles.
- `src/pages/admin/SimOrders.tsx` (list + filters) and `SimOrderDetail.tsx` with sections Overview / Fulfilment / Porting / Billing / Notes.

Admin actions (each an edge fn that writes `audit_logs` + a customer-safe `activity_log` timeline event):

- Approve / reject / on-hold / cancel.
- Enter `iccid`, `provisioned_msisdn`, `provisioned_plan_name`, customer-safe network wording.
- Upload eSIM QR to private bucket → generate signed URL (15 min) → send `sim-esim-ready` email.
- Mark physical SIM dispatched (date, optional tracking, ETA).
- Record PAC/STAC status, port_requested/scheduled/completed.
- **Mark service live** → sets `service_live_date`, `billing_anchor_day` (customer-chosen or today), runs billing gate (§5).

Nav change: one "SIM Orders" item under the existing admin Orders group. Nothing else moved.

## 5. Billing from live date (uses existing billing worker)

Rule: billing starts at `service_live_date`. Any card first payment already taken is treated as a credit against the first aligned period so the customer is never charged twice.

On `mark-service-live` for card orders:

- Compute first period: live_date → next `billing_anchor_day`. Pro-rata `expected_first_period_minor` = `monthly_price_minor × billable_days / full_cycle_days`.
- Compare to `first_payment_paid_minor`:
  - `paid >= expected` → create the first invoice in `invoices`/`invoice_lines`, mark it paid, apply the existing receipt against it, park any excess as `first_payment_credit_minor` and apply on subsequent invoices until zero.
  - `paid < expected` → create the invoice for the balance and a new `payment_requests` row via existing flow, send `sim-invoice`.

For DD orders: first invoice created on live date, DD collection request enqueued via existing DD worker only if mandate active and advance-notice window met; otherwise `admin_tasks` fallback.

Subsequent months: existing `automated-billing` cron path is extended to iterate `sim_orders` with `status='live'` alongside broadband services (single new branch, same invoice/receipt/reminder pipeline). **No duplicate billing system.**

## 6. Emails (extend the existing template registry)

New `.tsx` templates in `supabase/functions/_shared/transactional-email-templates/` extending `BrandLayout` and registered in `registry.ts`:

- `sim-order-confirmation`, `sim-payment-success` (+ receipt), `sim-payment-failed`, `sim-dd-received`, `sim-esim-ready` (signed QR link, 15 min), `sim-physical-dispatched`, `sim-pac-required`, `sim-stac-required`, `sim-port-scheduled`, `sim-port-completed`, `sim-service-live`, `sim-invoice`, `sim-payment-reminder`, `sim-overdue-reminder`.

Wording follows brand memory: "Simple telecom. Clear terms.", no forbidden phrases, ADR wording preserved. Send path is `supabase.functions.invoke('send-transactional-email', …)` with per-event idempotency key.

## 7. Ira SIM guardrails

Update `supabase/functions/ai-chat/index.ts`:

- Load `sim_settings_public` + `sim_plans_public` at request time; expose as tool `list_active_sim_plans` for Ira.
- System prompt block: only quote SIM plan names, prices, allowances, network wording, eSIM/physical availability from that live data. Never invent handset/network wording. Never promise an exact port date. If `standalone_enabled=false` or no active plans, reply exactly: *"SIM-only availability, pricing and ordering options can vary. Please contact OCCTA support so we can confirm the latest option for you."*
- KB retrieval limited to the SIM articles seeded below.

## 8. KB seed (data-only via `supabase--insert`, no migration)

Insert into `kb_articles` (kebab-case slugs, brutalist wording):

- how-to-order-a-sim-only-plan
- esim-vs-physical-sim
- how-to-keep-your-number-with-a-pac
- what-is-a-stac
- what-happens-after-you-order-a-sim
- how-sim-delivery-works
- how-esim-activation-works
- sim-billing-and-first-payment-explained
- direct-debit-for-sim-plans
- sim-checkout-asking-for-broadband

## 9. Customer dashboard

Extend `OverviewTab.tsx` and `OrdersTimelineTab.tsx` to render `sim_orders` alongside broadband orders — using existing `EmptyState`, no new top-level tab, no reshuffling of existing tabs. Only customer-safe columns via a `sim_orders_customer` SQL view.

## 10. Seed & go-live safety

Insert single `sim_settings` row: everything `false` except `physical_sim_enabled=true` and `esim_enabled=true` capability flags; `**standalone_enabled=false**`, no `sim_plans` seeded. `/sim` renders an empty-state directing to support until admin creates and enables plans. Ira falls back to the safe line above.

## 11. Verification (production-safe, no real cards)

- Static: `rg` shows no `simPlans` (from `lib/plans.ts`) imports in the `/sim` route tree; SIM plan buttons never link to `/pre-checkout` or `/checkout`.
- Playwright: `/sim` (with admin-seeded test plan) → wizard for eSIM+card and physical+DD paths; asserts no navigation to `/pre-checkout` or broadband `/checkout`.
- SQL: anon `SELECT * FROM sim_orders` denied; customer sees only own; `admin_notes`/`supplier_ref` not present in `sim_orders_customer` view.
- Idempotency: replaying a `SIM-…` Worldpay webhook doesn't duplicate receipts.
- Billing gate: mark-service-live with `paid == expected` → zero-balance paid invoice, no extra collection; `paid > expected` → credit carried; `paid < expected` → balance `payment_requests` row.
- Ira: with `standalone_enabled=false`, model returns the fixed safe sentence.
- `bun run build` / `tsgo` clean.

## Out of scope (explicitly not touched)

Broadband `/pre-checkout`, `/checkout`, `/build-plan`, Contract Summary flow, `two_document_contract_flow_enabled`, Worldpay HMAC verification/secrets, DD encryption at rest, cancellation flow, existing invoices/receipts data, existing dashboard tabs, existing admin nav order (single item added), RLS on unrelated tables.

## Requires real supplier setup (not code)

- Real SIM supplier/network onboarding and ICCID/MSISDN provisioning (admin enters manually until a supplier API is contracted).
- Signing DD provider live activation for the SIM tariff (existing DD infra reused).
- Admin must create real `sim_plans` rows and set `checkout_visible=true` before any customer sees them.
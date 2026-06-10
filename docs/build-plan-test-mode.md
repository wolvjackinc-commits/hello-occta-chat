# Build Plan Test Mode (admin-only)

Internal admin fixture for verifying the Build Plan + resolver end-to-end
without sending real customer/admin emails or creating quotes/orders/payments.

## URL

`/build-plan?test=1&max_download=80&primary_technology=FTTC`

- `test=1` — enables test mode UI (bypasses ICUK availability gate).
- `max_download` — speed cap to simulate at the address.
- `primary_technology` — optional tech hint (FTTP, SOGEA, FTTC, …).

## Server enforcement

- `resolve-build-plan-price` honours `test_availability` **only** if the JWT
  belongs to a user with role `admin` or `super_admin`. Otherwise the field
  is ignored.
- `submit-build-plan` honours `test_mode: true` **only** for admins. In test
  mode it:
  - prefixes `quote_request.message` with `[TEST]`
  - sets `source = "build_plan_test"`
  - does **not** send customer or admin emails
  - does **not** create a `quote` row
  - does **not** create an order or payment link
- The frontend shows a toast after submit instead of redirecting.

## What test mode does NOT do

- Bypass rate limits.
- Bypass margin/eligibility logic — those still run normally.
- Affect any production data outside of one `quote_request` row marked `[TEST]`.
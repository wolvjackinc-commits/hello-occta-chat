## What's actually happening with OCC-20260616-4189

I traced the order end-to-end:

- `guest_orders` row exists, status = `active` (you marked it).
- `order_journeys` row is `completed` with the signed Contract Summary attached.
- **There is no `auth.users` row, no `profiles` row, no `orders` row, no `dd_mandates` row, no `invoices` row** for `webb.d2507@gmail.com`.

That's why nothing shows up in Customer 360 / the customer dashboard:

- Admin → Customers and Customer 360 are keyed off `profiles.account_number` and join everything by `user_id`.
- The customer dashboard requires the customer to be signed in (so it needs an `auth.users` row).
- Guest checkout only ever wrote to `guest_orders`. It never created the user, profile, `orders` row, or linked the contract / payment method to a customer id.

So this isn't a UI bug — the post-order "promote guest → customer" step has never existed. Here's what I'll build.

## The flow we'll add

```text
guest_orders.status -> active           (you do this in admin, today)
        |
        v
[Activate Customer] button on the
guest order / journey panel
        |
        v
promote-guest-to-customer edge function (one call, idempotent):
  1. create auth.users (invite, no password)            -> sends magic-link "set your password" email
  2. handle_new_user trigger creates profile + role + account_number (already exists)
  3. backfill profile: full_name, phone, dob, address, account_number
  4. insert orders row (linked to user_id, plan, addresses, dates, journey_id)
  5. update guest_orders.user_id + linked_at
  6. update contract_summaries.customer_id
  7. update order_journeys.linked_customer_id + linked_at
  8. update payment_methods.user_id + dd_mandates.user_id (if any)
  9. write audit log + activity_log
        |
        v
Admin -> Customers list now shows them
Admin -> Customer 360 (/admin/customers/OCC########) shows:
  - profile + contact + address + DOB
  - order (with plan/price/start date)
  - signed Contract Summary + PDF
  - payment method + DD details
  - journey timeline + internal notes
        |
        v
Customer clicks the magic-link email -> sets password -> /dashboard
Dashboard shows: order, contract summary PDF, payment method, DD status,
                 invoices (when billing runs), support, etc.
```

## What I'll change

### Backend

1. **New edge function `promote-guest-to-customer`** (admin-only, JWT-verified):
   - Input: `{ guest_order_id }`.
   - Idempotent: if `guest_orders.user_id` is set, just returns the existing customer.
   - Uses `supabase.auth.admin.inviteUserByEmail` (or `createUser` + reset link) so the customer gets a "set your password and access your account" email.
   - Performs all the linking steps above in one transactional block.
   - Logs to `audit_logs` and `activity_log`.

2. **Auto-promote on activation (opt-in safety):** when `guest_orders.status` flips to `active`, fire the same function from a trigger via `pg_net` (same pattern as `notify_dd_mandate_created`). So future orders don't need a manual click.

3. **Welcome email** ("Your OCCTA account is ready") with magic-link, contract summary PDF re-attached, plus the Direct Debit Guarantee block (per existing standards).

### Admin UI

4. **`/admin/orders` & guest-order detail:** add an **"Activate Customer"** button next to each unlinked guest order showing a "No customer account yet" badge. Clicking calls the new function and on success navigates to `/admin/customers/<account_number>`.

5. **Customer 360 (`CustomerDetail.tsx`):** already pulls orders/services/invoices/contract summaries/payment requests by `user_id`. Once linking lands, this just works — no UI rewrite needed. I'll add a small **Source / Journey** card that surfaces the originating quote, journey id, and the signed contract PDF download for completeness.

6. **Admin → Customers list:** I'll verify it lists the newly-promoted customer (it already filters on `profiles`, so it will).

### Customer dashboard

7. No data-shape changes needed; once the user signs in, the existing dashboard tabs (Overview, Orders, Contract Summaries, Payments, Documents, Support) all read by `auth.uid()` and will display the order, contract, DD info, etc.

### One-off backfill for OCC-20260616-4189

8. After deploying the function, I'll invoke it once for this specific guest order so `webb.d2507@gmail.com` immediately appears in Customer 360 and the customer gets their magic-link welcome email.

## Out of scope (ask separately if you want these)

- Auto-creating the first invoice / starting the billing cycle on activation.
- Booking an installation slot automatically.
- Provisioning to ICUK / supplier on activation.

Approve and I'll build it.
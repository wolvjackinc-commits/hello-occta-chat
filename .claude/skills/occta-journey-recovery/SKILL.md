---
name: occta-journey-recovery
description: Use for any OCCTA work on Journey Control, abandoned checkouts, checkout reminder emails, the recovery desk, or recovering customers who started an order and didn't finish. Covers where tracking lives, the two reminder senders, and the rules that keep reporting accurate and production safe.
---

# OCCTA journey recovery

Admin page: `/admin/journey-control` (`src/pages/admin/JourneyControl.tsx`).
It shows settings, the Journey 2 funnel, the **Checkout recovery desk**
(`src/components/admin/CheckoutRecoveryDesk.tsx`) and the **Checkout journey
monitor** (`CheckoutJourneyMonitor.tsx`).

## Where the truth lives

| Fact | Source |
|---|---|
| Session, stage, contact details (`customer_details.full_name/email/phone`) | `customer_journey_sessions` |
| Was ever abandoned (survives resume) | `activity_log` `event_type='checkout_abandoned'`, `details->>'journey_session_id'` |
| Reminder emails | `checkout_reminders` (`status='sent'` only counts as sent) |
| Staff recovery calls | `checkout_recovery_contacts` (append-only) |
| Do-not-contact | `customer_journey_sessions.recovery_opt_out_at` |
| Timeline | `admin_checkout_timeline` — any `activity_log` event named `checkout_%` shows up |

`abandoned_at` is cleared when the customer comes back, so never use it alone
for history — use the `checkout_abandoned` events.

## Two reminder senders — keep them in sync

Both run every 15 minutes:
- `process_checkout_tracking()` (SQL, cron `checkout-journey-monitor`) — the one that actually sends most emails.
- `supabase/functions/journey2-resume-email` (cron `checkout-abandoned-recovery-worker`).

Any rule about who must NOT be emailed goes in **both**: test sessions,
signed contracts (`contract_acceptance_id`, `post_contract_applied_at`,
status `contract_accepted`), `recovery_opt_out_at`, `suppressed_emails`,
and existing customers (`checkout_email_has_order()` / `hasPlacedOrder()`).

## Reporting rules

- Recovered = recorded abandoned **and** later completed. Nothing else.
- Reminder/call "before completion" is a touch, not a cause. Never claim attribution.
- A failed read is shown as an error, never as zero.
- Exclude `test_session` everywhere.
- Email is never compulsory: phone-only customers must still be workable on the desk.

## Making changes safely

1. Live DB can drift from repo SQL (Lovable edits). Before `CREATE OR REPLACE`
   of an existing function, read the live definition with
   `mcp__Lovable__query_database` (project `ea7adb26-38dd-437d-a03d-df03c03f3f22`)
   and diff it — e.g. compare `md5(prosrc)` with your reconstructed original.
2. Migrations must be idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS`).
3. Add or extend `scripts/checkout-recovery-db.test.mjs` (PGlite, fixture in
   `supabase/tests/checkout-recovery-fixture.sql`) and wire it into `ci.yml`.
4. Run: `node --test scripts/checkout-recovery-db.test.mjs`, `npx vitest run src/lib/journey`,
   `npm run typecheck`, `npm run lint`, then let CI pass on a PR before merging.
5. Don't use Lovable credits: code, merge and push yourself. Lovable syncs `main`,
   applies migrations and deploys edge functions. Verify in the live DB afterwards
   (`supabase_migrations.schema_migrations`, function bodies, a staff RPC call).
6. Payment is Direct Debit or bank transfer only — recovery copy must never offer card or phone payment.

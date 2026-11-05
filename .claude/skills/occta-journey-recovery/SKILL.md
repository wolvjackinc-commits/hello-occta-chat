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
| Emails actually sent / opened | `communications_log` `template_name='journey2_checkout_reminder_N'`, `metadata->>'session_id'` |
| Old order links | `customer_journey_token_aliases` (replaced link hashes → session) |

`abandoned_at` is cleared when the customer comes back, so never use it alone
for history — use the `checkout_abandoned` events.

## Two reminder senders — keep them in sync

Both run every 15 minutes:
- `supabase/functions/journey2-resume-email` (cron `checkout-abandoned-recovery-worker`) — **the only one that sends today**.
- `process_checkout_tracking()` (SQL, cron `checkout-journey-monitor`) — marks abandonment and reconciles; its email
  branch is dormant because vault `CRON_JOB_SECRET` is empty. If that secret is ever added, both would send — fix first.

Every new order link (reminder email, same-browser restart) must keep the old one working:
upsert the replaced hash into `customer_journey_token_aliases`. `journey2-session` `get`
resolves an alias, issues the current link and returns it as `token`; the page switches to it.
Provider 4xx (not 429) = permanent failure: close the sequence, don't retry daily.

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
5. Don't use Lovable credits: code, merge and push yourself. Lovable syncs `main` and
   deploys edge functions, but does **not** apply migrations: apply the SQL with
   `query_database` in one transaction, then
   `insert into supabase_migrations.schema_migrations(version,name)`. Verify function bodies with md5.
   Dry-run on live first inside a block that ends in `RAISE EXCEPTION` carrying the results.
6. Publish with `mcp__Lovable__deploy_project`, then confirm the live `JourneyControl-*.js` /
   order chunks on occta.co.uk contain the new code (fetch from the browser pane). If production
   doesn't change after ~2 publishes, Saurabh must click **Publish → Update** in the Lovable editor.
7. Payment is Direct Debit or bank transfer only — recovery copy must never offer card or phone payment.

## What the data has shown (Nov 2026)

- Reminder emails open ~63%; ~22% of reminder-1 recipients come back, but almost none finish — the leak is after the click.
- Flex 30 converts ~6% vs Price Lock 24 ~27%; Flex loses most people at router/extras, where £84.99 setup + router cost appear.
- Google CPC and ChatGPT referrals: ~0 completions; direct/organic carries almost all orders.

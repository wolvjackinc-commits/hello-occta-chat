# OCCTA Campaign Manager — Release candidate 2026-10-09

## Scope and separation
Adds the email marketing Campaign Manager at **Admin → Support → Campaign Manager** (or `/admin/communications?tab=campaigns`). It extends the existing Communications and template catalogue; the existing `/admin/campaigns` controls SWITCH50/offer campaigns and is unchanged. Customer billing, invoicing, contract evidence, Direct Debit, order journeys and transactional emails are not altered. No historic customer consent is backfilled. The legacy immediate-send endpoint is disabled on deployment to prevent bypassing campaign approval.

## Included
- Campaign dashboard, consent-verifiable CSV import (5,000 rows/file, processed in <=200 batches), deduplication, tags, manual suppression
- Bulk PNG/JPEG/WebP/GIF artwork to a public-read, admin-write bucket with reusable HTML snippets
- Reusable email templates, sandboxed preview, customer marketing-consent segmentation, imported opt-in contacts and selected customers
- Snapshot of recipient list and email content, mandatory explicit approval, separately confirmed start/schedule, pause/resume, immutable recipient tracking tokens
- Batch worker (30 recipients/run), service-role only queue leasing and consent recheck before sending
- Resend provider message IDs, signed webhook delivery/bounce/complaint events, automatic suppression, optional open/click tracking
- Campaign history, per-recipient report, event trail and CSV export with spreadsheet injection protection

## Preconditions — no implicit activation
1. Merge PR after **green CI** and application owner review.
2. Before replacing the old sending function, stage all three database migrations in order:
   `20261009190000_email_campaign_manager.sql`, `20261009190001_campaign_click_tracking.sql`, `20261009190002_campaign_metrics.sql`.
   Apply in a managed migration transaction; record the versions in Supabase migration history. Do **not** run `db reset`, backfill customer data, or apply unrelated pending migrations. Run on staging first.
3. Deploy the functions `campaign-manager`, `campaign-dispatch`, `campaign-unsubscribe`, `campaign-track`, `campaign-open` and `campaign-resend-webhook`, plus the **410 compatibility endpoint** `bulk-send-email`; verify `supabase/config.toml` JWT settings are honoured.
4. Confirm the existing Resend sending identity with `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Set long, random secrets `CAMPAIGN_WORKER_SECRET` and `CAMPAIGN_TRACK_SECRET` on the **Supabase functions environment only**. Never place them in frontend Vite variables or repository files.
5. Configure Resend webhook for `https://oexgjmuvgdndizsufipe.supabase.co/functions/v1/campaign-resend-webhook` and set its matching `RESEND_WEBHOOK_SECRET` (`whsec_...`) in the function environment. Subscribe at least to delivered, bounced and complained events. Test with provider's signed test webhook.
6. Configure an authenticated, rate-bounded scheduled invocation of `campaign-dispatch` (suggested once per minute in Supabase Cron or every five minutes in external scheduler), with `x-campaign-worker-secret` header matching the server secret. **A scheduler is not automatically installed by this PR.** The UI also provides explicit manual dispatch of up to 30 emails per click.
7. Confirm storage bucket `campaign-artwork` exists, public-read and admin-write only. Host only non-confidential marketing images.
8. Enable a single-operator internal test campaign after verifying the sender domain DNS (SPF, DKIM, DMARC), opt-out and provider logs. Do not start bulk sends until test results are satisfactory.

## Operational invariants
- Creating a draft/approving a campaign never sends mail.
- `approved_at` plus `ready/sending` status is necessary for queue claim; a campaign is approved by an admin and then independently started.
- Legacy `bulk-send-email` returns HTTP 410 when deployed.
- Addresses suppressed for unsubscribe/bounce/complaint/manual reason are never reactivated by a CSV import.
- Archived users and users who turn off `marketing_email_consent` are excluded at audience creation and rechecked before each send.
- The sender uses deterministic Resend idempotency keys. A claimed `processing` row after an interruption **must be reconciled against provider logs**, not blindly reset to queued; blind reset risks duplicate emails.
- Sent means provider acceptance; delivered means confirmed by signed webhook. Opens/clicks are approximate and are opt-in switches in the campaign wizard.
- Uploaded artwork is public. Confidential uploads are not supported.

## Test plan
- `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`
- CI ephemeral Supabase full migration replay, including storage/RLS policies
- Negative tests: anonymous and ordinary-customer calls rejected; draft/start/approve wrong statuses rejected; invalid consent rows rejected; duplicate import cannot reactivate unsubscribe; replayed signed webhook is idempotent
- Positive staging test: import opted-in test CSV; create template and draft; inspect preview; approve; start with controlled test list; invoke worker; verify Resend ID, delivered webhook, history, report export and link tracking
- Withdraw consent or add suppression between queueing and dispatch; assert no email leaves
- Verify pause stops new leases; in-flight leases can complete, so allow a short drain
- Verify scheduled campaign remains queued before its due time, and scheduler runs after it
- Check customer service/billing emails and existing SWITCH50 remain unchanged

## Change and rollback
Affected frontend: `CampaignManagerTab`, `CampaignsTab` wrapper, Communications route tab, AdminLayout child navigation, CSV helpers.
Affected backend: 6 dedicated campaign functions and legacy `bulk-send-email` compatibility response; three additive marketing schema migrations and an artwork bucket. Existing customers/transactional tables get **no mass changes**.
Rollback: first pause/stop the scheduler and campaigns, then revert UI and functions to the previous GitHub commit; re-enable the legacy sender only after formal review since it permits direct sends without approval. Leave additive marketing tables and recipient evidence intact for audit; don't drop data or restore withdrawn consents. Database schema cleanup, if later required, is a separately approved migration.

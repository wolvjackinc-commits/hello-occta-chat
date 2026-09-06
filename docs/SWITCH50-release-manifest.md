# SWITCH50 release manifest — release remains held

This is the deployment scope prepared from the feature branch, compared with the Lovable-synced main commit `d1d9341cf4f722f0d69ee7a5580615a4dbbc674d`. It is a review artifact, not approval to merge, publish, apply SQL or send customer messages. Both GitHub workflows and the staging checks in [the operations guide](SWITCH50-operations.md) must pass for the chosen release commit.

## Database changes

The live Lovable Cloud inspection found no SWITCH50 tables. Recheck immediately before release and apply only the genuinely new migrations, in this order, with migration tracking recorded through the approved Cloud deployment mechanism:

1. `20260906093000_switch50_campaign.sql`
2. `20260906101500_switch50_hardening.sql`
3. `20260906101501_switch50_payout_lifecycle.sql`
4. `20260906124242_restrict_dd_browser_mutations.sql`

The fourth migration fixes the Direct Debit permissions failure found by full-stack CI and confirmed against the live catalog. It keeps masked finance intake creation and approved server workflows, while removing browser writes to status, secrets, history and the email queue. Deploy the matching `PaymentsDD` frontend change with it.

The historical schema reconciliation files and guarded customer-specific corrections support fresh test environments. They are not production migrations to reapply. Most historical Git filenames differ slightly from the live version numbers; a blanket migration push can therefore replay old operations. See [the reconciliation record](../supabase/reference/RECONCILIATION.md).

The campaign seed creates a paused offer. Enable new acquisitions through the audited admin control only after the dependent functions and frontend have been checked. Existing contractual rewards remain recorded if the campaign is later paused.

## Server functions

Deploy the changed entry points together with their shared modules:

- `switch50-public`, `switch50-session`, `switch50-prepare-contract`, `switch50-admin`, `switch50-message-worker`
- `journey2-session`, `journey2-prepare-contract`, `journey2-completion`
- `generate-contract-information-pack`, `process-activation-outbox`
- `admin-banks-remediation` (existing lint correction included in this branch)

The following existing entry points also import the changed contractual modules, directly or through the isolated test path. Rebuild their bundles from the same release commit so snapshot and document behavior remains consistent:

- `generate-contract-summary`
- `journey2-submit`, `journey2-welcome-send`
- `journey2-admin-test`, `journey2-test-runner`

Shared module updates are `journey2Docs.ts`, `journey2Snapshot.ts`, `offerCampaign.ts`, `switch50Delivery.ts` and `switch50Messages.ts`. The message worker's gateway JWT check is disabled in configuration because it validates its own strong scheduler secret. Preserve that handler authorization.

## Frontend and configuration

Build and publish the frontend from the same verified release commit. Confirm the banner, eligible checkout, both contract documents, order completion, customer tracker, finance payout page, campaign switch and source reports agree. The synthetic component preview is excluded from the production build.

The operations guide lists the exact Resend and Vault configuration. Keep `SWITCH50_EMAILS_ENABLED` disabled until controlled delivery checks pass. Do not copy the CI encryption key, synthetic catalogue row, test database URLs, or test identities into Lovable Cloud. SMS/WhatsApp and bank-transfer initiation are not enabled by this change.

## Keeping Lovable usage low

Code, migrations, tests and review are prepared in Git. Use the existing Lovable connection for narrowly scoped verification and the necessary deployment/configuration steps after release gates pass. No Lovable AI redesign or rebuild request is needed. Normal Cloud usage can still be charged and may share the workspace credit balance. The connection does not expose a balance for measuring an exact credit delta.

For rollback, pause new campaign acquisitions and disable email delivery. Preserve contracts, ledger, audit events and bank references. Recording a recovery requires an actual completed recovery; changing database status does not reverse a bank transfer.

# Consumer v2026.10.1 release status

The canonical target is **2026.10.1**, but a version number is not a completed
release. Consumer issuance and new acceptance must remain paused until the
requirements below have been implemented and tested. This pause covers new
agreements and newly signed revisions; it does not replace accepted agreements.

## Required before resuming issuance

- Retrieve and compare the approved Production v2026.10.1 ZIP/PDF/DOCX package.
  The prior chat contains download references and a summary, not the complete
  approved source documents. Repository clauses cannot be certified identical
  to that package from the summary alone.
- Capture genuine address/product-specific minimum, normally available,
  maximum and advertised download/upload speeds, source and retrieval time.
  Freeze them in the commercial snapshot and render them in both documents.
  Estimated/up-to figures and a version bump do not satisfy this requirement.
- Freeze the likely service date, applicable tariff/allowance and charge data.
- Record the confirmations actually shown, separate early-start consent and
  applicable Digital Voice acknowledgement; require both exact document versions,
  immutable PDF hashes and verified OTP before atomic acceptance.
- Compare customer PDFs with the approved package and verify page limits,
  typography, the model cancellation form and incorporated schedules.
- Test every consumer issuance/acceptance route, including direct authenticated
  RPC calls and administrative revisions, against the same gates.

The release-pause migration contains only a new trigger function and triggers.
It updates no existing customer row and does not backfill evidence. Existing
immutability triggers remain in place. The pause also protects the database
from older deployed functions and direct RPC calls. Business contracts remain
on their existing path; this is not a certification of that path.

## Deployment

Git sync updates Lovable's code, not its deployed Edge Functions or migrations.
The checked GitHub Actions backend deployment failed because the repository's
`SUPABASE_ACCESS_TOKEN` secret was absent. Never use Lovable AI build/message
requests to work around this restriction. Publishing the website alone is not
proof that the backend has deployed.

After the source is committed, apply the exact reviewed release-pause migration
to the OCCTA database and verify trigger definitions and historical record
digests. Deploy the changed functions with an authorized backend deployment
connection. Removing the pause requires a reviewed implementation of the
requirements above, not a client-supplied flag or an environment bypass.

## Verification

- `npm run typecheck`
- `npm run test:unit`
- `node --test scripts/consumer-contract-release.test.mjs`
- `npm run build`

The SQL test uses an isolated in-memory PostgreSQL instance with synthetic
records. Do not test acceptance, OTP consumption, email, payments or provisioning
against real customers.

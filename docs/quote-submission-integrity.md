# Verified quote submissions

Quote conversions now originate in a service-only database transaction that saves the request, its private retry receipt and its completion event together. Passive thank-you page visits cannot create verified conversions. Existing unlinked thank-you events are labelled unverified by the reporting function; historical customer and tracking records are not rewritten.

Both production forms send a stable random submission key. Repeating the same request returns the same reference without repeating quote generation or emails. The database serializes matching keys and rejects reuse with different request contents. A lost response is recovered by checking the receipt. Failed attempts retain the current form state and show retry instructions. Only opaque keys and payload hashes are kept in session storage, not form contents.

Receipt verification requires the private key from the submitting browser and returns only the saved request ID and reference. A reference alone, a manually opened thank-you URL, or a forwarded URL is insufficient. If verification is unavailable, the page tells customers to check their acknowledgement or contact staff, without claiming submission failed or inviting a duplicate solely on that basis.

Journey Control links verified requests to the staff Quote Requests queue and displays the recorded customer details. The generic browser row is suppressed once its client hash is linked to a server receipt. Recording failure events puts client failures in the Errors view and displays a staff warning; server save failures are recorded as `quote_submission_failed` in the activity log. No automatic customer retry or new staff email sender is introduced.

Test-mode Build Plan retains its existing path and does not create production receipts. A saved request remains available to staff even if subsequent quote generation or email work fails; recovery confirms request receipt, not successful quote delivery. Existing email logs remain the source for send/delivery evidence.

## Deployment

Apply `20260905120000_verified_quote_submissions.sql` and `20260905120100_quote_conversion_reporting.sql` before deploying the three quote edge functions and publishing the frontend. The GitHub Quote Submission Check workflow tests and builds before deploying those functions. It does not apply database migrations. The older reminder panel additionally requires `20260905070000_checkout_reminder_inspection.sql`.

## Verification

Focused browser tests cover lost-response recovery, same-key retries, direct thank-you visits, mismatched references, server-confirmed success, and exclusion of unverified conversions. The SQL transaction test in `supabase/tests/verified-quote-submissions.sql` is for an isolated local/CI database only; do not run it against production. A local PostgreSQL runtime also verified the reporting joins, duplicate browser-row suppression, public access denial and rollback on invalid requests. No real customer quote or email is needed for these tests.

The change does not prove why any historical visitor left or that a previously unlinked event was a real customer submission.

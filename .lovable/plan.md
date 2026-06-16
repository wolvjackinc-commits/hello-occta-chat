Resend final quote email for QT-2606-a294fe6a (quote id `0d497ed9-1058-4172-96b6-77a1e27e09d4`, customer `nhibataungaa@gmail.com`).

Steps:
1. Invoke `send-quote-email` edge function with `{ quote_id: "0d497ed9-1058-4172-96b6-77a1e27e09d4" }`.
   - This rotates the public token (old link invalidated), sends a fresh branded email via Resend, and inserts a new `quote_events.quote_sent` row.
2. Verify Resend returned 200 and re-query `quotes` + `quote_events` to confirm.
3. Report new token URL status, recipient, and event log entry.

No schema or code changes. No side-effects on contract_summaries / payment_requests / services / invoices / dd_mandates.
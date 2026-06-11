UPDATE payment_requests SET status='cancelled' WHERE payment_request_number='PR-2606-0006' AND status='opened';
INSERT INTO payment_requests (user_id, type, status, amount, currency, customer_name, customer_email, account_number, notes, token_hash, expires_at, created_by, contract_summary_id, contract_acceptance_id, metadata)
VALUES ('1f2f9646-7312-4730-b670-b7d2b5b19a42','card_payment','pending',18.00,'GBP','Internal Test PhaseE','internal-test+phasee@occta.co.uk',NULL,
'INTERNAL TEST — DO NOT PROCESS (Phase E re-run)',
'9e680120f658713201893c759ac69ca381142282d359eef864d6534d41818b01',
now() + interval '1 day',
'dde98b94-41ad-44a9-bb1a-d358c00f7cc5',
'2ac5824e-1c8c-4b5f-95e1-ee685c023db0',
'1290f250-c2d5-4503-8836-6e59b3a84d46',
'{"source":"phase-e-rerun","internal_test":true}'::jsonb);
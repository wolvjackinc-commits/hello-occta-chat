-- Phase E Live HPP session-create test PR
UPDATE public.payment_requests
SET status = 'cancelled', updated_at = now()
WHERE payment_request_number = 'PR-2606-0007'
  AND status IN ('sent','opened','draft','pending');

INSERT INTO public.payment_requests (
  type, status, amount, currency, customer_email, customer_name,
  contract_summary_id, token_hash, expires_at, notes,
  payment_request_number, metadata
) VALUES (
  'card_payment', 'sent', 18.00, 'GBP',
  'internal-test+phasee@occta.co.uk', 'INTERNAL TEST - DO NOT PROCESS',
  '2ac5824e-1c8c-4b5f-95e1-ee685c023db0',
  'de3f9a9f0800457b053bb0fb7b0f8e6cbec7247fce113dee122f629dce5e0120',
  now() + interval '14 days',
  'INTERNAL TEST - DO NOT PROCESS - Live HPP session-create test only',
  'PR-2606-LIVE1',
  '{"internal_test": true, "do_not_process": true, "phase": "E-live-session-create"}'::jsonb
);

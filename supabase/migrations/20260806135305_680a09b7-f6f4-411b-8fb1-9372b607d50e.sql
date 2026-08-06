-- Admin console still needs to create the mandate shell (no sensitive columns).
GRANT INSERT (
  user_id, status, mandate_reference, bank_last4, account_holder,
  account_holder_name, provider_code, is_test, payment_request_id, consent_timestamp
) ON public.dd_mandates TO authenticated;

ALTER TABLE public.dd_mandates ALTER COLUMN status SET DEFAULT 'details_received';
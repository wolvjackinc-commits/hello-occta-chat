ALTER TABLE public.quote_request_followups
  ADD COLUMN IF NOT EXISTS customer_summary TEXT;

COMMENT ON COLUMN public.quote_request_followups.notes IS
  'Internal follow-up notes. Never sent to customers automatically.';
COMMENT ON COLUMN public.quote_request_followups.customer_summary IS
  'Optional admin-authored, customer-safe summary. Used to prefill the customer email.';
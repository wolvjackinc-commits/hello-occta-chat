ALTER TABLE public.payment_requests DROP CONSTRAINT IF EXISTS payment_requests_status_check;
ALTER TABLE public.payment_requests ADD CONSTRAINT payment_requests_status_check
  CHECK (status = ANY (ARRAY[
    'draft'::text,
    'pending'::text,
    'sent'::text,
    'opened'::text,
    'checkout_created'::text,
    'paid'::text,
    'completed'::text,
    'failed'::text,
    'cancelled'::text
  ]));
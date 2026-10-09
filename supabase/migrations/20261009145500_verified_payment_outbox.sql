-- OCCTA: controlled settlement and notification outbox.
-- Deploy only after dry-run reconciliation approval. No retrospective updates.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS receipts_unique_verified_source
  ON public.receipts (reference)
  WHERE reference LIKE 'RECON:%';

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS pdf_storage_key text,
  ADD COLUMN IF NOT EXISTS pdf_hash text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.billing_notifications_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  invoice_id uuid REFERENCES public.invoices(id),
  kind text NOT NULL CHECK (kind IN ('payment_received', 'payment_failed')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  source_ref text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'retry', 'dead')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS billing_notifications_due
  ON public.billing_notifications_outbox (next_attempt_at, status)
  WHERE status IN ('pending', 'retry');

ALTER TABLE public.billing_notifications_outbox ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: service role only. Customers access receipts
-- using existing RLS on their invoices and receipts, not this internal outbox.

COMMIT;

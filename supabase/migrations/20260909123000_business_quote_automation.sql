-- Business broadband quote automation metadata.
-- Additive only: existing quote requests and admin flows keep working.

ALTER TABLE public.business_quote_requests
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS qualification_status text NOT NULL DEFAULT 'needs_review',
  ADD COLUMN IF NOT EXISTS qualification_reasons text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS qualification_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_due_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'business_quote_requests_qualification_status_check'
      AND conrelid = 'public.business_quote_requests'::regclass
  ) THEN
    ALTER TABLE public.business_quote_requests
      ADD CONSTRAINT business_quote_requests_qualification_status_check
      CHECK (qualification_status IN ('auto_qualified','needs_review','complex'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS business_quote_requests_reference_uidx
  ON public.business_quote_requests(reference)
  WHERE reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS business_quote_requests_followup_idx
  ON public.business_quote_requests(status, qualification_status, follow_up_due_at, created_at DESC);

COMMENT ON COLUMN public.business_quote_requests.reference IS
  'Server-generated customer-safe request reference. Never generated in the browser.';
COMMENT ON COLUMN public.business_quote_requests.qualification_status IS
  'Automated triage only; does not mean a supplier order or contract has been created.';
COMMENT ON COLUMN public.business_quote_requests.qualification_snapshot IS
  'Admin-only commercial guardrail snapshot derived from the current supplier catalogue. Must never be exposed publicly.';
COMMENT ON COLUMN public.business_quote_requests.follow_up_due_at IS
  'Operational target for the next business follow-up; not a contractual customer SLA.';
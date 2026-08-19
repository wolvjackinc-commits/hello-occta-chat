ALTER TABLE public.contract_summaries
  ADD COLUMN IF NOT EXISTS pack_sections jsonb,
  ADD COLUMN IF NOT EXISTS internal_pack jsonb;

ALTER TABLE public.contract_acceptances
  ADD COLUMN IF NOT EXISTS pack_acknowledgements jsonb,
  ADD COLUMN IF NOT EXISTS business_name text;

COMMENT ON COLUMN public.contract_summaries.pack_sections IS 'Customer-facing extra contract pack sections (charges tables, installation, router, Wi-Fi, cancellation, notes, required acknowledgements).';
COMMENT ON COLUMN public.contract_summaries.internal_pack IS 'Internal admin-only supplier route, cost and margin data. Never returned to token holders or customers.';
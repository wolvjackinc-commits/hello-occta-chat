
ALTER TABLE public.contract_acceptances
  ADD COLUMN IF NOT EXISTS mobile_snapshot text,
  ADD COLUMN IF NOT EXISTS address_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkbox_received_read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkbox_details_correct boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkbox_understand_charges boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkbox_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS journey_id uuid REFERENCES public.order_journeys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_route text,
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS accepted_at_europe_london text,
  ADD COLUMN IF NOT EXISTS acceptance_text_hash text;

CREATE INDEX IF NOT EXISTS idx_contract_acceptances_journey
  ON public.contract_acceptances(journey_id);

CREATE TABLE IF NOT EXISTS public.acceptance_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_acceptance_id uuid NOT NULL UNIQUE REFERENCES public.contract_acceptances(id) ON DELETE RESTRICT,
  contract_summary_id uuid NOT NULL REFERENCES public.contract_summaries(id) ON DELETE RESTRICT,
  quote_id uuid NOT NULL,
  customer_id uuid,
  journey_id uuid REFERENCES public.order_journeys(id) ON DELETE SET NULL,
  certificate_number text NOT NULL UNIQUE,
  storage_key text NOT NULL,
  sha256 text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.acceptance_certificates TO authenticated;
GRANT ALL ON public.acceptance_certificates TO service_role;

ALTER TABLE public.acceptance_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers read own acceptance certificates"
ON public.acceptance_certificates
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.contract_acceptances ca
    WHERE ca.id = acceptance_certificates.contract_acceptance_id
      AND ca.accepted_by_user = auth.uid()
  )
);

CREATE POLICY "Staff read all acceptance certificates"
ON public.acceptance_certificates
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.acceptance_certificates_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'acceptance_certificates is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_acceptance_certificates_no_update ON public.acceptance_certificates;
CREATE TRIGGER trg_acceptance_certificates_no_update
BEFORE UPDATE OR DELETE ON public.acceptance_certificates
FOR EACH ROW EXECUTE FUNCTION public.acceptance_certificates_block_mutation();

CREATE OR REPLACE FUNCTION public.generate_acceptance_certificate_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text := 'CERT-';
  v_ym text := to_char(CURRENT_DATE, 'YYMM');
  v_seq int;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(certificate_number, '^CERT-[0-9]{4}-', ''), '') AS integer)
  ), 0) + 1
  INTO v_seq
  FROM public.acceptance_certificates
  WHERE certificate_number LIKE v_prefix || v_ym || '-%';
  RETURN v_prefix || v_ym || '-' || LPAD(v_seq::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.acceptance_certificates_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.certificate_number IS NULL OR NEW.certificate_number = '' THEN
    NEW.certificate_number := public.generate_acceptance_certificate_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_acceptance_certificates_before_insert ON public.acceptance_certificates;
CREATE TRIGGER trg_acceptance_certificates_before_insert
BEFORE INSERT ON public.acceptance_certificates
FOR EACH ROW EXECUTE FUNCTION public.acceptance_certificates_before_insert();

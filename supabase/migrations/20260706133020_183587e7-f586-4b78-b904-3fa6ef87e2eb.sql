
CREATE TABLE public.contract_document_artifacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type TEXT NOT NULL CHECK (document_type IN ('contract_summary','contract_information_pack','acceptance_certificate')),
  document_id UUID NOT NULL,
  document_number TEXT,
  document_version INT,
  artifact_type TEXT NOT NULL DEFAULT 'pdf',
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  is_customer_visible BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT contract_doc_artifacts_unique
    UNIQUE (document_type, document_id, document_version, artifact_type)
);

GRANT SELECT ON public.contract_document_artifacts TO authenticated;
GRANT ALL ON public.contract_document_artifacts TO service_role;

ALTER TABLE public.contract_document_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read all artifacts"
  ON public.contract_document_artifacts
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'compliance_admin'::app_role)
    OR public.has_role(auth.uid(), 'support_agent'::app_role)
    OR public.has_role(auth.uid(), 'auditor'::app_role)
  );

CREATE POLICY "Customers can read their own artifacts"
  ON public.contract_document_artifacts
  FOR SELECT
  TO authenticated
  USING (
    is_customer_visible = true
    AND (
      (document_type = 'contract_summary' AND EXISTS (
         SELECT 1 FROM public.contract_summaries cs
         WHERE cs.id = document_id AND cs.customer_id = auth.uid()
      ))
      OR (document_type = 'contract_information_pack' AND EXISTS (
         SELECT 1 FROM public.contract_information_packs ip
         WHERE ip.id = document_id AND ip.customer_id = auth.uid()
      ))
      OR (document_type = 'acceptance_certificate' AND EXISTS (
         SELECT 1 FROM public.acceptance_certificates ac
         WHERE ac.id = document_id AND ac.customer_id = auth.uid()
      ))
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_artifact_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_service_role BOOLEAN;
BEGIN
  is_service_role := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_user = 'service_role');

  IF TG_OP = 'DELETE' THEN
    IF is_service_role AND (OLD.metadata ? 'void_reason') THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'contract_document_artifacts rows are immutable (DELETE blocked)';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF is_service_role AND (NEW.metadata ? 'void_reason')
       AND (COALESCE(OLD.metadata->>'void_reason','') IS DISTINCT FROM (NEW.metadata->>'void_reason')) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'contract_document_artifacts rows are immutable (UPDATE blocked)';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER contract_doc_artifacts_no_update
  BEFORE UPDATE ON public.contract_document_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_artifact_immutability();

CREATE TRIGGER contract_doc_artifacts_no_delete
  BEFORE DELETE ON public.contract_document_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_artifact_immutability();

CREATE INDEX idx_contract_doc_artifacts_doc
  ON public.contract_document_artifacts (document_type, document_id);

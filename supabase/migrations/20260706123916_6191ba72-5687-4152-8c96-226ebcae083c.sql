-- Block DELETE on accepted Contract Summaries
CREATE OR REPLACE FUNCTION public.enforce_contract_summary_no_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'accepted' OR OLD.accepted_at_utc IS NOT NULL THEN
    RAISE EXCEPTION 'accepted_contract_summary_cannot_be_deleted';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_cs_no_delete ON public.contract_summaries;
CREATE TRIGGER trg_cs_no_delete
  BEFORE DELETE ON public.contract_summaries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_contract_summary_no_delete();

-- Block DELETE on accepted Contract Information Packs
CREATE OR REPLACE FUNCTION public.enforce_cip_no_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.document_status = 'accepted' OR OLD.accepted_at_utc IS NOT NULL THEN
    RAISE EXCEPTION 'accepted_contract_information_pack_cannot_be_deleted';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_cip_no_delete ON public.contract_information_packs;
CREATE TRIGGER trg_cip_no_delete
  BEFORE DELETE ON public.contract_information_packs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cip_no_delete();

-- Acceptance Certificates: never deletable, ever
CREATE OR REPLACE FUNCTION public.enforce_certificate_no_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'acceptance_certificate_cannot_be_deleted';
END $$;

DROP TRIGGER IF EXISTS trg_cert_no_delete ON public.acceptance_certificates;
CREATE TRIGGER trg_cert_no_delete
  BEFORE DELETE ON public.acceptance_certificates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_certificate_no_delete();
-- Journey 2 two-document acceptance guard.
--
-- A direct/unified journey must not create acceptance evidence unless the
-- Contract Information pack paired to the exact Contract Summary exists,
-- has an immutable PDF, and is in an issuable state. Legacy non-journey
-- acceptance routes are deliberately unchanged by this migration.

CREATE OR REPLACE FUNCTION public.enforce_journey_contract_information_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _two_doc boolean := false;
  _pack_id uuid;
  _pack_status document_status_enum;
  _pdf_path text;
BEGIN
  IF NEW.journey_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(two_document_contract_flow_enabled, false)
    INTO _two_doc
    FROM public.platform_settings
   WHERE singleton = true;

  IF NOT _two_doc THEN
    RETURN NEW;
  END IF;

  SELECT id, document_status, pdf_storage_path
    INTO _pack_id, _pack_status, _pdf_path
    FROM public.contract_information_packs
   WHERE contract_summary_id = NEW.contract_summary_id
     AND document_status <> 'superseded'::document_status_enum
   ORDER BY version DESC
   LIMIT 1;

  IF _pack_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'contract_information_missing',
      DETAIL = 'A matching Contract Information pack must exist before a Journey 2 agreement can be accepted.';
  END IF;

  IF _pack_status NOT IN ('issued'::document_status_enum, 'accepted'::document_status_enum)
     OR nullif(_pdf_path, '') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'contract_information_not_ready',
      DETAIL = 'The matching Contract Information pack must be issued with an immutable PDF before acceptance.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_journey_contract_information_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.journey_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.contract_information_packs
     SET document_status = 'accepted'::document_status_enum,
         accepted_at_utc = coalesce(accepted_at_utc, NEW.accepted_at)
   WHERE contract_summary_id = NEW.contract_summary_id
     AND document_status = 'issued'::document_status_enum;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_journey_contract_information_acceptance ON public.contract_acceptances;
CREATE TRIGGER trg_enforce_journey_contract_information_acceptance
BEFORE INSERT ON public.contract_acceptances
FOR EACH ROW EXECUTE FUNCTION public.enforce_journey_contract_information_acceptance();

DROP TRIGGER IF EXISTS trg_mark_journey_contract_information_accepted ON public.contract_acceptances;
CREATE TRIGGER trg_mark_journey_contract_information_accepted
AFTER INSERT ON public.contract_acceptances
FOR EACH ROW EXECUTE FUNCTION public.mark_journey_contract_information_accepted();
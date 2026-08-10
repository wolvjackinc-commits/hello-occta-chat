-- Information-refresh documents are records-only: they can never be accepted or
-- signed, and no acceptance record may ever point at one. Historic ordinary
-- accepted contract summaries are unaffected (guard only fires when
-- is_information_update = true).

CREATE OR REPLACE FUNCTION public.enforce_information_update_never_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_information_update, false)
       AND (NEW.status = 'accepted' OR NEW.accepted_at IS NOT NULL) THEN
      RAISE EXCEPTION 'information_update_not_acceptable: an information refresh cannot be created as an accepted contract summary (%).', NEW.cs_number
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.is_information_update, false) OR COALESCE(NEW.is_information_update, false) THEN
    IF NEW.status = 'accepted' OR NEW.accepted_at IS NOT NULL THEN
      RAISE EXCEPTION 'information_update_not_acceptable: contract summary % is an information refresh for records only and cannot be accepted or signed.', COALESCE(NEW.cs_number, OLD.cs_number)
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cs_info_update_never_accepted ON public.contract_summaries;
CREATE TRIGGER trg_cs_info_update_never_accepted
  BEFORE INSERT OR UPDATE ON public.contract_summaries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_information_update_never_accepted();

CREATE OR REPLACE FUNCTION public.enforce_acceptance_not_information_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_info boolean;
BEGIN
  IF NEW.contract_summary_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(is_information_update, false) INTO v_info
  FROM public.contract_summaries
  WHERE id = NEW.contract_summary_id;

  IF v_info THEN
    RAISE EXCEPTION 'information_update_not_acceptable: acceptance records cannot be created against an information refresh document.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_acceptance_not_information_update ON public.contract_acceptances;
CREATE TRIGGER trg_acceptance_not_information_update
  BEFORE INSERT ON public.contract_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.enforce_acceptance_not_information_update();
-- Safety release: keep consumer issuance closed until the required customer
-- data and approved production package are integrated and verified.
-- No existing row, PDF, hash, OTP challenge or evidence record is updated.
-- This also protects direct RPCs and old deployed edge functions.
CREATE OR REPLACE FUNCTION public.enforce_consumer_contract_release_pause()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  customer_kind text;
BEGIN
  IF TG_TABLE_NAME = 'contract_summaries' THEN
    IF TG_OP = 'UPDATE' THEN
      -- Existing accepted records remain governed by their immutability guards.
      IF OLD.status::text = 'accepted' OR OLD.document_status::text = 'accepted' THEN
        RETURN NEW;
      END IF;
      IF NEW.status::text IS DISTINCT FROM 'accepted'
         AND NEW.document_status::text IS DISTINCT FROM 'accepted' THEN
        RETURN NEW;
      END IF;
    ELSIF coalesce(NEW.is_information_update, false) THEN
      -- Records-only updates remain unsignable under existing DB guards.
      RETURN NEW;
    END IF;
    customer_kind := NEW.customer_type::text;
  ELSIF TG_TABLE_NAME = 'contract_information_packs' THEN
    IF TG_OP = 'UPDATE' THEN
      IF OLD.document_status::text = 'accepted'
         OR NEW.document_status::text IS DISTINCT FROM 'accepted' THEN
        RETURN NEW;
      END IF;
    END IF;
    SELECT q.customer_type::text INTO customer_kind
      FROM public.quotes q WHERE q.id = NEW.quote_id;
  ELSIF TG_TABLE_NAME = 'contract_acceptances' THEN
    SELECT c.customer_type::text INTO customer_kind
      FROM public.contract_summaries c WHERE c.id = NEW.contract_summary_id;
  ELSE
    RAISE EXCEPTION 'unexpected_consumer_release_guard_table';
  END IF;

  IF customer_kind IS DISTINCT FROM 'business' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'consumer_contract_issuance_paused',
      DETAIL = 'Consumer v2026.10.1 requires verified speed data, complete immutable documents and verified acceptance controls before issuance resumes.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_consumer_contract_release_pause() FROM PUBLIC;

CREATE TRIGGER trg_consumer_release_pause_summary
BEFORE INSERT OR UPDATE OF status, document_status ON public.contract_summaries
FOR EACH ROW EXECUTE FUNCTION public.enforce_consumer_contract_release_pause();

CREATE TRIGGER trg_consumer_release_pause_pack
BEFORE INSERT OR UPDATE OF document_status ON public.contract_information_packs
FOR EACH ROW EXECUTE FUNCTION public.enforce_consumer_contract_release_pause();

CREATE TRIGGER trg_consumer_release_pause_acceptance
BEFORE INSERT ON public.contract_acceptances
FOR EACH ROW EXECUTE FUNCTION public.enforce_consumer_contract_release_pause();

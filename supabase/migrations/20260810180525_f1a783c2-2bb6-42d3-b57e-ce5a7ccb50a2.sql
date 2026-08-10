ALTER TABLE public.dd_mandates
  ADD COLUMN IF NOT EXISTS intake_request_id uuid REFERENCES public.dd_intake_requests(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS dd_mandates_intake_request_id_key
  ON public.dd_mandates (intake_request_id) WHERE intake_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.dd_sync_mandate_from_intake(_intake_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intake public.dd_intake_requests;
  v_pm public.payment_methods;
  v_acct text;
  v_ref text;
  v_id uuid;
BEGIN
  SELECT * INTO v_intake FROM public.dd_intake_requests WHERE id = _intake_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT id INTO v_id FROM public.dd_mandates WHERE intake_request_id = _intake_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT * INTO v_pm FROM public.payment_methods WHERE id = v_intake.payment_method_id;
  IF NOT FOUND OR v_pm.customer_id IS NULL THEN RETURN NULL; END IF;

  SELECT account_number INTO v_acct FROM public.profiles WHERE id = v_pm.customer_id;
  v_ref := 'DD-' || COALESCE(v_acct, 'PENDING') || '-'
           || to_char(v_intake.created_at, 'YYYYMMDD') || '-'
           || substr(replace(_intake_id::text, '-', ''), 1, 6);

  INSERT INTO public.dd_mandates (
    user_id, status, mandate_reference, intake_request_id,
    bank_last4, masked_account_last4, masked_sort_last2, provider,
    account_holder, account_holder_name, bank_details_ciphertext,
    enc_key_id, enc_alg, enc_nonce,
    consent_timestamp, consent_ip, consent_user_agent, signature_name,
    plaintext_purged_at
  ) VALUES (
    v_pm.customer_id, 'awaiting_manual_submission', v_ref, _intake_id,
    v_intake.masked_account_last4, v_intake.masked_account_last4, v_intake.masked_sort_last2, v_intake.bank_name,
    v_pm.account_holder_name, v_pm.account_holder_name, v_intake.bank_details_ciphertext,
    v_intake.enc_key_id, v_intake.enc_alg, v_intake.nonce,
    v_pm.consent_at, v_pm.ip, v_pm.ua, v_pm.account_holder_name,
    now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_dd_intake_create_mandate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.dd_sync_mandate_from_intake(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dd_intake_create_mandate ON public.dd_intake_requests;
CREATE TRIGGER trg_dd_intake_create_mandate
AFTER INSERT ON public.dd_intake_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_dd_intake_create_mandate();

CREATE OR REPLACE FUNCTION public.trg_pm_customer_linked_create_mandate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.customer_id IS NOT NULL AND (OLD.customer_id IS NULL OR OLD.customer_id <> NEW.customer_id) THEN
    FOR r IN SELECT id FROM public.dd_intake_requests WHERE payment_method_id = NEW.id LOOP
      PERFORM public.dd_sync_mandate_from_intake(r.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pm_customer_linked_create_mandate ON public.payment_methods;
CREATE TRIGGER trg_pm_customer_linked_create_mandate
AFTER UPDATE OF customer_id ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.trg_pm_customer_linked_create_mandate();

-- 1. Columns
ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS contract_summary_id uuid REFERENCES public.contract_summaries(id),
  ADD COLUMN IF NOT EXISTS contract_acceptance_id uuid REFERENCES public.contract_acceptances(id),
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id),
  ADD COLUMN IF NOT EXISTS quote_request_id uuid REFERENCES public.quote_requests(id),
  ADD COLUMN IF NOT EXISTS payment_request_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS provider_session_id text,
  ADD COLUMN IF NOT EXISTS provider_checkout_url text,
  ADD COLUMN IF NOT EXISTS provider_payment_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_payment_requests_cs ON public.payment_requests(contract_summary_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_provider_ref ON public.payment_requests(provider_reference);
CREATE INDEX IF NOT EXISTS idx_payment_requests_token_hash ON public.payment_requests(token_hash);

-- 2. PR number generator
CREATE OR REPLACE FUNCTION public.generate_payment_request_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text := 'PR-';
  v_ym text := to_char(CURRENT_DATE, 'YYMM');
  v_seq int;
  v_num text;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(payment_request_number, '^PR-[0-9]{4}-', ''), '') AS integer)
  ), 0) + 1
  INTO v_seq
  FROM public.payment_requests
  WHERE payment_request_number LIKE v_prefix || v_ym || '-%';
  v_num := v_prefix || v_ym || '-' || LPAD(v_seq::text, 4, '0');
  RETURN v_num;
END;
$$;

CREATE OR REPLACE FUNCTION public.pr_before_insert_assign_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_request_number IS NULL THEN
    NEW.payment_request_number := public.generate_payment_request_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pr_assign_number ON public.payment_requests;
CREATE TRIGGER trg_pr_assign_number
  BEFORE INSERT ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.pr_before_insert_assign_number();

-- 3. Guard: CS-linked payment requires accepted CS + acceptance + stored PDF + no active duplicate
CREATE OR REPLACE FUNCTION public.pr_guard_cs_linked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cs_status text;
  v_pdf_key text;
  v_pdf_sha text;
  v_has_acceptance boolean;
  v_dup_count int;
BEGIN
  IF NEW.contract_summary_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status::text, pdf_storage_key, pdf_sha256
    INTO v_cs_status, v_pdf_key, v_pdf_sha
  FROM public.contract_summaries
  WHERE id = NEW.contract_summary_id;

  IF v_cs_status IS NULL THEN
    RAISE EXCEPTION 'CS-linked payment_request: contract_summary not found';
  END IF;
  IF v_cs_status <> 'accepted' THEN
    RAISE EXCEPTION 'CS-linked payment_request blocked: contract_summary status must be accepted (was %)', v_cs_status;
  END IF;
  IF v_pdf_key IS NULL OR v_pdf_sha IS NULL THEN
    RAISE EXCEPTION 'CS-linked payment_request blocked: accepted CS PDF missing (storage_key or sha256)';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contract_acceptances WHERE contract_summary_id = NEW.contract_summary_id
  ) INTO v_has_acceptance;
  IF NOT v_has_acceptance THEN
    RAISE EXCEPTION 'CS-linked payment_request blocked: no contract_acceptance record';
  END IF;

  IF NEW.contract_acceptance_id IS NULL THEN
    SELECT id INTO NEW.contract_acceptance_id
    FROM public.contract_acceptances
    WHERE contract_summary_id = NEW.contract_summary_id
    ORDER BY accepted_at ASC
    LIMIT 1;
  END IF;

  -- Block duplicate active PR for same CS
  SELECT count(*) INTO v_dup_count
  FROM public.payment_requests
  WHERE contract_summary_id = NEW.contract_summary_id
    AND status IN ('draft','pending','checkout_created','paid','sent','opened','completed');
  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'CS-linked payment_request blocked: active or paid payment_request already exists for this Contract Summary';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pr_guard_cs_linked ON public.payment_requests;
CREATE TRIGGER trg_pr_guard_cs_linked
  BEFORE INSERT ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.pr_guard_cs_linked();

-- 4. Paid immutability + webhook flag protection (CS-linked only; legacy paths untouched)
CREATE OR REPLACE FUNCTION public.pr_protect_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_user = 'service_role');
BEGIN
  -- Only enforce for CS-linked payment requests (do not break legacy invoice payments)
  IF OLD.contract_summary_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Once paid, key fields are immutable; paid_at and webhook_verified cannot be cleared.
  IF OLD.status = 'paid' THEN
    IF (NEW.amount, NEW.currency, NEW.user_id, NEW.contract_summary_id,
        NEW.contract_acceptance_id, NEW.quote_id, NEW.quote_request_id,
        NEW.provider_reference)
       IS DISTINCT FROM
       (OLD.amount, OLD.currency, OLD.user_id, OLD.contract_summary_id,
        OLD.contract_acceptance_id, OLD.quote_id, OLD.quote_request_id,
        OLD.provider_reference) THEN
      RAISE EXCEPTION 'Paid CS-linked payment_request: core fields are immutable';
    END IF;
    IF OLD.paid_at IS NOT NULL AND NEW.paid_at IS NULL THEN
      RAISE EXCEPTION 'Paid CS-linked payment_request: paid_at cannot be cleared';
    END IF;
    IF OLD.webhook_verified = true AND NEW.webhook_verified = false THEN
      RAISE EXCEPTION 'Paid CS-linked payment_request: webhook_verified cannot be cleared';
    END IF;
    IF NEW.status NOT IN ('paid','cancelled') THEN
      RAISE EXCEPTION 'Paid CS-linked payment_request: status can only stay paid or move to cancelled by admin';
    END IF;
  END IF;

  -- Only service_role may set status='paid' or webhook_verified=true on CS-linked rows.
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    IF NOT is_service THEN
      RAISE EXCEPTION 'Only webhook (service role) may mark CS-linked payment_request as paid';
    END IF;
  END IF;
  IF NEW.webhook_verified = true AND OLD.webhook_verified = false THEN
    IF NOT is_service THEN
      RAISE EXCEPTION 'Only webhook (service role) may set webhook_verified=true';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pr_protect_paid ON public.payment_requests;
CREATE TRIGGER trg_pr_protect_paid
  BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.pr_protect_paid();

-- 5. RLS hardening: remove broken customer INSERT policy; customers cannot mutate
DROP POLICY IF EXISTS "Users can create own payment requests" ON public.payment_requests;

-- Explicit deny INSERT/UPDATE/DELETE for authenticated (admin policy already grants full access)
DROP POLICY IF EXISTS payment_requests_block_customer_write ON public.payment_requests;
CREATE POLICY payment_requests_block_customer_write
  ON public.payment_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS payment_requests_block_customer_update ON public.payment_requests;
CREATE POLICY payment_requests_block_customer_update
  ON public.payment_requests
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS payment_requests_block_customer_delete ON public.payment_requests;
CREATE POLICY payment_requests_block_customer_delete
  ON public.payment_requests
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

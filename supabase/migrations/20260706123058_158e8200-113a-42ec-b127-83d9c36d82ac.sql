-- 1. Activation-blocked flags for Digital Voice vulnerability review
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS activation_blocked_pending_review boolean NOT NULL DEFAULT false;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS activation_blocked_pending_review boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_activation_blocked
  ON public.orders (activation_blocked_pending_review) WHERE activation_blocked_pending_review = true;

CREATE INDEX IF NOT EXISTS idx_services_activation_blocked
  ON public.services (activation_blocked_pending_review) WHERE activation_blocked_pending_review = true;

-- 2. Service can only have a next_billing_date once actual_activation_date is recorded.
--    Enforced via CHECK: if next_billing_date is set, actual_activation_date must be set too.
ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_next_billing_requires_activation;
ALTER TABLE public.services
  ADD CONSTRAINT services_next_billing_requires_activation
  CHECK (next_billing_date IS NULL OR actual_activation_date IS NOT NULL) NOT VALID;

-- 3. First-invoice uniqueness: at most one first_billing_jobs row per (order_id, service_id)
--    in non-failed state. Uses partial unique index so old failed rows do not block retries.
CREATE UNIQUE INDEX IF NOT EXISTS uq_first_billing_jobs_order_service_active
  ON public.first_billing_jobs (order_id, service_id)
  WHERE status IN ('pending','processing','completed');

-- 4. Recurring-invoice uniqueness: at most one invoice per (service_id, billing_period_start, billing_period_end)
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_service_period
  ON public.invoices (service_id, billing_period_start, billing_period_end)
  WHERE service_id IS NOT NULL AND billing_period_start IS NOT NULL AND billing_period_end IS NOT NULL;

-- 5. Assert-service-live helper. Backend billing code calls this before creating charges.
--    Returns true only if the service is confirmed live, not blocked pending review,
--    and (when two-doc flow is on) has accepted CS + CIP hashes recorded on the order.
CREATE OR REPLACE FUNCTION public.assert_service_live(_service_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_live_at timestamptz;
  v_activation_date date;
  v_billing_enabled boolean;
  v_svc_blocked boolean;
  v_order_id uuid;
  v_order_blocked boolean;
  v_order_live_at timestamptz;
  v_flag_on boolean;
BEGIN
  SELECT s.activation_confirmed_at, s.actual_activation_date, s.billing_enabled,
         s.activation_blocked_pending_review, s.order_id
    INTO v_service_live_at, v_activation_date, v_billing_enabled, v_svc_blocked, v_order_id
  FROM public.services s WHERE s.id = _service_id;

  IF v_service_live_at IS NULL OR v_activation_date IS NULL OR v_billing_enabled IS DISTINCT FROM true THEN
    RETURN false;
  END IF;
  IF v_svc_blocked THEN RETURN false; END IF;

  SELECT o.activation_blocked_pending_review, o.actual_service_live_at_utc
    INTO v_order_blocked, v_order_live_at
  FROM public.orders o WHERE o.id = v_order_id;
  IF v_order_blocked THEN RETURN false; END IF;
  IF v_order_live_at IS NULL THEN RETURN false; END IF;

  -- When the two-doc flow is enabled, also require accepted CS + CIP hashes on the order.
  SELECT two_document_contract_flow_enabled INTO v_flag_on FROM public.platform_settings LIMIT 1;
  IF v_flag_on IS TRUE THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = v_order_id
        AND o.contract_summary_pdf_hash IS NOT NULL
        AND o.contract_information_pack_pdf_hash IS NOT NULL
    ) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_service_live(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_service_live(uuid) TO authenticated, service_role;

-- 6. Document immutability triggers.
--    Once a CS or CIP is accepted (status/document_status = 'accepted' or accepted_at_utc set),
--    or an acceptance certificate is issued, block updates to the evidentiary fields.

CREATE OR REPLACE FUNCTION public.enforce_contract_summary_immutability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.status = 'accepted' OR OLD.accepted_at_utc IS NOT NULL) THEN
    IF NEW.pdf_hash IS DISTINCT FROM OLD.pdf_hash
       OR NEW.pdf_storage_path IS DISTINCT FROM OLD.pdf_storage_path
       OR NEW.pdf_storage_key IS DISTINCT FROM OLD.pdf_storage_key
       OR NEW.pdf_sha256 IS DISTINCT FROM OLD.pdf_sha256
       OR NEW.accepted_at_utc IS DISTINCT FROM OLD.accepted_at_utc
       OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.version IS DISTINCT FROM OLD.version THEN
      RAISE EXCEPTION 'contract_summary_immutable_after_acceptance';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cs_immutable ON public.contract_summaries;
CREATE TRIGGER trg_cs_immutable
  BEFORE UPDATE ON public.contract_summaries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_contract_summary_immutability();

CREATE OR REPLACE FUNCTION public.enforce_cip_immutability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.document_status = 'accepted' OR OLD.accepted_at_utc IS NOT NULL) THEN
    IF NEW.pdf_hash IS DISTINCT FROM OLD.pdf_hash
       OR NEW.pdf_storage_path IS DISTINCT FROM OLD.pdf_storage_path
       OR NEW.accepted_at_utc IS DISTINCT FROM OLD.accepted_at_utc
       OR NEW.document_status IS DISTINCT FROM OLD.document_status
       OR NEW.version IS DISTINCT FROM OLD.version THEN
      RAISE EXCEPTION 'contract_information_pack_immutable_after_acceptance';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cip_immutable ON public.contract_information_packs;
CREATE TRIGGER trg_cip_immutable
  BEFORE UPDATE ON public.contract_information_packs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cip_immutability();

CREATE OR REPLACE FUNCTION public.enforce_certificate_immutability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Acceptance certificates are always immutable once created.
    RAISE EXCEPTION 'acceptance_certificate_immutable';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cert_immutable ON public.acceptance_certificates;
CREATE TRIGGER trg_cert_immutable
  BEFORE UPDATE ON public.acceptance_certificates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_certificate_immutability();
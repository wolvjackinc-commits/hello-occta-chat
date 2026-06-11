
-- provisioning_readiness: admin checklist ticks
CREATE TABLE public.provisioning_readiness (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_request_id uuid NOT NULL UNIQUE REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  contract_summary_id uuid NOT NULL REFERENCES public.contract_summaries(id) ON DELETE CASCADE,
  installation_confirmed boolean NOT NULL DEFAULT false,
  router_confirmed boolean NOT NULL DEFAULT false,
  internal_notes_reviewed boolean NOT NULL DEFAULT false,
  admin_review_complete boolean NOT NULL DEFAULT false,
  reviewer_user_id uuid,
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provisioning_readiness TO authenticated;
GRANT ALL ON public.provisioning_readiness TO service_role;

ALTER TABLE public.provisioning_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage provisioning_readiness"
  ON public.provisioning_readiness
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_provisioning_readiness_updated_at
  BEFORE UPDATE ON public.provisioning_readiness
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- draft_order_packs: append-only snapshots
CREATE TABLE public.draft_order_packs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_request_id uuid NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  contract_summary_id uuid NOT NULL REFERENCES public.contract_summaries(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  snapshot jsonb NOT NULL,
  generated_by uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_request_id, version)
);

CREATE INDEX idx_draft_order_packs_pr ON public.draft_order_packs(payment_request_id, version DESC);

-- Append-only: grant only SELECT + INSERT to authenticated. No UPDATE/DELETE for anyone in app role.
GRANT SELECT, INSERT ON public.draft_order_packs TO authenticated;
GRANT ALL ON public.draft_order_packs TO service_role;

ALTER TABLE public.draft_order_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read draft_order_packs"
  ON public.draft_order_packs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert draft_order_packs"
  ON public.draft_order_packs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
-- Intentionally no UPDATE or DELETE policies => append-only at RLS layer.

-- DB-level guard: enforce verified-payment + accepted-CS chain before draft pack insert.
CREATE OR REPLACE FUNCTION public.draft_order_pack_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pr record;
  v_cs record;
  v_q_status text;
  v_qr_status text;
  v_has_acceptance boolean;
  v_next_version int;
BEGIN
  SELECT id, status, webhook_verified, paid_at, contract_summary_id, quote_id, quote_request_id, amount, currency
    INTO v_pr
  FROM public.payment_requests
  WHERE id = NEW.payment_request_id;
  IF v_pr.id IS NULL THEN
    RAISE EXCEPTION 'verified payment required before draft order pack generation (payment_request not found)';
  END IF;
  IF v_pr.status <> 'paid' OR v_pr.webhook_verified IS NOT TRUE OR v_pr.paid_at IS NULL THEN
    RAISE EXCEPTION 'verified payment required before draft order pack generation';
  END IF;

  IF v_pr.contract_summary_id IS NULL OR v_pr.contract_summary_id <> NEW.contract_summary_id THEN
    RAISE EXCEPTION 'verified payment required before draft order pack generation (contract_summary mismatch)';
  END IF;

  SELECT id, status::text AS status, pdf_storage_key, pdf_sha256, quote_id, quote_request_id
    INTO v_cs
  FROM public.contract_summaries
  WHERE id = NEW.contract_summary_id;
  IF v_cs.id IS NULL OR v_cs.status <> 'accepted' THEN
    RAISE EXCEPTION 'verified payment required before draft order pack generation (contract_summary not accepted)';
  END IF;
  IF v_cs.pdf_storage_key IS NULL OR v_cs.pdf_sha256 IS NULL THEN
    RAISE EXCEPTION 'verified payment required before draft order pack generation (accepted CS PDF missing)';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contract_acceptances WHERE contract_summary_id = NEW.contract_summary_id
  ) INTO v_has_acceptance;
  IF NOT v_has_acceptance THEN
    RAISE EXCEPTION 'verified payment required before draft order pack generation (no contract_acceptance)';
  END IF;

  SELECT status::text INTO v_q_status FROM public.quotes WHERE id = v_cs.quote_id;
  IF v_q_status IS DISTINCT FROM 'contract_summary_accepted' THEN
    RAISE EXCEPTION 'verified payment required before draft order pack generation (quote not contract_summary_accepted)';
  END IF;

  SELECT status::text INTO v_qr_status FROM public.quote_requests WHERE id = v_cs.quote_request_id;
  IF v_qr_status IS DISTINCT FROM 'contract_summary_accepted' THEN
    RAISE EXCEPTION 'verified payment required before draft order pack generation (quote_request not contract_summary_accepted)';
  END IF;

  -- Auto-version per payment_request_id
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM public.draft_order_packs WHERE payment_request_id = NEW.payment_request_id;
  NEW.version := v_next_version;

  -- Audit log
  PERFORM public.log_event(
    'admin', 'draft_order_pack_generated', 'Draft order pack generated',
    jsonb_build_object('payment_request_id', NEW.payment_request_id, 'contract_summary_id', NEW.contract_summary_id, 'version', NEW.version),
    NULL, NULL, NULL, v_cs.quote_id, NEW.contract_summary_id, NULL, NULL, NULL, NULL, NULL, NULL, 'provisioning', 'info'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_draft_order_pack_guard
  BEFORE INSERT ON public.draft_order_packs
  FOR EACH ROW EXECUTE FUNCTION public.draft_order_pack_guard();

-- Block any UPDATE/DELETE on draft_order_packs at trigger level too (defence in depth).
CREATE OR REPLACE FUNCTION public.draft_order_pack_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'draft_order_packs is append-only';
END;
$$;

CREATE TRIGGER trg_draft_order_pack_no_update
  BEFORE UPDATE ON public.draft_order_packs
  FOR EACH ROW EXECUTE FUNCTION public.draft_order_pack_block_mutation();

CREATE TRIGGER trg_draft_order_pack_no_delete
  BEFORE DELETE ON public.draft_order_packs
  FOR EACH ROW EXECUTE FUNCTION public.draft_order_pack_block_mutation();

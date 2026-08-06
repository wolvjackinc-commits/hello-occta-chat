-- =====================================================================
-- 1. MULTI-PROVIDER DIRECT DEBIT CONFIGURATION (manual portal only)
-- =====================================================================
CREATE TABLE public.dd_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  legal_collection_name text NOT NULL,
  service_user_number text NOT NULL,
  advance_notice_working_days integer NOT NULL,
  mandate_template_name text NOT NULL,
  guarantee_template_name text NOT NULL,
  guarantee_version_label text NOT NULL,
  submission_mode text NOT NULL DEFAULT 'manual_portal',
  enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dd_providers_sun_chk CHECK (service_user_number ~ '^[0-9]{6}$'),
  CONSTRAINT dd_providers_notice_chk CHECK (advance_notice_working_days > 0),
  CONSTRAINT dd_providers_mode_chk CHECK (submission_mode = 'manual_portal')
);

CREATE UNIQUE INDEX dd_providers_single_default ON public.dd_providers (is_default) WHERE is_default;

GRANT SELECT ON public.dd_providers TO authenticated;
GRANT ALL ON public.dd_providers TO service_role;
ALTER TABLE public.dd_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dd_providers_staff_read" ON public.dd_providers
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "dd_providers_service_all" ON public.dd_providers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER dd_providers_updated_at BEFORE UPDATE ON public.dd_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.dd_providers (
  provider_code, display_name, legal_collection_name, service_user_number,
  advance_notice_working_days, mandate_template_name, guarantee_template_name,
  guarantee_version_label, submission_mode, enabled, is_default
) VALUES
  ('fastpay', 'FastPay', 'FastPay Ltd', '246668', 5,
   'DDI - OCCTA Ltd.pdf', 'DDI - OCCTA Ltd.pdf', 'DDI - OCCTA Ltd.pdf', 'manual_portal', true, false),
  ('accesspay', 'AccessPay — APS Re OCCTA', 'APS Re OCCTA', '538166', 3,
   'Occta Mandate.pdf', 'Occta Mandate.pdf', 'Occta Mandate.pdf', 'manual_portal', true, false);

-- Backwards-compatibility: keep the old singleton name readable.
ALTER TABLE public.dd_provider_config RENAME TO dd_provider_config_legacy;

CREATE VIEW public.dd_provider_config
WITH (security_invoker = off) AS
  SELECT
    p.id,
    true AS singleton,
    p.legal_collection_name AS provider_name,
    p.service_user_number,
    p.mandate_template_name AS ddi_template_version,
    p.guarantee_version_label AS guarantee_version,
    p.advance_notice_working_days AS advance_notice_days,
    NULL::text AS provider_support_contact,
    NULL::date AS provider_approval_date,
    false AS live_collection_enabled,
    p.created_at,
    p.updated_at
  FROM public.dd_providers p
  WHERE p.enabled
    AND public.is_staff(auth.uid())
  ORDER BY p.is_default DESC, p.provider_code;

GRANT SELECT ON public.dd_provider_config TO authenticated;
GRANT SELECT ON public.dd_provider_config TO service_role;

-- =====================================================================
-- 2. MANDATE COLUMNS: provider selection, encryption, masking, test flag
-- =====================================================================
ALTER TABLE public.dd_mandates
  ADD COLUMN provider_code text REFERENCES public.dd_providers(provider_code),
  ADD COLUMN submitted_to_provider_at timestamptz,
  ADD COLUMN is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN bank_details_ciphertext bytea,
  ADD COLUMN enc_key_id text,
  ADD COLUMN enc_alg text,
  ADD COLUMN enc_nonce bytea,
  ADD COLUMN masked_account_last4 text,
  ADD COLUMN masked_sort_last2 text,
  ADD COLUMN plaintext_purged_at timestamptz;

CREATE INDEX idx_dd_mandates_provider_code ON public.dd_mandates (provider_code);
CREATE INDEX idx_dd_mandates_is_test ON public.dd_mandates (is_test) WHERE is_test;

ALTER TABLE public.dd_mandates DROP CONSTRAINT IF EXISTS dd_mandates_status_check;
ALTER TABLE public.dd_mandates ADD CONSTRAINT dd_mandates_status_check CHECK (
  status = ANY (ARRAY[
    'details_received','pending_contract','awaiting_manual_submission',
    'submitted_to_provider','active','action_required','rejected','failed','cancelled',
    -- legacy values preserved so existing records stay valid
    'pending','verified','submitted'
  ])
);

-- Browser clients: read-only, non-sensitive columns only. No direct writes.
REVOKE ALL ON public.dd_mandates FROM authenticated;
GRANT SELECT (
  id, user_id, status, mandate_reference, bank_last4, provider, provider_code,
  provider_reference, account_holder, account_holder_name, created_at, updated_at,
  consent_timestamp, payment_request_id, submitted_to_provider_at, is_test,
  masked_account_last4, masked_sort_last2, plaintext_purged_at
) ON public.dd_mandates TO authenticated;
GRANT ALL ON public.dd_mandates TO service_role;

-- =====================================================================
-- 3. STATUS HISTORY
-- =====================================================================
CREATE TABLE public.dd_mandate_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id uuid NOT NULL REFERENCES public.dd_mandates(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  provider_code text,
  provider_reference text,
  submitted_at timestamptz,
  changed_by uuid,
  internal_note text,
  override_reason text,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dd_status_history_mandate ON public.dd_mandate_status_history (mandate_id, created_at DESC);

GRANT SELECT ON public.dd_mandate_status_history TO authenticated;
GRANT ALL ON public.dd_mandate_status_history TO service_role;
ALTER TABLE public.dd_mandate_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dd_history_staff_read" ON public.dd_mandate_status_history
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'finance_admin') OR public.has_role(auth.uid(), 'compliance_admin')
  );
CREATE POLICY "dd_history_service_all" ON public.dd_mandate_status_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- 4. CUSTOMER NOTIFICATION OUTBOX
-- =====================================================================
CREATE TABLE public.dd_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id uuid NOT NULL REFERENCES public.dd_mandates(id) ON DELETE CASCADE,
  status_history_id uuid REFERENCES public.dd_mandate_status_history(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL UNIQUE,
  template_key text NOT NULL,
  recipient_email text,
  subject text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  retry_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_error text,
  sent_at timestamptz,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dd_email_outbox_status_chk CHECK (
    status = ANY (ARRAY['pending','sending','sent','failed','cancelled','suppressed_test'])
  )
);

CREATE INDEX idx_dd_email_outbox_pending ON public.dd_email_outbox (status, created_at)
  WHERE status IN ('pending','failed');

GRANT SELECT ON public.dd_email_outbox TO authenticated;
GRANT ALL ON public.dd_email_outbox TO service_role;
ALTER TABLE public.dd_email_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dd_outbox_staff_read" ON public.dd_email_outbox
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'finance_admin') OR public.has_role(auth.uid(), 'compliance_admin')
  );
CREATE POLICY "dd_outbox_service_all" ON public.dd_email_outbox
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER dd_email_outbox_updated_at BEFORE UPDATE ON public.dd_email_outbox
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 5. LIFECYCLE HELPERS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.dd_normalise_status(_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _status
    WHEN 'pending' THEN 'details_received'
    WHEN 'verified' THEN 'awaiting_manual_submission'
    WHEN 'submitted' THEN 'submitted_to_provider'
    ELSE _status
  END;
$$;

CREATE OR REPLACE FUNCTION public.dd_allowed_next_statuses(_status text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE public.dd_normalise_status(_status)
    WHEN 'details_received' THEN ARRAY['pending_contract','awaiting_manual_submission','cancelled']
    WHEN 'pending_contract' THEN ARRAY['awaiting_manual_submission','cancelled']
    WHEN 'awaiting_manual_submission' THEN ARRAY['submitted_to_provider','cancelled']
    WHEN 'submitted_to_provider' THEN ARRAY['active','action_required','rejected','failed','cancelled']
    WHEN 'action_required' THEN ARRAY['awaiting_manual_submission','submitted_to_provider','cancelled']
    WHEN 'active' THEN ARRAY['cancelled','failed']
    WHEN 'failed' THEN ARRAY['awaiting_manual_submission','cancelled']
    WHEN 'rejected' THEN ARRAY['awaiting_manual_submission','cancelled']
    WHEN 'cancelled' THEN ARRAY[]::text[]
    ELSE ARRAY[]::text[]
  END;
$$;

CREATE OR REPLACE FUNCTION public.dd_status_customer_label(_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE public.dd_normalise_status(_status)
    WHEN 'details_received' THEN 'Bank details received'
    WHEN 'pending_contract' THEN 'Waiting for your agreement to be completed'
    WHEN 'awaiting_manual_submission' THEN 'Ready to be set up with our Direct Debit provider'
    WHEN 'submitted_to_provider' THEN 'Submitted to our Direct Debit provider'
    WHEN 'active' THEN 'Active and ready for collections'
    WHEN 'action_required' THEN 'Action needed from you'
    WHEN 'rejected' THEN 'Not accepted'
    WHEN 'failed' THEN 'Unsuccessful'
    WHEN 'cancelled' THEN 'Cancelled'
    ELSE _status
  END;
$$;

CREATE OR REPLACE FUNCTION public.dd_status_subject(_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE public.dd_normalise_status(_status)
    WHEN 'submitted_to_provider' THEN 'Your OCCTA Direct Debit instruction has been submitted'
    WHEN 'active' THEN 'Your OCCTA Direct Debit is now active'
    WHEN 'action_required' THEN 'Action needed for your OCCTA Direct Debit'
    WHEN 'rejected' THEN 'Your OCCTA Direct Debit instruction was not accepted'
    WHEN 'failed' THEN 'Your OCCTA Direct Debit instruction was not accepted'
    WHEN 'cancelled' THEN 'Your OCCTA Direct Debit has been cancelled'
    ELSE 'Update to your OCCTA Direct Debit'
  END;
$$;

-- =====================================================================
-- 6. ATOMIC ADMIN STATUS CHANGE (status + history + outbox in one tx)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.dd_admin_change_mandate_status(
  _mandate_id uuid,
  _new_status text,
  _provider_code text DEFAULT NULL,
  _provider_reference text DEFAULT NULL,
  _submitted_at timestamptz DEFAULT NULL,
  _internal_note text DEFAULT NULL,
  _override_reason text DEFAULT NULL,
  _actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  actor uuid;
  is_service boolean := (current_setting('role', true) = 'service_role' OR auth.uid() IS NULL);
  is_super boolean := false;
  eff_provider text;
  eff_reference text;
  eff_submitted timestamptz;
  prov record;
  history_id uuid;
  recipient text;
  cust_name text;
  acct_number text;
  outbox_id uuid;
  outbox_status text;
BEGIN
  actor := COALESCE(auth.uid(), _actor);

  IF auth.uid() IS NOT NULL THEN
    IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
            OR has_role(auth.uid(), 'finance_admin')) THEN
      RETURN jsonb_build_object('success', false, 'error', 'forbidden');
    END IF;
    is_super := has_role(auth.uid(), 'super_admin');
  ELSE
    is_super := true; -- service role / backend orchestrator
  END IF;

  SELECT * INTO m FROM dd_mandates WHERE id = _mandate_id FOR UPDATE;
  IF m.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'mandate_not_found');
  END IF;

  IF _new_status IS NULL OR _new_status NOT IN (
    'details_received','pending_contract','awaiting_manual_submission',
    'submitted_to_provider','active','action_required','rejected','failed','cancelled'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status');
  END IF;

  -- No-op guard
  IF dd_normalise_status(m.status) = _new_status THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_op_status_change');
  END IF;

  -- Transition validity
  IF NOT (_new_status = ANY (dd_allowed_next_statuses(m.status))) THEN
    IF NOT is_super OR _override_reason IS NULL OR length(btrim(_override_reason)) < 5 THEN
      RETURN jsonb_build_object(
        'success', false, 'error', 'invalid_transition',
        'from', dd_normalise_status(m.status), 'to', _new_status,
        'allowed', to_jsonb(dd_allowed_next_statuses(m.status))
      );
    END IF;
  END IF;

  eff_provider := COALESCE(NULLIF(btrim(COALESCE(_provider_code, '')), ''), m.provider_code);
  eff_reference := COALESCE(NULLIF(btrim(COALESCE(_provider_reference, '')), ''), m.provider_reference);
  eff_submitted := COALESCE(_submitted_at, m.submitted_to_provider_at);

  -- Manual provider must be explicitly selected before any provider-dependent state
  IF _new_status IN ('submitted_to_provider','active','action_required','rejected','failed') THEN
    IF eff_provider IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'provider_selection_required');
    END IF;
  END IF;

  IF eff_provider IS NOT NULL THEN
    SELECT * INTO prov FROM dd_providers WHERE provider_code = eff_provider;
    IF prov.provider_code IS NULL OR NOT prov.enabled THEN
      RETURN jsonb_build_object('success', false, 'error', 'provider_not_configured');
    END IF;
  END IF;

  IF _new_status = 'submitted_to_provider' THEN
    IF eff_reference IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'provider_reference_required');
    END IF;
    IF eff_submitted IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'submission_date_required');
    END IF;
  END IF;

  UPDATE dd_mandates SET
    status = _new_status,
    provider_code = eff_provider,
    provider = COALESCE(eff_provider, provider),
    provider_reference = eff_reference,
    submitted_to_provider_at = eff_submitted,
    updated_at = now()
  WHERE id = _mandate_id;

  INSERT INTO dd_mandate_status_history (
    mandate_id, old_status, new_status, provider_code, provider_reference,
    submitted_at, changed_by, internal_note, override_reason, is_test
  ) VALUES (
    _mandate_id, m.status, _new_status, eff_provider, eff_reference,
    eff_submitted, actor, NULLIF(btrim(COALESCE(_internal_note, '')), ''),
    NULLIF(btrim(COALESCE(_override_reason, '')), ''), m.is_test
  ) RETURNING id INTO history_id;

  -- Resolve recipient (non-sensitive contact data only)
  IF m.payment_request_id IS NOT NULL THEN
    SELECT customer_email, customer_name, account_number
      INTO recipient, cust_name, acct_number
      FROM payment_requests WHERE id = m.payment_request_id;
  END IF;
  IF recipient IS NULL THEN
    SELECT email, full_name, account_number
      INTO recipient, cust_name, acct_number
      FROM profiles WHERE id = m.user_id;
  END IF;

  outbox_status := CASE WHEN m.is_test THEN 'suppressed_test' ELSE 'pending' END;

  INSERT INTO dd_email_outbox (
    mandate_id, status_history_id, idempotency_key, template_key,
    recipient_email, subject, payload, status, is_test
  ) VALUES (
    _mandate_id, history_id,
    'dd-status:' || _mandate_id::text || ':' || history_id::text || ':' || _new_status,
    'dd-status-change',
    recipient,
    dd_status_subject(_new_status),
    jsonb_strip_nulls(jsonb_build_object(
      'customer_name', cust_name,
      'account_number', acct_number,
      'mandate_reference', m.mandate_reference,
      'mandate_bank_last4', m.bank_last4,
      'new_status', _new_status,
      'new_status_label', dd_status_customer_label(_new_status),
      'old_status', dd_normalise_status(m.status),
      'provider_code', eff_provider,
      'provider_display_name', prov.display_name,
      'provider_collection_name', prov.legal_collection_name,
      'provider_service_user_number', prov.service_user_number,
      'advance_notice_working_days', prov.advance_notice_working_days,
      'provider_reference', CASE WHEN _new_status IN ('submitted_to_provider','active') THEN eff_reference ELSE NULL END,
      'updated_at', now()
    )),
    outbox_status,
    m.is_test
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO outbox_id;

  IF outbox_id IS NULL THEN
    SELECT id INTO outbox_id FROM dd_email_outbox
    WHERE idempotency_key = 'dd-status:' || _mandate_id::text || ':' || history_id::text || ':' || _new_status;
  END IF;

  INSERT INTO audit_logs (actor_user_id, action, entity, entity_id, metadata)
  VALUES (actor, 'dd_status_change', 'dd_mandate', _mandate_id,
    jsonb_strip_nulls(jsonb_build_object(
      'old_status', m.status, 'new_status', _new_status,
      'provider_code', eff_provider, 'provider_reference', eff_reference,
      'status_history_id', history_id, 'outbox_id', outbox_id,
      'is_test', m.is_test, 'override_reason', _override_reason
    )));

  RETURN jsonb_build_object(
    'success', true,
    'mandate_id', _mandate_id,
    'old_status', m.status,
    'new_status', _new_status,
    'provider_code', eff_provider,
    'provider_reference', eff_reference,
    'status_history_id', history_id,
    'outbox_id', outbox_id,
    'outbox_status', outbox_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dd_admin_change_mandate_status(uuid, text, text, text, timestamptz, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dd_admin_change_mandate_status(uuid, text, text, text, timestamptz, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dd_admin_change_mandate_status(uuid, text, text, text, timestamptz, text, text, uuid) TO service_role;

-- =====================================================================
-- 7. MASKED ADMIN/CUSTOMER VIEW REFRESH (adds provider + masked columns)
-- =====================================================================
DROP VIEW IF EXISTS public.dd_mandates_list;
CREATE VIEW public.dd_mandates_list
WITH (security_invoker = off) AS
  SELECT
    id, user_id, status, mandate_reference, bank_last4, account_holder,
    provider_code, provider_reference, submitted_to_provider_at, is_test,
    CASE
      WHEN masked_sort_last2 IS NOT NULL THEN '**-**-' || masked_sort_last2
      WHEN sort_code IS NOT NULL AND length(sort_code) >= 2 THEN '**-**-' || right(sort_code, 2)
      ELSE NULL
    END AS sort_code_masked,
    CASE
      WHEN masked_account_last4 IS NOT NULL THEN '****' || masked_account_last4
      WHEN account_number_full IS NOT NULL AND length(account_number_full) >= 4 THEN '****' || right(account_number_full, 4)
      ELSE NULL
    END AS account_number_masked,
    (bank_details_ciphertext IS NOT NULL OR account_number_full IS NOT NULL) AS has_bank_details,
    consent_timestamp, payment_request_id, created_at, updated_at
  FROM public.dd_mandates
  WHERE auth.uid() = user_id OR has_role(auth.uid(), 'admin')
     OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_admin')
     OR has_role(auth.uid(), 'compliance_admin');

GRANT SELECT ON public.dd_mandates_list TO authenticated;
GRANT SELECT ON public.dd_mandates_list TO service_role;

-- =====================================================================
-- 8. REMOVE THE INDISCRIMINATE EMAIL TRIGGER (outbox replaces it)
-- =====================================================================
DROP TRIGGER IF EXISTS trigger_dd_status_notify ON public.dd_mandates;
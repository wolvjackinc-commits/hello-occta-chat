CREATE OR REPLACE FUNCTION public.dd_admin_change_mandate_status(
  _mandate_id uuid, _new_status text, _provider_code text DEFAULT NULL::text,
  _provider_reference text DEFAULT NULL::text, _submitted_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _internal_note text DEFAULT NULL::text, _override_reason text DEFAULT NULL::text, _actor uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m record;
  actor uuid;
  is_backend boolean := (
    current_user IN ('postgres','supabase_admin','service_role','supabase_storage_admin','sandbox_exec')
    OR current_setting('role', true) = 'service_role'
  );
  is_super boolean := false;
  eff_provider text;
  eff_reference text;
  eff_submitted timestamptz;
  prov_display text;
  prov_collection text;
  prov_sun text;
  prov_notice int;
  prov_enabled boolean;
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
  ELSIF is_backend THEN
    is_super := true;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
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

  IF dd_normalise_status(m.status) = _new_status THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_op_status_change');
  END IF;

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

  IF _new_status IN ('submitted_to_provider','active','action_required','rejected','failed') THEN
    IF eff_provider IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'provider_selection_required');
    END IF;
  END IF;

  IF eff_provider IS NOT NULL THEN
    SELECT display_name, legal_collection_name, service_user_number, advance_notice_working_days, enabled
      INTO prov_display, prov_collection, prov_sun, prov_notice, prov_enabled
      FROM dd_providers WHERE provider_code = eff_provider;
    IF prov_display IS NULL OR NOT COALESCE(prov_enabled, false) THEN
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
      'customer_account_reference', acct_number,
      'mandate_reference', m.mandate_reference,
      'mandate_bank_last4', m.bank_last4,
      'new_status', _new_status,
      'new_status_label', dd_status_customer_label(_new_status),
      'old_status', dd_normalise_status(m.status),
      'provider_code', eff_provider,
      'provider_display_name', prov_display,
      'provider_collection_name', prov_collection,
      'provider_service_user_number', prov_sun,
      'advance_notice_working_days', prov_notice,
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
$function$;

REVOKE ALL ON FUNCTION public.dd_admin_change_mandate_status(uuid,text,text,text,timestamptz,text,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dd_admin_change_mandate_status(uuid,text,text,text,timestamptz,text,text,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.dd_admin_change_mandate_status(uuid,text,text,text,timestamptz,text,text,uuid) TO authenticated, service_role;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.dd_admin_change_mandate_status(uuid,text,text,text,timestamptz,text,text,uuid) TO sandbox_exec';
  END IF;
END $$;
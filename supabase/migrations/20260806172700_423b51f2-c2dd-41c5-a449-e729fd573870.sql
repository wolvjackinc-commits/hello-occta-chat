CREATE OR REPLACE FUNCTION public.journey2_commit_order(_session_id uuid, _recomputed_sha256 text, _guest_order_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s          record;
  snap       record;
  q          record;
  j          record;
  cs         record;
  acc_id     uuid;
  pm         record;
  o_id       uuid;
  o_number   text;
  new_number text;
  recipient  text;
  p          jsonb;
  two_doc    boolean;
BEGIN
  SELECT * INTO s FROM customer_journey_sessions WHERE id = _session_id FOR UPDATE;
  IF s IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'session_not_found'); END IF;
  IF s.test_session THEN RETURN jsonb_build_object('ok', false, 'error', 'test_session_not_allowed'); END IF;
  IF s.checkout_session_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'checkout_session_missing'); END IF;

  SELECT * INTO snap FROM journey2_contract_snapshots WHERE session_id = s.id FOR UPDATE;
  IF snap IS NULL OR snap.snapshot_sha256 IS NULL OR length(snap.snapshot_sha256) <> 64 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'snapshot_invalid');
  END IF;

  -- Byte-for-byte fingerprint match against the canonical recomputation.
  IF _recomputed_sha256 IS NULL OR length(_recomputed_sha256) <> 64
     OR lower(_recomputed_sha256) <> lower(snap.snapshot_sha256) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'snapshot_fingerprint_mismatch');
  END IF;

  p := snap.snapshot -> 'pricing';
  IF p IS NULL OR (p ->> 'amount_due_today')::numeric <> 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount_due_today_must_be_zero');
  END IF;

  IF s.preferred_start_date IS NULL OR s.cooling_off_acknowledged IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'start_date_required');
  END IF;
  IF s.billing_anchor_day IS NULL OR s.dd_masked IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'billing_required');
  END IF;

  -- Contractual data must still match the accepted snapshot exactly.
  IF (snap.snapshot -> 'schedule' ->> 'preferred_start_date') IS DISTINCT FROM s.preferred_start_date::text
     OR (snap.snapshot -> 'schedule' ->> 'billing_day')::int IS DISTINCT FROM s.billing_anchor_day
     OR (snap.snapshot -> 'direct_debit' ->> 'last4') IS DISTINCT FROM (s.dd_masked ->> 'last4')
     OR (snap.snapshot -> 'direct_debit' ->> 'sort_last2') IS DISTINCT FROM (s.dd_masked ->> 'sort_last2')
     OR (snap.snapshot -> 'product' ->> 'speed_bucket') IS DISTINCT FROM s.speed_bucket
     OR (snap.snapshot -> 'product' ->> 'contract_term') IS DISTINCT FROM s.plan_term THEN
    RETURN jsonb_build_object('ok', false, 'error', 'snapshot_data_mismatch');
  END IF;

  SELECT * INTO q FROM quotes WHERE id = s.quote_id;
  IF q IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'quote_missing'); END IF;
  IF abs(coalesce(q.monthly_gross, -1) - (p ->> 'monthly_incl_vat')::numeric) > 0.005 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pricing_mismatch');
  END IF;

  SELECT * INTO j FROM order_journeys WHERE quote_id = q.id ORDER BY created_at DESC LIMIT 1;
  IF j IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'journey_missing'); END IF;
  IF j.contract_accepted_at IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'contract_not_accepted'); END IF;

  SELECT * INTO cs FROM contract_summaries
   WHERE quote_id = q.id AND status <> 'superseded'
   ORDER BY version DESC LIMIT 1;
  IF cs IS NULL OR cs.status <> 'accepted' OR cs.accepted_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'contract_summary_not_accepted');
  END IF;

  -- The Contract Information Pack only exists in the two-document flow. In the
  -- standard single-document flow the Contract Summary plus the agreement pack
  -- generated from the snapshot is the contractual record, so the pack is only
  -- mandatory while the two-document flow is switched on.
  SELECT coalesce(bool_or(two_document_contract_flow_enabled), false) INTO two_doc FROM platform_settings;
  IF two_doc AND NOT EXISTS (SELECT 1 FROM contract_information_packs WHERE contract_summary_id = cs.id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'contract_information_missing');
  END IF;

  SELECT id INTO acc_id FROM contract_acceptances
   WHERE contract_summary_id = cs.id ORDER BY accepted_at ASC LIMIT 1;
  IF acc_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'acceptance_evidence_missing'); END IF;

  SELECT * INTO pm FROM payment_methods WHERE journey_id = j.id AND active IS TRUE LIMIT 1;
  IF pm IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'payment_method_missing'); END IF;

  -- Idempotent order creation, enforced by the unique checkout-session index.
  SELECT id, occta_order_number INTO o_id, o_number
    FROM orders WHERE checkout_session_id = s.checkout_session_id;

  IF o_id IS NULL THEN
    new_number := generate_occta_order_number();
    INSERT INTO orders (
      user_id, customer_id, journey_id, quote_id, contract_summary_id,
      contract_acceptance_id, payment_method_id, guest_order_id,
      occta_order_number, lifecycle_status, service_type, plan_name, plan_price,
      postcode, address_line1, address_line2, city,
      preferred_start_date, cooling_off_ends_at, billing_anchor_day,
      payment_method, status, journey_version, checkout_session_id
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', NULL, j.id, q.id, cs.id,
      acc_id, pm.id, _guest_order_id,
      new_number, 'order_received', q.service_type, q.plan_name, q.monthly_gross,
      upper(coalesce(s.postcode, '')),
      coalesce(nullif(s.service_address ->> 'address_line_1', ''), 'Address to be confirmed'),
      nullif(s.service_address ->> 'address_line_2', ''),
      coalesce(nullif(s.service_address ->> 'town', ''), 'To be confirmed'),
      s.preferred_start_date, j.cooling_off_ends_at, s.billing_anchor_day,
      pm.method, 'pending', 'v2', s.checkout_session_id
    )
    ON CONFLICT (checkout_session_id) DO NOTHING
    RETURNING id, occta_order_number INTO o_id, o_number;

    IF o_id IS NULL THEN
      SELECT id, occta_order_number INTO o_id, o_number
        FROM orders WHERE checkout_session_id = s.checkout_session_id;
    ELSE
      INSERT INTO order_status_history (order_id, previous_status, new_status, source, customer_note, metadata)
      VALUES (o_id, NULL, 'order_received', 'journey2_submit', 'Order received',
              jsonb_build_object('journey_id', j.id, 'quote_id', q.id,
                                 'checkout_session_id', s.checkout_session_id,
                                 'snapshot_sha256', snap.snapshot_sha256));
    END IF;
  END IF;

  IF o_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'order_create_failed'); END IF;

  UPDATE order_journeys
     SET order_id = o_id, status = 'completed', current_step = 'complete',
         submitted_at = coalesce(submitted_at, now()),
         completed_at = coalesce(completed_at, now())
   WHERE id = j.id;

  UPDATE payment_methods
     SET checkout_session_id = coalesce(checkout_session_id, s.checkout_session_id),
         journey_version = 'v2',
         dd_setup_status = CASE WHEN dd_setup_status IN ('active','submitted_to_provider')
                                THEN dd_setup_status ELSE 'setup_requested' END
   WHERE id = pm.id;

  recipient := coalesce(s.customer_details ->> 'email', '');

  IF recipient <> '' THEN
    INSERT INTO journey2_account_provisioning (
      order_id, session_id, checkout_session_id, email, full_name, status
    ) VALUES (
      o_id, s.id, s.checkout_session_id, recipient,
      nullif(s.customer_details ->> 'full_name', ''), 'pending'
    )
    ON CONFLICT (order_id) DO NOTHING;

    INSERT INTO journey2_email_outbox (
      order_id, session_id, checkout_session_id, email_type, recipient_email, subject, attachments, status
    ) VALUES (
      o_id, s.id, s.checkout_session_id, 'journey2_welcome_pack', recipient,
      'Your OCCTA order is confirmed',
      jsonb_build_array('contract_summary','contract_information','acceptance_certificate',
                        'agreement_pack','order_summary','dd_instruction_confirmation',
                        'dd_guarantee','cooling_off_information'),
      'pending'
    )
    ON CONFLICT (order_id, email_type) DO NOTHING;
  END IF;

  UPDATE customer_journey_sessions
     SET status = 'completed', current_step = 'complete', last_completed_step = 'review',
         order_id = o_id,
         contract_summary_id = cs.id, contract_acceptance_id = acc_id,
         payment_method_id = pm.id, contract_snapshot_id = snap.id,
         dd_status = CASE WHEN dd_status IN ('active','submitted_to_provider')
                          THEN dd_status ELSE 'setup_requested' END,
         submitted_at = coalesce(submitted_at, now()),
         completed_at = coalesce(completed_at, now()),
         last_activity_at = now(), last_error = NULL
   WHERE id = s.id;

  RETURN jsonb_build_object('ok', true, 'order_id', o_id, 'order_number', o_number,
                            'snapshot_sha256', snap.snapshot_sha256);
END;
$function$;
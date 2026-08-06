-- 0. Compliance-safe exception: filling a blank account owner is metadata,
--    not contract content. All other columns must remain byte-identical.
CREATE OR REPLACE FUNCTION public.prevent_accepted_contract_summary_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'accepted' THEN
      RAISE EXCEPTION 'compliance_immutability: cannot delete accepted contract_summaries row (id=%). Insert a new version instead.', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'accepted' THEN
    IF OLD.customer_id IS NULL
       AND NEW.customer_id IS NOT NULL
       AND ((to_jsonb(NEW) - 'customer_id' - 'updated_at')
            = (to_jsonb(OLD) - 'customer_id' - 'updated_at')) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'compliance_immutability: cannot update accepted contract_summaries row (id=%). Insert a new version with supersedes reference instead.', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- 1. Shared linking engine (no direct client access)
CREATE OR REPLACE FUNCTION public.link_customer_records(_uid uuid, _email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(_email));
  c jsonb := '{}'::jsonb;
  n integer;
  v_conflicts integer := 0;
BEGIN
  IF _uid IS NULL OR v_email IS NULL OR length(v_email) = 0 THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'missing_identity');
  END IF;

  -- ensure a profile row exists (other records reference profiles)
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (_uid, v_email, '')
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.profiles p SET email = v_email, updated_at = now()
  WHERE p.id = _uid AND (p.email IS NULL OR length(trim(p.email)) = 0);
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('profiles', n);

  UPDATE public.quote_requests q SET customer_id = _uid, updated_at = now()
  WHERE q.customer_id IS NULL AND lower(q.email) = v_email;
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('quote_requests', n);

  UPDATE public.guest_orders g SET user_id = _uid, linked_at = now()
  WHERE g.user_id IS NULL AND lower(g.email) = v_email;
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('guest_orders', n);

  UPDATE public.contract_summaries cs SET customer_id = _uid
  WHERE cs.customer_id IS NULL AND lower(cs.customer_email_snapshot) = v_email;
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('contract_summaries', n);

  -- Acceptances and certificates are append-only/immutable: visibility is
  -- derived from the linked contract summary, never rewritten.
  SELECT count(*) INTO n FROM public.contract_acceptances ca
  WHERE lower(ca.accepted_by_email) = v_email
    AND ca.contract_summary_id IN (SELECT id FROM public.contract_summaries WHERE customer_id = _uid);
  c := c || jsonb_build_object('contract_acceptances_visible', n);

  SELECT count(*) INTO n FROM public.acceptance_certificates ac
  WHERE ac.contract_summary_id IN (SELECT id FROM public.contract_summaries WHERE customer_id = _uid);
  c := c || jsonb_build_object('acceptance_certificates_visible', n);

  -- canonical orders, only via unambiguous relational chains
  UPDATE public.orders o
  SET customer_id = _uid, user_id = _uid, updated_at = now()
  WHERE o.customer_id IS NULL
    AND (
      o.guest_order_id IN (SELECT id FROM public.guest_orders WHERE user_id = _uid)
      OR o.quote_id IN (SELECT id FROM public.quote_requests WHERE customer_id = _uid)
      OR o.contract_summary_id IN (SELECT id FROM public.contract_summaries WHERE customer_id = _uid)
      OR o.journey_id IN (SELECT id FROM public.order_journeys WHERE customer_id = _uid)
    );
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('orders', n);

  UPDATE public.guest_orders g SET linked_order_id = o.id
  FROM public.orders o
  WHERE g.user_id = _uid AND g.linked_order_id IS NULL AND o.guest_order_id = g.id;
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('guest_order_backlinks', n);

  UPDATE public.order_journeys j
  SET customer_id = _uid,
      linked_customer_id = COALESCE(j.linked_customer_id, _uid),
      linked_at = COALESCE(j.linked_at, now()),
      updated_at = now()
  WHERE j.customer_id IS NULL
    AND (
      j.order_id IN (SELECT id FROM public.orders WHERE customer_id = _uid)
      OR j.quote_id IN (SELECT id FROM public.quote_requests WHERE customer_id = _uid)
      OR j.contract_summary_id IN (SELECT id FROM public.contract_summaries WHERE customer_id = _uid)
    );
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('order_journeys', n);

  UPDATE public.payment_methods pm SET customer_id = _uid, updated_at = now()
  WHERE pm.customer_id IS NULL
    AND (
      pm.journey_id IN (SELECT id FROM public.order_journeys WHERE customer_id = _uid)
      OR pm.id IN (SELECT payment_method_id FROM public.orders WHERE customer_id = _uid AND payment_method_id IS NOT NULL)
    );
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('payment_methods', n);

  -- ownership conflicts: same verified email already owned by another user
  SELECT count(*) INTO v_conflicts FROM (
    SELECT 1 FROM public.guest_orders WHERE lower(email) = v_email AND user_id IS NOT NULL AND user_id <> _uid
    UNION ALL
    SELECT 1 FROM public.contract_summaries WHERE lower(customer_email_snapshot) = v_email AND customer_id IS NOT NULL AND customer_id <> _uid
    UNION ALL
    SELECT 1 FROM public.contract_acceptances WHERE lower(accepted_by_email) = v_email AND customer_id IS NOT NULL AND customer_id <> _uid
  ) s;

  c := c || jsonb_build_object('conflicts', v_conflicts, 'status', 'ok');

  IF (SELECT COALESCE(sum(v::int), 0) FROM jsonb_each_text(
        c - 'status' - 'conflicts' - 'contract_acceptances_visible' - 'acceptance_certificates_visible'
      ) AS t(k, v)) > 0
     OR v_conflicts > 0 THEN
    INSERT INTO public.audit_logs (actor_user_id, action, entity, entity_id, metadata)
    VALUES (_uid, 'customer_account_link', 'profiles', _uid, c);
  END IF;

  RETURN c;
END;
$$;

REVOKE ALL ON FUNCTION public.link_customer_records(uuid, text) FROM PUBLIC, anon, authenticated;

-- 2. Canonical authenticated entry point: identity derived server-side only
CREATE OR REPLACE FUNCTION public.link_my_customer_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT lower(u.email), u.email_confirmed_at INTO v_email, v_confirmed
  FROM auth.users u WHERE u.id = v_uid;

  IF v_email IS NULL OR length(v_email) = 0 THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'no_email');
  END IF;
  IF v_confirmed IS NULL THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'email_unverified');
  END IF;

  RETURN public.link_customer_records(v_uid, v_email);
END;
$$;

REVOKE ALL ON FUNCTION public.link_my_customer_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_my_customer_account() TO authenticated;

-- 3. Repaired customer overview: correct owner columns, fault isolation, masked DD
CREATE OR REPLACE FUNCTION public.get_my_customer_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile jsonb; v_order jsonb; v_service jsonb; v_invoices jsonb := '[]'::jsonb;
  v_prs jsonb := '[]'::jsonb; v_receipts jsonb := '[]'::jsonb; v_documents jsonb := '{}'::jsonb;
  v_pm jsonb; v_timeline jsonb := '[]'::jsonb; v_dd jsonb;
  v_order_id uuid; v_service_id uuid; v_account_no text;
  v_errors text[] := '{}';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  BEGIN
    SELECT jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone,
      'account_number', p.account_number, 'address_line1', p.address_line1,
      'city', p.city, 'postcode', p.postcode
    ), p.account_number
    INTO v_profile, v_account_no
    FROM public.profiles p WHERE p.id = v_uid;
  EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'profile'; END;

  BEGIN
    SELECT o.id INTO v_order_id
    FROM public.orders o
    WHERE o.customer_id = v_uid OR o.user_id = v_uid
    ORDER BY
      CASE o.lifecycle_status WHEN 'live' THEN 0
                              WHEN 'committed' THEN 1
                              WHEN 'processing' THEN 2
                              WHEN 'ordered' THEN 3
                              WHEN 'order_received' THEN 4
                              WHEN 'on_hold' THEN 5
                              ELSE 9 END,
      o.created_at DESC
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'order_lookup'; END;

  IF v_order_id IS NOT NULL THEN
    BEGIN
      SELECT jsonb_build_object(
        'id', o.id,
        'occta_order_number', o.occta_order_number,
        'lifecycle_status',   o.lifecycle_status,
        'plan_name',          COALESCE(cs.plan_name, o.plan_name),
        'service_type',       COALESCE(cs.service_type::text, o.service_type),
        'monthly_price',      COALESCE(cs.monthly_price_incl_vat, o.plan_price),
        'estimated_download_speed', cs.estimated_download_speed,
        'estimated_upload_speed',   cs.estimated_upload_speed,
        'preferred_start_date',   o.expected_activation_date,
        'actual_activation_date', o.actual_activation_date,
        'contract_length',  cs.contract_length,
        'notice_period',    cs.notice_period,
        'service_address',  COALESCE(cs.service_address,
          concat_ws(', ', o.address_line1, o.address_line2, o.city, o.postcode)),
        'created_at',       o.created_at
      )
      INTO v_order
      FROM public.orders o
      LEFT JOIN public.contract_summaries cs ON cs.id = o.contract_summary_id
      WHERE o.id = v_order_id;
    EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'order'; END;

    BEGIN
      SELECT jsonb_build_object(
        'type', pm.method,
        'billing_anchor_day', pm.billing_anchor_day,
        'account_holder_name', pm.account_holder_name,
        'last4', pm.masked_account_last4,
        'dd_setup_status', pm.dd_setup_status,
        'active', pm.active
      )
      INTO v_pm
      FROM public.payment_methods pm
      JOIN public.orders o ON o.payment_method_id = pm.id
      WHERE o.id = v_order_id;
    EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'payment_method'; END;

    BEGIN
      SELECT s.id INTO v_service_id FROM public.services s WHERE s.order_id = v_order_id LIMIT 1;
      IF v_service_id IS NOT NULL THEN
        SELECT jsonb_build_object(
          'id', s.id, 'status', s.status, 'plan_name', s.plan_name,
          'service_type', s.service_type, 'monthly_price', s.price_monthly,
          'activation_date', s.activation_date,
          'billing_anchor_day', s.billing_anchor_day,
          'next_billing_date', s.next_billing_date,
          'minimum_term_end_date', s.minimum_term_end_date,
          'contract_type', s.contract_type,
          'service_address', s.service_address
        )
        INTO v_service FROM public.services s WHERE s.id = v_service_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'service'; END;

    BEGIN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'at', h.created_at, 'status', h.new_status, 'note', h.customer_note
      ) ORDER BY h.created_at), '[]'::jsonb)
      INTO v_timeline
      FROM public.order_status_history h WHERE h.order_id = v_order_id;
    EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'timeline'; END;
  END IF;

  -- masked Direct Debit state only (never sort code / account number)
  BEGIN
    SELECT jsonb_build_object(
      'status', m.status,
      'account_holder_name', m.account_holder_name,
      'masked_account_last4', m.masked_account_last4,
      'masked_sort_last2', m.masked_sort_last2,
      'updated_at', m.updated_at
    )
    INTO v_dd
    FROM public.dd_mandates m
    WHERE m.customer_id = v_uid
    ORDER BY m.updated_at DESC NULLS LAST
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'direct_debit'; END;

  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', i.id, 'invoice_number', i.invoice_number,
      'issue_date', i.issue_date, 'due_date', i.due_date, 'status', i.status,
      'total', i.total, 'subtotal', i.subtotal, 'vat_total', i.vat_total,
      'pro_rata', i.pro_rata,
      'billing_period_start', i.billing_period_start,
      'billing_period_end', i.billing_period_end,
      'invoice_type', i.invoice_type
    ) ORDER BY i.issue_date DESC), '[]'::jsonb)
    INTO v_invoices
    FROM public.invoices i WHERE i.user_id = v_uid;
  EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'invoices'; END;

  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', pr.id, 'status', pr.status, 'amount', pr.amount, 'currency', pr.currency,
      'invoice_id', pr.invoice_id, 'created_at', pr.created_at,
      'completed_at', pr.completed_at
    ) ORDER BY pr.created_at DESC), '[]'::jsonb)
    INTO v_prs
    FROM public.payment_requests pr WHERE pr.user_id = v_uid;
  EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'payment_requests'; END;

  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', r.id, 'invoice_id', r.invoice_id, 'amount', r.amount,
      'paid_at', r.paid_at
    ) ORDER BY r.paid_at DESC), '[]'::jsonb)
    INTO v_receipts
    FROM public.receipts r
    WHERE r.invoice_id IN (SELECT id FROM public.invoices WHERE user_id = v_uid);
  EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'receipts'; END;

  BEGIN
    SELECT jsonb_build_object(
      'contract_summary', (
        SELECT jsonb_build_object('id', cs.id, 'plan_name', cs.plan_name,
          'accepted_at', cs.accepted_at, 'pdf_storage_key', cs.pdf_storage_key,
          'cs_number', cs.cs_number)
        FROM public.contract_summaries cs
        WHERE cs.customer_id = v_uid AND cs.accepted_at IS NOT NULL
        ORDER BY cs.accepted_at DESC LIMIT 1
      ),
      'acceptance_certificate', (
        SELECT jsonb_build_object('id', ac.id, 'storage_key', ac.storage_key,
          'issued_at', ac.generated_at, 'certificate_number', ac.certificate_number)
        FROM public.acceptance_certificates ac
        WHERE ac.customer_id = v_uid
           OR ac.contract_summary_id IN (SELECT id FROM public.contract_summaries WHERE customer_id = v_uid)
           OR ac.journey_id IN (SELECT id FROM public.order_journeys WHERE customer_id = v_uid)
        ORDER BY ac.generated_at DESC LIMIT 1
      )
    )
    INTO v_documents;
  EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'documents'; END;

  RETURN jsonb_build_object(
    'profile', v_profile, 'account_number', v_account_no,
    'order', v_order, 'service', v_service, 'payment_method', v_pm,
    'direct_debit', v_dd,
    'invoices', v_invoices, 'payment_requests', v_prs, 'receipts', v_receipts,
    'documents', v_documents, 'timeline', COALESCE(v_timeline, '[]'::jsonb),
    'section_errors', to_jsonb(v_errors),
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_customer_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_customer_overview() TO authenticated;

-- 4. One-off safe backfill for existing confirmed accounts
DO $$
DECLARE r record; res jsonb;
BEGIN
  FOR r IN SELECT id, lower(email) AS email FROM auth.users
           WHERE email IS NOT NULL AND length(email) > 0 AND email_confirmed_at IS NOT NULL
  LOOP
    res := public.link_customer_records(r.id, r.email);
  END LOOP;
END $$;


ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS pdf_storage_key        text,
  ADD COLUMN IF NOT EXISTS pdf_hash               text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at       timestamptz,
  ADD COLUMN IF NOT EXISTS email_sent_at          timestamptz,
  ADD COLUMN IF NOT EXISTS email_provider_message_id text,
  ADD COLUMN IF NOT EXISTS email_error            text,
  ADD COLUMN IF NOT EXISTS email_attempts         integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices(status);

CREATE UNIQUE INDEX IF NOT EXISTS first_billing_jobs_order_period_uidx
  ON public.first_billing_jobs(order_id, period_start, period_end);

CREATE OR REPLACE FUNCTION public.first_billing_job_is_eligible(_job_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.first_billing_jobs j
    JOIN public.orders          o ON o.id = j.order_id
    JOIN public.services        s ON s.id = j.service_id
    JOIN public.payment_methods pm ON pm.id = o.payment_method_id
    JOIN public.profiles        p ON p.id = o.customer_id
    WHERE j.id = _job_id
      AND j.status IN ('pending','retry_scheduled')
      AND COALESCE(j.blocker, '') NOT IN ('awaiting_billing_engine_handover','manual_hold')
      AND o.lifecycle_status = 'live'
      AND s.status = 'active'
      AND pm.active IS TRUE
      AND NOT EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.service_id = j.service_id
          AND i.billing_period_start = j.period_start
          AND i.billing_period_end   = j.period_end
          AND i.status NOT IN ('cancelled')
          AND (i.invoice_type = CASE WHEN j.is_pro_rata
                                     THEN 'first_pro_rata' ELSE 'monthly' END)
          AND i.id <> COALESCE(j.invoice_id, '00000000-0000-0000-0000-000000000000'::uuid)
      )
  );
$$;
REVOKE ALL ON FUNCTION public.first_billing_job_is_eligible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.first_billing_job_is_eligible(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_customer_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile jsonb; v_order jsonb; v_service jsonb; v_invoices jsonb;
  v_prs jsonb; v_receipts jsonb; v_documents jsonb; v_pm jsonb; v_timeline jsonb;
  v_order_id uuid; v_service_id uuid; v_account_no text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone,
    'account_number', p.account_number, 'address_line1', p.address_line1,
    'city', p.city, 'postcode', p.postcode
  ), p.account_number
  INTO v_profile, v_account_no
  FROM public.profiles p WHERE p.id = v_uid;

  SELECT o.id INTO v_order_id
  FROM public.orders o
  WHERE o.customer_id = v_uid
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

  IF v_order_id IS NOT NULL THEN
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

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'at', h.created_at, 'status', h.new_status, 'note', h.customer_note
    ) ORDER BY h.created_at), '[]'::jsonb)
    INTO v_timeline
    FROM public.order_status_history h WHERE h.order_id = v_order_id;
  END IF;

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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pr.id, 'status', pr.status, 'amount', pr.amount, 'currency', pr.currency,
    'invoice_id', pr.invoice_id, 'created_at', pr.created_at,
    'completed_at', pr.completed_at
  ) ORDER BY pr.created_at DESC), '[]'::jsonb)
  INTO v_prs
  FROM public.payment_requests pr WHERE pr.user_id = v_uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'invoice_id', r.invoice_id, 'amount', r.amount,
    'paid_at', r.paid_at
  ) ORDER BY r.paid_at DESC), '[]'::jsonb)
  INTO v_receipts
  FROM public.receipts r
  WHERE r.invoice_id IN (SELECT id FROM public.invoices WHERE user_id = v_uid);

  SELECT jsonb_build_object(
    'contract_summary', (
      SELECT jsonb_build_object('id', cs.id, 'plan_name', cs.plan_name,
        'accepted_at', cs.accepted_at, 'pdf_storage_key', cs.pdf_storage_key)
      FROM public.contract_summaries cs
      WHERE cs.user_id = v_uid AND cs.accepted_at IS NOT NULL
      ORDER BY cs.accepted_at DESC LIMIT 1
    ),
    'acceptance_certificate', (
      SELECT jsonb_build_object('id', ac.id, 'storage_key', ac.storage_key, 'issued_at', ac.issued_at)
      FROM public.acceptance_certificates ac
      WHERE ac.user_id = v_uid
      ORDER BY ac.issued_at DESC LIMIT 1
    )
  )
  INTO v_documents;

  RETURN jsonb_build_object(
    'profile', v_profile, 'account_number', v_account_no,
    'order', v_order, 'service', v_service, 'payment_method', v_pm,
    'invoices', v_invoices, 'payment_requests', v_prs, 'receipts', v_receipts,
    'documents', v_documents, 'timeline', COALESCE(v_timeline, '[]'::jsonb),
    'generated_at', now()
  );
END $$;
REVOKE ALL ON FUNCTION public.get_my_customer_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_customer_overview() TO authenticated;

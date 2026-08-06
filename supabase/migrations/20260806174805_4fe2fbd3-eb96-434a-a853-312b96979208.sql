-- 1) Repair dashboard overview: dd_mandates is keyed by user_id, and text[] appends need explicit casts
CREATE OR REPLACE FUNCTION public.get_my_customer_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'profile'::text; END;

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
  EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'order_lookup'::text; END;

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
    EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'order'::text; END;

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
    EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'payment_method'::text; END;

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
    EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'service'::text; END;

    BEGIN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'at', h.created_at, 'status', h.new_status, 'note', h.customer_note
      ) ORDER BY h.created_at), '[]'::jsonb)
      INTO v_timeline
      FROM public.order_status_history h WHERE h.order_id = v_order_id;
    EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'timeline'::text; END;
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
    WHERE m.user_id = v_uid
    ORDER BY m.updated_at DESC NULLS LAST
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'direct_debit'::text; END;

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
  EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'invoices'::text; END;

  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', pr.id, 'status', pr.status, 'amount', pr.amount, 'currency', pr.currency,
      'invoice_id', pr.invoice_id, 'created_at', pr.created_at,
      'completed_at', pr.completed_at
    ) ORDER BY pr.created_at DESC), '[]'::jsonb)
    INTO v_prs
    FROM public.payment_requests pr WHERE pr.user_id = v_uid;
  EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'payment_requests'::text; END;

  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', r.id, 'invoice_id', r.invoice_id, 'amount', r.amount,
      'paid_at', r.paid_at
    ) ORDER BY r.paid_at DESC), '[]'::jsonb)
    INTO v_receipts
    FROM public.receipts r
    WHERE r.invoice_id IN (SELECT id FROM public.invoices WHERE user_id = v_uid);
  EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'receipts'::text; END;

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
  EXCEPTION WHEN OTHERS THEN v_errors := v_errors || 'documents'::text; END;

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
$function$;

-- 2) Allow a signed-in user to claim their own UNOWNED guest order (self-claim only)
CREATE OR REPLACE FUNCTION public.guard_guest_orders_customer_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_self_claim boolean;
BEGIN
  IF auth.uid() IS NULL OR public.has_any_admin_role(auth.uid()) THEN
    RETURN NEW;
  END IF;

  v_self_claim := OLD.user_id IS NULL
                  AND NEW.user_id = auth.uid()
                  AND NEW.email IS NOT DISTINCT FROM OLD.email;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.plan_name IS DISTINCT FROM OLD.plan_name
     OR NEW.plan_price IS DISTINCT FROM OLD.plan_price
     OR NEW.service_type IS DISTINCT FROM OLD.service_type
     OR NEW.order_number IS DISTINCT FROM OLD.order_number
     OR NEW.account_number IS DISTINCT FROM OLD.account_number
     OR (NOT v_self_claim AND (
            NEW.user_id IS DISTINCT FROM OLD.user_id
         OR NEW.linked_at IS DISTINCT FROM OLD.linked_at
         OR NEW.linked_order_id IS DISTINCT FROM OLD.linked_order_id))
  THEN
    RAISE EXCEPTION 'internal_fields_not_customer_editable';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_customer_internal_guest_orders_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_self_claim boolean;
BEGIN
  IF public.is_staff(auth.uid()) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_self_claim := OLD.user_id IS NULL
                  AND NEW.user_id = auth.uid()
                  AND NEW.email IS NOT DISTINCT FROM OLD.email;

  IF NEW.status IS DISTINCT FROM OLD.status
    OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
    OR NEW.account_number IS DISTINCT FROM OLD.account_number
    OR NEW.email IS DISTINCT FROM OLD.email
    OR (NOT v_self_claim AND (
           NEW.user_id IS DISTINCT FROM OLD.user_id
        OR NEW.linked_order_id IS DISTINCT FROM OLD.linked_order_id))
  THEN
    RAISE EXCEPTION 'permission denied: cannot modify internal guest order fields';
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Allow a signed-in user to claim their own UNOWNED order (self-claim only)
CREATE OR REPLACE FUNCTION public.protect_internal_order_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  is_staff boolean;
  col text;
  editable text[];
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT public.has_role(uid, 'admin')
      OR public.has_role(uid, 'super_admin')
      OR public.has_role(uid, 'support_agent')
      OR public.has_role(uid, 'sales_agent')
      OR public.has_role(uid, 'finance_admin')
    INTO is_staff;

  IF COALESCE(is_staff, false) THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'orders' THEN
    editable := ARRAY['notes','preferred_start_date','updated_at'];
    -- self-claim of an unowned order: allow ownership columns only
    IF (OLD.customer_id IS NULL AND NEW.customer_id = uid)
       OR (OLD.user_id IS NULL AND NEW.user_id = uid) THEN
      editable := editable || ARRAY['customer_id','user_id'];
    END IF;
  ELSE
    editable := ARRAY['user_id','updated_at'];
  END IF;

  FOR col IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = TG_TABLE_NAME
  LOOP
    IF NOT (col = ANY(editable)) THEN
      IF to_jsonb(NEW) -> col IS DISTINCT FROM to_jsonb(OLD) -> col THEN
        RAISE EXCEPTION 'Field % cannot be changed', col USING ERRCODE = '42501';
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- =====================================================================
-- Phase 8 corrections
-- 1) compute_cancellation_preview: no 30-day fallback, use anchor cycles
-- 2) finalize_service_cancellation: create exactly one final billing doc
-- 3) Idempotency index for the final billing document
-- =====================================================================

-- Helper: cycle window containing date d, given anchor day-of-month
CREATE OR REPLACE FUNCTION public.cancellation_cycle_window(p_anchor_day int, p_in_date date)
RETURNS TABLE(cycle_start date, cycle_end date)
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_anchor int;
  v_start date;
  v_end date;
  v_month_start date;
  v_dim int;
BEGIN
  v_anchor := GREATEST(1, LEAST(28, COALESCE(p_anchor_day, 1)));
  v_month_start := date_trunc('month', p_in_date)::date;
  v_dim := EXTRACT(DAY FROM (v_month_start + INTERVAL '1 month - 1 day'))::int;
  v_start := v_month_start + (LEAST(v_anchor, v_dim) - 1);
  IF p_in_date < v_start THEN
    v_month_start := (v_month_start - INTERVAL '1 month')::date;
    v_dim := EXTRACT(DAY FROM (v_month_start + INTERVAL '1 month - 1 day'))::int;
    v_start := v_month_start + (LEAST(v_anchor, v_dim) - 1);
  END IF;
  v_end := (v_start + INTERVAL '1 month')::date;
  cycle_start := v_start;
  cycle_end := v_end;
  RETURN NEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancellation_cycle_window(int,date) TO authenticated, service_role;

-- =====================================================================
-- Rewritten preview
-- =====================================================================
CREATE OR REPLACE FUNCTION public.compute_cancellation_preview(
  p_service_id uuid,
  p_requested_date date
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service services%ROWTYPE;
  v_order orders%ROWTYPE;
  v_cs contract_summaries%ROWTYPE;
  v_notice_days int;
  v_proposed_cease date;
  v_monthly_minor bigint := 0;
  v_within_min_term boolean := false;
  v_unpaid_minor bigint := 0;
  v_credits_minor bigint := 0;
  v_unbilled_minor bigint := 0;
  v_etf_minor bigint := 0;
  v_final_minor bigint;
  v_last_billed_through date;
  v_reasons text[] := ARRAY[]::text[];
  v_etf_policy jsonb;
  v_etf_method text := NULL;
  v_anchor_day int;
  v_cycle_cursor date;
  v_cycle_start date;
  v_cycle_end date;
  v_days_in_cycle int;
  v_full_cycle_days int;
  v_cycle_breakdown jsonb := '[]'::jsonb;
  v_loop_guard int := 0;
BEGIN
  SELECT * INTO v_service FROM services WHERE id = p_service_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'service_not_found'; END IF;
  SELECT * INTO v_order FROM orders WHERE id = v_service.order_id;
  IF v_service.contract_summary_id IS NOT NULL THEN
    SELECT * INTO v_cs FROM contract_summaries WHERE id = v_service.contract_summary_id;
  END IF;

  -- Notice period: NO fallback. Missing => manual review, no cease date.
  v_notice_days := v_service.notice_period_days;
  IF v_notice_days IS NULL THEN
    v_reasons := array_append(v_reasons, 'notice_period_missing');
  ELSE
    v_proposed_cease := GREATEST(COALESCE(p_requested_date, CURRENT_DATE), CURRENT_DATE) + v_notice_days;
  END IF;

  -- Monthly charge in minor units
  v_monthly_minor := COALESCE((v_service.price_monthly * 100)::bigint, 0);
  IF v_monthly_minor = 0 AND v_cs.monthly_price_incl_vat IS NOT NULL THEN
    v_monthly_minor := (v_cs.monthly_price_incl_vat * 100)::bigint;
  END IF;
  IF v_monthly_minor = 0 THEN
    v_reasons := array_append(v_reasons, 'missing_monthly_charge');
  END IF;

  -- Minimum term
  IF v_service.minimum_term_end_date IS NOT NULL AND v_proposed_cease IS NOT NULL THEN
    v_within_min_term := v_proposed_cease < v_service.minimum_term_end_date;
  END IF;

  -- Last billed-through
  SELECT MAX(billing_period_end) INTO v_last_billed_through
    FROM invoices
   WHERE service_id = p_service_id
     AND status NOT IN ('void','cancelled','draft');

  -- Unpaid invoices (issued)
  SELECT COALESCE(SUM((total * 100)::bigint), 0) INTO v_unpaid_minor
    FROM invoices
   WHERE service_id = p_service_id
     AND status IN ('sent','overdue','partial');

  -- Credits
  BEGIN
    SELECT COALESCE(SUM((amount * 100)::bigint), 0) INTO v_credits_minor
      FROM credit_notes WHERE service_id = p_service_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    v_credits_minor := 0;
  END;

  -- Unbilled service via anchor-cycle pro-rata (only when we have a cease date)
  IF v_proposed_cease IS NOT NULL AND v_monthly_minor > 0 THEN
    v_anchor_day := COALESCE(v_service.billing_anchor_day, v_order.billing_anchor_day);
    IF v_anchor_day IS NULL THEN
      v_reasons := array_append(v_reasons, 'billing_anchor_missing');
    ELSE
      -- Start the cursor one day AFTER what was last billed (or activation date if never billed)
      v_cycle_cursor := COALESCE(
        v_last_billed_through + 1,
        v_service.actual_activation_date,
        v_service.activation_date,
        v_order.actual_activation_date
      );
      IF v_cycle_cursor IS NULL THEN
        v_reasons := array_append(v_reasons, 'activation_date_missing');
      ELSE
        WHILE v_cycle_cursor < v_proposed_cease AND v_loop_guard < 36 LOOP
          v_loop_guard := v_loop_guard + 1;
          SELECT cycle_start, cycle_end INTO v_cycle_start, v_cycle_end
            FROM cancellation_cycle_window(v_anchor_day, v_cycle_cursor);
          v_full_cycle_days := (v_cycle_end - v_cycle_start);
          v_days_in_cycle := (LEAST(v_cycle_end, v_proposed_cease) - v_cycle_cursor);
          IF v_days_in_cycle > 0 AND v_full_cycle_days > 0 THEN
            v_unbilled_minor := v_unbilled_minor
              + (v_monthly_minor::numeric * v_days_in_cycle / v_full_cycle_days)::bigint;
            v_cycle_breakdown := v_cycle_breakdown || jsonb_build_array(jsonb_build_object(
              'cycle_start', v_cycle_start,
              'cycle_end', v_cycle_end,
              'full_cycle_days', v_full_cycle_days,
              'billable_days', v_days_in_cycle,
              'amount_minor', (v_monthly_minor::numeric * v_days_in_cycle / v_full_cycle_days)::bigint
            ));
          END IF;
          v_cycle_cursor := v_cycle_end;
        END LOOP;
      END IF;
    END IF;
  END IF;

  -- ETF (only if within min term AND policy snapshot exists with supported method)
  v_etf_policy := COALESCE(v_service.etf_policy_snapshot, v_order.etf_policy_snapshot);
  IF v_within_min_term THEN
    IF v_etf_policy IS NULL OR v_etf_policy = 'null'::jsonb THEN
      v_reasons := array_append(v_reasons, 'etf_policy_missing');
    ELSE
      v_etf_method := v_etf_policy->>'method';
      IF v_etf_method = 'remaining_months_x_monthly' THEN
        v_etf_minor := v_monthly_minor *
          GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_service.minimum_term_end_date - v_proposed_cease))/86400.0/30.0))::bigint;
        IF (v_etf_policy->>'avoided_cost_discount_pct') IS NOT NULL THEN
          v_etf_minor := v_etf_minor * (100 - (v_etf_policy->>'avoided_cost_discount_pct')::int) / 100;
        END IF;
      ELSIF v_etf_method = 'fixed_amount_minor' THEN
        v_etf_minor := COALESCE((v_etf_policy->>'amount_minor')::bigint, 0);
      ELSE
        v_reasons := array_append(v_reasons, 'unsupported_etf_method');
      END IF;
    END IF;
  END IF;

  v_final_minor := v_unpaid_minor + v_unbilled_minor + v_etf_minor - v_credits_minor;

  RETURN jsonb_build_object(
    'formula_version', 'cancellation_preview_v2_anchor_cycle',
    'requested_date', p_requested_date,
    'proposed_cease_date', v_proposed_cease,
    'notice_period_days', v_notice_days,
    'minimum_term_end_date', v_service.minimum_term_end_date,
    'within_minimum_term', v_within_min_term,
    'monthly_minor', v_monthly_minor,
    'billing_anchor_day', v_anchor_day,
    'last_billed_through', v_last_billed_through,
    'unpaid_invoices_minor', v_unpaid_minor,
    'unbilled_service_minor', v_unbilled_minor,
    'unbilled_cycles', v_cycle_breakdown,
    'credits_minor', v_credits_minor,
    'etf_minor', v_etf_minor,
    'etf_method', v_etf_method,
    'final_balance_minor', v_final_minor,
    'currency', 'GBP',
    'manual_review_reasons', v_reasons,
    'computed_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_cancellation_preview(uuid,date) FROM public;
GRANT EXECUTE ON FUNCTION public.compute_cancellation_preview(uuid,date) TO authenticated, service_role;

-- =====================================================================
-- Idempotency for the final cancellation billing document
-- =====================================================================
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS cancellation_case_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_cancellation_final_uidx
  ON public.invoices(cancellation_case_id)
  WHERE invoice_type = 'cancellation_final';

ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS cancellation_case_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS credit_notes_cancellation_final_uidx
  ON public.credit_notes(cancellation_case_id)
  WHERE cancellation_case_id IS NOT NULL;

-- =====================================================================
-- Final cancellation transaction now creates the final billing document
-- =====================================================================
CREATE OR REPLACE FUNCTION public.finalize_service_cancellation(
  p_case_id uuid,
  p_actual_cease_date date,
  p_admin_user uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case service_cancellation_cases%ROWTYPE;
  v_preview jsonb;
  v_final_minor bigint;
  v_unbilled_minor bigint;
  v_unpaid_minor bigint;
  v_etf_minor bigint;
  v_credits_minor bigint;
  v_doc_type text;
  v_new_invoice_id uuid;
  v_new_credit_id uuid;
  v_existing_id uuid;
BEGIN
  IF NOT public.has_role(p_admin_user, 'admin') THEN
    RAISE EXCEPTION 'unauthorised';
  END IF;

  SELECT * INTO v_case FROM service_cancellation_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'case_not_found'; END IF;

  IF v_case.status = 'completed' THEN
    RETURN jsonb_build_object('already_completed', true, 'case_id', p_case_id);
  END IF;

  IF v_case.status NOT IN ('approved_for_cease','submitted_to_giacom','cease_committed') THEN
    RAISE EXCEPTION 'invalid_state:%', v_case.status;
  END IF;

  -- Recompute the preview against the ACTUAL cease date and store as immutable snapshot
  v_preview := public.compute_cancellation_preview(v_case.service_id, p_actual_cease_date);
  v_final_minor   := COALESCE((v_preview->>'final_balance_minor')::bigint, 0);
  v_unbilled_minor:= COALESCE((v_preview->>'unbilled_service_minor')::bigint, 0);
  v_unpaid_minor  := COALESCE((v_preview->>'unpaid_invoices_minor')::bigint, 0);
  v_etf_minor     := COALESCE((v_preview->>'etf_minor')::bigint, 0);
  v_credits_minor := COALESCE((v_preview->>'credits_minor')::bigint, 0);

  -- ---- Service & order state
  UPDATE services
     SET status = 'cancelled',
         billing_enabled = false,
         updated_at = now()
   WHERE id = v_case.service_id;

  UPDATE orders
     SET lifecycle_status = 'cancelled',
         cease_date = p_actual_cease_date,
         updated_at = now()
   WHERE id = v_case.order_id;

  -- Cancel only future unissued billing jobs
  UPDATE first_billing_jobs
     SET status = 'cancelled', updated_at = now()
   WHERE service_id = v_case.service_id
     AND status IN ('pending','scheduled','ready')
     AND COALESCE(period_start, activation_date) > p_actual_cease_date;

  -- ---- Final billing document (exactly one per case)
  -- Positive => invoice for the net amount JUST for unbilled + ETF (do not re-bill
  -- already-issued unpaid invoices). Negative => credit note. Zero => closing statement (invoice with 0 total).
  IF v_final_minor > 0 THEN
    v_doc_type := 'invoice';
    SELECT id INTO v_existing_id FROM invoices
      WHERE cancellation_case_id = p_case_id AND invoice_type = 'cancellation_final';
    IF v_existing_id IS NULL THEN
      INSERT INTO invoices(
        user_id, service_id, order_id, status,
        issue_date, due_date, currency,
        subtotal, vat_total, total, tax,
        billing_period_start, billing_period_end,
        invoice_type, notes, pro_rata,
        cancellation_case_id
      ) VALUES (
        v_case.customer_id, v_case.service_id, v_case.order_id, 'draft',
        CURRENT_DATE, CURRENT_DATE + 14, 'GBP',
        ((v_unbilled_minor + v_etf_minor)::numeric / 100),
        0, ((v_unbilled_minor + v_etf_minor)::numeric / 100), 0,
        COALESCE((v_preview->>'last_billed_through')::date + 1, p_actual_cease_date),
        p_actual_cease_date,
        'cancellation_final',
        'Final cancellation invoice. Includes unbilled service to cease date'
          || CASE WHEN v_etf_minor > 0 THEN ' and early termination charge' ELSE '' END || '.',
        v_preview,
        p_case_id
      ) RETURNING id INTO v_new_invoice_id;
    ELSE
      v_new_invoice_id := v_existing_id;
    END IF;
  ELSIF v_final_minor < 0 THEN
    v_doc_type := 'credit_note';
    SELECT id INTO v_existing_id FROM credit_notes WHERE cancellation_case_id = p_case_id;
    IF v_existing_id IS NULL THEN
      BEGIN
        INSERT INTO credit_notes(user_id, service_id, amount, notes, cancellation_case_id)
        VALUES (v_case.customer_id, v_case.service_id, (ABS(v_final_minor)::numeric / 100),
                'Final cancellation credit note.', p_case_id)
        RETURNING id INTO v_new_credit_id;
      EXCEPTION WHEN undefined_column OR undefined_table THEN
        -- fall back to a zero invoice noting credit owed if credit_notes schema differs
        INSERT INTO invoices(
          user_id, service_id, order_id, status, issue_date, due_date, currency,
          subtotal, vat_total, total, tax, invoice_type, notes, pro_rata, cancellation_case_id
        ) VALUES (
          v_case.customer_id, v_case.service_id, v_case.order_id, 'draft',
          CURRENT_DATE, CURRENT_DATE, 'GBP', 0, 0, 0, 0,
          'cancellation_final',
          'Final cancellation closing statement. Net credit of '
            || (ABS(v_final_minor)::numeric / 100)::text || ' GBP owed to customer.',
          v_preview, p_case_id
        ) RETURNING id INTO v_new_invoice_id;
        v_doc_type := 'closing_statement';
      END;
    ELSE
      v_new_credit_id := v_existing_id;
    END IF;
  ELSE
    v_doc_type := 'closing_statement';
    SELECT id INTO v_existing_id FROM invoices
      WHERE cancellation_case_id = p_case_id AND invoice_type = 'cancellation_final';
    IF v_existing_id IS NULL THEN
      INSERT INTO invoices(
        user_id, service_id, order_id, status, issue_date, due_date, currency,
        subtotal, vat_total, total, tax, invoice_type, notes, pro_rata, cancellation_case_id
      ) VALUES (
        v_case.customer_id, v_case.service_id, v_case.order_id, 'sent',
        CURRENT_DATE, CURRENT_DATE, 'GBP', 0, 0, 0, 0,
        'cancellation_final',
        'Final cancellation closing statement. No balance due.',
        v_preview, p_case_id
      ) RETURNING id INTO v_new_invoice_id;
    ELSE
      v_new_invoice_id := v_existing_id;
    END IF;
  END IF;

  UPDATE service_cancellation_cases
     SET status = 'completed',
         actual_cease_date = p_actual_cease_date,
         completed_at = now(),
         cease_committed_by = COALESCE(cease_committed_by, p_admin_user),
         cease_committed_at = COALESCE(cease_committed_at, now()),
         preview_snapshot = v_preview,
         preview_formula_version = v_preview->>'formula_version',
         preview_generated_at = now()
   WHERE id = p_case_id;

  INSERT INTO cancellation_case_history(case_id, from_status, to_status, actor_user_id, actor_role, reason, metadata)
  VALUES (p_case_id, v_case.status, 'completed', p_admin_user, 'admin', 'cease_confirmed',
          jsonb_build_object(
            'actual_cease_date', p_actual_cease_date,
            'final_balance_minor', v_final_minor,
            'document_type', v_doc_type,
            'invoice_id', v_new_invoice_id,
            'credit_note_id', v_new_credit_id
          ));

  -- DD stop task only when an active mandate exists; idempotent
  INSERT INTO admin_tasks(task_type, priority, status, related_id, title, description)
  SELECT 'stop_direct_debit', 'high', 'open', v_case.service_id,
         'Stop Direct Debit for cancelled service',
         'Service cancelled; stop the mandate with the DD provider and record confirmation.'
  WHERE EXISTS (SELECT 1 FROM dd_mandates m WHERE m.customer_id = v_case.customer_id AND m.status = 'active')
    AND NOT EXISTS (
      SELECT 1 FROM admin_tasks t
       WHERE t.task_type='stop_direct_debit' AND t.related_id = v_case.service_id AND t.status <> 'closed'
    );

  -- Queue completion email (idempotent)
  INSERT INTO cancellation_email_outbox(case_id, email_type, recipient_email, idempotency_key)
  SELECT v_case.id, 'completed',
         COALESCE((SELECT email FROM profiles WHERE id = v_case.customer_id),
                  (SELECT customer_email_snapshot FROM contract_summaries WHERE id = v_case.contract_summary_id)),
         'cancel-complete:'||v_case.id::text
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN jsonb_build_object(
    'case_id', p_case_id,
    'status', 'completed',
    'cease_date', p_actual_cease_date,
    'final_balance_minor', v_final_minor,
    'document_type', v_doc_type,
    'invoice_id', v_new_invoice_id,
    'credit_note_id', v_new_credit_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_service_cancellation(uuid,date,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.finalize_service_cancellation(uuid,date,uuid) TO service_role;

-- =====================================================================
-- Outbox: ensure retry/last_attempted_at columns present
-- =====================================================================
ALTER TABLE public.cancellation_email_outbox
  ADD COLUMN IF NOT EXISTS last_attempted_at timestamptz;

-- =====================================================================
-- Notice-period missing => durable reconciliation task (called from edge)
-- Helper for both edge fn and trigger consumers
-- =====================================================================
CREATE OR REPLACE FUNCTION public.flag_cancellation_manual_review(p_case_id uuid, p_reasons text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO admin_reconciliation_tasks(task_type, priority, status, related_entity_id, reason, payload)
  VALUES (
    'cancellation_manual_review', 'high', 'open', p_case_id,
    'Cancellation preview requires manual review: '||array_to_string(p_reasons, ', '),
    jsonb_build_object('case_id', p_case_id, 'reasons', p_reasons)
  )
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.flag_cancellation_manual_review(uuid, text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.flag_cancellation_manual_review(uuid, text[]) TO service_role;

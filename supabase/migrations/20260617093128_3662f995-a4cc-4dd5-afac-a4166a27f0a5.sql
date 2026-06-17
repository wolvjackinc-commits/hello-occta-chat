
-- Phase 8: In-life cancellation, cease-date and ETF preview

-- Lifecycle status enum additions are handled via text columns already (orders.lifecycle_status is text-like).
-- Add status column already present; introduce service_cancellation_cases table.

CREATE TABLE IF NOT EXISTS public.service_cancellation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  account_number text,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  contract_summary_id uuid REFERENCES public.contract_summaries(id),
  contract_acceptance_id uuid REFERENCES public.contract_acceptances(id),
  status text NOT NULL DEFAULT 'requested', -- requested|preview_ready|manual_review_required|approved_for_cease|submitted_to_giacom|cease_committed|completed|withdrawn|rejected
  source text NOT NULL CHECK (source IN ('customer','admin')),
  reason_code text,
  notes text,
  requested_date date,
  proposed_cease_date date,
  actual_cease_date date,
  notice_period_days integer,
  minimum_term_end_date date,
  request_ip text,
  request_user_agent text,
  requested_by_user uuid,
  requested_by_staff uuid,
  approved_by_staff uuid,
  approved_at timestamptz,
  withdrawn_by uuid,
  withdrawn_at timestamptz,
  withdrawn_reason text,
  giacom_cease_reference text,
  giacom_submitted_at timestamptz,
  supplier_confirmed_cease_date date,
  cease_committed_at timestamptz,
  cease_committed_by uuid,
  completed_at timestamptz,
  preview_snapshot jsonb,
  preview_formula_version text,
  preview_generated_at timestamptz,
  contract_snapshot jsonb,
  manual_review_reasons text[],
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.service_cancellation_cases TO authenticated;
GRANT ALL ON public.service_cancellation_cases TO service_role;
ALTER TABLE public.service_cancellation_cases ENABLE ROW LEVEL SECURITY;

-- Only one OPEN case per service
CREATE UNIQUE INDEX IF NOT EXISTS service_cancellation_cases_one_open_uidx
  ON public.service_cancellation_cases(service_id)
  WHERE status NOT IN ('completed','withdrawn','rejected');

CREATE INDEX IF NOT EXISTS service_cancellation_cases_customer_idx ON public.service_cancellation_cases(customer_id);
CREATE INDEX IF NOT EXISTS service_cancellation_cases_order_idx ON public.service_cancellation_cases(order_id);
CREATE INDEX IF NOT EXISTS service_cancellation_cases_status_idx ON public.service_cancellation_cases(status);

-- Customers can view their own cases (read-only); writes via edge functions
CREATE POLICY "customers can view own cancellation cases"
  ON public.service_cancellation_cases FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "admins manage cancellation cases"
  ON public.service_cancellation_cases FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_service_cancellation_cases_updated
  BEFORE UPDATE ON public.service_cancellation_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Append-only history
CREATE TABLE IF NOT EXISTS public.cancellation_case_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.service_cancellation_cases(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_user_id uuid,
  actor_role text,
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.cancellation_case_history TO authenticated;
GRANT ALL ON public.cancellation_case_history TO service_role;
ALTER TABLE public.cancellation_case_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read history" ON public.cancellation_case_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "customers read own history" ON public.cancellation_case_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_cancellation_cases c WHERE c.id = case_id AND c.customer_id = auth.uid()));

CREATE INDEX IF NOT EXISTS cancellation_case_history_case_idx ON public.cancellation_case_history(case_id, created_at);

-- Durable email outbox for cancellation lifecycle
CREATE TABLE IF NOT EXISTS public.cancellation_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.service_cancellation_cases(id) ON DELETE CASCADE,
  email_type text NOT NULL CHECK (email_type IN ('acknowledgement','confirmed_cease','completed')),
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  sent_at timestamptz,
  provider_message_id text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cancellation_email_outbox TO authenticated;
GRANT ALL ON public.cancellation_email_outbox TO service_role;
ALTER TABLE public.cancellation_email_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read cancellation outbox" ON public.cancellation_email_outbox FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_cancellation_outbox_updated BEFORE UPDATE ON public.cancellation_email_outbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Helper: compute cancellation preview
-- ============================================================
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
  v_service public.services%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_cs public.contract_summaries%ROWTYPE;
  v_notice_days int;
  v_proposed_cease date;
  v_monthly_minor bigint;
  v_within_min_term boolean := false;
  v_unpaid_minor bigint := 0;
  v_credits_minor bigint := 0;
  v_unbilled_minor bigint := 0;
  v_etf_minor bigint := 0;
  v_final_minor bigint;
  v_last_billed_through date;
  v_reasons text[] := ARRAY[]::text[];
  v_etf_policy jsonb;
  v_etf_method text;
  v_method text := 'standard_v1';
BEGIN
  SELECT * INTO v_service FROM services WHERE id = p_service_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'service_not_found'; END IF;
  SELECT * INTO v_order FROM orders WHERE id = v_service.order_id;
  IF v_service.contract_summary_id IS NOT NULL THEN
    SELECT * INTO v_cs FROM contract_summaries WHERE id = v_service.contract_summary_id;
  END IF;

  v_notice_days := COALESCE(v_service.notice_period_days, 30);

  v_proposed_cease := GREATEST(COALESCE(p_requested_date, CURRENT_DATE), CURRENT_DATE) + v_notice_days;

  -- monthly charge in minor units
  v_monthly_minor := COALESCE((v_service.price_monthly * 100)::bigint, 0);
  IF v_monthly_minor = 0 AND v_cs.monthly_price_incl_vat IS NOT NULL THEN
    v_monthly_minor := (v_cs.monthly_price_incl_vat * 100)::bigint;
  END IF;
  IF v_monthly_minor = 0 THEN
    v_reasons := array_append(v_reasons, 'missing_monthly_charge');
  END IF;

  -- minimum term check
  IF v_service.minimum_term_end_date IS NOT NULL THEN
    v_within_min_term := v_proposed_cease < v_service.minimum_term_end_date;
  END IF;

  -- last billed-through
  SELECT MAX(billing_period_end) INTO v_last_billed_through
    FROM invoices
    WHERE service_id = p_service_id
      AND status NOT IN ('void','cancelled','draft');

  -- unpaid invoices
  SELECT COALESCE(SUM((total * 100)::bigint), 0) INTO v_unpaid_minor
    FROM invoices
    WHERE service_id = p_service_id AND status IN ('sent','overdue','partial');

  -- credits (credit_notes table)
  BEGIN
    SELECT COALESCE(SUM((amount * 100)::bigint), 0) INTO v_credits_minor
      FROM credit_notes WHERE service_id = p_service_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    v_credits_minor := 0;
  END;

  -- unbilled service days
  IF v_last_billed_through IS NOT NULL AND v_proposed_cease > v_last_billed_through THEN
    v_unbilled_minor := (v_monthly_minor * (v_proposed_cease - v_last_billed_through)) / 30;
  END IF;

  -- ETF
  v_etf_policy := COALESCE(v_service.etf_policy_snapshot, v_order.etf_policy_snapshot);
  IF v_within_min_term THEN
    IF v_etf_policy IS NULL OR v_etf_policy = 'null'::jsonb THEN
      v_reasons := array_append(v_reasons, 'etf_policy_missing');
      v_etf_minor := 0;
    ELSE
      v_etf_method := COALESCE(v_etf_policy->>'method', 'remaining_months_x_monthly');
      IF v_etf_method = 'remaining_months_x_monthly' THEN
        v_etf_minor := v_monthly_minor *
          GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_service.minimum_term_end_date - v_proposed_cease))/86400.0/30.0))::bigint;
        -- allowed avoided-cost discount
        IF (v_etf_policy->>'avoided_cost_discount_pct') IS NOT NULL THEN
          v_etf_minor := v_etf_minor * (100 - (v_etf_policy->>'avoided_cost_discount_pct')::int) / 100;
        END IF;
      ELSIF v_etf_method = 'fixed_amount_minor' THEN
        v_etf_minor := COALESCE((v_etf_policy->>'amount_minor')::bigint, 0);
      ELSE
        v_reasons := array_append(v_reasons, 'unsupported_etf_method');
        v_etf_minor := 0;
      END IF;
    END IF;
  END IF;

  v_final_minor := v_unpaid_minor + v_unbilled_minor + v_etf_minor - v_credits_minor;

  RETURN jsonb_build_object(
    'formula_version', v_method,
    'requested_date', p_requested_date,
    'proposed_cease_date', v_proposed_cease,
    'notice_period_days', v_notice_days,
    'minimum_term_end_date', v_service.minimum_term_end_date,
    'within_minimum_term', v_within_min_term,
    'monthly_minor', v_monthly_minor,
    'last_billed_through', v_last_billed_through,
    'unpaid_invoices_minor', v_unpaid_minor,
    'unbilled_service_minor', v_unbilled_minor,
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

-- ============================================================
-- Atomic finalisation when Giacom cease is confirmed by admin
-- ============================================================
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

  -- Update service & order
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

  -- Cancel future unissued billing jobs
  UPDATE first_billing_jobs
     SET status = 'cancelled', updated_at = now()
   WHERE service_id = v_case.service_id
     AND status IN ('pending','scheduled','ready')
     AND COALESCE(period_start, activation_date) > p_actual_cease_date;

  UPDATE service_cancellation_cases
     SET status = 'completed',
         actual_cease_date = p_actual_cease_date,
         completed_at = now(),
         cease_committed_by = COALESCE(cease_committed_by, p_admin_user),
         cease_committed_at = COALESCE(cease_committed_at, now())
   WHERE id = p_case_id;

  INSERT INTO cancellation_case_history(case_id, from_status, to_status, actor_user_id, actor_role, reason, metadata)
  VALUES (p_case_id, v_case.status, 'completed', p_admin_user, 'admin', 'cease_confirmed',
          jsonb_build_object('actual_cease_date', p_actual_cease_date));

  -- DD stop task (admin will record provider confirmation later)
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

  RETURN jsonb_build_object('case_id', p_case_id, 'status', 'completed', 'cease_date', p_actual_cease_date);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_service_cancellation(uuid,date,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.finalize_service_cancellation(uuid,date,uuid) TO service_role;

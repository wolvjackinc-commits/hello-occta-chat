
-- Phase 4: confirm-service-live — durable outboxes + idempotency guards

-- 1) First-billing job durable outbox
CREATE TABLE IF NOT EXISTS public.first_billing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
  customer_id uuid,
  status text NOT NULL DEFAULT 'pending', -- pending | processing | done | blocked | failed
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  activation_date date NOT NULL,
  billing_anchor_day int NOT NULL,
  next_billing_date date NOT NULL,
  is_pro_rata boolean NOT NULL DEFAULT false,
  amount_minor integer,        -- never floats
  currency text NOT NULL DEFAULT 'GBP',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocker text,                -- explains pending if no billing engine
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS first_billing_jobs_order_unique
  ON public.first_billing_jobs (order_id);
CREATE INDEX IF NOT EXISTS first_billing_jobs_status_idx
  ON public.first_billing_jobs (status, created_at);

GRANT SELECT ON public.first_billing_jobs TO authenticated;
GRANT ALL ON public.first_billing_jobs TO service_role;

ALTER TABLE public.first_billing_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read first billing jobs" ON public.first_billing_jobs;
CREATE POLICY "Staff read first billing jobs"
  ON public.first_billing_jobs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- 2) Idempotency guards
-- Exactly one activation-email outbox row per service.
CREATE UNIQUE INDEX IF NOT EXISTS service_activation_outbox_unique_per_type
  ON public.service_activation_outbox (service_id, job_type);

-- Exactly one committed→live history row per order.
CREATE UNIQUE INDEX IF NOT EXISTS order_status_history_live_once
  ON public.order_status_history (order_id)
  WHERE new_status = 'live';

-- 3) Helper to compute next anchor billing date (handles 29–31 short months)
CREATE OR REPLACE FUNCTION public.next_anchor_billing_date(
  _from date,
  _anchor_day int
) RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM _from)::int;
  v_month int := EXTRACT(MONTH FROM _from)::int;
  v_day int := LEAST(GREATEST(COALESCE(_anchor_day,1),1),31);
  v_last int;
  v_candidate date;
BEGIN
  v_last := EXTRACT(DAY FROM (date_trunc('month', _from) + interval '1 month - 1 day'))::int;
  v_candidate := make_date(v_year, v_month, LEAST(v_day, v_last));
  IF v_candidate < _from THEN
    v_candidate := (date_trunc('month', _from) + interval '1 month')::date;
    v_year := EXTRACT(YEAR FROM v_candidate)::int;
    v_month := EXTRACT(MONTH FROM v_candidate)::int;
    v_last := EXTRACT(DAY FROM (date_trunc('month', v_candidate) + interval '1 month - 1 day'))::int;
    v_candidate := make_date(v_year, v_month, LEAST(v_day, v_last));
  END IF;
  RETURN v_candidate;
END $$;

-- 4) Atomic transaction function for confirm-service-live core state.
--    Returns service_id + already_live flag. Outboxes and the legacy mirror
--    are inserted server-side by the edge function (also idempotent via
--    the unique indexes above).
CREATE OR REPLACE FUNCTION public.confirm_service_live_tx(
  _order_id uuid,
  _actor uuid,
  _actual_activation_date date,
  _activation_reference text,
  _activation_notes text,
  _giacom_reference text,
  _customer_note text,
  _internal_note text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order record;
  v_cs record;
  v_pm record;
  v_existing_service uuid;
  v_service_id uuid;
  v_anchor int;
  v_next_billing date;
  v_min_term_months int;
  v_min_term_end date;
  v_notice_days int;
  v_addr text;
  v_addons jsonb;
  v_contract_type text;
  v_etf jsonb;
  v_speed_down int;
  v_speed_up int;
  v_plan_name text;
  v_monthly numeric;
  v_service_type text;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF v_order IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;

  -- Idempotency: already live for this order → return existing service.
  IF v_order.lifecycle_status = 'live' THEN
    SELECT id INTO v_existing_service FROM public.services WHERE order_id = _order_id LIMIT 1;
    RETURN jsonb_build_object(
      'already_live', true,
      'service_id', v_existing_service,
      'order_id', _order_id
    );
  END IF;

  IF v_order.lifecycle_status IS DISTINCT FROM 'committed' THEN
    RAISE EXCEPTION 'order_not_committed:%', COALESCE(v_order.lifecycle_status,'null');
  END IF;
  IF v_order.contract_summary_id IS NULL THEN RAISE EXCEPTION 'missing_contract_summary'; END IF;
  IF v_order.customer_id IS NULL THEN RAISE EXCEPTION 'missing_customer'; END IF;
  IF v_order.payment_method_id IS NULL THEN RAISE EXCEPTION 'missing_payment_method'; END IF;
  IF COALESCE(_giacom_reference, v_order.giacom_reference) IS NULL THEN
    RAISE EXCEPTION 'missing_giacom_reference';
  END IF;
  IF _actual_activation_date IS NULL THEN RAISE EXCEPTION 'missing_actual_activation_date'; END IF;
  IF _activation_reference IS NULL OR length(trim(_activation_reference)) = 0 THEN
    RAISE EXCEPTION 'missing_activation_reference';
  END IF;

  SELECT * INTO v_cs FROM public.contract_summaries WHERE id = v_order.contract_summary_id;
  IF v_cs IS NULL THEN RAISE EXCEPTION 'contract_summary_not_found'; END IF;
  IF v_cs.accepted_at IS NULL THEN RAISE EXCEPTION 'cs_not_accepted'; END IF;
  IF v_cs.pdf_storage_key IS NULL OR v_cs.pdf_sha256 IS NULL THEN
    RAISE EXCEPTION 'cs_pdf_missing';
  END IF;

  SELECT * INTO v_pm FROM public.payment_methods WHERE id = v_order.payment_method_id;
  IF v_pm IS NULL THEN RAISE EXCEPTION 'payment_method_not_found'; END IF;
  v_anchor := COALESCE(v_pm.billing_anchor_day, v_order.billing_anchor_day);
  IF v_anchor IS NULL THEN RAISE EXCEPTION 'missing_billing_anchor_day'; END IF;

  -- Derived service fields from accepted CS + order.
  v_plan_name := COALESCE(v_cs.plan_name, v_order.plan_name);
  v_service_type := COALESCE(v_cs.service_type::text, v_order.service_type);
  v_monthly := COALESCE(v_cs.monthly_price_incl_vat, v_order.plan_price);
  v_speed_down := v_cs.estimated_download_speed;
  v_speed_up := v_cs.estimated_upload_speed;
  v_addons := COALESCE(v_cs.selected_addons, '[]'::jsonb);
  v_addr := COALESCE(v_cs.service_address,
    concat_ws(', ', v_order.address_line1, v_order.address_line2, v_order.city, v_order.postcode));
  v_contract_type := COALESCE(v_cs.contract_length, 'flex');
  v_min_term_months := CASE
    WHEN v_cs.contract_length ~ '^[0-9]+' THEN (regexp_match(v_cs.contract_length, '([0-9]+)'))[1]::int
    ELSE NULL
  END;
  v_notice_days := CASE
    WHEN v_cs.notice_period ~ '([0-9]+)' THEN (regexp_match(v_cs.notice_period, '([0-9]+)'))[1]::int
    ELSE 30
  END;
  v_etf := jsonb_build_object(
    'cease_cancellation_charges', v_cs.cease_cancellation_charges,
    'contract_length', v_cs.contract_length,
    'notice_period', v_cs.notice_period,
    'price_rise_policy', v_cs.price_rise_policy
  );

  v_next_billing := public.next_anchor_billing_date(_actual_activation_date + 1, v_anchor);
  IF v_min_term_months IS NOT NULL THEN
    v_min_term_end := (_actual_activation_date + (v_min_term_months || ' months')::interval)::date;
  END IF;

  -- Idempotent service upsert via unique(order_id).
  INSERT INTO public.services (
    user_id, order_id, journey_id, contract_summary_id,
    service_type, plan_name, price_monthly, status,
    activation_date, actual_activation_date, activation_reference, activation_notes,
    activation_confirmed_by, activation_confirmed_at,
    billing_anchor_day, billing_enabled, next_billing_date,
    minimum_term_months, minimum_term_end_date, notice_period_days,
    service_address, contract_type, selected_addons, etf_policy_snapshot,
    supplier_reference, identifiers
  ) VALUES (
    v_order.customer_id, _order_id, v_order.journey_id, v_order.contract_summary_id,
    v_service_type, v_plan_name, v_monthly, 'active',
    _actual_activation_date, _actual_activation_date, _activation_reference, _activation_notes,
    _actor, now(),
    v_anchor, true, v_next_billing,
    v_min_term_months, v_min_term_end, v_notice_days,
    v_addr, v_contract_type, v_addons, v_etf,
    COALESCE(_giacom_reference, v_order.giacom_reference),
    jsonb_build_object('download_mbps', v_speed_down, 'upload_mbps', v_speed_up)
  )
  ON CONFLICT (order_id) WHERE order_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_service_id;

  IF v_service_id IS NULL THEN
    SELECT id INTO v_service_id FROM public.services WHERE order_id = _order_id LIMIT 1;
  END IF;

  -- Promote order to live (legacy mirror = active).
  UPDATE public.orders SET
    lifecycle_status = 'live',
    status = 'active',
    actual_activation_date = _actual_activation_date,
    giacom_reference = COALESCE(_giacom_reference, giacom_reference),
    updated_at = now()
  WHERE id = _order_id AND lifecycle_status = 'committed';

  -- Append history (unique partial index makes this idempotent).
  INSERT INTO public.order_status_history (
    order_id, previous_status, new_status, changed_by, source,
    customer_note, internal_note, giacom_reference,
    expected_activation_date, actual_activation_date, metadata
  ) VALUES (
    _order_id, 'committed', 'live', _actor, 'admin',
    _customer_note, _internal_note,
    COALESCE(_giacom_reference, v_order.giacom_reference),
    v_order.expected_activation_date, _actual_activation_date,
    jsonb_build_object('activation_reference', _activation_reference)
  )
  ON CONFLICT (order_id) WHERE new_status = 'live' DO NOTHING;

  RETURN jsonb_build_object(
    'already_live', false,
    'service_id', v_service_id,
    'order_id', _order_id,
    'next_billing_date', v_next_billing,
    'minimum_term_end_date', v_min_term_end,
    'billing_anchor_day', v_anchor,
    'monthly_price', v_monthly
  );
END $$;

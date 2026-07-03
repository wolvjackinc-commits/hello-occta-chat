
-- ─────────────────────────────────────────────────────────────
-- Phase 1: extend first_billing_jobs with accepted-fee snapshot
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.first_billing_jobs
  ADD COLUMN IF NOT EXISTS activation_fee_minor  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS one_off_charges_minor integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS one_off_lines         jsonb   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS vat_mode              text    NOT NULL DEFAULT 'inclusive',
  ADD COLUMN IF NOT EXISTS vat_rate              numeric NOT NULL DEFAULT 20;

COMMENT ON COLUMN public.first_billing_jobs.activation_fee_minor  IS 'One-off activation/setup fee snapshotted from accepted Contract Summary, in pence.';
COMMENT ON COLUMN public.first_billing_jobs.one_off_charges_minor IS 'Sum of extra one-off charges from CS one_off_charges_json, in pence.';
COMMENT ON COLUMN public.first_billing_jobs.one_off_lines         IS 'Array of {label, amount_minor} snapshotted from accepted CS one_off_charges_json.';
COMMENT ON COLUMN public.first_billing_jobs.vat_mode              IS '''inclusive'' (residential; amounts already include VAT) or ''exclusive'' (business; VAT added on top).';
COMMENT ON COLUMN public.first_billing_jobs.vat_rate              IS 'VAT rate percent used to itemise VAT on the first invoice.';

-- ─────────────────────────────────────────────────────────────
-- Phase 2: replace confirm_service_live_tx
--   - snapshots setup_charge + one_off_charges_json into the job
--   - sets blocker = NULL when all required inputs are present so
--     the first-billing worker will pick the job up automatically
--   - opens an admin_tasks row when a real input is missing
--   - preserves signature, return keys, activation-outbox row and
--     the existing service upsert / order promotion / history row
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_service_live_tx(
  _order_id                uuid,
  _actor                   uuid,
  _actual_activation_date  date,
  _activation_reference    text,
  _activation_notes        text,
  _giacom_reference        text,
  _customer_note           text,
  _internal_note           text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order            record;
  v_cs               record;
  v_pm               record;
  v_existing_service uuid;
  v_service_id       uuid;
  v_anchor           int;
  v_next_billing     date;
  v_following        date;
  v_billable_days    int;
  v_full_cycle_days  int;
  v_is_pro_rata      boolean;
  v_period_start     date;
  v_period_end       date;
  v_min_term_months  int;
  v_min_term_end     date;
  v_notice_days      int;
  v_addr             text;
  v_addons           jsonb;
  v_contract_type    text;
  v_etf              jsonb;
  v_speed_down       int;
  v_speed_up         int;
  v_plan_name        text;
  v_monthly_num      numeric;
  v_monthly_minor    integer;
  v_service_type     text;
  v_profile          record;

  -- New: fee snapshot
  v_activation_minor   integer := 0;
  v_one_off_minor      integer := 0;
  v_one_off_lines      jsonb   := '[]'::jsonb;
  v_vat_mode           text    := 'inclusive';
  v_vat_rate           numeric := 20;
  v_blocker            text;
  v_missing_reasons    text[]  := ARRAY[]::text[];
  v_line              jsonb;
  v_line_amt          numeric;
  v_customer_type_txt text;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF v_order IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;

  -- Idempotency: already live.
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
  IF v_order.customer_id        IS NULL THEN RAISE EXCEPTION 'missing_customer'; END IF;
  IF v_order.payment_method_id  IS NULL THEN RAISE EXCEPTION 'missing_payment_method'; END IF;
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

  v_plan_name    := COALESCE(v_cs.plan_name, v_order.plan_name);
  v_service_type := COALESCE(v_cs.service_type::text, v_order.service_type::text);
  v_customer_type_txt := COALESCE(v_cs.customer_type::text, 'residential');

  -- VAT mode from accepted CS snapshot: business => net (exclusive), else inclusive.
  IF v_customer_type_txt = 'business' THEN
    v_vat_mode := 'exclusive';
    -- Prefer business_monthly_ex_vat if set; otherwise fall back to monthly_price_incl_vat.
    v_monthly_num := COALESCE(v_cs.business_monthly_ex_vat, v_cs.monthly_price_incl_vat, v_order.plan_price);
  ELSE
    v_vat_mode := 'inclusive';
    v_monthly_num := COALESCE(v_cs.monthly_price_incl_vat, v_order.plan_price);
  END IF;
  IF v_monthly_num IS NULL THEN RAISE EXCEPTION 'missing_monthly_price'; END IF;
  v_monthly_minor := (round(v_monthly_num * 100))::int;

  -- Snapshot activation/setup fee (already in same VAT basis as monthly).
  v_activation_minor := (round(COALESCE(v_cs.setup_charge, 0) * 100))::int;

  -- Snapshot one_off_charges_json → aggregate + line array in minor units.
  IF v_cs.one_off_charges_json IS NOT NULL AND jsonb_typeof(v_cs.one_off_charges_json) = 'array' THEN
    FOR v_line IN SELECT * FROM jsonb_array_elements(v_cs.one_off_charges_json) LOOP
      v_line_amt := COALESCE((v_line->>'amount')::numeric, 0);
      IF v_line_amt > 0 THEN
        v_one_off_minor := v_one_off_minor + (round(v_line_amt * 100))::int;
        v_one_off_lines := v_one_off_lines || jsonb_build_array(jsonb_build_object(
          'label', COALESCE(v_line->>'label', 'One-off charge'),
          'amount_minor', (round(v_line_amt * 100))::int
        ));
      END IF;
    END LOOP;
  END IF;

  v_speed_down := v_cs.estimated_download_speed;
  v_speed_up   := v_cs.estimated_upload_speed;
  v_addons     := COALESCE(v_cs.selected_addons, '[]'::jsonb);
  v_addr       := COALESCE(v_cs.service_address,
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
    'notice_period',   v_cs.notice_period,
    'price_rise_policy', v_cs.price_rise_policy
  );

  -- Anchor calculations (unchanged).
  v_next_billing := public.next_anchor_billing_date(_actual_activation_date + 1, v_anchor);
  v_following    := public.next_anchor_billing_date(v_next_billing + 1, v_anchor);
  v_full_cycle_days := (v_following - v_next_billing);

  IF v_next_billing = (_actual_activation_date + (v_full_cycle_days || ' days')::interval)::date THEN
    v_is_pro_rata    := false;
    v_period_start   := _actual_activation_date;
    v_period_end     := v_next_billing;
    v_billable_days  := v_full_cycle_days;
  ELSE
    v_period_start   := _actual_activation_date;
    v_period_end     := v_next_billing;
    v_billable_days  := (v_next_billing - _actual_activation_date);
    v_is_pro_rata    := v_billable_days < v_full_cycle_days;
  END IF;

  IF v_min_term_months IS NOT NULL THEN
    v_min_term_end := (_actual_activation_date + (v_min_term_months || ' months')::interval)::date;
  END IF;

  -- Idempotent service upsert.
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
    v_service_type, v_plan_name, v_monthly_num, 'active',
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
  IF v_service_id IS NULL THEN RAISE EXCEPTION 'service_upsert_failed'; END IF;

  -- Promote order to live.
  UPDATE public.orders SET
    lifecycle_status        = 'live',
    status                  = 'active',
    actual_activation_date  = _actual_activation_date,
    giacom_reference        = COALESCE(_giacom_reference, giacom_reference),
    updated_at              = now()
  WHERE id = _order_id AND lifecycle_status = 'committed';

  -- History row.
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

  -- Profile for outbox.
  SELECT id, email, full_name, account_number INTO v_profile
  FROM public.profiles WHERE id = v_order.customer_id;

  -- Activation-email outbox (unchanged).
  INSERT INTO public.service_activation_outbox (
    service_id, journey_id, job_type, status, payload
  ) VALUES (
    v_service_id, v_order.journey_id, 'activation_email', 'pending',
    jsonb_build_object(
      'recipient_email',     v_profile.email,
      'recipient_name',      v_profile.full_name,
      'account_number',      v_profile.account_number,
      'occta_order_number',  v_order.occta_order_number,
      'plan_name',           v_plan_name,
      'activation_date',     _actual_activation_date,
      'next_billing_date',   v_next_billing,
      'monthly_price_minor', v_monthly_minor,
      'currency',            'GBP'
    )
  )
  ON CONFLICT (service_id, job_type) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.service_activation_outbox
    WHERE service_id = v_service_id AND job_type = 'activation_email'
  ) THEN
    RAISE EXCEPTION 'activation_outbox_failed';
  END IF;

  -- Determine blocker only for genuinely missing inputs.
  -- (All required fields have already been raised above; the check here
  --  is a defence in depth so any missing derived value blocks safely.)
  IF v_monthly_minor IS NULL OR v_monthly_minor <= 0 THEN
    v_missing_reasons := array_append(v_missing_reasons, 'missing_monthly_price');
  END IF;
  IF v_vat_mode IS NULL THEN
    v_missing_reasons := array_append(v_missing_reasons, 'missing_vat_mode');
  END IF;

  IF array_length(v_missing_reasons, 1) IS NOT NULL THEN
    v_blocker := array_to_string(v_missing_reasons, ',');
  ELSE
    v_blocker := NULL;
  END IF;

  -- First-billing job with fee snapshot.
  INSERT INTO public.first_billing_jobs (
    order_id, service_id, customer_id, status,
    activation_date, billing_anchor_day, next_billing_date,
    is_pro_rata, amount_minor, currency, blocker,
    period_start, period_end, billable_days, full_cycle_days,
    calc_method, payload,
    activation_fee_minor, one_off_charges_minor, one_off_lines,
    vat_mode, vat_rate
  ) VALUES (
    _order_id, v_service_id, v_order.customer_id, 'pending',
    _actual_activation_date, v_anchor, v_next_billing,
    v_is_pro_rata, v_monthly_minor, 'GBP', v_blocker,
    v_period_start, v_period_end, v_billable_days, v_full_cycle_days,
    'anchor_v2',
    jsonb_build_object(
      'plan_name', v_plan_name,
      'monthly_amount_minor', v_monthly_minor,
      'customer_type', v_customer_type_txt
    ),
    v_activation_minor, v_one_off_minor, v_one_off_lines,
    v_vat_mode, v_vat_rate
  )
  ON CONFLICT (order_id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.first_billing_jobs WHERE order_id = _order_id
  ) THEN
    RAISE EXCEPTION 'first_billing_job_failed';
  END IF;

  -- If we set a blocker, open an admin task explaining what's missing.
  IF v_blocker IS NOT NULL THEN
    INSERT INTO public.admin_tasks (
      title, description, priority, status, created_by,
      related_customer_id
    ) VALUES (
      'First billing blocked for order ' || COALESCE(v_order.occta_order_number, _order_id::text),
      'First-billing job is blocked. Missing: ' || v_blocker,
      'high', 'open', _actor,
      v_order.customer_id
    );
  END IF;

  RETURN jsonb_build_object(
    'already_live', false,
    'service_id', v_service_id,
    'order_id', _order_id,
    'next_billing_date', v_next_billing,
    'minimum_term_end_date', v_min_term_end,
    'billing_anchor_day', v_anchor,
    'monthly_price', v_monthly_num,
    'monthly_price_minor', v_monthly_minor,
    'is_pro_rata', v_is_pro_rata,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'billable_days', v_billable_days,
    'full_cycle_days', v_full_cycle_days,
    'calc_method', 'anchor_v2',
    'activation_fee_minor', v_activation_minor,
    'one_off_charges_minor', v_one_off_minor,
    'vat_mode', v_vat_mode,
    'blocker', v_blocker
  );
END $function$;

-- Phase 6: rewire Manual Giacom Tracking around canonical orders.

ALTER TABLE public.manual_fulfilment_orders
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS manual_fulfilment_orders_order_id_unique
  ON public.manual_fulfilment_orders (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mfo_order_id
  ON public.manual_fulfilment_orders (order_id);

CREATE OR REPLACE FUNCTION public.can_create_manual_fulfilment_for_order(_order_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.profiles p ON p.id = o.customer_id
    JOIN public.contract_summaries cs ON cs.id = o.contract_summary_id
    JOIN public.payment_methods pm ON pm.id = o.payment_method_id
    WHERE o.id = _order_id
      AND p.account_number IS NOT NULL
      AND o.occta_order_number IS NOT NULL
      AND cs.accepted_at IS NOT NULL
      AND cs.pdf_storage_key IS NOT NULL
      AND cs.pdf_sha256 IS NOT NULL
      AND o.preferred_start_date IS NOT NULL
      AND COALESCE(o.cooling_off_ends_at, now() - interval '1 second') <= now()
      AND o.lifecycle_status IS DISTINCT FROM 'live'
      AND o.lifecycle_status IS DISTINCT FROM 'cancelled'
      AND o.cancellation_requested_at IS NULL
  );
$$;
REVOKE ALL ON FUNCTION public.can_create_manual_fulfilment_for_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_manual_fulfilment_for_order(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_manual_fulfilment_eligibility()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    IF NOT public.can_create_manual_fulfilment_for_order(NEW.order_id) THEN
      RAISE EXCEPTION 'manual_fulfilment_order_ineligible';
    END IF;
  ELSIF NEW.payment_request_id IS NOT NULL THEN
    IF NOT public.can_create_manual_fulfilment(NEW.payment_request_id) THEN
      RAISE EXCEPTION 'Manual fulfilment tracker requires a paid, webhook-verified payment request linked to an accepted Contract Summary with a stored PDF.';
    END IF;
  ELSIF NEW.journey_id IS NOT NULL THEN
    IF NOT public.can_create_manual_fulfilment_for_journey(NEW.journey_id) THEN
      RAISE EXCEPTION 'Manual fulfilment tracker requires a completed order journey with an accepted Contract Summary, selected payment method, preferred start date and elapsed cooling-off period.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Manual fulfilment tracker requires order_id, payment_request_id or journey_id.';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.create_manual_fulfilment_tracker_for_order(
  _order_id uuid,
  _actor uuid,
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order   record;
  v_account text;
  v_existing uuid;
  v_new_id   uuid;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF v_order IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF NOT public.can_create_manual_fulfilment_for_order(_order_id) THEN
    RAISE EXCEPTION 'order_not_eligible';
  END IF;

  SELECT id INTO v_existing FROM public.manual_fulfilment_orders
   WHERE order_id = _order_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('already_exists', true, 'tracker_id', v_existing);
  END IF;

  SELECT account_number INTO v_account FROM public.profiles WHERE id = v_order.customer_id;

  INSERT INTO public.manual_fulfilment_orders (
    order_id, customer_id, account_number, journey_id, contract_summary_id,
    selected_product_label, readiness_confirmed, created_by, notes, status
  ) VALUES (
    _order_id, v_order.customer_id, v_account, v_order.journey_id, v_order.contract_summary_id,
    v_order.plan_name, true, _actor, _notes, 'ready_for_manual_order'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    SELECT id INTO v_new_id FROM public.manual_fulfilment_orders WHERE order_id = _order_id;
    RETURN jsonb_build_object('already_exists', true, 'tracker_id', v_new_id);
  END IF;
  RETURN jsonb_build_object('already_exists', false, 'tracker_id', v_new_id);
END $$;
REVOKE ALL ON FUNCTION public.create_manual_fulfilment_tracker_for_order(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_manual_fulfilment_tracker_for_order(uuid, uuid, text) TO service_role;

CREATE OR REPLACE VIEW public.manual_fulfilment_eligible_orders
WITH (security_invoker = true) AS
SELECT
  o.id                              AS order_id,
  o.occta_order_number,
  p.account_number,
  p.full_name                       AS customer_name,
  p.email                           AS customer_email,
  o.customer_id,
  o.journey_id,
  o.contract_summary_id,
  o.payment_method_id,
  o.plan_name,
  o.plan_price,
  o.service_type,
  o.address_line1, o.address_line2, o.city, o.postcode,
  o.preferred_start_date,
  o.cooling_off_ends_at,
  o.lifecycle_status,
  o.giacom_reference,
  o.giacom_product_ref,
  o.entered_in_giacom_at,
  o.expected_activation_date,
  o.actual_activation_date,
  cs.cs_number,
  cs.estimated_download_speed,
  cs.estimated_upload_speed,
  cs.pdf_storage_key,
  pm.method                         AS payment_method,
  mfo.id                            AS tracker_id,
  mfo.status                        AS tracker_status,
  mfo.notes                         AS tracker_notes,
  mfo.updated_at                    AS tracker_updated_at,
  o.created_at,
  o.updated_at
FROM public.orders o
JOIN public.profiles p           ON p.id = o.customer_id
JOIN public.contract_summaries cs ON cs.id = o.contract_summary_id
JOIN public.payment_methods pm   ON pm.id = o.payment_method_id
LEFT JOIN public.manual_fulfilment_orders mfo ON mfo.order_id = o.id
WHERE p.account_number IS NOT NULL
  AND o.occta_order_number IS NOT NULL
  AND cs.accepted_at IS NOT NULL
  AND cs.pdf_storage_key IS NOT NULL
  AND cs.pdf_sha256 IS NOT NULL
  AND o.preferred_start_date IS NOT NULL
  AND COALESCE(o.cooling_off_ends_at, now() - interval '1 second') <= now()
  AND o.lifecycle_status IS DISTINCT FROM 'cancelled'
  AND o.cancellation_requested_at IS NULL;

GRANT SELECT ON public.manual_fulfilment_eligible_orders TO authenticated, service_role;

-- Backfill: try to link legacy trackers to canonical orders via journey_id,
-- else (strictly) via a unique contract_summary_id match. Otherwise raise a
-- reconciliation task and leave the legacy row untouched.
DO $$
DECLARE
  r record;
  v_order_id uuid;
  v_count int;
BEGIN
  FOR r IN
    SELECT mfo.id, mfo.journey_id, mfo.contract_summary_id, mfo.account_number
    FROM public.manual_fulfilment_orders mfo
    WHERE mfo.order_id IS NULL
  LOOP
    v_order_id := NULL;
    IF r.journey_id IS NOT NULL THEN
      SELECT o.id INTO v_order_id
      FROM public.orders o
      WHERE o.journey_id = r.journey_id
      ORDER BY o.created_at DESC
      LIMIT 1;
    END IF;

    IF v_order_id IS NULL AND r.contract_summary_id IS NOT NULL THEN
      SELECT count(*) INTO v_count
      FROM public.orders o
      WHERE o.contract_summary_id = r.contract_summary_id;
      IF v_count = 1 THEN
        SELECT o.id INTO v_order_id
        FROM public.orders o
        WHERE o.contract_summary_id = r.contract_summary_id;
      END IF;
    END IF;

    IF v_order_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.manual_fulfilment_orders WHERE order_id = v_order_id)
    THEN
      UPDATE public.manual_fulfilment_orders
         SET order_id = v_order_id
       WHERE id = r.id;
    ELSE
      INSERT INTO public.admin_reconciliation_tasks (kind, severity, status, payload)
      VALUES (
        'manual_fulfilment_legacy_unlinked',
        'high',
        'open',
        jsonb_build_object(
          'tracker_id', r.id,
          'journey_id', r.journey_id,
          'contract_summary_id', r.contract_summary_id,
          'account_number', r.account_number,
          'reason', CASE
            WHEN v_order_id IS NULL THEN 'no_canonical_order_match'
            ELSE 'canonical_order_already_has_tracker'
          END
        )
      );
    END IF;
  END LOOP;
END $$;
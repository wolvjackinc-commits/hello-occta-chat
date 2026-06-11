
CREATE TABLE IF NOT EXISTS public.retail_price_floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL,
  speed_bucket text NOT NULL,
  plan_term text NOT NULL,
  floor_monthly_gross numeric(10,2) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_type, speed_bucket, plan_term)
);

GRANT SELECT ON public.retail_price_floors TO authenticated;
GRANT ALL ON public.retail_price_floors TO service_role;

ALTER TABLE public.retail_price_floors ENABLE ROW LEVEL SECURITY;

CREATE POLICY rpf_staff_read ON public.retail_price_floors
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY rpf_staff_write ON public.retail_price_floors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.retail_price_floors (service_type, speed_bucket, plan_term, floor_monthly_gross, notes) VALUES
  ('broadband','essential','price_lock_24',34.99,'Phase C fair-pricing floor'),
  ('broadband','essential','flex_30',37.99,'Phase C fair-pricing floor'),
  ('broadband','superfast','price_lock_24',39.99,'Phase C fair-pricing floor'),
  ('broadband','superfast','flex_30',42.99,'Phase C fair-pricing floor'),
  ('broadband','ultrafast','price_lock_24',49.99,'Phase C fair-pricing floor'),
  ('broadband','ultrafast','flex_30',52.99,'Phase C fair-pricing floor'),
  ('broadband','gigabit','price_lock_24',52.99,'Phase C fair-pricing floor'),
  ('broadband','gigabit','flex_30',54.99,'Phase C fair-pricing floor')
ON CONFLICT (service_type, speed_bucket, plan_term) DO UPDATE
  SET floor_monthly_gross = EXCLUDED.floor_monthly_gross,
      active = true,
      updated_at = now();

INSERT INTO public.margin_rules
  (service_type, plan_type, customer_type,
   minimum_monthly_margin, minimum_first_3_month_margin, minimum_contract_margin,
   support_cost_buffer, payment_processing_buffer, failed_payment_risk_buffer,
   reward_cost_buffer, router_cost_buffer, install_cost_buffer, cease_risk_buffer,
   active)
SELECT 'broadband', x.pt, 'both',
       5.00, 15.00, 60.00,
       0.50, 0.30, 0.20,
       0.00, 0.00, 0.00, 0.00,
       true
FROM (VALUES ('contract_saver'),('flex')) AS x(pt)
WHERE NOT EXISTS (
  SELECT 1 FROM public.margin_rules m
  WHERE m.service_type = 'broadband'
    AND m.plan_type = x.pt
    AND m.active = true
);

CREATE OR REPLACE FUNCTION public.quote_below_retail_floor(_quote_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_st text; v_bucket text; v_term text; v_price numeric; v_floor numeric;
BEGIN
  SELECT service_type::text, speed_bucket, plan_term, monthly_gross
    INTO v_st, v_bucket, v_term, v_price
  FROM public.quotes WHERE id = _quote_id;
  IF v_st IS NULL OR v_bucket IS NULL OR v_term IS NULL THEN
    RETURN false;
  END IF;
  SELECT floor_monthly_gross INTO v_floor
  FROM public.retail_price_floors
  WHERE active = true
    AND service_type = v_st
    AND speed_bucket = v_bucket
    AND plan_term = v_term
  LIMIT 1;
  IF v_floor IS NULL THEN RETURN false; END IF;
  RETURN v_price < v_floor;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.quote_below_retail_floor(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.quote_below_retail_floor(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_override_quote_floor(_quote_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid(); v_qr uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (public.has_role(v_actor,'admin') OR public.has_role(v_actor,'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _quote_id IS NULL OR _reason IS NULL OR length(trim(_reason)) < 10 THEN
    RAISE EXCEPTION 'reason required (min 10 chars)';
  END IF;
  UPDATE public.quotes
  SET bucket_override_reason = left('FLOOR_OVERRIDE: ' || _reason, 1000),
      updated_at = now()
  WHERE id = _quote_id
  RETURNING quote_request_id INTO v_qr;
  IF v_qr IS NULL THEN RAISE EXCEPTION 'quote not found'; END IF;

  INSERT INTO public.quote_events(quote_id, quote_request_id, event_type, title, actor_type, actor_id, details)
  VALUES (_quote_id, v_qr, 'floor_override', 'Retail floor override recorded', 'admin', v_actor,
          jsonb_build_object('reason_preview', left(_reason,200)));

  INSERT INTO public.audit_logs(actor_user_id, action, entity, entity_id, metadata)
  VALUES (v_actor, 'admin_override_quote_floor', 'quotes', _quote_id,
          jsonb_build_object('reason', left(_reason, 1000)));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_override_quote_floor(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_override_quote_floor(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_approve_final_quote(_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_qr uuid;
  v_snapshot jsonb;
  v_margin_status public.quote_margin_check_status;
  v_has_override_floor boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT public.is_staff(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _quote_id IS NULL THEN RAISE EXCEPTION 'invalid args'; END IF;

  SELECT status INTO v_margin_status
  FROM public.quote_margin_checks
  WHERE quote_id = _quote_id
  ORDER BY checked_at DESC
  LIMIT 1;
  IF v_margin_status IS NULL THEN
    RAISE EXCEPTION 'margin check required before approval';
  END IF;

  IF NOT public.can_send_quote(_quote_id) THEN
    RAISE EXCEPTION 'margin check failed — approve blocked. Run margin check or log an override.';
  END IF;

  IF v_margin_status = 'unknown' THEN
    RAISE EXCEPTION 'margin status unknown — link supplier product and re-run margin check before approval';
  END IF;

  IF public.quote_below_retail_floor(_quote_id) THEN
    SELECT (bucket_override_reason IS NOT NULL AND bucket_override_reason LIKE 'FLOOR_OVERRIDE:%')
      INTO v_has_override_floor
    FROM public.quotes WHERE id = _quote_id;
    IF NOT COALESCE(v_has_override_floor, false) THEN
      RAISE EXCEPTION 'customer price below retail fair-pricing floor — record an authorised floor override before approval';
    END IF;
  END IF;

  SELECT to_jsonb(q.*) INTO v_snapshot FROM public.quotes q WHERE q.id = _quote_id;
  IF v_snapshot IS NULL THEN RAISE EXCEPTION 'quote not found'; END IF;

  UPDATE public.quotes
  SET status = 'approved'::public.quote_status_kind,
      approved_at = COALESCE(approved_at, now()),
      approved_by = COALESCE(approved_by, v_actor),
      final_snapshot = COALESCE(final_snapshot, v_snapshot),
      updated_at = now()
  WHERE id = _quote_id
  RETURNING quote_request_id INTO v_qr;

  IF v_qr IS NOT NULL THEN
    UPDATE public.quote_requests
    SET status = 'final_quote_ready'::public.quote_request_status,
        final_quote_id = _quote_id,
        updated_at = now()
    WHERE id = v_qr;
  END IF;

  INSERT INTO public.quote_events(quote_id, quote_request_id, event_type, title, actor_type, actor_id, details)
  VALUES (_quote_id, v_qr, 'quote_approved', 'Final quote approved', 'admin', v_actor,
          jsonb_build_object('approved_by', v_actor, 'margin_status', v_margin_status));

  INSERT INTO public.audit_logs(actor_user_id, action, entity, entity_id, metadata)
  VALUES (v_actor, 'admin_approve_final_quote', 'quotes', _quote_id,
          jsonb_build_object('quote_request_id', v_qr, 'margin_status', v_margin_status));
END;
$$;

UPDATE public.quote_requests
SET final_quote_id = NULL,
    status = 'draft_quote_created'::public.quote_request_status,
    customer_facing_message = '[INTERNAL TEST — DO NOT PROCESS] Prior approved quote invalidated by Phase C pricing guard patch.',
    updated_at = now()
WHERE reference = 'QR-2606-20fa0e58';

UPDATE public.quotes
SET status = 'rejected'::public.quote_status_kind,
    admin_notes = COALESCE(admin_notes || E'\n','') || '[INTERNAL TEST — DO NOT PROCESS] Invalidated by Phase C pricing guard patch: 1.96% margin / below £34.99 floor.',
    updated_at = now()
WHERE quote_number = 'QT-2606-3c57d019';

UPDATE public.quote_margin_checks
SET reason = '[INVALIDATED by Phase C guard patch] ' || reason
WHERE quote_id IN (SELECT id FROM public.quotes WHERE quote_number = 'QT-2606-3c57d019');

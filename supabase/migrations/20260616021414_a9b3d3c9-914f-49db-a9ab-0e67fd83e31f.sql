
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS customer_intent_proceeded_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_intent_ip text,
  ADD COLUMN IF NOT EXISTS customer_intent_ua text;

CREATE OR REPLACE FUNCTION public.customer_proceed_with_quote_by_token(
  _token_hash text,
  _ip text DEFAULT NULL,
  _ua text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_quote_id uuid; v_status text; v_expires timestamptz; v_already timestamptz;
  v_qr_id uuid; v_qnum text;
BEGIN
  SELECT id, status::text, expires_at, customer_intent_proceeded_at, quote_request_id, quote_number
    INTO v_quote_id, v_status, v_expires, v_already, v_qr_id, v_qnum
  FROM public.quotes WHERE public_token_hash = _token_hash LIMIT 1;

  IF v_quote_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF v_already IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'already', true, 'proceeded_at', v_already); END IF;
  IF v_status NOT IN ('approved','sent','viewed') THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status'); END IF;
  IF v_expires IS NOT NULL AND v_expires < now() THEN RETURN jsonb_build_object('ok', false, 'reason', 'expired'); END IF;

  UPDATE public.quotes
    SET customer_intent_proceeded_at = now(),
        customer_intent_ip = LEFT(COALESCE(_ip,''), 64),
        customer_intent_ua = LEFT(COALESCE(_ua,''), 512),
        updated_at = now()
    WHERE id = v_quote_id;

  INSERT INTO public.quote_events(quote_id, quote_request_id, event_type, title, actor_type, details)
  VALUES (v_quote_id, v_qr_id, 'customer_intent_proceed',
          'Customer chose to proceed with quote', 'public',
          jsonb_build_object('ip', _ip, 'ua', LEFT(COALESCE(_ua,''), 200)));

  PERFORM public.log_event(
    'public','customer_intent_proceed',
    'Customer chose to proceed with quote ' || COALESCE(v_qnum,''),
    jsonb_build_object('quote_id', v_quote_id),
    NULL, NULL, NULL, v_quote_id, NULL, NULL, NULL, NULL, NULL,
    _ip, LEFT(COALESCE(_ua,''), 200), 'quotes', 'info'
  );

  RETURN jsonb_build_object('ok', true, 'proceeded_at', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_proceed_with_quote_authed(_quote_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid(); v_owner uuid; v_status text; v_expires timestamptz; v_already timestamptz;
  v_qr_id uuid; v_qnum text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'auth_required'); END IF;

  SELECT customer_id, status::text, expires_at, customer_intent_proceeded_at, quote_request_id, quote_number
    INTO v_owner, v_status, v_expires, v_already, v_qr_id, v_qnum
  FROM public.quotes WHERE id = _quote_id LIMIT 1;

  IF v_owner IS NULL OR v_owner <> v_uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF v_already IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'already', true, 'proceeded_at', v_already); END IF;
  IF v_status NOT IN ('approved','sent','viewed') THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status'); END IF;
  IF v_expires IS NOT NULL AND v_expires < now() THEN RETURN jsonb_build_object('ok', false, 'reason', 'expired'); END IF;

  UPDATE public.quotes
    SET customer_intent_proceeded_at = now(), updated_at = now()
    WHERE id = _quote_id;

  INSERT INTO public.quote_events(quote_id, quote_request_id, event_type, title, actor_type, actor_id)
  VALUES (_quote_id, v_qr_id, 'customer_intent_proceed',
          'Customer chose to proceed with quote (dashboard)', 'customer', v_uid);

  PERFORM public.log_event(
    'customer','customer_intent_proceed',
    'Customer chose to proceed with quote ' || COALESCE(v_qnum,''),
    jsonb_build_object('quote_id', _quote_id),
    v_uid, NULL, NULL, _quote_id, NULL, NULL, NULL, NULL, NULL,
    NULL, NULL, 'quotes', 'info'
  );

  RETURN jsonb_build_object('ok', true, 'proceeded_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.customer_proceed_with_quote_by_token(text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.customer_proceed_with_quote_authed(uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_customer_quotes();
CREATE OR REPLACE FUNCTION public.get_customer_quotes()
 RETURNS TABLE(id uuid, quote_number text, plan_name text, service_type text, plan_type text, customer_type text, status text, monthly_net numeric, monthly_gross numeric, setup_gross numeric, router_gross numeric, installation_gross numeric, delivery_gross numeric, total_due_today_gross numeric, contract_length_months integer, notice_period text, expires_at timestamptz, approved_at timestamptz, customer_notes text, created_at timestamptz, quote_request_reference text, customer_intent_proceeded_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT q.id, q.quote_number, q.plan_name,
         q.service_type::text, q.plan_type::text, q.customer_type::text, q.status::text,
         q.monthly_net, q.monthly_gross,
         q.setup_gross, q.router_gross, q.installation_gross, q.delivery_gross,
         q.total_due_today_gross, q.contract_length_months, q.notice_period,
         q.expires_at, q.approved_at, q.customer_notes, q.created_at,
         qr.reference, q.customer_intent_proceeded_at
  FROM public.quotes q
  LEFT JOIN public.quote_requests qr ON qr.id = q.quote_request_id
  WHERE q.customer_id = auth.uid()
    AND q.status::text IN ('approved','sent','viewed','accepted','expired')
  ORDER BY q.created_at DESC
  LIMIT 100;
$$;

DROP FUNCTION IF EXISTS public.get_customer_quote_by_id(uuid);
CREATE OR REPLACE FUNCTION public.get_customer_quote_by_id(_id uuid)
 RETURNS TABLE(id uuid, quote_number text, plan_name text, service_type text, plan_type text, customer_type text, status text, monthly_net numeric, monthly_vat_amount numeric, monthly_gross numeric, setup_gross numeric, router_gross numeric, installation_gross numeric, delivery_gross numeric, total_due_today_gross numeric, contract_length_months integer, notice_period text, price_rise_policy text, expires_at timestamptz, approved_at timestamptz, customer_notes text, estimated_download_speed integer, estimated_upload_speed integer, speed_notes text, quote_request_reference text, customer_intent_proceeded_at timestamptz, selected_addons jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT q.id, q.quote_number, q.plan_name,
         q.service_type::text, q.plan_type::text, q.customer_type::text, q.status::text,
         q.monthly_net, q.monthly_vat_amount, q.monthly_gross,
         q.setup_gross, q.router_gross, q.installation_gross, q.delivery_gross,
         q.total_due_today_gross, q.contract_length_months, q.notice_period,
         q.price_rise_policy, q.expires_at, q.approved_at, q.customer_notes,
         q.estimated_download_speed, q.estimated_upload_speed, q.speed_notes,
         qr.reference, q.customer_intent_proceeded_at, q.selected_addons
  FROM public.quotes q
  LEFT JOIN public.quote_requests qr ON qr.id = q.quote_request_id
  WHERE q.id = _id
    AND q.customer_id = auth.uid()
    AND q.status::text IN ('approved','sent','viewed','accepted','expired')
  LIMIT 1;
$$;

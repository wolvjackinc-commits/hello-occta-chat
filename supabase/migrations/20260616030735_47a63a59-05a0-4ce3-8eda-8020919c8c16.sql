CREATE OR REPLACE FUNCTION public.customer_proceed_with_quote_by_token(
  _token_hash text, _ip text DEFAULT NULL, _ua text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
          'Customer chose to proceed with quote', 'anon',
          jsonb_build_object('ip', _ip, 'ua', LEFT(COALESCE(_ua,''), 200)));

  PERFORM public.log_event(
    'anon','customer_intent_proceed',
    'Customer chose to proceed with quote ' || COALESCE(v_qnum,''),
    jsonb_build_object('quote_id', v_quote_id),
    NULL, NULL, NULL, v_quote_id, NULL, NULL, NULL, NULL, NULL,
    _ip, LEFT(COALESCE(_ua,''), 200), 'quotes', 'info'
  );

  RETURN jsonb_build_object('ok', true, 'proceeded_at', now());
END;
$function$;
CREATE TABLE public.quote_submission_receipts (
  key_hash text PRIMARY KEY,
  fingerprint text NOT NULL,
  quote_request_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  tracking_session_id uuid NOT NULL REFERENCES public.checkout_tracking_sessions(id),
  client_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quote_submission_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_submission_receipts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.quote_submission_receipts TO service_role;
CREATE INDEX quote_submission_client_hash_idx ON public.quote_submission_receipts(client_hash);

CREATE OR REPLACE FUNCTION public.save_quote_submission(
  _key_hash text, _fingerprint text, _payload jsonb, _client_hash text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _receipt public.quote_submission_receipts;
  _request public.quote_requests;
  _input public.quote_requests;
  _tracking uuid;
BEGIN
  IF _key_hash IS NULL OR _key_hash !~ '^[0-9a-f]{64}$'
    OR _fingerprint IS NULL OR _fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid submission identity';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_key_hash, 0));
  SELECT * INTO _receipt FROM public.quote_submission_receipts WHERE key_hash = _key_hash;
  IF FOUND THEN
    IF _receipt.fingerprint <> _fingerprint THEN
      RAISE EXCEPTION 'submission_key_conflict' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO _request FROM public.quote_requests WHERE id = _receipt.quote_request_id;
    RETURN jsonb_build_object('id', _request.id, 'reference', _request.reference, 'replayed', true);
  END IF;
  _input := jsonb_populate_record(NULL::public.quote_requests, _payload);
  INSERT INTO public.quote_requests (
    customer_id, full_name, email, phone, postcode, address_line_1, address_line_2,
    town, county, service_interest, plan_preference, customer_type, business_name,
    current_provider, current_monthly_bill, preferred_contact_method, message,
    marketing_consent, source, ip, user_agent, gclid, utm_source, utm_campaign,
    utm_term, utm_medium, landing_page, conversion_page, date_of_birth
  ) VALUES (
    _input.customer_id, _input.full_name, _input.email, _input.phone, _input.postcode,
    _input.address_line_1, _input.address_line_2, _input.town, _input.county,
    _input.service_interest, _input.plan_preference, _input.customer_type, _input.business_name,
    _input.current_provider, _input.current_monthly_bill, _input.preferred_contact_method,
    _input.message, _input.marketing_consent, _input.source, _input.ip, _input.user_agent,
    _input.gclid, _input.utm_source, _input.utm_campaign, _input.utm_term, _input.utm_medium,
    _input.landing_page, _input.conversion_page, _input.date_of_birth
  ) RETURNING * INTO _request;
  INSERT INTO public.checkout_tracking_sessions (
    client_session_hash, source, status, route_started, current_route, current_stage,
    progress_percent, completed_at
  ) VALUES (
    encode(extensions.digest('quote-receipt:' || _key_hash, 'sha256'), 'hex'),
    'web', 'completed', '/quote/start', '/quote/thank-you', 'quote_complete', 100, now()
  ) RETURNING id INTO _tracking;
  INSERT INTO public.quote_submission_receipts(key_hash, fingerprint, quote_request_id, tracking_session_id, client_hash)
    VALUES (_key_hash, _fingerprint, _request.id, _tracking, _client_hash);
  INSERT INTO public.checkout_tracking_events(tracking_session_id, event_type, route, stage, progress_percent, severity, details)
    VALUES (_tracking, 'complete', '/quote/thank-you', 'quote_complete', 100, 'info',
      jsonb_build_object('quote_request_id', _request.id, 'reference', _request.reference, 'server_verified', true));
  RETURN jsonb_build_object('id', _request.id, 'reference', _request.reference, 'replayed', false);
END;
$$;
REVOKE ALL ON FUNCTION public.save_quote_submission(text,text,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_quote_submission(text,text,jsonb,text) TO service_role;

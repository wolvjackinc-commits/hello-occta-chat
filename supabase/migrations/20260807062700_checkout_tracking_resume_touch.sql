-- Opening or reviewing a valid Journey 2 resume link counts as activity. This
-- prevents a second abandoned-checkout reminder while the customer is actively
-- reading the resumed order, without advancing or changing any checkout step.
CREATE OR REPLACE FUNCTION public.track_checkout_event(
  _client_session_id uuid,
  _event_type text,
  _route text,
  _stage text DEFAULT NULL,
  _progress_percent integer DEFAULT NULL,
  _journey_token text DEFAULT NULL,
  _error_code text DEFAULT NULL,
  _error_message text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hash text;
  _tracking_id uuid;
  _journey_id uuid;
  _journey_version text;
  _existing_stage text;
  _safe jsonb;
  _ua text;
BEGIN
  IF _event_type NOT IN ('session_start','route_change','stage_change','heartbeat','error','complete','cancel') THEN
    RAISE EXCEPTION 'unsupported checkout event';
  END IF;
  IF _route IS NULL OR length(_route) < 1 OR length(_route) > 180 OR left(_route,1) <> '/' THEN
    RAISE EXCEPTION 'invalid checkout route';
  END IF;
  IF _progress_percent IS NOT NULL AND (_progress_percent < 0 OR _progress_percent > 100) THEN
    RAISE EXCEPTION 'invalid checkout progress';
  END IF;

  _hash := encode(extensions.digest(_client_session_id::text, 'sha256'), 'hex');
  _safe := coalesce(_metadata, '{}'::jsonb)
    - 'token' - 'access_token' - 'refresh_token' - 'password' - 'date_of_birth'
    - 'dob' - 'sort_code' - 'account_number' - 'card_number' - 'cvv' - 'email'
    - 'phone' - 'address';
  _ua := left(coalesce(_safe->>'user_agent',''), 300);
  _safe := _safe - 'user_agent';

  IF _journey_token IS NOT NULL AND length(_journey_token) BETWEEN 16 AND 200 THEN
    SELECT id, journey_version
      INTO _journey_id, _journey_version
      FROM public.customer_journey_sessions
     WHERE public_token_hash = encode(extensions.digest(_journey_token, 'sha256'), 'hex')
     LIMIT 1;
  END IF;

  IF _journey_id IS NOT NULL AND _event_type IN ('session_start','route_change','stage_change','heartbeat') THEN
    UPDATE public.customer_journey_sessions
       SET last_activity_at = now(), abandoned_at = NULL
     WHERE id = _journey_id
       AND completed_at IS NULL
       AND submitted_at IS NULL
       AND status IN ('active','contract_prepared','contract_accepted');
  END IF;

  SELECT id, current_stage INTO _tracking_id, _existing_stage
    FROM public.checkout_tracking_sessions
   WHERE client_session_hash = _hash
   LIMIT 1;

  IF _tracking_id IS NULL THEN
    INSERT INTO public.checkout_tracking_sessions (
      client_session_hash, source, journey_session_id, journey_version,
      status, route_started, current_route, current_stage, progress_percent,
      user_agent
    ) VALUES (
      _hash, 'web', _journey_id, _journey_version,
      CASE WHEN _event_type='complete' THEN 'completed' ELSE 'active' END,
      _route, _route, _stage, _progress_percent,
      nullif(_ua,'')
    ) RETURNING id INTO _tracking_id;
  ELSE
    UPDATE public.checkout_tracking_sessions
       SET journey_session_id = coalesce(_journey_id, journey_session_id),
           journey_version = coalesce(_journey_version, journey_version),
           current_route = _route,
           current_stage = coalesce(_stage, current_stage),
           progress_percent = coalesce(_progress_percent, progress_percent),
           last_activity_at = now(),
           stage_started_at = CASE WHEN _stage IS NOT NULL AND _stage IS DISTINCT FROM _existing_stage THEN now() ELSE stage_started_at END,
           status = CASE
             WHEN _event_type='complete' THEN 'completed'
             WHEN _event_type='cancel' THEN 'cancelled'
             WHEN _event_type='error' AND status <> 'completed' THEN status
             ELSE CASE WHEN status='abandoned' THEN 'active' ELSE status END
           END,
           completed_at = CASE WHEN _event_type='complete' THEN coalesce(completed_at,now()) ELSE completed_at END,
           abandoned_at = CASE WHEN status='abandoned' AND _event_type IN ('route_change','stage_change','heartbeat') THEN NULL ELSE abandoned_at END,
           error_count = error_count + CASE WHEN _event_type='error' THEN 1 ELSE 0 END,
           last_error = CASE WHEN _event_type='error' THEN left(coalesce(_error_code,'error') || CASE WHEN _error_message IS NULL THEN '' ELSE ': ' || _error_message END,500) ELSE last_error END,
           last_error_at = CASE WHEN _event_type='error' THEN now() ELSE last_error_at END,
           user_agent = coalesce(nullif(_ua,''),user_agent),
           updated_at = now()
     WHERE id = _tracking_id;
  END IF;

  IF _event_type <> 'heartbeat' THEN
    INSERT INTO public.checkout_tracking_events (
      tracking_session_id, journey_session_id, event_type, route, stage,
      progress_percent, severity, details
    ) VALUES (
      _tracking_id, _journey_id, _event_type, _route, _stage,
      _progress_percent, CASE WHEN _event_type='error' THEN 'error' ELSE 'info' END,
      CASE WHEN _event_type='error'
        THEN _safe || jsonb_build_object('error_code',left(coalesce(_error_code,'error'),120),'error_message',left(coalesce(_error_message,''),300))
        ELSE _safe
      END
    );
  END IF;

  RETURN _tracking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.track_checkout_event(uuid,text,text,text,integer,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_checkout_event(uuid,text,text,text,integer,text,text,text,jsonb) TO anon, authenticated;

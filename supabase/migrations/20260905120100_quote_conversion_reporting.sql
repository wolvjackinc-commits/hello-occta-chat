CREATE OR REPLACE FUNCTION public.admin_checkout_session_list(_limit integer DEFAULT 150)
 RETURNS TABLE(source text, session_id uuid, journey_session_id uuid, journey_version text, status text, current_stage text, progress_percent integer, customer_name text, customer_email text, postcode text, plan_label text, current_route text, started_at timestamp with time zone, last_activity_at timestamp with time zone, stage_started_at timestamp with time zone, completed_at timestamp with time zone, abandoned_at timestamp with time zone, reminder_count integer, error_count integer, last_error text, order_id uuid, quote_id uuid, utm_source text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _since timestamptz := now() - interval '30 days';
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'staff access required';
  END IF;

  RETURN QUERY SELECT * FROM (
    SELECT 'journey2'::text AS source, s.id AS session_id, s.id AS journey_session_id, s.journey_version AS journey_version,
      CASE WHEN s.abandoned_at IS NOT NULL AND s.completed_at IS NULL THEN 'abandoned' ELSE s.status END::text AS status,
      s.current_step::text AS current_stage, public.checkout_stage_progress(s.current_step) AS progress_percent,
      nullif(s.customer_details->>'full_name','') AS customer_name, nullif(s.customer_details->>'email','') AS customer_email,
      s.postcode::text AS postcode,
      concat_ws(' - ',nullif(s.speed_bucket,''),nullif(s.plan_term,''))::text AS plan_label, '/order'::text AS current_route,
      coalesce(s.checkout_tracking_started_at,s.created_at) AS started_at, s.last_activity_at AS last_activity_at,
      coalesce(s.current_step_started_at,s.last_activity_at) AS stage_started_at, s.completed_at AS completed_at, s.abandoned_at AS abandoned_at,
      coalesce(s.reminder_count,0)::integer AS reminder_count, coalesce(s.error_count,0)::integer AS error_count, left(s.last_error,500)::text AS last_error,
      s.order_id AS order_id, s.quote_id AS quote_id, nullif(s.utm_snapshot->>'utm_source','')::text AS utm_source
    FROM public.customer_journey_sessions s
    WHERE NOT coalesce(s.test_session,false)
      AND coalesce(s.checkout_tracking_started_at,s.created_at) >= _since
    UNION ALL
    SELECT 'web'::text, w.id, NULL::uuid, coalesce(w.journey_version,'legacy')::text,
      CASE WHEN qr.id IS NOT NULL THEN 'completed' WHEN w.current_route = '/quote/thank-you' OR w.current_stage IN ('quote_complete','quote_confirmation_view') THEN 'unverified' ELSE w.status END::text,
      CASE WHEN qr.id IS NOT NULL THEN 'quote_complete' WHEN w.current_route = '/quote/thank-you' OR w.current_stage IN ('quote_complete','quote_confirmation_view') THEN 'quote_confirmation_view' ELSE w.current_stage END::text,
      CASE WHEN qr.id IS NOT NULL THEN 100 WHEN w.current_route = '/quote/thank-you' OR w.current_stage IN ('quote_complete','quote_confirmation_view') THEN NULL ELSE w.progress_percent END::integer,
      qr.full_name::text, qr.email::text, qr.postcode::text, qr.reference::text, w.current_route::text, w.started_at,
      w.last_activity_at, w.stage_started_at,
      CASE WHEN qr.id IS NOT NULL THEN qr.created_at WHEN w.current_route = '/quote/thank-you' OR w.current_stage IN ('quote_complete','quote_confirmation_view') THEN NULL ELSE w.completed_at END,
      w.abandoned_at, 0::integer, w.error_count::integer,
      left(w.last_error,500)::text, NULL::uuid, NULL::uuid, qr.utm_source::text
    FROM public.checkout_tracking_sessions w
    LEFT JOIN public.quote_submission_receipts receipt ON receipt.tracking_session_id = w.id
    LEFT JOIN public.quote_requests qr ON qr.id = receipt.quote_request_id
    WHERE w.journey_session_id IS NULL
      AND coalesce(w.journey_version,'legacy') <> 'v2'
      AND w.started_at >= _since
      AND NOT EXISTS (SELECT 1 FROM public.quote_submission_receipts linked WHERE linked.client_hash = w.client_session_hash)
  ) x ORDER BY x.started_at DESC LIMIT greatest(1,least(coalesce(_limit,150),500));
END; $function$
;
CREATE OR REPLACE FUNCTION public.track_checkout_event(_client_session_id uuid, _event_type text, _route text, _stage text DEFAULT NULL::text, _progress_percent integer DEFAULT NULL::integer, _journey_token text DEFAULT NULL::text, _error_code text DEFAULT NULL::text, _error_message text DEFAULT NULL::text, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _hash text; _tracking_id uuid; _journey_id uuid; _journey_version text; _existing_stage text; _safe jsonb; _ua text;
BEGIN
  IF _route = '/quote/thank-you' OR _stage IN ('quote_complete','quote_confirmation_view') THEN
    IF _event_type = 'complete' THEN _event_type := 'route_change'; END IF;
    _stage := 'quote_confirmation_view';
    _progress_percent := NULL;
  END IF;
  IF _event_type NOT IN ('session_start','route_change','stage_change','heartbeat','error','complete','cancel') THEN RAISE EXCEPTION 'unsupported checkout event'; END IF;
  IF _route IS NULL OR length(_route)<1 OR length(_route)>180 OR left(_route,1)<>'/' THEN RAISE EXCEPTION 'invalid checkout route'; END IF;
  IF _progress_percent IS NOT NULL AND (_progress_percent<0 OR _progress_percent>100) THEN RAISE EXCEPTION 'invalid checkout progress'; END IF;
  _hash := encode(extensions.digest(_client_session_id::text,'sha256'),'hex');
  _safe := coalesce(_metadata,'{}'::jsonb) - 'token' - 'access_token' - 'refresh_token' - 'password' - 'date_of_birth' - 'dob' - 'sort_code' - 'account_number' - 'card_number' - 'cvv' - 'email' - 'phone' - 'address';
  _ua := left(coalesce(_safe->>'user_agent',''),300); _safe := _safe - 'user_agent';
  IF _journey_token IS NOT NULL AND length(_journey_token) BETWEEN 16 AND 200 THEN
    SELECT id,journey_version INTO _journey_id,_journey_version FROM public.customer_journey_sessions WHERE public_token_hash=encode(extensions.digest(_journey_token,'sha256'),'hex') LIMIT 1;
  END IF;
  IF _journey_id IS NOT NULL AND _event_type IN ('session_start','route_change','stage_change','heartbeat') THEN
    UPDATE public.customer_journey_sessions
       SET last_activity_at=now(), abandoned_at=NULL
     WHERE id=_journey_id
       AND completed_at IS NULL
       AND submitted_at IS NULL
       AND status IN ('active','contract_prepared','contract_accepted');
  END IF;
  SELECT id,current_stage INTO _tracking_id,_existing_stage FROM public.checkout_tracking_sessions WHERE client_session_hash=_hash LIMIT 1;
  IF _tracking_id IS NULL THEN
    INSERT INTO public.checkout_tracking_sessions(client_session_hash,source,journey_session_id,journey_version,status,route_started,current_route,current_stage,progress_percent,user_agent)
    VALUES(_hash,'web',_journey_id,_journey_version,CASE WHEN _event_type='complete' THEN 'completed' ELSE 'active' END,_route,_route,_stage,_progress_percent,nullif(_ua,'')) RETURNING id INTO _tracking_id;
  ELSE
    UPDATE public.checkout_tracking_sessions SET journey_session_id=coalesce(_journey_id,journey_session_id),journey_version=coalesce(_journey_version,journey_version),current_route=_route,current_stage=coalesce(_stage,current_stage),progress_percent=coalesce(_progress_percent,progress_percent),last_activity_at=now(),stage_started_at=CASE WHEN _stage IS NOT NULL AND _stage IS DISTINCT FROM _existing_stage THEN now() ELSE stage_started_at END,status=CASE WHEN _event_type='complete' THEN 'completed' WHEN _event_type='cancel' THEN 'cancelled' WHEN _event_type='error' AND status<>'completed' THEN status ELSE CASE WHEN status='abandoned' THEN 'active' ELSE status END END,completed_at=CASE WHEN _event_type='complete' THEN coalesce(completed_at,now()) ELSE completed_at END,abandoned_at=CASE WHEN status='abandoned' AND _event_type IN ('route_change','stage_change','heartbeat') THEN NULL ELSE abandoned_at END,error_count=error_count+CASE WHEN _event_type='error' THEN 1 ELSE 0 END,last_error=CASE WHEN _event_type='error' THEN left(coalesce(_error_code,'error')||CASE WHEN _error_message IS NULL THEN '' ELSE ': '||_error_message END,500) ELSE last_error END,last_error_at=CASE WHEN _event_type='error' THEN now() ELSE last_error_at END,user_agent=coalesce(nullif(_ua,''),user_agent),updated_at=now() WHERE id=_tracking_id;
  END IF;
  IF _event_type<>'heartbeat' THEN
    INSERT INTO public.checkout_tracking_events(tracking_session_id,journey_session_id,event_type,route,stage,progress_percent,severity,details)
    VALUES(_tracking_id,_journey_id,_event_type,_route,_stage,_progress_percent,CASE WHEN _event_type='error' THEN 'error' ELSE 'info' END,CASE WHEN _event_type='error' THEN _safe||jsonb_build_object('error_code',left(coalesce(_error_code,'error'),120),'error_message',left(coalesce(_error_message,''),300)) ELSE _safe END);
  END IF;
  RETURN _tracking_id;
END; $function$
;


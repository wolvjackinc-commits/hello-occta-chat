-- Supabase installs pgcrypto into the extensions schema. Keep the checked-in
-- migration path identical to the production-tested definitions.

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

CREATE OR REPLACE FUNCTION public.process_checkout_tracking()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _delay_minutes integer := 60;
  _enabled boolean := false;
  _secret text;
  _r record;
  _response record;
  _email text;
  _first_name text;
  _subject text;
  _title text;
  _body text;
  _fact text;
  _raw_token text;
  _token_hash text;
  _resume_url text;
  _request_id bigint;
  _next_no integer;
  _marked integer := 0;
  _queued integer := 0;
  _reconciled integer := 0;
BEGIN
  SELECT coalesce(customer_journey_v2_abandoned_resume_enabled,false),
         greatest(5,coalesce(customer_journey_v2_resume_delay_minutes,60))
    INTO _enabled, _delay_minutes
    FROM public.platform_settings
   WHERE singleton = true;

  FOR _r IN
    SELECT r.id, r.journey_session_id, r.reminder_number, r.provider_request_id
      FROM public.checkout_reminders r
     WHERE r.status='queued' AND r.provider_request_id IS NOT NULL
       AND r.queued_at < now() - interval '30 seconds'
     ORDER BY r.queued_at
     LIMIT 100
  LOOP
    SELECT status_code, content INTO _response
      FROM net._http_response
     WHERE id = _r.provider_request_id;
    IF FOUND THEN
      IF _response.status_code BETWEEN 200 AND 299 THEN
        UPDATE public.checkout_reminders SET status='sent', delivered_at=now(), last_error=NULL WHERE id=_r.id;
        UPDATE public.customer_journey_sessions SET reminder_last_sent_at=now() WHERE id=_r.journey_session_id;
        PERFORM public.log_event(
          _actor_type := 'system', _event_type := 'checkout_reminder_sent',
          _title := 'Checkout resume reminder delivered',
          _details := jsonb_build_object('journey_session_id',_r.journey_session_id,'reminder_number',_r.reminder_number),
          _source_module := 'checkout_tracking'
        );
      ELSE
        UPDATE public.checkout_reminders
           SET status='failed', failed_at=now(), last_error=left(coalesce(_response.content,'HTTP '||_response.status_code::text),500)
         WHERE id=_r.id;
        PERFORM public.log_event(
          _actor_type := 'system', _event_type := 'checkout_reminder_failed',
          _title := 'Checkout resume reminder failed',
          _details := jsonb_build_object('journey_session_id',_r.journey_session_id,'reminder_number',_r.reminder_number,'status_code',_response.status_code),
          _source_module := 'checkout_tracking', _severity := 'warning'
        );
      END IF;
      _reconciled := _reconciled + 1;
    END IF;
  END LOOP;

  UPDATE public.checkout_tracking_sessions
     SET status='abandoned', abandoned_at=coalesce(abandoned_at,now()), updated_at=now()
   WHERE status='active'
     AND last_activity_at < now() - make_interval(mins => _delay_minutes);
  GET DIAGNOSTICS _marked = ROW_COUNT;

  UPDATE public.customer_journey_sessions
     SET abandoned_at=now()
   WHERE checkout_tracking_started_at IS NOT NULL
     AND abandoned_at IS NULL
     AND completed_at IS NULL
     AND submitted_at IS NULL
     AND status IN ('active','contract_prepared','contract_accepted')
     AND last_activity_at < now() - make_interval(mins => _delay_minutes)
     AND NOT coalesce(test_session,false);

  IF NOT _enabled THEN
    RETURN jsonb_build_object('ok',true,'reminders_enabled',false,'generic_marked',_marked,'reconciled',_reconciled,'queued',0);
  END IF;

  SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
   WHERE name='CRON_JOB_SECRET'
   LIMIT 1;
  IF coalesce(_secret,'') = '' THEN
    PERFORM public.log_event(
      _actor_type := 'system', _event_type := 'checkout_reminder_config_error',
      _title := 'Checkout reminders paused: email secret unavailable',
      _details := '{}'::jsonb, _source_module := 'checkout_tracking', _severity := 'error'
    );
    RETURN jsonb_build_object('ok',false,'error','email_secret_unavailable','generic_marked',_marked,'reconciled',_reconciled,'queued',0);
  END IF;

  FOR _r IN
    SELECT s.*
      FROM public.customer_journey_sessions s
     WHERE s.checkout_tracking_started_at IS NOT NULL
       AND s.abandoned_at IS NOT NULL
       AND s.completed_at IS NULL
       AND s.submitted_at IS NULL
       AND s.status IN ('active','contract_prepared','contract_accepted')
       AND NOT coalesce(s.test_session,false)
       AND coalesce(s.reminder_count,0) < 3
       AND nullif(trim(s.customer_details->>'email'),'') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.suppressed_emails se
          WHERE lower(se.email)=lower(s.customer_details->>'email')
       )
       AND (
         (coalesce(s.reminder_count,0)=0)
         OR (s.reminder_count=1 AND s.reminder_last_queued_at < now()-interval '23 hours')
         OR (s.reminder_count=2 AND s.reminder_last_queued_at < now()-interval '47 hours')
       )
     ORDER BY s.last_activity_at
     LIMIT 50
  LOOP
    _next_no := coalesce(_r.reminder_count,0)+1;
    _email := lower(trim(_r.customer_details->>'email'));
    _first_name := split_part(coalesce(nullif(trim(_r.customer_details->>'full_name'),''),'there'),' ',1);

    _fact := CASE
      WHEN _r.plan_term='price_lock_24' THEN 'Useful to know: Price Lock 24 is OCCTA''s fixed-term option, designed for customers who prefer price certainty over the minimum term.'
      WHEN _r.plan_term='flex_30' THEN 'Useful to know: Flex 30 is OCCTA''s rolling option where available, for customers who prefer a shorter commitment.'
      WHEN coalesce(_r.selected_addons,'[]'::jsonb) @> '["digital_voice"]'::jsonb THEN 'Useful to know: Digital Home Phone is a broadband add-on and depends on your broadband connection and power.'
      ELSE 'Useful to know: OCCTA confirms final availability, speed, setup and order details before your order is placed.'
    END;

    IF _next_no=1 THEN
      _subject := 'Your OCCTA order is saved — pick up where you left off';
      _title := 'Your order is saved';
      _body := '<p>You were part-way through your OCCTA order, so we saved the progress you had already completed.</p><p><strong>Nothing is charged simply because you started checkout.</strong> You can review everything again before the order is placed.</p><p>'||_fact||'</p><p>Your secure link below returns you to the latest saved stage.</p>';
    ELSIF _next_no=2 THEN
      _subject := 'A quick note before you finish your OCCTA order';
      _title := 'Carry on when you are ready';
      _body := '<p>Your saved OCCTA order is still incomplete. If you were comparing options or got interrupted, you do not need to rebuild it from the beginning.</p><p>'||_fact||'</p><p>Review the saved choices, contract information and billing details before submitting.</p>';
    ELSE
      _subject := 'Still want to continue your OCCTA order?';
      _title := 'Final automatic reminder';
      _body := '<p>This is our final automatic reminder for this saved order.</p><p>If you still want to continue, use the secure link below. If you no longer want the service, no action is needed.</p><p>'||_fact||'</p><p>If something stopped you completing the order, call <strong>0800 260 6626</strong> or email <strong>hello@occta.co.uk</strong> and we can help.</p>';
    END IF;

    _raw_token := encode(extensions.gen_random_bytes(24),'hex');
    _token_hash := encode(extensions.digest(_raw_token,'sha256'),'hex');
    _resume_url := 'https://www.occta.co.uk/order/'||_raw_token;

    UPDATE public.customer_journey_sessions
       SET public_token_hash=_token_hash,
           reminder_count=_next_no,
           reminder_last_queued_at=now()
     WHERE id=_r.id
       AND reminder_count=_r.reminder_count
       AND abandoned_at IS NOT NULL;
    IF NOT FOUND THEN CONTINUE; END IF;

    SELECT net.http_post(
      url := 'https://oexgjmuvgdndizsufipe.supabase.co/functions/v1/send-email',
      headers := jsonb_build_object('Content-Type','application/json','x-internal-secret',_secret),
      body := jsonb_build_object(
        'type','custom_admin', 'to',_email, 'logToCommunications',true,
        'data',jsonb_build_object(
          'subject',_subject,'title',_title,'greeting','Hi '||_first_name,
          'html_body',_body,'cta_text','Finish your order','cta_url',_resume_url
        )
      )
    ) INTO _request_id;

    INSERT INTO public.checkout_reminders(journey_session_id,reminder_number,subject,stage,status,provider_request_id)
    VALUES(_r.id,_next_no,_subject,_r.current_step,'queued',_request_id)
    ON CONFLICT(journey_session_id,reminder_number) DO NOTHING;

    PERFORM public.log_event(
      _actor_type := 'system', _event_type := 'checkout_reminder_queued',
      _title := 'Checkout resume reminder queued',
      _details := jsonb_build_object('journey_session_id',_r.id,'reminder_number',_next_no,'stage',_r.current_step),
      _source_module := 'checkout_tracking'
    );
    _queued := _queued+1;
  END LOOP;

  RETURN jsonb_build_object('ok',true,'reminders_enabled',true,'generic_marked',_marked,'reconciled',_reconciled,'queued',_queued);
END;
$$;

REVOKE ALL ON FUNCTION public.process_checkout_tracking() FROM PUBLIC;

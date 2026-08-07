-- Checkout journey intelligence: append-only tracking, abandonment detection,
-- safe resume reminders and admin-only reporting.
--
-- This migration deliberately wraps the existing checkout/order state machines.
-- It does not change pricing, contract, payment, Direct Debit or order semantics.

-- New tracking fields are nullable for historical rows. Defaults are applied
-- only to sessions created after this migration, so old sessions never receive
-- retroactive abandoned-checkout reminders.
ALTER TABLE public.customer_journey_sessions
  ADD COLUMN IF NOT EXISTS checkout_tracking_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_step_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reminder_last_queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;

ALTER TABLE public.customer_journey_sessions
  ALTER COLUMN checkout_tracking_started_at SET DEFAULT now(),
  ALTER COLUMN current_step_started_at SET DEFAULT now();

CREATE TABLE IF NOT EXISTS public.checkout_tracking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_session_hash text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'web',
  journey_session_id uuid REFERENCES public.customer_journey_sessions(id) ON DELETE SET NULL,
  journey_version text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','abandoned','completed','cancelled','error')),
  route_started text NOT NULL,
  current_route text NOT NULL,
  current_stage text,
  progress_percent smallint CHECK (progress_percent IS NULL OR progress_percent BETWEEN 0 AND 100),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  stage_started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  abandoned_at timestamptz,
  error_count integer NOT NULL DEFAULT 0,
  last_error text,
  last_error_at timestamptz,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checkout_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_session_id uuid NOT NULL REFERENCES public.checkout_tracking_sessions(id) ON DELETE CASCADE,
  journey_session_id uuid REFERENCES public.customer_journey_sessions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  route text,
  stage text,
  progress_percent smallint CHECK (progress_percent IS NULL OR progress_percent BETWEEN 0 AND 100),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','error')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checkout_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_session_id uuid NOT NULL REFERENCES public.customer_journey_sessions(id) ON DELETE CASCADE,
  reminder_number smallint NOT NULL CHECK (reminder_number BETWEEN 1 AND 3),
  subject text NOT NULL,
  stage text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  provider_request_id bigint,
  queued_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  failed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_session_id, reminder_number)
);

CREATE INDEX IF NOT EXISTS idx_checkout_tracking_sessions_activity
  ON public.checkout_tracking_sessions (status, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_tracking_sessions_journey
  ON public.checkout_tracking_sessions (journey_session_id);
CREATE INDEX IF NOT EXISTS idx_checkout_tracking_events_session_time
  ON public.checkout_tracking_events (tracking_session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_tracking_events_journey_time
  ON public.checkout_tracking_events (journey_session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_reminders_session_time
  ON public.checkout_reminders (journey_session_id, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_journey_tracking_activity
  ON public.customer_journey_sessions (checkout_tracking_started_at, status, last_activity_at DESC)
  WHERE checkout_tracking_started_at IS NOT NULL;

ALTER TABLE public.checkout_tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_reminders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.checkout_tracking_sessions FROM anon, authenticated;
REVOKE ALL ON public.checkout_tracking_events FROM anon, authenticated;
REVOKE ALL ON public.checkout_reminders FROM anon, authenticated;

-- Small deterministic helper used by both the database trigger and admin UI.
CREATE OR REPLACE FUNCTION public.checkout_stage_progress(_stage text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(_stage, ''))
    WHEN 'address' THEN 10
    WHEN 'plan' THEN 20
    WHEN 'router' THEN 30
    WHEN 'extras' THEN 40
    WHEN 'details' THEN 50
    WHEN 'start_date' THEN 60
    WHEN 'billing' THEN 70
    WHEN 'contract' THEN 80
    WHEN 'agreement' THEN 80
    WHEN 'review' THEN 90
    WHEN 'payment' THEN 90
    WHEN 'complete' THEN 100
    ELSE NULL
  END
$$;

-- Keep current-step timing and error counters accurate irrespective of which
-- existing edge function changed the Journey 2 row.
CREATE OR REPLACE FUNCTION public.checkout_journey_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.checkout_tracking_started_at := coalesce(NEW.checkout_tracking_started_at, now());
    NEW.current_step_started_at := coalesce(NEW.current_step_started_at, now());
    RETURN NEW;
  END IF;

  IF NEW.current_step IS DISTINCT FROM OLD.current_step THEN
    NEW.current_step_started_at := now();
  END IF;

  IF NEW.last_error IS DISTINCT FROM OLD.last_error AND NEW.last_error IS NOT NULL THEN
    NEW.error_count := coalesce(OLD.error_count, 0) + 1;
    NEW.last_error_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checkout_journey_before_write ON public.customer_journey_sessions;
CREATE TRIGGER trg_checkout_journey_before_write
BEFORE INSERT OR UPDATE ON public.customer_journey_sessions
FOR EACH ROW EXECUTE FUNCTION public.checkout_journey_before_write();

-- Central, server-side journey observer. It writes only non-sensitive state to
-- activity_log; DOB, phone, bank details, full address and tokens never enter it.
CREATE OR REPLACE FUNCTION public.checkout_journey_after_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _progress integer;
BEGIN
  _progress := public.checkout_stage_progress(NEW.current_step);

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_event(
      _actor_type := 'system',
      _event_type := 'checkout_journey_started',
      _title := 'Checkout journey started',
      _details := jsonb_build_object(
        'journey_session_id', NEW.id,
        'checkout_session_id', NEW.checkout_session_id,
        'journey_version', NEW.journey_version,
        'stage', NEW.current_step,
        'progress_percent', _progress
      ),
      _source_module := 'checkout_tracking'
    );
  ELSE
    IF NEW.current_step IS DISTINCT FROM OLD.current_step THEN
      PERFORM public.log_event(
        _actor_type := 'system',
        _event_type := 'checkout_stage_changed',
        _title := 'Checkout stage changed',
        _details := jsonb_build_object(
          'journey_session_id', NEW.id,
          'checkout_session_id', NEW.checkout_session_id,
          'journey_version', NEW.journey_version,
          'from_stage', OLD.current_step,
          'stage', NEW.current_step,
          'progress_percent', _progress
        ),
        _source_module := 'checkout_tracking'
      );
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.log_event(
        _actor_type := 'system',
        _event_type := 'checkout_status_changed',
        _title := 'Checkout status changed',
        _details := jsonb_build_object(
          'journey_session_id', NEW.id,
          'journey_version', NEW.journey_version,
          'from_status', OLD.status,
          'status', NEW.status,
          'stage', NEW.current_step,
          'progress_percent', _progress
        ),
        _source_module := 'checkout_tracking'
      );
    END IF;

    IF NEW.last_error IS DISTINCT FROM OLD.last_error AND NEW.last_error IS NOT NULL THEN
      PERFORM public.log_event(
        _actor_type := 'system',
        _event_type := 'checkout_error',
        _title := 'Checkout error recorded',
        _details := jsonb_build_object(
          'journey_session_id', NEW.id,
          'journey_version', NEW.journey_version,
          'stage', NEW.current_step,
          'error', left(NEW.last_error, 500)
        ),
        _source_module := 'checkout_tracking',
        _severity := 'error'
      );
    END IF;

    IF NEW.abandoned_at IS NOT NULL AND OLD.abandoned_at IS NULL THEN
      PERFORM public.log_event(
        _actor_type := 'system',
        _event_type := 'checkout_abandoned',
        _title := 'Checkout inactivity threshold reached',
        _details := jsonb_build_object(
          'journey_session_id', NEW.id,
          'journey_version', NEW.journey_version,
          'stage', NEW.current_step,
          'progress_percent', _progress
        ),
        _source_module := 'checkout_tracking',
        _severity := 'warning'
      );
    ELSIF NEW.abandoned_at IS NULL AND OLD.abandoned_at IS NOT NULL THEN
      PERFORM public.log_event(
        _actor_type := 'system',
        _event_type := 'checkout_resumed',
        _title := 'Customer resumed checkout',
        _details := jsonb_build_object(
          'journey_session_id', NEW.id,
          'journey_version', NEW.journey_version,
          'stage', NEW.current_step,
          'progress_percent', _progress,
          'reminders_sent', NEW.reminder_count
        ),
        _source_module := 'checkout_tracking'
      );
    END IF;

    IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
      PERFORM public.log_event(
        _actor_type := 'system',
        _event_type := 'checkout_completed',
        _title := 'Checkout completed',
        _details := jsonb_build_object(
          'journey_session_id', NEW.id,
          'journey_version', NEW.journey_version,
          'stage', NEW.current_step,
          'progress_percent', 100,
          'order_id', NEW.order_id
        ),
        _order_id := NEW.order_id,
        _quote_id := NEW.quote_id,
        _source_module := 'checkout_tracking'
      );
    END IF;
  END IF;

  UPDATE public.checkout_tracking_sessions
     SET journey_version = NEW.journey_version,
         current_stage = NEW.current_step,
         progress_percent = _progress,
         last_activity_at = greatest(last_activity_at, coalesce(NEW.last_activity_at, now())),
         stage_started_at = coalesce(NEW.current_step_started_at, stage_started_at),
         status = CASE
           WHEN NEW.completed_at IS NOT NULL OR NEW.status IN ('completed','order_submitted') THEN 'completed'
           WHEN NEW.status = 'cancelled' THEN 'cancelled'
           WHEN NEW.abandoned_at IS NOT NULL THEN 'abandoned'
           ELSE 'active'
         END,
         completed_at = coalesce(completed_at, NEW.completed_at),
         abandoned_at = NEW.abandoned_at,
         error_count = greatest(error_count, coalesce(NEW.error_count,0)),
         last_error = CASE WHEN NEW.last_error IS NULL THEN last_error ELSE left(NEW.last_error,500) END,
         last_error_at = coalesce(NEW.last_error_at, last_error_at),
         updated_at = now()
   WHERE journey_session_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checkout_journey_after_write ON public.customer_journey_sessions;
CREATE TRIGGER trg_checkout_journey_after_write
AFTER INSERT OR UPDATE ON public.customer_journey_sessions
FOR EACH ROW EXECUTE FUNCTION public.checkout_journey_after_write();

-- Public browser telemetry is deliberately narrow and SECURITY DEFINER. The
-- browser can write progression/error metadata but cannot read any session data.
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

  _hash := encode(digest(_client_session_id::text, 'sha256'), 'hex');
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
     WHERE public_token_hash = encode(digest(_journey_token, 'sha256'), 'hex')
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

-- Admin-safe overview. It exposes name/email for sales follow-up, but never DOB,
-- phone, full address, Direct Debit details or any journey token.
CREATE OR REPLACE FUNCTION public.admin_checkout_session_list(_limit integer DEFAULT 150)
RETURNS TABLE (
  source text,
  session_id uuid,
  journey_session_id uuid,
  journey_version text,
  status text,
  current_stage text,
  progress_percent integer,
  customer_name text,
  customer_email text,
  postcode text,
  plan_label text,
  current_route text,
  started_at timestamptz,
  last_activity_at timestamptz,
  stage_started_at timestamptz,
  completed_at timestamptz,
  abandoned_at timestamptz,
  reminder_count integer,
  error_count integer,
  last_error text,
  order_id uuid,
  quote_id uuid,
  utm_source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'admin access required';
  END IF;

  RETURN QUERY
  SELECT * FROM (
    SELECT
      'journey2'::text AS source,
      s.id AS session_id,
      s.id AS journey_session_id,
      s.journey_version,
      CASE WHEN s.abandoned_at IS NOT NULL AND s.completed_at IS NULL THEN 'abandoned' ELSE s.status END::text AS status,
      s.current_step::text AS current_stage,
      public.checkout_stage_progress(s.current_step) AS progress_percent,
      nullif(s.customer_details->>'full_name','') AS customer_name,
      nullif(s.customer_details->>'email','') AS customer_email,
      s.postcode::text,
      concat_ws(' · ', nullif(s.speed_bucket,''), nullif(s.plan_term,''))::text AS plan_label,
      ('/order')::text AS current_route,
      coalesce(s.checkout_tracking_started_at,s.created_at) AS started_at,
      s.last_activity_at,
      coalesce(s.current_step_started_at,s.last_activity_at) AS stage_started_at,
      s.completed_at,
      s.abandoned_at,
      coalesce(s.reminder_count,0)::integer AS reminder_count,
      coalesce(s.error_count,0)::integer AS error_count,
      left(s.last_error,500)::text AS last_error,
      s.order_id,
      s.quote_id,
      nullif(s.utm_snapshot->>'utm_source','')::text AS utm_source
    FROM public.customer_journey_sessions s
    WHERE s.checkout_tracking_started_at IS NOT NULL
      AND NOT coalesce(s.test_session,false)

    UNION ALL

    SELECT
      'web'::text,
      w.id,
      NULL::uuid,
      coalesce(w.journey_version,'legacy')::text,
      w.status::text,
      w.current_stage::text,
      w.progress_percent::integer,
      NULL::text,
      NULL::text,
      NULL::text,
      NULL::text,
      w.current_route::text,
      w.started_at,
      w.last_activity_at,
      w.stage_started_at,
      w.completed_at,
      w.abandoned_at,
      0::integer,
      w.error_count::integer,
      left(w.last_error,500)::text,
      NULL::uuid,
      NULL::uuid,
      NULL::text
    FROM public.checkout_tracking_sessions w
    WHERE w.journey_session_id IS NULL
  ) x
  ORDER BY x.started_at DESC
  LIMIT greatest(1,least(coalesce(_limit,150),500));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_checkout_session_list(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_checkout_session_list(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_checkout_timeline(_source text, _session_id uuid)
RETURNS TABLE (
  id uuid,
  event_type text,
  title text,
  stage text,
  severity text,
  details jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'admin access required';
  END IF;

  IF _source = 'journey2' THEN
    RETURN QUERY
    SELECT a.id, a.event_type, a.title,
           coalesce(a.details->>'stage',a.details->>'from_stage')::text,
           coalesce(a.severity,'info')::text,
           a.details, a.created_at
      FROM public.activity_log a
     WHERE (
       a.details->>'journey_session_id' = _session_id::text
       OR a.details->>'session_id' = _session_id::text
     )
       AND (a.event_type LIKE 'checkout_%' OR a.event_type LIKE 'journey2_%')
     ORDER BY a.created_at ASC;
  ELSE
    RETURN QUERY
    SELECT e.id, e.event_type, initcap(replace(e.event_type,'_',' '))::text,
           e.stage, e.severity, e.details, e.created_at
      FROM public.checkout_tracking_events e
     WHERE e.tracking_session_id = _session_id
     ORDER BY e.created_at ASC;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_checkout_timeline(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_checkout_timeline(text,uuid) TO authenticated;

-- Reconcile asynchronous email responses, mark inactivity and queue at most
-- three transactional resume reminders. Reminder copy is factual and does not
-- use urgency, fake scarcity or unverified commercial claims.
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

  -- Reconcile queued email HTTP requests from prior runs.
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
        UPDATE public.checkout_reminders
           SET status='sent', delivered_at=now(), last_error=NULL
         WHERE id=_r.id;
        UPDATE public.customer_journey_sessions
           SET reminder_last_sent_at=now()
         WHERE id=_r.journey_session_id;
        PERFORM public.log_event(
          _actor_type := 'system',
          _event_type := 'checkout_reminder_sent',
          _title := 'Checkout resume reminder delivered',
          _details := jsonb_build_object('journey_session_id',_r.journey_session_id,'reminder_number',_r.reminder_number),
          _source_module := 'checkout_tracking'
        );
      ELSE
        UPDATE public.checkout_reminders
           SET status='failed', failed_at=now(), last_error=left(coalesce(_response.content,'HTTP '||_response.status_code::text),500)
         WHERE id=_r.id;
        PERFORM public.log_event(
          _actor_type := 'system',
          _event_type := 'checkout_reminder_failed',
          _title := 'Checkout resume reminder failed',
          _details := jsonb_build_object('journey_session_id',_r.journey_session_id,'reminder_number',_r.reminder_number,'status_code',_response.status_code),
          _source_module := 'checkout_tracking',
          _severity := 'warning'
        );
      END IF;
      _reconciled := _reconciled + 1;
    END IF;
  END LOOP;

  -- Generic/legacy web journeys become abandoned after inactivity, but no email
  -- is sent because the tracker intentionally does not harvest partial-form PII.
  UPDATE public.checkout_tracking_sessions
     SET status='abandoned', abandoned_at=coalesce(abandoned_at,now()), updated_at=now()
   WHERE status='active'
     AND last_activity_at < now() - make_interval(mins => _delay_minutes);

  GET DIAGNOSTICS _marked = ROW_COUNT;

  -- Journey 2 keeps its normal checkout status. abandoned_at is an overlay only.
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
      _actor_type := 'system',
      _event_type := 'checkout_reminder_config_error',
      _title := 'Checkout reminders paused: email secret unavailable',
      _details := '{}'::jsonb,
      _source_module := 'checkout_tracking',
      _severity := 'error'
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

    -- The latest reminder token replaces the former browser token. This mirrors
    -- the existing Journey 2 resume-email security model: only the newest secure
    -- email link remains valid.
    _raw_token := encode(gen_random_bytes(24),'hex');
    _token_hash := encode(digest(_raw_token,'sha256'),'hex');
    _resume_url := 'https://www.occta.co.uk/order/'||_raw_token;

    UPDATE public.customer_journey_sessions
       SET public_token_hash=_token_hash,
           reminder_count=_next_no,
           reminder_last_queued_at=now()
     WHERE id=_r.id
       AND reminder_count=_r.reminder_count
       AND abandoned_at IS NOT NULL;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT net.http_post(
      url := 'https://oexgjmuvgdndizsufipe.supabase.co/functions/v1/send-email',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-internal-secret',_secret
      ),
      body := jsonb_build_object(
        'type','custom_admin',
        'to',_email,
        'logToCommunications',true,
        'data',jsonb_build_object(
          'subject',_subject,
          'title',_title,
          'greeting','Hi '||_first_name,
          'html_body',_body,
          'cta_text','Finish your order',
          'cta_url',_resume_url
        )
      )
    ) INTO _request_id;

    INSERT INTO public.checkout_reminders(
      journey_session_id, reminder_number, subject, stage, status, provider_request_id
    ) VALUES (_r.id,_next_no,_subject,_r.current_step,'queued',_request_id)
    ON CONFLICT (journey_session_id,reminder_number) DO NOTHING;

    PERFORM public.log_event(
      _actor_type := 'system',
      _event_type := 'checkout_reminder_queued',
      _title := 'Checkout resume reminder queued',
      _details := jsonb_build_object(
        'journey_session_id',_r.id,
        'reminder_number',_next_no,
        'stage',_r.current_step
      ),
      _source_module := 'checkout_tracking'
    );
    _queued := _queued+1;
  END LOOP;

  RETURN jsonb_build_object('ok',true,'reminders_enabled',true,'generic_marked',_marked,'reconciled',_reconciled,'queued',_queued);
END;
$$;

REVOKE ALL ON FUNCTION public.process_checkout_tracking() FROM PUBLIC;

-- One lightweight database job replaces manual checking. It calls only SQL and
-- the already-deployed send-email function; no new edge function is required.
DO $$
DECLARE _job record;
BEGIN
  FOR _job IN SELECT jobid FROM cron.job WHERE jobname='checkout-journey-monitor' LOOP
    PERFORM cron.unschedule(_job.jobid);
  END LOOP;
  PERFORM cron.schedule(
    'checkout-journey-monitor',
    '*/15 * * * *',
    'SELECT public.process_checkout_tracking();'
  );
END;
$$;

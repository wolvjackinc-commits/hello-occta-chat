-- Checkout recovery desk (Journey Control).
--
-- 1. Staff work queue for abandoned Journey 2 checkouts, with a phone number
--    to call (many OCCTA customers do not use email).
-- 2. Append-only log of every recovery contact attempt and its outcome.
-- 3. "Do not contact" stops all further automatic reminder emails.
-- 4. Honest recovery reporting: a session counts as recovered only when it was
--    recorded abandoned (activity_log checkout_abandoned) and later completed.
--    Reminders and staff contacts before completion are reported as touches,
--    never as proof of cause.
-- 5. The database reminder sender no longer emails signed contracts or people
--    who already have an OCCTA order (the edge worker already skipped them).
--
-- Idempotent: safe to re-run.

ALTER TABLE public.customer_journey_sessions
  ADD COLUMN IF NOT EXISTS recovery_opt_out_at timestamptz;

CREATE TABLE IF NOT EXISTS public.checkout_recovery_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_session_id uuid NOT NULL REFERENCES public.customer_journey_sessions(id) ON DELETE CASCADE,
  staff_user_id uuid NOT NULL,
  outcome text NOT NULL CHECK (outcome IN (
    'no_answer','voicemail','callback_requested','will_complete_online',
    'phone_order_started','not_interested','wrong_number','do_not_contact','opt_out_withdrawn')),
  note text CHECK (note IS NULL OR char_length(note) <= 1000),
  callback_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((outcome = 'callback_requested') = (callback_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS checkout_recovery_contacts_session_idx
  ON public.checkout_recovery_contacts (journey_session_id, created_at DESC);
-- First-abandonment lookups per session (small partial index).
CREATE INDEX IF NOT EXISTS activity_log_checkout_abandoned_session_idx
  ON public.activity_log ((details->>'journey_session_id'), ts)
  WHERE event_type = 'checkout_abandoned';

ALTER TABLE public.checkout_recovery_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS checkout_recovery_contacts_staff_read ON public.checkout_recovery_contacts;
CREATE POLICY checkout_recovery_contacts_staff_read ON public.checkout_recovery_contacts
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
-- No insert/update/delete policies: writes only through admin_log_checkout_recovery.

CREATE OR REPLACE FUNCTION public.checkout_recovery_contacts_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'checkout recovery contacts are append-only' USING ERRCODE = '42501';
END; $$;
DROP TRIGGER IF EXISTS checkout_recovery_contacts_no_update ON public.checkout_recovery_contacts;
CREATE TRIGGER checkout_recovery_contacts_no_update
  BEFORE UPDATE ON public.checkout_recovery_contacts
  FOR EACH ROW EXECUTE FUNCTION public.checkout_recovery_contacts_immutable();

-- True when this email already belongs to someone who has ordered or signed
-- with OCCTA. Mirrors hasPlacedOrder() in journey2-resume-email.
CREATE OR REPLACE FUNCTION public.checkout_email_has_order(_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT nullif(trim(_email), '') IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.guest_orders g WHERE lower(g.email) = lower(trim(_email)))
    OR EXISTS (SELECT 1 FROM public.contract_summaries c
               WHERE lower(c.customer_email_snapshot) = lower(trim(_email)) AND c.status::text = 'accepted')
    OR EXISTS (SELECT 1 FROM public.profiles p
               WHERE lower(p.email) = lower(trim(_email))
                 AND (EXISTS (SELECT 1 FROM public.orders o WHERE o.user_id = p.id)
                      OR EXISTS (SELECT 1 FROM public.services sv WHERE sv.user_id = p.id)))
  );
$$;
REVOKE ALL ON FUNCTION public.checkout_email_has_order(text) FROM PUBLIC, anon, authenticated;

-- Work queue: abandoned, unfinished, real Journey 2 checkouts from the last
-- 30 days that left a phone number or email.
CREATE OR REPLACE FUNCTION public.admin_checkout_recovery_queue(_limit integer DEFAULT 200)
RETURNS TABLE(
  session_id uuid, customer_name text, phone text, email text, postcode text,
  current_stage text, progress_percent integer, status text, plan_label text,
  contract_signed boolean, expired boolean, existing_customer boolean,
  started_at timestamptz, last_activity_at timestamptz, first_abandoned_at timestamptz,
  reminders_sent integer, last_reminder_at timestamptz,
  contact_attempts integer, last_outcome text, last_contact_at timestamptz, callback_at timestamptz,
  opted_out_at timestamptz, utm_source text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_staff(auth.uid()), false) THEN
    RAISE EXCEPTION 'staff access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT s.id,
    nullif(trim(s.customer_details->>'full_name'), ''),
    nullif(trim(s.customer_details->>'phone'), ''),
    nullif(trim(s.customer_details->>'email'), ''),
    s.postcode::text,
    s.current_step::text,
    public.checkout_stage_progress(s.current_step),
    s.status::text,
    nullif(concat_ws(' - ', nullif(s.speed_bucket, ''), nullif(s.plan_term, '')), '')::text,
    (s.contract_acceptance_id IS NOT NULL OR s.status = 'contract_accepted'),
    (s.expires_at <= now() OR s.status = 'expired'),
    public.checkout_email_has_order(s.customer_details->>'email'),
    coalesce(s.checkout_tracking_started_at, s.created_at),
    s.last_activity_at,
    coalesce((SELECT min(a.ts) FROM public.activity_log a
              WHERE a.event_type = 'checkout_abandoned' AND a.details->>'journey_session_id' = s.id::text), s.abandoned_at),
    (SELECT count(*)::integer FROM public.checkout_reminders r WHERE r.journey_session_id = s.id AND r.status = 'sent'),
    (SELECT max(coalesce(r.delivered_at, r.queued_at)) FROM public.checkout_reminders r WHERE r.journey_session_id = s.id AND r.status = 'sent'),
    (SELECT count(*)::integer FROM public.checkout_recovery_contacts c WHERE c.journey_session_id = s.id),
    lc.outcome, lc.created_at, lc.callback_at,
    s.recovery_opt_out_at,
    nullif(s.utm_snapshot->>'utm_source', '')::text
  FROM public.customer_journey_sessions s
  LEFT JOIN LATERAL (
    SELECT c.outcome, c.created_at, c.callback_at FROM public.checkout_recovery_contacts c
    WHERE c.journey_session_id = s.id ORDER BY c.created_at DESC, c.id DESC LIMIT 1
  ) lc ON true
  WHERE s.journey_version = 'v2'
    AND NOT coalesce(s.test_session, false)
    AND s.completed_at IS NULL
    AND s.submitted_at IS NULL
    AND s.status IN ('active', 'contract_prepared', 'contract_accepted', 'expired')
    AND (s.abandoned_at IS NOT NULL OR s.status = 'expired')
    AND s.last_activity_at >= now() - interval '30 days'
    AND (nullif(trim(s.customer_details->>'phone'), '') IS NOT NULL OR nullif(trim(s.customer_details->>'email'), '') IS NOT NULL)
  ORDER BY
    (s.recovery_opt_out_at IS NOT NULL),                                  -- opted out last
    (lc.outcome = 'callback_requested' AND lc.callback_at <= now()) DESC, -- due callbacks first
    (s.contract_acceptance_id IS NOT NULL OR s.status = 'contract_accepted') DESC,
    public.checkout_stage_progress(s.current_step) DESC NULLS LAST,
    s.last_activity_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 200), 500));
END; $$;
REVOKE ALL ON FUNCTION public.admin_checkout_recovery_queue(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_checkout_recovery_queue(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_checkout_recovery_history(_session_id uuid)
RETURNS TABLE(id uuid, outcome text, note text, callback_at timestamptz, created_at timestamptz, staff_email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_staff(auth.uid()), false) THEN
    RAISE EXCEPTION 'staff access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT c.id, c.outcome, c.note, c.callback_at, c.created_at, p.email::text
  FROM public.checkout_recovery_contacts c
  LEFT JOIN public.profiles p ON p.id = c.staff_user_id
  WHERE c.journey_session_id = _session_id
  ORDER BY c.created_at DESC, c.id DESC;
END; $$;
REVOKE ALL ON FUNCTION public.admin_checkout_recovery_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_checkout_recovery_history(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_log_checkout_recovery(
  _session_id uuid, _outcome text, _note text DEFAULT NULL, _callback_at timestamptz DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _note_clean text := nullif(trim(coalesce(_note, '')), '');
BEGIN
  IF _uid IS NULL OR NOT coalesce(public.is_staff(_uid), false) THEN
    RAISE EXCEPTION 'staff access required' USING ERRCODE = '42501';
  END IF;
  IF _outcome IS NULL OR _outcome NOT IN ('no_answer','voicemail','callback_requested','will_complete_online',
      'phone_order_started','not_interested','wrong_number','do_not_contact','opt_out_withdrawn') THEN
    RAISE EXCEPTION 'invalid recovery outcome' USING ERRCODE = '22023';
  END IF;
  IF _outcome = 'callback_requested' THEN
    IF _callback_at IS NULL OR _callback_at < now() - interval '5 minutes' OR _callback_at > now() + interval '60 days' THEN
      RAISE EXCEPTION 'a callback needs a time within the next 60 days' USING ERRCODE = '22023';
    END IF;
  ELSE
    _callback_at := NULL;
  END IF;
  IF _note_clean IS NOT NULL AND char_length(_note_clean) > 1000 THEN
    RAISE EXCEPTION 'note is too long (1000 characters max)' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.customer_journey_sessions s
   WHERE s.id = _session_id AND NOT coalesce(s.test_session, false) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'checkout session not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.checkout_recovery_contacts(journey_session_id, staff_user_id, outcome, note, callback_at)
  VALUES (_session_id, _uid, _outcome, _note_clean, _callback_at) RETURNING id INTO _id;

  IF _outcome = 'do_not_contact' THEN
    UPDATE public.customer_journey_sessions SET recovery_opt_out_at = coalesce(recovery_opt_out_at, now()) WHERE id = _session_id;
  ELSIF _outcome = 'opt_out_withdrawn' THEN
    UPDATE public.customer_journey_sessions SET recovery_opt_out_at = NULL WHERE id = _session_id;
  END IF;

  -- Appears in the Journey Control timeline (event_type LIKE 'checkout_%').
  -- The free-text note stays in the contacts table only.
  PERFORM public.log_event(
    _actor_type := 'staff', _event_type := 'checkout_recovery_contact',
    _title := 'Recovery contact logged: ' || replace(_outcome, '_', ' '),
    _details := jsonb_build_object('journey_session_id', _session_id, 'contact_id', _id,
                                   'outcome', _outcome, 'callback_at', _callback_at, 'staff_user_id', _uid),
    _source_module := 'checkout_recovery');
  RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_log_checkout_recovery(uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_checkout_recovery(uuid, text, text, timestamptz) TO authenticated;

-- Recovery reporting for sessions started in the last _days days.
CREATE OR REPLACE FUNCTION public.admin_checkout_recovery_stats(_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(_days, 30), 365))); _r jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_staff(auth.uid()), false) THEN
    RAISE EXCEPTION 'staff access required' USING ERRCODE = '42501';
  END IF;
  WITH s AS (
    SELECT x.id, x.completed_at, x.submitted_at, x.recovery_opt_out_at, x.status,
      nullif(trim(x.customer_details->>'phone'), '') AS phone,
      nullif(trim(x.customer_details->>'email'), '') AS email,
      coalesce((SELECT min(a.ts) FROM public.activity_log a
                WHERE a.event_type = 'checkout_abandoned' AND a.details->>'journey_session_id' = x.id::text), x.abandoned_at) AS first_abandoned_at
    FROM public.customer_journey_sessions x
    WHERE x.journey_version = 'v2' AND NOT coalesce(x.test_session, false)
      AND coalesce(x.checkout_tracking_started_at, x.created_at) >= _since
  ), t AS (
    SELECT s.*,
      (s.first_abandoned_at IS NOT NULL AND s.completed_at IS NOT NULL AND s.completed_at > s.first_abandoned_at) AS recovered,
      EXISTS (SELECT 1 FROM public.checkout_reminders r WHERE r.journey_session_id = s.id AND r.status = 'sent'
              AND coalesce(r.delivered_at, r.queued_at) < coalesce(s.completed_at, 'infinity')) AS reminded,
      EXISTS (SELECT 1 FROM public.checkout_recovery_contacts c WHERE c.journey_session_id = s.id
              AND c.created_at < coalesce(s.completed_at, 'infinity')) AS contacted
    FROM s
  )
  SELECT jsonb_build_object(
    'window_days', greatest(1, least(coalesce(_days, 30), 365)),
    'started', count(*),
    'abandoned', count(*) FILTER (WHERE first_abandoned_at IS NOT NULL),
    'recovered', count(*) FILTER (WHERE recovered),
    'recovered_after_reminder', count(*) FILTER (WHERE recovered AND reminded),
    'recovered_after_staff_contact', count(*) FILTER (WHERE recovered AND contacted),
    'recovered_without_touch', count(*) FILTER (WHERE recovered AND NOT reminded AND NOT contacted),
    'open_abandoned', count(*) FILTER (WHERE first_abandoned_at IS NOT NULL AND completed_at IS NULL AND submitted_at IS NULL AND status NOT IN ('cancelled','completed')),
    'open_with_phone', count(*) FILTER (WHERE first_abandoned_at IS NOT NULL AND completed_at IS NULL AND submitted_at IS NULL AND status NOT IN ('cancelled','completed') AND phone IS NOT NULL AND recovery_opt_out_at IS NULL),
    'open_contacted', count(*) FILTER (WHERE first_abandoned_at IS NOT NULL AND completed_at IS NULL AND submitted_at IS NULL AND status NOT IN ('cancelled','completed') AND contacted),
    'opted_out', count(*) FILTER (WHERE recovery_opt_out_at IS NOT NULL),
    'recovery_rate', CASE WHEN count(*) FILTER (WHERE first_abandoned_at IS NOT NULL) = 0 THEN NULL
      ELSE round(100.0 * count(*) FILTER (WHERE recovered) / count(*) FILTER (WHERE first_abandoned_at IS NOT NULL), 1) END,
    'outcomes', coalesce((SELECT jsonb_object_agg(o.outcome, o.n) FROM (
        SELECT c.outcome, count(*) n FROM public.checkout_recovery_contacts c
        JOIN s ON s.id = c.journey_session_id GROUP BY c.outcome) o), '{}'::jsonb)
  ) INTO _r FROM t;
  RETURN _r;
END; $$;
REVOKE ALL ON FUNCTION public.admin_checkout_recovery_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_checkout_recovery_stats(integer) TO authenticated;

-- Database reminder sender: identical to the live version except the email
-- selection now also excludes (a) signed contracts / post-contract sessions,
-- (b) sessions marked do-not-contact and (c) emails that already have an
-- OCCTA order — matching the journey2-resume-email edge worker.
CREATE OR REPLACE FUNCTION public.process_checkout_tracking()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
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
  _journey_marked integer := 0;
  _queued integer := 0;
  _reconciled integer := 0;
  _failed_reconciled integer := 0;
  _switch50 record;
begin
  select coalesce(customer_journey_v2_abandoned_resume_enabled,false),
         greatest(5,coalesce(customer_journey_v2_resume_delay_minutes,60))
    into _enabled, _delay_minutes
    from public.platform_settings
   where singleton = true;

  update public.checkout_tracking_sessions
     set status='abandoned', abandoned_at=coalesce(abandoned_at,now()), updated_at=now()
   where status='active'
     and last_activity_at < now() - make_interval(mins => _delay_minutes);
  get diagnostics _marked = row_count;

  update public.customer_journey_sessions
     set abandoned_at=now()
   where checkout_tracking_started_at is not null
     and abandoned_at is null
     and completed_at is null
     and submitted_at is null
     and status in ('active','contract_prepared','contract_accepted')
     and last_activity_at < now() - make_interval(mins => _delay_minutes)
     and not coalesce(test_session,false);
  get diagnostics _journey_marked = row_count;

  -- Reconcile provider responses first so counts and delivery states remain honest.
  for _r in
    select r.id, r.journey_session_id, r.reminder_number, r.provider_request_id
      from public.checkout_reminders r
     where r.status='queued' and r.provider_request_id is not null
     order by r.queued_at
     limit 150
  loop
    select status_code, content into _response
      from net._http_response
     where id = _r.provider_request_id;
    if found then
      if _response.status_code between 200 and 299 then
        update public.checkout_reminders
           set status='sent', delivered_at=coalesce(delivered_at,now()), last_error=null
         where id=_r.id;
        update public.customer_journey_sessions
           set reminder_last_sent_at=now()
         where id=_r.journey_session_id;
        _reconciled := _reconciled + 1;
      else
        update public.checkout_reminders
           set status='failed', failed_at=now(), last_error=left(coalesce(_response.content,'HTTP '||coalesce(_response.status_code::text,'unknown')),500)
         where id=_r.id;
        -- Allow a later retry of the same reminder number with a fresh secure token.
        update public.customer_journey_sessions
           set reminder_count=greatest(coalesce(reminder_count,1)-1,0), reminder_last_queued_at=null
         where id=_r.journey_session_id and reminder_count=_r.reminder_number;
        _failed_reconciled := _failed_reconciled + 1;
      end if;
    elsif exists(select 1 from public.checkout_reminders x where x.id=_r.id and x.queued_at < now()-interval '6 hours') then
      update public.checkout_reminders
         set status='failed', failed_at=now(), last_error=coalesce(last_error,'provider_response_missing')
       where id=_r.id;
      update public.customer_journey_sessions
         set reminder_count=greatest(coalesce(reminder_count,1)-1,0), reminder_last_queued_at=null
       where id=_r.journey_session_id and reminder_count=_r.reminder_number;
      _failed_reconciled := _failed_reconciled + 1;
    end if;
  end loop;

  if not _enabled then
    return jsonb_build_object('ok',true,'reminders_enabled',false,'generic_marked',_marked,'journey_marked',_journey_marked,'reconciled',_reconciled,'failed_reconciled',_failed_reconciled,'queued',0);
  end if;

  select decrypted_secret into _secret
    from vault.decrypted_secrets
   where name='CRON_JOB_SECRET'
   limit 1;
  if coalesce(_secret,'')='' then
    return jsonb_build_object('ok',false,'error','email_secret_unavailable','generic_marked',_marked,'journey_marked',_journey_marked,'queued',0);
  end if;

  select code,title,reward_amount,reward_currency,starts_at,ends_at,terms_version,terms_text
    into _switch50
    from public.offer_campaigns
   where code='SWITCH50' and active=true and starts_at<=now() and ends_at>=now()
   order by created_at desc
   limit 1;

  for _r in
    select s.*
      from public.customer_journey_sessions s
     where s.checkout_tracking_started_at is not null
       and s.abandoned_at is not null
       and s.completed_at is null
       and s.submitted_at is null
       and s.status in ('active','contract_prepared')
       and s.contract_acceptance_id is null
       and s.post_contract_applied_at is null
       and s.recovery_opt_out_at is null
       and not coalesce(s.test_session,false)
       and s.expires_at > now()
       and coalesce(s.reminder_count,0) < 4
       and nullif(trim(s.customer_details->>'email'),'') is not null
       and not exists (select 1 from public.suppressed_emails se where lower(se.email)=lower(s.customer_details->>'email'))
       and not public.checkout_email_has_order(s.customer_details->>'email')
       and (
         coalesce(s.reminder_count,0)=0
         or (s.reminder_count=1 and s.reminder_last_queued_at < now()-interval '23 hours')
         or (s.reminder_count=2 and s.reminder_last_queued_at < now()-interval '47 hours')
         or (s.reminder_count=3 and s.reminder_last_queued_at < now()-interval '47 hours'
             and coalesce((s.customer_details->>'marketing_consent')::boolean,false)=true
             and _switch50.code is not null)
       )
     order by case when s.reminder_count=3 then 0 else 1 end, s.last_activity_at
     limit 50
  loop
    _next_no := coalesce(_r.reminder_count,0)+1;
    if _next_no=4 and (coalesce((_r.customer_details->>'marketing_consent')::boolean,false) is not true or _switch50.code is null) then
      continue;
    end if;

    _email := lower(trim(_r.customer_details->>'email'));
    _first_name := split_part(coalesce(nullif(trim(_r.customer_details->>'full_name'),''),'there'),' ',1);
    _fact := case
      when _r.plan_term='price_lock_24' then 'Useful to know: Price Lock 24 is OCCTA''s fixed-term option for customers who prefer price certainty over the minimum term.'
      when _r.plan_term='flex_30' then 'Useful to know: Flex 30 is OCCTA''s rolling option where available, for customers who prefer a shorter commitment.'
      when coalesce(_r.selected_addons,'[]'::jsonb) @> '["digital_voice"]'::jsonb then 'Useful to know: Digital Home Phone is a broadband add-on and depends on your broadband connection and mains power.'
      else 'Useful to know: OCCTA confirms final availability, estimated speed, setup and order details before your order is placed.'
    end;

    if _next_no=1 then
      _subject := 'Your OCCTA order is saved — pick up where you left off';
      _title := 'Your order is saved';
      _body := '<p>You were part-way through your OCCTA order, so we saved the progress you had already completed.</p><p><strong>Nothing is charged simply because you started checkout.</strong> You can review everything again before the order is placed.</p><p>'||_fact||'</p><p>Your secure link below returns you to the latest saved stage.</p>';
    elsif _next_no=2 then
      _subject := 'A quick note before you finish your OCCTA order';
      _title := 'Carry on when you are ready';
      _body := '<p>Your saved OCCTA order is still incomplete. If you were comparing options or got interrupted, you do not need to rebuild it from the beginning.</p><p>'||_fact||'</p><p>Review the saved choices, contract information and billing details before submitting.</p>';
    elsif _next_no=3 then
      _subject := 'Still want to continue your OCCTA order?';
      _title := 'Final automatic checkout reminder';
      _body := '<p>This is our final automatic checkout reminder for this saved order.</p><p>If you still want to continue, use the secure link below. If you no longer want the service, no action is needed.</p><p>'||_fact||'</p><p>If something stopped you completing the order, call <strong>0800 260 6626</strong> or email <strong>hello@occta.co.uk</strong> and we can help.</p>';
    else
      _subject := '£50 Switch Cash is available on eligible OCCTA orders';
      _title := '£50 Switch Cash';
      _body := '<p>You previously started an OCCTA broadband order and asked to receive offers from us.</p><p><strong>Our £50 Switch Cash offer is now live.</strong> It applies to an eligible new residential <strong>Essential Fibre — Price Lock 24</strong> order placed by '||to_char(_switch50.ends_at at time zone 'Europe/London','DD Mon YYYY')||'.</p><p>The £50 reward is separate from your broadband bill and does not reduce the £34.99 monthly broadband price. It becomes eligible 30 days after service activation once the first broadband invoice has been paid and the account remains eligible. One reward per eligible service address. Terms apply.</p><p>Your secure link below reopens the exact saved checkout. You can review or change your plan before submitting anything.</p><p style="font-size:12px;opacity:.75">You received this offer because marketing consent is recorded on your saved checkout. To stop marketing messages, contact privacy@occta.co.uk.</p>';
    end if;

    _raw_token := encode(extensions.gen_random_bytes(24),'hex');
    _token_hash := encode(extensions.digest(_raw_token,'sha256'),'hex');
    _resume_url := 'https://www.occta.co.uk/order/'||_raw_token||'?utm_source=occta&utm_medium=email&utm_campaign='||case when _next_no=4 then 'SWITCH50' else 'abandoned_checkout' end||'&utm_content=reminder_'||_next_no::text||case when _next_no=4 then '&offer=SWITCH50' else '' end;

    update public.customer_journey_sessions
       set public_token_hash=_token_hash,
           reminder_count=_next_no,
           reminder_last_queued_at=now()
     where id=_r.id
       and coalesce(reminder_count,0)=coalesce(_r.reminder_count,0)
       and abandoned_at is not null
       and completed_at is null
       and submitted_at is null
       and recovery_opt_out_at is null;
    if not found then continue; end if;

    select net.http_post(
      url := 'https://oexgjmuvgdndizsufipe.supabase.co/functions/v1/send-email',
      headers := jsonb_build_object('Content-Type','application/json','x-internal-secret',_secret),
      body := jsonb_build_object(
        'type','custom_admin','to',_email,'logToCommunications',true,
        'data',jsonb_build_object(
          'subject',_subject,'title',_title,'greeting','Hi '||_first_name,
          'html_body',_body,'cta_text',case when _next_no=4 then 'View £50 offer & continue' else 'Finish your order' end,'cta_url',_resume_url
        )
      )
    ) into _request_id;

    insert into public.checkout_reminders(journey_session_id,reminder_number,subject,stage,status,provider_request_id,queued_at,failed_at,last_error)
    values(_r.id,_next_no,_subject,_r.current_step,'queued',_request_id,now(),null,null)
    on conflict(journey_session_id,reminder_number) do update set
      subject=excluded.subject, stage=excluded.stage, status='queued', provider_request_id=excluded.provider_request_id,
      queued_at=now(), failed_at=null, last_error=null;

    perform public.log_event(
      _actor_type := 'system', _event_type := case when _next_no=4 then 'switch50_abandoned_recovery_queued' else 'checkout_reminder_queued' end,
      _title := case when _next_no=4 then 'SWITCH50 abandoned checkout offer queued' else 'Checkout resume reminder queued' end,
      _details := jsonb_build_object('journey_session_id',_r.id,'reminder_number',_next_no,'stage',_r.current_step,'campaign_code',case when _next_no=4 then 'SWITCH50' else null end),
      _source_module := 'checkout_tracking'
    );
    _queued := _queued+1;
  end loop;

  return jsonb_build_object('ok',true,'reminders_enabled',true,'delivery_owner','database_checkout_recovery','generic_marked',_marked,'journey_marked',_journey_marked,'reconciled',_reconciled,'failed_reconciled',_failed_reconciled,'queued',_queued,'switch50_active',_switch50.code is not null);
end;
$function$;

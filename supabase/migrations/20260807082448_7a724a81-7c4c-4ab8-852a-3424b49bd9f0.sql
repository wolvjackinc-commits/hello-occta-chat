-- Abandoned-checkout hotfix: process_checkout_tracking() marks/reconciles only.
-- Email delivery moves to the deployed journey2-resume-email edge worker.
CREATE OR REPLACE FUNCTION public.process_checkout_tracking()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _delay_minutes integer := 60;
  _enabled boolean := false;
  _marked integer := 0;
  _journey_marked integer := 0;
  _stale integer := 0;
BEGIN
  SELECT coalesce(customer_journey_v2_abandoned_resume_enabled,false),
         greatest(5,coalesce(customer_journey_v2_resume_delay_minutes,60))
    INTO _enabled, _delay_minutes
    FROM public.platform_settings
   WHERE singleton = true;

  -- Generic/legacy web journeys become abandoned after inactivity. No email is
  -- sent because the tracker intentionally does not harvest partial-form PII.
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
  GET DIAGNOSTICS _journey_marked = ROW_COUNT;

  -- Reconcile reminders the worker never confirmed, so admin views stay honest.
  UPDATE public.checkout_reminders
     SET status='failed',
         failed_at=now(),
         last_error=coalesce(last_error,'worker_did_not_confirm_delivery')
   WHERE status='queued'
     AND queued_at < now() - interval '6 hours';
  GET DIAGNOSTICS _stale = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'reminders_enabled', _enabled,
    'delivery_owner', 'journey2-resume-email',
    'generic_marked', _marked,
    'journey_marked', _journey_marked,
    'stale_reminders_failed', _stale
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_checkout_tracking() FROM PUBLIC;

-- Keep exactly one monitor job, and remove any legacy in-database reminder job.
DO $$
DECLARE _job record;
BEGIN
  FOR _job IN
    SELECT jobid FROM cron.job
     WHERE jobname IN ('checkout-journey-monitor','checkout-abandoned-reminders','journey2-resume-email')
  LOOP
    PERFORM cron.unschedule(_job.jobid);
  END LOOP;
  PERFORM cron.schedule(
    'checkout-journey-monitor',
    '*/15 * * * *',
    'SELECT public.process_checkout_tracking();'
  );
END;
$$;

-- Reminders stay disabled for this hotfix.
UPDATE public.platform_settings
   SET customer_journey_v2_abandoned_resume_enabled = false
 WHERE singleton = true;

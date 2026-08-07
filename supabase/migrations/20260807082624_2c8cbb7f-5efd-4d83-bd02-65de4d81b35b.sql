-- Schedule the deployed journey2-resume-email worker using the project's
-- existing server-side cron-secret convention. The command is cloned from an
-- existing scheduled worker so no secret value is written or printed here.
DO $$
DECLARE
  _job record;
  _template text;
  _cmd text;
BEGIN
  FOR _job IN
    SELECT jobid FROM cron.job WHERE jobname = 'checkout-abandoned-recovery-worker'
  LOOP
    PERFORM cron.unschedule(_job.jobid);
  END LOOP;

  SELECT command INTO _template
    FROM cron.job
   WHERE jobname = 'process-activation-outbox'
   LIMIT 1;

  IF _template IS NULL OR position('process-activation-outbox' in _template) = 0 THEN
    RAISE NOTICE 'cron template unavailable; recovery worker not scheduled';
    RETURN;
  END IF;

  _cmd := replace(_template, 'process-activation-outbox', 'journey2-resume-email');

  PERFORM cron.schedule(
    'checkout-abandoned-recovery-worker',
    '*/15 * * * *',
    _cmd
  );
END;
$$;

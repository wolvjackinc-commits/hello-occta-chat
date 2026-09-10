-- Keep Direct Debit customer notifications moving even if the immediate
-- server-side worker invocation fails. Reuse the existing trusted cron command
-- (including its secret header) without copying any secret into source control.
DO $$
DECLARE
  _job record;
  _template text;
  _cmd text;
BEGIN
  FOR _job IN
    SELECT jobid FROM cron.job WHERE jobname = 'process-dd-email-outbox'
  LOOP
    PERFORM cron.unschedule(_job.jobid);
  END LOOP;

  SELECT command INTO _template
    FROM cron.job
   WHERE jobname = 'process-activation-outbox'
     AND active
   ORDER BY jobid DESC
   LIMIT 1;

  IF _template IS NULL OR position('process-activation-outbox' in _template) = 0 THEN
    RAISE NOTICE 'trusted cron template unavailable; Direct Debit email outbox worker not scheduled';
    RETURN;
  END IF;

  _cmd := replace(_template, 'process-activation-outbox', 'dd-outbox-worker');

  PERFORM cron.schedule(
    'process-dd-email-outbox',
    '*/5 * * * *',
    _cmd
  );
END;
$$;

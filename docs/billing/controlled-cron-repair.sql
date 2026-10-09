-- CONTROLLED RELEASE STEP ONLY. Do not run until:
-- 1. PR CI green, payment outbox migration applied, all edge functions deployed.
-- 2. The process-first-billing cron endpoint has been confirmed to return HTTP 200.
-- 3. No pending customer financial disputes/holds have been overridden.
--
-- Reuse the already configured first-billing job's internal authentication
-- header without SELECTing or logging its secret value to the client.
-- This fixes the 255-run broken legacy GUC: app.cron_secret.
BEGIN;
DO $$
DECLARE
  template_command text;
  invoice_job bigint;
BEGIN
  SELECT command INTO template_command
  FROM cron.job WHERE jobname = 'process-first-billing' AND active IS TRUE;
  IF template_command IS NULL OR
     strpos(template_command, '/process-first-billing') = 0 OR
     strpos(template_command, 'x-cron-secret') = 0 THEN
    RAISE EXCEPTION 'Working authenticated first-billing cron template missing';
  END IF;

  SELECT jobid INTO invoice_job
  FROM cron.job WHERE jobname = 'generate-monthly-invoices';
  IF invoice_job IS NULL THEN
    RAISE EXCEPTION 'Expected existing invoice scheduler is missing';
  END IF;

  -- Replace only URL function segment; retain existing auth and timeouts.
  PERFORM cron.alter_job(
    invoice_job,
    command := replace(template_command,
      '/process-first-billing', '/generate-invoices')
  );

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'payment-reminders-safe') THEN
    PERFORM cron.schedule('payment-reminders-safe', '0 9 * * *',
      replace(template_command,
        '/process-first-billing', '/payment-reminders'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-payment-status-notifications') THEN
    PERFORM cron.schedule('billing-payment-status-notifications', '*/5 * * * *',
      replace(template_command,
        '/process-first-billing', '/process-billing-notifications'));
  END IF;
END $$;
COMMIT;

-- Post-release: cron.job_run_details must be inspected for new runs,
-- and net._http_response HTTP errors must be checked. Cron 'succeeded'
-- means dispatch, NOT necessarily Edge Function success.
-- Rollback: restore cron.job.command from a pre-change encrypted backup
-- and UNSCHEDULE only the two jobs introduced by this script.

-- The secret that was typed here was retired in 20261020183000_cron_secret_vault_rotation.sql
-- (cron jobs now read CRON_JOB_SECRET from Vault).
-- Update the daily-payment-reminders cron job to remove the unnecessary Bearer token
-- and use only the x-cron-secret header for authentication (matching other cron jobs)

SELECT cron.unschedule('daily-payment-reminders');

SELECT cron.schedule(
  'daily-payment-reminders',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://oexgjmuvgdndizsufipe.supabase.co/functions/v1/payment-reminders',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "REDACTED-rotated-in-20261020183000"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
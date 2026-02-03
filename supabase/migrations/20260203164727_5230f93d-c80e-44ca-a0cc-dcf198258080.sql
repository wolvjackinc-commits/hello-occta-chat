-- Update the daily-payment-reminders cron job to remove the unnecessary Bearer token
-- and use only the x-cron-secret header for authentication (matching other cron jobs)

SELECT cron.unschedule('daily-payment-reminders');

SELECT cron.schedule(
  'daily-payment-reminders',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://oexgjmuvgdndizsufipe.supabase.co/functions/v1/payment-reminders',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "occta_cron_7f3k9m2x5p8w1n4j6h0q"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
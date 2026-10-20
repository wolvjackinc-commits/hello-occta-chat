-- One cron/internal secret, generated and held only by the database.
--
-- Before this migration the secret that scheduled jobs send in x-cron-secret
-- was typed into seven cron commands and committed in an old migration, and
-- generate-monthly-invoices had a broken command that failed every day (so
-- monthly invoices were not being issued). The daily payment-reminders job
-- had also been removed (last run 5 Aug 2026).
--
-- After this migration:
--   * Vault secret CRON_JOB_SECRET is the single source. It is rotated here to
--     a fresh random value that no person or file ever sees.
--   * Edge functions read it through public.get_cron_job_secret() (service
--     role only) via supabase/functions/_shared/cronSecret.ts.
--   * Every cron job that calls an edge function goes through
--     public.invoke_edge_function_from_cron(), which reads the secret from
--     Vault at run time. Future rotation: SELECT public.rotate_cron_job_secret();
--
-- Deploy the edge functions that use _shared/cronSecret.ts BEFORE applying
-- this migration, so they accept the Vault value as soon as it changes.

-- 1. Read access for edge functions (service role only).
CREATE OR REPLACE FUNCTION public.get_cron_job_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_JOB_SECRET' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_cron_job_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_job_secret() TO service_role;

-- 2. Rotation: replace the Vault value with 256 random bits.
CREATE OR REPLACE FUNCTION public.rotate_cron_job_secret()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id  uuid;
  v_new text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'CRON_JOB_SECRET';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_new, 'CRON_JOB_SECRET',
      'Shared secret for pg_cron jobs and internal edge-function calls (x-cron-secret / x-internal-secret).');
  ELSE
    PERFORM vault.update_secret(v_id, v_new);
  END IF;
END
$$;
REVOKE ALL ON FUNCTION public.rotate_cron_job_secret() FROM PUBLIC, anon, authenticated, service_role;

-- 3. The one way cron jobs call edge functions.
CREATE OR REPLACE FUNCTION public.invoke_edge_function_from_cron(_fn text, _body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
BEGIN
  IF _fn !~ '^[a-z0-9-]+$' THEN
    RAISE EXCEPTION 'invalid edge function name: %', _fn;
  END IF;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'CRON_JOB_SECRET' LIMIT 1;
  IF coalesce(v_secret, '') = '' THEN
    RAISE EXCEPTION 'CRON_JOB_SECRET is missing from vault';
  END IF;
  RETURN net.http_post(
    url     := 'https://oexgjmuvgdndizsufipe.supabase.co/functions/v1/' || _fn,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body    := coalesce(_body, '{}'::jsonb)
  );
END
$$;
REVOKE ALL ON FUNCTION public.invoke_edge_function_from_cron(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- 4. Fresh secret now. The old one (typed into jobs and committed in
--    20260203164727) stops working from here.
SELECT public.rotate_cron_job_secret();

-- 5. Point every edge-function cron job at the helper, keeping each job's
--    schedule. sim-recurring-billing-daily already reads the Vault secret, so
--    it picks up the new value without changes.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT j.jobname, j.schedule, v.fn, v.body
      FROM (VALUES
        ('checkout-abandoned-recovery-worker', 'journey2-resume-email',      '{}'::jsonb),
        ('daily-installation-reminders',       'installation-reminders',     '{}'::jsonb),
        ('generate-monthly-invoices',          'generate-invoices',          '{"source":"cron"}'::jsonb),
        ('outreach-worker',                    'outreach-worker',            '{}'::jsonb),
        ('process-activation-outbox',          'process-activation-outbox',  '{}'::jsonb),
        ('process-cancellation-outbox',        'process-cancellation-outbox','{}'::jsonb),
        ('process-first-billing',              'process-first-billing',      '{}'::jsonb)
      ) AS v(jobname, fn, body)
      JOIN cron.job j ON j.jobname = v.jobname
  LOOP
    PERFORM cron.schedule(
      r.jobname,
      r.schedule,
      format('SELECT public.invoke_edge_function_from_cron(%L, %L::jsonb)', r.fn, r.body::text)
    );
  END LOOP;
END
$$;

-- 6. Restore the daily payment reminders (removed after 5 Aug 2026).
SELECT cron.schedule(
  'daily-payment-reminders',
  '0 9 * * *',
  $$SELECT public.invoke_edge_function_from_cron('payment-reminders', '{}'::jsonb)$$
);

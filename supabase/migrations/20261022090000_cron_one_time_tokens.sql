-- Retire the shared cron secret.
--
-- Scheduled jobs and internal function-to-function calls authenticated with
-- one long-lived value (x-cron-secret / x-internal-secret). It was typed into
-- the cron commands and committed in an old migration of a public repository,
-- so it has to be treated as known to anyone.
--
-- From here every call carries a single-use code instead:
--   * public.mint_cron_token() creates 256 random bits, stores only their
--     SHA-256 hash with a 10-minute expiry, and returns the code once.
--   * public.consume_cron_token(code) succeeds at most once per code, before
--     it expires. Edge functions call it through _shared/cronSecret.ts.
--   * public.invoke_edge_function_from_cron(fn, body) mints a code and posts
--     to the edge function with it; every cron job goes through it.
-- No code lives anywhere long enough to leak, and nothing uses Vault. The old
-- secret stops working as soon as the edge functions from the same change are
-- deployed, because they no longer accept it.

CREATE TABLE IF NOT EXISTS public.cron_call_tokens (
  token_hash text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);
ALTER TABLE public.cron_call_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cron_call_tokens FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS cron_call_tokens_expires_idx ON public.cron_call_tokens (expires_at);

CREATE OR REPLACE FUNCTION public.mint_cron_token()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
BEGIN
  -- Housekeeping: codes are worthless a day after they expire.
  DELETE FROM public.cron_call_tokens WHERE expires_at < now() - interval '1 day';
  INSERT INTO public.cron_call_tokens (token_hash, expires_at)
  VALUES (encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '10 minutes');
  RETURN v_token;
END
$$;
REVOKE ALL ON FUNCTION public.mint_cron_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mint_cron_token() TO service_role;

CREATE OR REPLACE FUNCTION public.consume_cron_token(_token text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hit text;
BEGIN
  IF _token IS NULL OR _token !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;
  UPDATE public.cron_call_tokens
     SET used_at = now()
   WHERE token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
     AND used_at IS NULL
     AND expires_at > now()
  RETURNING token_hash INTO v_hit;
  RETURN v_hit IS NOT NULL;
END
$$;
REVOKE ALL ON FUNCTION public.consume_cron_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_cron_token(text) TO service_role;

CREATE OR REPLACE FUNCTION public.invoke_edge_function_from_cron(_fn text, _body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF _fn !~ '^[a-z0-9-]+$' THEN
    RAISE EXCEPTION 'invalid edge function name: %', _fn;
  END IF;
  RETURN net.http_post(
    url     := 'https://oexgjmuvgdndizsufipe.supabase.co/functions/v1/' || _fn,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', public.mint_cron_token()),
    body    := coalesce(_body, '{}'::jsonb),
    timeout_milliseconds := 60000
  );
END
$$;
REVOKE ALL ON FUNCTION public.invoke_edge_function_from_cron(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- Point every edge-function cron job at the helper, keeping its schedule.
-- This also removes the old secret from cron.job (it was a literal in eight
-- commands; the SIM job looked up a Vault secret that does not exist).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT j.jobname, j.schedule, v.fn, v.body
      FROM (VALUES
        ('checkout-abandoned-recovery-worker', 'journey2-resume-email',         '{}'::jsonb),
        ('daily-installation-reminders',       'installation-reminders',        '{}'::jsonb),
        ('daily-payment-reminders',            'payment-reminders',             '{}'::jsonb),
        ('generate-monthly-invoices',          'generate-invoices',             '{}'::jsonb),
        ('outreach-worker',                    'outreach-worker',               '{}'::jsonb),
        ('process-activation-outbox',          'process-activation-outbox',     '{}'::jsonb),
        ('process-cancellation-outbox',        'process-cancellation-outbox',   '{}'::jsonb),
        ('process-first-billing',              'process-first-billing',         '{}'::jsonb),
        ('sim-recurring-billing-daily',        'process-sim-recurring-billing', '{"trigger":"cron"}'::jsonb)
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

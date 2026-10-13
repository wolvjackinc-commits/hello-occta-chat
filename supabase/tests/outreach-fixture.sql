-- Minimal Supabase-shaped fixture for the outreach migration (PGlite).
-- Production column names; only what the outreach migration touches.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE SCHEMA cron;
CREATE TABLE cron.job(jobid bigserial PRIMARY KEY, jobname text, schedule text, command text);
CREATE FUNCTION cron.schedule(_name text, _schedule text, _command text) RETURNS bigint LANGUAGE sql AS
  $$ INSERT INTO cron.job(jobname, schedule, command) VALUES (_name, _schedule, _command) RETURNING jobid $$;
CREATE FUNCTION cron.unschedule(_jobid bigint) RETURNS boolean LANGUAGE sql AS
  $$ DELETE FROM cron.job WHERE jobid = _jobid RETURNING true $$;
-- The existing worker whose command (with the project cron secret header) is cloned.
INSERT INTO cron.job(jobname, schedule, command) VALUES (
  'process-activation-outbox', '* * * * *',
  $c$SELECT net.http_post(url := 'https://example.supabase.co/functions/v1/process-activation-outbox', headers := '{"x-cron-secret":"test-secret"}'::jsonb)$c$
);

CREATE TABLE public.user_roles(user_id uuid, role text);
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.business_leads(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  utm jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.business_quote_requests(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  utm jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Customer accounts (marketing consent lives here; see 20261013160000_outreach_customer_optins.sql).
CREATE TABLE public.profiles(
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  marketing_email_consent boolean NOT NULL DEFAULT false,
  consent_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

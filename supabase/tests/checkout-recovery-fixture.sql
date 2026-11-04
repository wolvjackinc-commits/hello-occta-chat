-- Minimal stand-ins for the production objects the checkout recovery desk
-- migration depends on, so it can run on PGlite in CI.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS vault;
CREATE SCHEMA IF NOT EXISTS net;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE TABLE public.user_roles(user_id uuid, role text);
CREATE FUNCTION public.is_staff(_user_id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) $$;

CREATE FUNCTION extensions.gen_random_bytes(n integer) RETURNS bytea LANGUAGE sql AS $$ SELECT decode(substr(md5(random()::text) || md5(random()::text), 1, n * 2), 'hex') $$;
CREATE FUNCTION extensions.digest(t text, alg text) RETURNS bytea LANGUAGE sql AS $$ SELECT decode(md5(t), 'hex') $$;
CREATE TABLE vault.decrypted_secrets(name text, decrypted_secret text);
INSERT INTO vault.decrypted_secrets VALUES ('CRON_JOB_SECRET', 'test-secret');
CREATE TABLE net._http_response(id bigint, status_code integer, content text);
CREATE SEQUENCE net.req_seq;
CREATE TABLE net.requests(id bigint, url text, body jsonb);
CREATE FUNCTION net.http_post(url text, headers jsonb, body jsonb) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE i bigint := nextval('net.req_seq'); BEGIN INSERT INTO net.requests VALUES (i, url, body); RETURN i; END $$;

CREATE TABLE public.platform_settings(singleton boolean PRIMARY KEY, customer_journey_v2_abandoned_resume_enabled boolean, customer_journey_v2_resume_delay_minutes integer);
INSERT INTO public.platform_settings VALUES (true, true, 60);
CREATE TABLE public.offer_campaigns(code text, title text, reward_amount numeric, reward_currency text, starts_at timestamptz, ends_at timestamptz,
  terms_version text, terms_text text, active boolean, created_at timestamptz DEFAULT now());
CREATE TABLE public.suppressed_emails(email text);
CREATE TABLE public.profiles(id uuid PRIMARY KEY, email text);
CREATE TABLE public.orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid);
CREATE TABLE public.services(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid);
CREATE TABLE public.guest_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);
CREATE TABLE public.contract_summaries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_email_snapshot text, status text);

CREATE TABLE public.activity_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ts timestamptz DEFAULT now(), actor_type text,
  event_type text, title text, details jsonb, severity text, source_module text);
CREATE FUNCTION public.log_event(_actor_type text, _event_type text, _title text, _details jsonb DEFAULT '{}', _source_module text DEFAULT NULL, _severity text DEFAULT 'info')
RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.activity_log(actor_type, event_type, title, details, source_module, severity)
  VALUES (_actor_type, _event_type, _title, _details, _source_module, _severity) RETURNING id $$;
CREATE FUNCTION public.checkout_stage_progress(_s text) RETURNS integer LANGUAGE sql AS $$
  SELECT CASE _s WHEN 'address' THEN 10 WHEN 'plan' THEN 25 WHEN 'details' THEN 50 WHEN 'contract' THEN 75 WHEN 'review' THEN 90 ELSE 5 END $$;

CREATE TABLE public.checkout_tracking_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text, abandoned_at timestamptz,
  last_activity_at timestamptz, updated_at timestamptz);
CREATE TABLE public.customer_journey_sessions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), journey_version text DEFAULT 'v2', status text DEFAULT 'active',
  current_step text DEFAULT 'details', customer_details jsonb, postcode text, speed_bucket text, plan_term text,
  selected_addons jsonb DEFAULT '[]', utm_snapshot jsonb, test_session boolean DEFAULT false,
  created_at timestamptz DEFAULT now(), checkout_tracking_started_at timestamptz DEFAULT now(),
  last_activity_at timestamptz DEFAULT now(), abandoned_at timestamptz, completed_at timestamptz, submitted_at timestamptz,
  expires_at timestamptz DEFAULT now() + interval '14 days', contract_acceptance_id uuid, post_contract_applied_at timestamptz,
  public_token_hash text, reminder_count integer DEFAULT 0, reminder_last_queued_at timestamptz, reminder_last_sent_at timestamptz);
CREATE TABLE public.checkout_reminders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), journey_session_id uuid, reminder_number integer,
  subject text, stage text, status text, provider_request_id bigint, queued_at timestamptz, delivered_at timestamptz,
  failed_at timestamptz, last_error text, UNIQUE (journey_session_id, reminder_number));

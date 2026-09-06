-- Minimal schema fixture, using the real production column names. Campaign
-- migrations run unchanged on PostgreSQL; full historical replay is a CI gate.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
-- Supabase default grants must be explicitly narrowed for finance tables.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
CREATE SCHEMA auth; CREATE SCHEMA cron;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION cron.unschedule(text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION cron.schedule(text,text,text) RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;
CREATE TABLE user_roles(user_id uuid, role text);
CREATE FUNCTION public.is_staff(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1) $$;
CREATE TABLE public.orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid, user_id uuid,
  checkout_session_id uuid, quote_id uuid, contract_acceptance_id uuid,
  service_type text DEFAULT 'broadband', plan_name text DEFAULT 'Essential Fibre',
  address_line1 text, address_line2 text, postcode text, created_at timestamptz DEFAULT now(),
  lifecycle_status text DEFAULT 'order_received', status text DEFAULT 'pending',
  actual_service_live_at_utc timestamptz, actual_activation_date date,
  cancellation_requested_at timestamptz, cease_date date, activation_blocked_pending_review boolean DEFAULT false);
CREATE TABLE public.customer_journey_sessions(id uuid PRIMARY KEY, checkout_session_id uuid, created_at timestamptz DEFAULT now(),
  order_id uuid, contract_snapshot_id uuid, test_session boolean DEFAULT false, utm_snapshot jsonb DEFAULT '{}');
CREATE TABLE public.journey2_contract_snapshots(id uuid PRIMARY KEY, session_id uuid, snapshot jsonb);
CREATE TABLE public.quotes(id uuid PRIMARY KEY, monthly_gross numeric, reward_eligibility text);
CREATE TABLE public.contract_summaries(id uuid PRIMARY KEY, quote_id uuid, speed_notes text, monthly_price_incl_vat numeric);
CREATE TABLE public.invoices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, order_id uuid, service_id uuid,
  invoice_type text DEFAULT 'monthly', status text DEFAULT 'sent' CHECK(status IN ('draft','issued','sent','paid','overdue','cancelled')), total numeric DEFAULT 34.99,
  issue_date date DEFAULT current_date, due_date date, created_at timestamptz DEFAULT now());
CREATE TABLE public.credit_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL, user_id uuid NOT NULL, amount numeric NOT NULL);
CREATE TABLE public.receipts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL, user_id uuid NOT NULL, amount numeric NOT NULL);
CREATE TABLE public.services(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, user_id uuid,
  service_type text DEFAULT 'broadband', status text DEFAULT 'active', archived_at timestamptz,
  activation_blocked_pending_review boolean DEFAULT false);
CREATE TABLE public.service_cancellation_cases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid,
  status text, withdrawn_at timestamptz);
CREATE TYPE public.campaign_draft_type AS ENUM ('contract_saver_offer');
CREATE TYPE public.campaign_margin_status AS ENUM ('green');
CREATE TYPE public.campaign_compliance_status AS ENUM ('passed');
CREATE TYPE public.campaign_approval_status AS ENUM ('published');
CREATE TABLE public.campaign_drafts(campaign_type campaign_draft_type,title text,target_audience text,draft_copy text,
  offer_terms text,margin_check_status campaign_margin_status,compliance_check_status campaign_compliance_status,
  approval_status campaign_approval_status,published_at timestamptz,starts_at timestamptz,ends_at timestamptz,active boolean,performance_json jsonb);
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
GRANT SELECT ON user_roles TO authenticated;

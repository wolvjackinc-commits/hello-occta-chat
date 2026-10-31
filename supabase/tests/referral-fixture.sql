-- Minimal schema fixture for the refer-a-friend engine, using the real
-- production column names. The full historical replay runs in CI.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
CREATE SCHEMA auth; CREATE SCHEMA cron;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION cron.unschedule(text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION cron.schedule(text,text,text) RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;
CREATE TABLE public.user_roles(user_id uuid, role text);
CREATE TABLE public.platform_settings(singleton boolean PRIMARY KEY DEFAULT true, rewards_enabled boolean DEFAULT false);
INSERT INTO public.platform_settings VALUES (true, false);
CREATE TABLE public.offer_campaigns(code text PRIMARY KEY);
INSERT INTO public.offer_campaigns VALUES ('SWITCH50');
CREATE TABLE public.partners(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE, display_name text, updated_at timestamptz);
CREATE TABLE public.partner_commission_payouts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), partner_id uuid);
CREATE TABLE public.profiles(id uuid PRIMARY KEY, email text, full_name text, phone text, address_line1 text, address_line2 text,
  postcode text, account_number text, account_type text DEFAULT 'residential', suspended_at timestamptz, archived_at timestamptz,
  created_at timestamptz DEFAULT now());
CREATE TABLE public.referral_codes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid, partner_id uuid,
  code text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz, usage_count integer NOT NULL DEFAULT 0, max_uses integer);
CREATE TABLE public.orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid, user_id uuid,
  checkout_session_id uuid, occta_order_number text, customer_type_v2 text,
  service_type text DEFAULT 'broadband', address_line1 text, address_line2 text, postcode text,
  created_at timestamptz DEFAULT now(), lifecycle_status text DEFAULT 'order_received', status text DEFAULT 'pending',
  actual_service_live_at_utc timestamptz, actual_activation_date date, cancellation_requested_at timestamptz,
  cease_date date, campaign_code text);
CREATE TABLE public.customer_journey_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), checkout_session_id uuid, order_id uuid,
  test_session boolean DEFAULT false, utm_snapshot jsonb DEFAULT '{}', customer_details jsonb DEFAULT '{}', ip text, user_agent text,
  created_at timestamptz DEFAULT now(), submitted_at timestamptz);
CREATE TABLE public.services(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, user_id uuid, status text DEFAULT 'active',
  archived_at timestamptz, suspension_reason text, created_at timestamptz DEFAULT now());
CREATE TABLE public.invoices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_number text, user_id uuid, order_id uuid, service_id uuid, pdf_storage_key text,
  invoice_type text DEFAULT 'monthly', status text DEFAULT 'sent', subtotal numeric DEFAULT 0, vat_total numeric DEFAULT 0,
  total numeric DEFAULT 30, vat_enabled boolean DEFAULT true, vat_rate numeric DEFAULT 20,
  issue_date date DEFAULT current_date, due_date date, email_sent_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE public.invoice_lines(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid, description text, qty numeric,
  unit_price numeric, vat_rate numeric, line_total numeric, metadata jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE public.credit_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid, user_id uuid, amount numeric);
CREATE TABLE public.receipts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid, user_id uuid, amount numeric,
  paid_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE public.payment_attempts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, invoice_id uuid, status text,
  reason text, attempted_at timestamptz DEFAULT now());
CREATE TABLE public.payment_recon_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), linked_account_number text, failed_on date);
CREATE TABLE public.service_cancellation_cases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, status text, withdrawn_at timestamptz);
CREATE TABLE public.quote_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, phone text, address_line_1 text,
  address_line_2 text, postcode text, created_at timestamptz DEFAULT now());
CREATE TABLE public.dd_mandates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, masked_account_last4 text, masked_sort_last2 text);
CREATE TABLE public.fraud_flags(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid, status text DEFAULT 'open');
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;

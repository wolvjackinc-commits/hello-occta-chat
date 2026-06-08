
-- =========================================================
-- Phase 2: Quote Requests, Quotes, Contract Summaries
-- =========================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.quote_request_status AS ENUM ('new','assigned','checking','quoted','expired','rejected','converted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.service_interest_kind AS ENUM ('broadband','sim','digital_voice','business','switching','bundle','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.customer_type_kind AS ENUM ('residential','business');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.plan_preference_kind AS ENUM ('flex','contract_saver','not_sure');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.plan_type_kind AS ENUM ('flex','contract_saver');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.margin_status_kind AS ENUM ('unknown','green','amber','red');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.quote_status_kind AS ENUM ('draft','sent','viewed','accepted','rejected','expired','converted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contract_summary_status_kind AS ENUM ('draft','issued','viewed','accepted','superseded','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- 1. quote_requests
-- =========================================================
CREATE TABLE public.quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE NOT NULL DEFAULT ('QR-' || to_char(now(),'YYMM') || '-' || substring(replace(gen_random_uuid()::text,'-',''),1,8)),
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  postcode text NOT NULL,
  address_line_1 text,
  address_line_2 text,
  town text,
  county text,
  service_interest public.service_interest_kind NOT NULL,
  plan_preference public.plan_preference_kind NOT NULL DEFAULT 'not_sure',
  customer_type public.customer_type_kind NOT NULL DEFAULT 'residential',
  business_name text,
  current_provider text,
  current_monthly_bill numeric(8,2),
  preferred_contact_method text NOT NULL DEFAULT 'email',
  message text,
  marketing_consent boolean NOT NULL DEFAULT false,
  status public.quote_request_status NOT NULL DEFAULT 'new',
  assigned_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'web',
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_requests TO authenticated;
GRANT ALL ON public.quote_requests TO service_role;

ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_customer_select_own" ON public.quote_requests
  FOR SELECT TO authenticated
  USING (customer_id IS NOT NULL AND customer_id = auth.uid());

CREATE POLICY "qr_staff_select_all" ON public.quote_requests
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "qr_staff_update" ON public.quote_requests
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "qr_staff_delete" ON public.quote_requests
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- No INSERT policy: inserts only via edge function using service_role.

CREATE TRIGGER trg_quote_requests_updated_at
  BEFORE UPDATE ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_quote_requests_status ON public.quote_requests(status);
CREATE INDEX idx_quote_requests_customer ON public.quote_requests(customer_id);
CREATE INDEX idx_quote_requests_created_at ON public.quote_requests(created_at DESC);

-- =========================================================
-- 2. quotes
-- =========================================================
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE NOT NULL DEFAULT ('QT-' || to_char(now(),'YYMM') || '-' || substring(replace(gen_random_uuid()::text,'-',''),1,8)),
  quote_request_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  supplier_name text,
  supplier_product_id text,
  supplier_reference text,

  plan_name text NOT NULL,
  service_type public.service_interest_kind NOT NULL,
  plan_type public.plan_type_kind NOT NULL,
  customer_type public.customer_type_kind NOT NULL,
  contract_length_months integer,

  monthly_net numeric(10,2) NOT NULL DEFAULT 0,
  monthly_vat_rate numeric(5,2) NOT NULL DEFAULT 0,
  monthly_vat_amount numeric(10,2) NOT NULL DEFAULT 0,
  monthly_gross numeric(10,2) NOT NULL DEFAULT 0,

  setup_net numeric(10,2) NOT NULL DEFAULT 0,
  setup_vat_amount numeric(10,2) NOT NULL DEFAULT 0,
  setup_gross numeric(10,2) NOT NULL DEFAULT 0,

  router_net numeric(10,2) NOT NULL DEFAULT 0,
  router_vat_amount numeric(10,2) NOT NULL DEFAULT 0,
  router_gross numeric(10,2) NOT NULL DEFAULT 0,

  delivery_net numeric(10,2) NOT NULL DEFAULT 0,
  delivery_vat_amount numeric(10,2) NOT NULL DEFAULT 0,
  delivery_gross numeric(10,2) NOT NULL DEFAULT 0,

  installation_net numeric(10,2) NOT NULL DEFAULT 0,
  installation_vat_amount numeric(10,2) NOT NULL DEFAULT 0,
  installation_gross numeric(10,2) NOT NULL DEFAULT 0,

  cease_fee_gross numeric(10,2),
  total_due_today_gross numeric(10,2) NOT NULL DEFAULT 0,

  estimated_download_speed integer,
  estimated_upload_speed integer,
  speed_notes text,
  price_rise_policy text NOT NULL DEFAULT 'No mid-contract CPI or annual price rises on residential telecom services. Changes to price are notified in writing and you may leave penalty-free.',
  notice_period text NOT NULL DEFAULT '30 days',
  reward_eligibility text,

  margin_amount numeric(10,2),
  margin_status public.margin_status_kind NOT NULL DEFAULT 'unknown',

  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  status public.quote_status_kind NOT NULL DEFAULT 'draft',

  admin_notes text,
  customer_notes text,

  public_token_hash text UNIQUE,
  token_expires_at timestamptz,

  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "q_customer_select_own" ON public.quotes
  FOR SELECT TO authenticated
  USING (customer_id IS NOT NULL AND customer_id = auth.uid());

CREATE POLICY "q_staff_select_all" ON public.quotes
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "q_staff_update" ON public.quotes
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "q_staff_delete" ON public.quotes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- INSERT only via edge functions (service_role).

CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_quotes_request ON public.quotes(quote_request_id);
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_quotes_customer ON public.quotes(customer_id);

-- =========================================================
-- 3. contract_summaries
-- =========================================================
CREATE TABLE public.contract_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cs_number text UNIQUE NOT NULL DEFAULT ('CS-' || to_char(now(),'YYMM') || '-' || substring(replace(gen_random_uuid()::text,'-',''),1,8)),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE RESTRICT,
  quote_request_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  version integer NOT NULL DEFAULT 1,
  status public.contract_summary_status_kind NOT NULL DEFAULT 'draft',

  customer_email_snapshot text NOT NULL,
  customer_name_snapshot text NOT NULL,
  service_address text NOT NULL,

  plan_name text NOT NULL,
  service_type public.service_interest_kind NOT NULL,
  plan_type public.plan_type_kind NOT NULL,
  customer_type public.customer_type_kind NOT NULL,

  monthly_price_incl_vat numeric(10,2) NOT NULL,
  business_monthly_ex_vat numeric(10,2),
  business_monthly_incl_vat numeric(10,2),

  one_off_charges_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  setup_charge numeric(10,2) NOT NULL DEFAULT 0,
  router_charge numeric(10,2) NOT NULL DEFAULT 0,
  delivery_charge numeric(10,2) NOT NULL DEFAULT 0,
  installation_charge numeric(10,2) NOT NULL DEFAULT 0,
  cease_cancellation_charges text,

  contract_length text NOT NULL,
  notice_period text NOT NULL,
  estimated_download_speed integer,
  estimated_upload_speed integer,
  speed_notes text,
  price_rise_policy text NOT NULL,
  digital_voice_warning text,
  vulnerable_customer_note text,
  complaints_adr_info text NOT NULL,
  payment_schedule text NOT NULL,

  terms_version text NOT NULL DEFAULT '2026-06',
  privacy_version text NOT NULL DEFAULT '2026-06',

  public_token_hash text UNIQUE,
  token_expires_at timestamptz,

  issued_at timestamptz,
  accepted_at timestamptz,
  accepted_ip text,
  accepted_user_agent text,
  pdf_url text,
  emailed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_summaries TO authenticated;
GRANT ALL ON public.contract_summaries TO service_role;

ALTER TABLE public.contract_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_customer_select_own" ON public.contract_summaries
  FOR SELECT TO authenticated
  USING (customer_id IS NOT NULL AND customer_id = auth.uid());

CREATE POLICY "cs_staff_select_all" ON public.contract_summaries
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "cs_staff_update" ON public.contract_summaries
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- No INSERT/DELETE for authenticated. All inserts via service_role edge fns.

CREATE TRIGGER trg_contract_summaries_updated_at
  BEFORE UPDATE ON public.contract_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Immutability trigger: once accepted, only service_role may change status to 'superseded'.
CREATE OR REPLACE FUNCTION public.cs_block_update_if_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_user = 'service_role');
BEGIN
  IF OLD.status = 'accepted' THEN
    IF NOT is_service THEN
      RAISE EXCEPTION 'Accepted Contract Summary is immutable';
    END IF;
    -- Service role: only allow status -> superseded; everything else must stay equal
    IF NEW.status NOT IN ('accepted','superseded') THEN
      RAISE EXCEPTION 'Accepted CS may only transition to superseded';
    END IF;
    IF (NEW.id, NEW.quote_id, NEW.version, NEW.monthly_price_incl_vat, NEW.plan_name,
        NEW.customer_email_snapshot, NEW.accepted_at)
       IS DISTINCT FROM
       (OLD.id, OLD.quote_id, OLD.version, OLD.monthly_price_incl_vat, OLD.plan_name,
        OLD.customer_email_snapshot, OLD.accepted_at) THEN
      RAISE EXCEPTION 'Accepted CS core fields cannot be modified';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_cs_immutable
  BEFORE UPDATE ON public.contract_summaries
  FOR EACH ROW EXECUTE FUNCTION public.cs_block_update_if_accepted();

CREATE INDEX idx_cs_quote ON public.contract_summaries(quote_id);
CREATE INDEX idx_cs_status ON public.contract_summaries(status);
CREATE INDEX idx_cs_customer ON public.contract_summaries(customer_id);

-- =========================================================
-- 4. contract_acceptances (append-only)
-- =========================================================
CREATE TABLE public.contract_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_summary_id uuid NOT NULL REFERENCES public.contract_summaries(id) ON DELETE RESTRICT,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_by_name text NOT NULL,
  accepted_by_email text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  acceptance_text text NOT NULL,
  checkbox_confirmed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.contract_acceptances TO authenticated;
GRANT ALL ON public.contract_acceptances TO service_role;

ALTER TABLE public.contract_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_customer_select_own" ON public.contract_acceptances
  FOR SELECT TO authenticated
  USING (customer_id IS NOT NULL AND customer_id = auth.uid());

CREATE POLICY "ca_staff_select_all" ON public.contract_acceptances
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Append-only: block updates/deletes for everyone except service_role.
CREATE OR REPLACE FUNCTION public.ca_block_mutations()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  RAISE EXCEPTION 'contract_acceptances is append-only';
END;
$fn$;

CREATE TRIGGER trg_ca_block_update
  BEFORE UPDATE ON public.contract_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.ca_block_mutations();

CREATE TRIGGER trg_ca_block_delete
  BEFORE DELETE ON public.contract_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.ca_block_mutations();

CREATE INDEX idx_ca_cs ON public.contract_acceptances(contract_summary_id);
CREATE INDEX idx_ca_quote ON public.contract_acceptances(quote_id);

-- =========================================================
-- 5. quote_events
-- =========================================================
CREATE TABLE public.quote_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
  contract_summary_id uuid REFERENCES public.contract_summaries(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_type text NOT NULL DEFAULT 'system',
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.quote_events TO authenticated;
GRANT ALL ON public.quote_events TO service_role;

ALTER TABLE public.quote_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qe_staff_select" ON public.quote_events
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "qe_customer_select_own" ON public.quote_events
  FOR SELECT TO authenticated
  USING (
    quote_request_id IN (SELECT id FROM public.quote_requests WHERE customer_id = auth.uid())
    OR quote_id IN (SELECT id FROM public.quotes WHERE customer_id = auth.uid())
  );

CREATE INDEX idx_qe_request ON public.quote_events(quote_request_id);
CREATE INDEX idx_qe_quote ON public.quote_events(quote_id);
CREATE INDEX idx_qe_created ON public.quote_events(created_at DESC);

-- =========================================================
-- Security definer helpers
-- =========================================================

-- has_accepted_contract_summary: drives the checkout pay-gate.
CREATE OR REPLACE FUNCTION public.has_accepted_contract_summary(_quote_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contract_summaries
    WHERE quote_id = _quote_id AND status = 'accepted'
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_accepted_contract_summary(uuid) TO authenticated, anon;

-- expire_old_quotes: callable manually; cron-scheduling deferred.
CREATE OR REPLACE FUNCTION public.expire_old_quotes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.quotes
  SET status = 'expired'
  WHERE expires_at < now()
    AND status IN ('draft','sent','viewed');
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.contract_summaries
  SET status = 'expired'
  WHERE token_expires_at IS NOT NULL
    AND token_expires_at < now()
    AND status IN ('draft','issued','viewed');

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_old_quotes() FROM public;
GRANT EXECUTE ON FUNCTION public.expire_old_quotes() TO service_role;

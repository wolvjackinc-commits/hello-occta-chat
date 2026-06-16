
-- Stage 5 Phase A: Unified order journey foundation
-- =====================================================

-- 1) order_journeys: single source of truth for the unified customer journey
CREATE TABLE public.order_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE RESTRICT,
  contract_summary_id uuid REFERENCES public.contract_summaries(id) ON DELETE SET NULL,
  contract_acceptance_id uuid REFERENCES public.contract_acceptances(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  token_hash text NOT NULL,
  current_step text NOT NULL DEFAULT 'quote',
  status text NOT NULL DEFAULT 'in_progress',
  decline_reason text,
  decline_notes text,
  declined_at timestamptz,
  quote_continued_at timestamptz,
  contract_accepted_at timestamptz,
  cooling_off_ends_at timestamptz,
  preferred_start_date date,
  start_date_selected_at timestamptz,
  payment_method text,
  billing_anchor_day integer,
  idempotency_key uuid UNIQUE,
  submitted_at timestamptz,
  completed_at timestamptz,
  consolidated_email_sent_at timestamptz,
  order_pack_storage_key text,
  order_pack_sha256 text,
  ip text,
  ua text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_journeys_status_chk CHECK (status IN ('in_progress','declined','submitted','completed','cancelled')),
  CONSTRAINT order_journeys_step_chk CHECK (current_step IN ('quote','agreement','start_date','payment','review','complete')),
  CONSTRAINT order_journeys_payment_chk CHECK (payment_method IS NULL OR payment_method IN ('direct_debit','invoice_link')),
  CONSTRAINT order_journeys_anchor_chk CHECK (billing_anchor_day IS NULL OR (billing_anchor_day BETWEEN 1 AND 31))
);
CREATE UNIQUE INDEX order_journeys_quote_unique ON public.order_journeys(quote_id) WHERE status <> 'cancelled';
CREATE INDEX order_journeys_customer_idx ON public.order_journeys(customer_id);
CREATE INDEX order_journeys_token_hash_idx ON public.order_journeys(token_hash);
GRANT SELECT, UPDATE ON public.order_journeys TO authenticated;
GRANT ALL ON public.order_journeys TO service_role;
ALTER TABLE public.order_journeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers read their own journey" ON public.order_journeys FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Staff manage journeys" ON public.order_journeys FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_order_journeys_updated BEFORE UPDATE ON public.order_journeys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) journey_decline_events
CREATE TABLE public.journey_decline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.order_journeys(id) ON DELETE CASCADE,
  reason_code text NOT NULL,
  reason_text text,
  ip text,
  ua text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.journey_decline_events TO authenticated;
GRANT ALL ON public.journey_decline_events TO service_role;
ALTER TABLE public.journey_decline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read decline events" ON public.journey_decline_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- 3) dd_provider_config (singleton)
CREATE TABLE public.dd_provider_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  provider_name text,
  service_user_number text,
  ddi_template_version text,
  guarantee_version text,
  advance_notice_days integer NOT NULL DEFAULT 10,
  provider_support_contact text,
  provider_approval_date date,
  live_collection_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dd_provider_config TO authenticated;
GRANT ALL ON public.dd_provider_config TO service_role;
ALTER TABLE public.dd_provider_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed reads dd config (non-sensitive)" ON public.dd_provider_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage dd config" ON public.dd_provider_config FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
INSERT INTO public.dd_provider_config (provider_name, live_collection_enabled) VALUES ('To be configured', false);

-- 4) payment_methods (one active per customer/service)
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  journey_id uuid REFERENCES public.order_journeys(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  method text NOT NULL CHECK (method IN ('direct_debit','invoice_link')),
  billing_anchor_day integer NOT NULL CHECK (billing_anchor_day BETWEEN 1 AND 31),
  dd_setup_status text CHECK (dd_setup_status IN ('setup_requested','details_verified','submitted_to_provider','provider_confirmation_pending','active','failed','cancelled')),
  masked_account_last4 text,
  masked_sort_last2 text,
  account_holder_name text,
  consent_version text,
  consent_text text,
  consent_at timestamptz,
  ip text,
  ua text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payment_methods_journey_unique ON public.payment_methods(journey_id) WHERE journey_id IS NOT NULL AND active = true;
CREATE INDEX payment_methods_customer_idx ON public.payment_methods(customer_id);
GRANT SELECT ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers read own payment methods" ON public.payment_methods FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER trg_payment_methods_updated BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) dd_intake_requests (encrypted bank details - edge-function-only AES-256-GCM)
CREATE TABLE public.dd_intake_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method_id uuid NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  journey_id uuid REFERENCES public.order_journeys(id) ON DELETE SET NULL,
  bank_details_ciphertext bytea NOT NULL,
  enc_key_id text NOT NULL,
  enc_alg text NOT NULL DEFAULT 'AES-256-GCM',
  nonce bytea NOT NULL,
  auth_tag bytea,
  masked_account_last4 text NOT NULL,
  masked_sort_last2 text NOT NULL,
  bank_name text,
  uk_account_confirmed boolean NOT NULL DEFAULT false,
  payer_authorised_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Lock down: no direct SELECT for authenticated. Only service_role (edge functions).
GRANT INSERT ON public.dd_intake_requests TO authenticated; -- but blocked by RLS
GRANT ALL ON public.dd_intake_requests TO service_role;
ALTER TABLE public.dd_intake_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct authenticated access to dd_intake" ON public.dd_intake_requests FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 6) order_billing_snapshots (immutable JSON snapshot taken at order submission)
CREATE TABLE public.order_billing_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.order_journeys(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  snapshot jsonb NOT NULL,
  monthly_minor integer NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  vat_included boolean NOT NULL DEFAULT true,
  vat_rate numeric,
  one_off_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX order_billing_snapshots_journey_unique ON public.order_billing_snapshots(journey_id);
GRANT SELECT ON public.order_billing_snapshots TO authenticated;
GRANT ALL ON public.order_billing_snapshots TO service_role;
ALTER TABLE public.order_billing_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read billing snapshots" ON public.order_billing_snapshots FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Immutability trigger
CREATE OR REPLACE FUNCTION public.order_billing_snapshots_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'order_billing_snapshots is immutable'; END $$;
CREATE TRIGGER trg_billing_snapshots_immutable BEFORE UPDATE OR DELETE ON public.order_billing_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.order_billing_snapshots_immutable();

-- 7) service_activation_outbox (idempotent post-activation jobs)
CREATE TABLE public.service_activation_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  journey_id uuid REFERENCES public.order_journeys(id) ON DELETE SET NULL,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(service_id, job_type)
);
GRANT SELECT ON public.service_activation_outbox TO authenticated;
GRANT ALL ON public.service_activation_outbox TO service_role;
ALTER TABLE public.service_activation_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read activation outbox" ON public.service_activation_outbox FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- 8) billing_runs + billing_events + invoice_email_events
CREATE TABLE public.billing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  services_processed integer NOT NULL DEFAULT 0,
  invoices_created integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(run_date)
);
GRANT SELECT ON public.billing_runs TO authenticated;
GRANT ALL ON public.billing_runs TO service_role;
ALTER TABLE public.billing_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read billing runs" ON public.billing_runs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read billing events" ON public.billing_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.invoice_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invoice_id, event_type)
);
GRANT SELECT ON public.invoice_email_events TO authenticated;
GRANT ALL ON public.invoice_email_events TO service_role;
ALTER TABLE public.invoice_email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read invoice email events" ON public.invoice_email_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- 9) Extend orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS journey_id uuid REFERENCES public.order_journeys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IS NULL OR payment_method IN ('direct_debit','invoice_link')),
  ADD COLUMN IF NOT EXISTS billing_anchor_day integer CHECK (billing_anchor_day IS NULL OR (billing_anchor_day BETWEEN 1 AND 31)),
  ADD COLUMN IF NOT EXISTS preferred_start_date date,
  ADD COLUMN IF NOT EXISTS cooling_off_ends_at timestamptz;
CREATE INDEX IF NOT EXISTS orders_journey_idx ON public.orders(journey_id);

-- 10) Extend services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS journey_id uuid REFERENCES public.order_journeys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actual_activation_date date,
  ADD COLUMN IF NOT EXISTS billing_anchor_day integer CHECK (billing_anchor_day IS NULL OR (billing_anchor_day BETWEEN 1 AND 31)),
  ADD COLUMN IF NOT EXISTS billing_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_billing_date date,
  ADD COLUMN IF NOT EXISTS activation_reference text,
  ADD COLUMN IF NOT EXISTS activation_notes text,
  ADD COLUMN IF NOT EXISTS activation_confirmed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS activation_confirmed_at timestamptz;
CREATE INDEX IF NOT EXISTS services_next_billing_idx ON public.services(next_billing_date) WHERE billing_enabled = true;

-- 11) Extend invoices and invoice_lines
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_type text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS pro_rata jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_service_period_unique
  ON public.invoices(service_id, billing_period_start, billing_period_end, invoice_type)
  WHERE service_id IS NOT NULL AND billing_period_start IS NOT NULL;

ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 12) Relax manual_fulfilment_orders eligibility (correction #5)
-- Make payment_request_id nullable so journey-based trackers can exist without an upfront paid PR.
ALTER TABLE public.manual_fulfilment_orders
  ALTER COLUMN payment_request_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS journey_id uuid REFERENCES public.order_journeys(id) ON DELETE SET NULL;

-- Replace eligibility function: allow either legacy paid-PR path OR new journey path.
CREATE OR REPLACE FUNCTION public.can_create_manual_fulfilment(_payment_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.payment_requests pr
    JOIN public.contract_summaries cs ON cs.id = pr.contract_summary_id
    WHERE pr.id = _payment_request_id
      AND pr.status = 'paid'
      AND pr.webhook_verified = true
      AND pr.paid_at IS NOT NULL
      AND cs.accepted_at IS NOT NULL
      AND cs.pdf_url IS NOT NULL
  );
$$;

-- New journey-based eligibility checker
CREATE OR REPLACE FUNCTION public.can_create_manual_fulfilment_for_journey(_journey_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_journeys j
    JOIN public.contract_summaries cs ON cs.id = j.contract_summary_id
    LEFT JOIN public.payment_methods pm ON pm.journey_id = j.id AND pm.active = true
    WHERE j.id = _journey_id
      AND j.status IN ('submitted','completed')
      AND j.preferred_start_date IS NOT NULL
      AND cs.status = 'accepted'
      AND cs.pdf_storage_key IS NOT NULL
      AND cs.pdf_sha256 IS NOT NULL
      AND pm.id IS NOT NULL
      AND COALESCE(j.cooling_off_ends_at, now() + interval '1 second') <= now()
  );
$$;

-- Replace enforcement trigger to allow either path
CREATE OR REPLACE FUNCTION public.enforce_manual_fulfilment_eligibility()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_request_id IS NOT NULL THEN
    IF NOT public.can_create_manual_fulfilment(NEW.payment_request_id) THEN
      RAISE EXCEPTION 'Manual fulfilment tracker requires a paid, webhook-verified payment request linked to an accepted Contract Summary with a stored PDF.';
    END IF;
  ELSIF NEW.journey_id IS NOT NULL THEN
    IF NOT public.can_create_manual_fulfilment_for_journey(NEW.journey_id) THEN
      RAISE EXCEPTION 'Manual fulfilment tracker requires a completed order journey with an accepted Contract Summary, selected payment method, preferred start date and elapsed cooling-off period.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Manual fulfilment tracker requires either payment_request_id or journey_id.';
  END IF;
  RETURN NEW;
END $$;

-- 13) Platform feature flags
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS unified_journey_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legacy_onboarding_emails_suppressed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_issue_notice_days integer NOT NULL DEFAULT 7;

-- 14) Helper: secure RPC to read order_journeys by token hash (for unauthenticated journey)
CREATE OR REPLACE FUNCTION public.get_order_journey_by_token(_token_hash text)
RETURNS TABLE(
  id uuid, quote_id uuid, contract_summary_id uuid, current_step text, status text,
  preferred_start_date date, cooling_off_ends_at timestamptz, payment_method text,
  billing_anchor_day integer, contract_accepted_at timestamptz, completed_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, quote_id, contract_summary_id, current_step, status,
         preferred_start_date, cooling_off_ends_at, payment_method,
         billing_anchor_day, contract_accepted_at, completed_at
  FROM public.order_journeys WHERE token_hash = _token_hash LIMIT 1;
$$;

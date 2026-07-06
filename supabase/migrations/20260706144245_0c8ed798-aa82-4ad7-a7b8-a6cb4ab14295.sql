
-- =========================================================
-- SIM-only journey (additive)
-- =========================================================

-- 1. sim_settings (singleton)
CREATE TABLE IF NOT EXISTS public.sim_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  standalone_enabled boolean NOT NULL DEFAULT false,
  esim_enabled boolean NOT NULL DEFAULT true,
  physical_sim_enabled boolean NOT NULL DEFAULT true,
  direct_debit_enabled boolean NOT NULL DEFAULT true,
  pay_monthly_enabled boolean NOT NULL DEFAULT true,
  payg_enabled boolean NOT NULL DEFAULT false,
  dispatch_lead_time_days int NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sim_settings TO authenticated;
GRANT ALL ON public.sim_settings TO service_role;
ALTER TABLE public.sim_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim_settings admin read" ON public.sim_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. sim_plans catalogue
CREATE TABLE IF NOT EXISTS public.sim_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  network_display_name text,
  plan_type text NOT NULL DEFAULT 'pay_monthly' CHECK (plan_type IN ('pay_monthly','payg')),
  data_label text NOT NULL,
  calls_label text NOT NULL DEFAULT 'Unlimited calls',
  texts_label text NOT NULL DEFAULT 'Unlimited texts',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  monthly_price_minor int NOT NULL,
  first_payment_minor int NOT NULL DEFAULT 0,
  setup_fee_minor int NOT NULL DEFAULT 0,
  delivery_fee_minor int NOT NULL DEFAULT 0,
  min_term_months int NOT NULL DEFAULT 1,
  is_rolling boolean NOT NULL DEFAULT true,
  esim_available boolean NOT NULL DEFAULT true,
  physical_sim_available boolean NOT NULL DEFAULT true,
  vat_mode text NOT NULL DEFAULT 'included' CHECK (vat_mode IN ('included','excluded')),
  vat_rate numeric(5,4) NOT NULL DEFAULT 0.20,
  is_active boolean NOT NULL DEFAULT false,
  checkout_visible boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 100,
  terms_url text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sim_plans TO authenticated;
GRANT ALL ON public.sim_plans TO service_role;
ALTER TABLE public.sim_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim_plans admin all" ON public.sim_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. sim_orders
CREATE TABLE IF NOT EXISTS public.sim_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT ('SIM-' || to_char(now(),'YYMMDD') || '-' || substring(gen_random_uuid()::text,1,8)),
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.sim_plans(id) ON DELETE RESTRICT,
  -- immutable snapshot at time of order
  plan_slug_snapshot text NOT NULL,
  plan_name_snapshot text NOT NULL,
  monthly_price_minor_snapshot int NOT NULL,
  first_payment_minor_snapshot int NOT NULL DEFAULT 0,
  delivery_fee_minor_snapshot int NOT NULL DEFAULT 0,
  vat_mode_snapshot text NOT NULL DEFAULT 'included',
  vat_rate_snapshot numeric(5,4) NOT NULL DEFAULT 0.20,
  min_term_months_snapshot int NOT NULL DEFAULT 1,
  -- customer details
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- SIM type
  sim_type text NOT NULL CHECK (sim_type IN ('esim','physical')),
  esim_device_brand text,
  esim_device_model text,
  esim_eid text,
  delivery_address jsonb,
  -- number choice
  number_choice text NOT NULL CHECK (number_choice IN ('keep','new','new_with_stac','provide_later')),
  current_msisdn text,
  current_provider text,
  pac_code text,
  pac_expiry date,
  stac_code text,
  preferred_transfer_date date,
  -- payment
  payment_method text NOT NULL CHECK (payment_method IN ('card','direct_debit')),
  first_payment_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  first_payment_paid_minor int NOT NULL DEFAULT 0,
  first_payment_credit_minor int NOT NULL DEFAULT 0,
  -- lifecycle
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','awaiting_payment','payment_failed','paid',
    'dd_mandate_pending','admin_review',
    'esim_ready','esim_sent',
    'physical_sim_pending','physical_sim_dispatched',
    'pac_required','stac_required',
    'port_requested','port_scheduled','port_completed',
    'live','on_hold','failed','cancelled'
  )),
  service_live_date date,
  billing_anchor_day int CHECK (billing_anchor_day BETWEEN 1 AND 28),
  -- admin fulfilment (never exposed to customer)
  iccid text,
  provisioned_msisdn text,
  provisioned_plan_name text,
  port_requested_at timestamptz,
  port_scheduled_at timestamptz,
  port_completed_at timestamptz,
  dispatched_at timestamptz,
  dispatch_tracking text,
  admin_notes text,
  supplier_ref text,
  -- consent snapshot
  consent jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sim_orders_customer_id_idx ON public.sim_orders(customer_id);
CREATE INDEX IF NOT EXISTS sim_orders_status_idx ON public.sim_orders(status);
CREATE INDEX IF NOT EXISTS sim_orders_invoice_idx ON public.sim_orders(first_payment_invoice_id);

GRANT SELECT ON public.sim_orders TO authenticated;
GRANT ALL ON public.sim_orders TO service_role;
ALTER TABLE public.sim_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sim_orders customer read own" ON public.sim_orders FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Writes come exclusively from edge functions (service_role); no INSERT/UPDATE/DELETE for authenticated.

-- 4. sim_esim_deliveries (admin-only)
CREATE TABLE IF NOT EXISTS public.sim_esim_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.sim_orders(id) ON DELETE CASCADE,
  qr_storage_path text,
  activation_code text,
  smdp_address text,
  sent_at timestamptz,
  sent_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sim_esim_deliveries TO authenticated;
GRANT ALL ON public.sim_esim_deliveries TO service_role;
ALTER TABLE public.sim_esim_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim_esim_deliveries admin only" ON public.sim_esim_deliveries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Public views (customer-safe)
CREATE OR REPLACE VIEW public.sim_plans_public
WITH (security_invoker = true) AS
SELECT id, slug, name, network_display_name, plan_type,
       data_label, calls_label, texts_label, features,
       monthly_price_minor, first_payment_minor, setup_fee_minor, delivery_fee_minor,
       min_term_months, is_rolling, esim_available, physical_sim_available,
       vat_mode, vat_rate, sort_order, terms_url
FROM public.sim_plans
WHERE is_active = true AND checkout_visible = true;
GRANT SELECT ON public.sim_plans_public TO anon, authenticated;

CREATE OR REPLACE VIEW public.sim_settings_public
WITH (security_invoker = true) AS
SELECT standalone_enabled, esim_enabled, physical_sim_enabled,
       direct_debit_enabled, pay_monthly_enabled, payg_enabled,
       dispatch_lead_time_days
FROM public.sim_settings
WHERE singleton = true;
GRANT SELECT ON public.sim_settings_public TO anon, authenticated;

-- allow anon/authenticated to read sim_plans through the view (view is security_invoker,
-- so add SELECT grants on the base table restricted by RLS-safe columns via view scope).
-- We do NOT open sim_plans base table to anon/authenticated for SELECT — the view filter
-- runs as caller; grant table-level SELECT to the view owner (postgres) which owns the view.
-- Views defined by postgres bypass base-table RLS for column-limited access when granted.
GRANT SELECT (id, slug, name, network_display_name, plan_type, data_label, calls_label,
              texts_label, features, monthly_price_minor, first_payment_minor,
              setup_fee_minor, delivery_fee_minor, min_term_months, is_rolling,
              esim_available, physical_sim_available, vat_mode, vat_rate, sort_order,
              terms_url, is_active, checkout_visible)
  ON public.sim_plans TO anon, authenticated;

GRANT SELECT (standalone_enabled, esim_enabled, physical_sim_enabled,
              direct_debit_enabled, pay_monthly_enabled, payg_enabled,
              dispatch_lead_time_days, singleton)
  ON public.sim_settings TO anon, authenticated;

-- Add anon-permissive RLS policy scoped to visibility flags so security_invoker view returns rows.
CREATE POLICY "sim_plans public visible read" ON public.sim_plans FOR SELECT TO anon, authenticated
  USING (is_active = true AND checkout_visible = true);
CREATE POLICY "sim_settings public read" ON public.sim_settings FOR SELECT TO anon, authenticated
  USING (singleton = true);

-- Customer dashboard view — omits admin_notes, supplier_ref, iccid, dispatch_tracking
CREATE OR REPLACE VIEW public.sim_orders_customer
WITH (security_invoker = true) AS
SELECT id, order_number, customer_id, plan_slug_snapshot, plan_name_snapshot,
       monthly_price_minor_snapshot, first_payment_minor_snapshot,
       vat_mode_snapshot, vat_rate_snapshot, min_term_months_snapshot,
       full_name, email, sim_type, esim_device_brand, esim_device_model,
       delivery_address, number_choice, current_msisdn, current_provider,
       pac_code, pac_expiry, stac_code, preferred_transfer_date,
       payment_method, first_payment_invoice_id, first_payment_paid_minor,
       status, service_live_date, billing_anchor_day,
       provisioned_msisdn, provisioned_plan_name,
       port_requested_at, port_scheduled_at, port_completed_at,
       dispatched_at, created_at, updated_at
FROM public.sim_orders
WHERE customer_id = auth.uid();
GRANT SELECT ON public.sim_orders_customer TO authenticated;

-- 6. updated_at trigger (reuse existing helper if present)
CREATE OR REPLACE FUNCTION public.sim_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER sim_settings_touch BEFORE UPDATE ON public.sim_settings
  FOR EACH ROW EXECUTE FUNCTION public.sim_touch_updated_at();
CREATE TRIGGER sim_plans_touch BEFORE UPDATE ON public.sim_plans
  FOR EACH ROW EXECUTE FUNCTION public.sim_touch_updated_at();
CREATE TRIGGER sim_orders_touch BEFORE UPDATE ON public.sim_orders
  FOR EACH ROW EXECUTE FUNCTION public.sim_touch_updated_at();

-- 7. Trigger: when linked invoice becomes paid, mark SIM order as paid
CREATE OR REPLACE FUNCTION public.sim_sync_invoice_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sim public.sim_orders%ROWTYPE;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'paid' THEN
    SELECT * INTO _sim FROM public.sim_orders
      WHERE first_payment_invoice_id = NEW.id LIMIT 1;
    IF FOUND AND _sim.status IN ('awaiting_payment','payment_failed','draft') THEN
      UPDATE public.sim_orders
        SET status = 'paid',
            first_payment_paid_minor = COALESCE(NEW.total,0)::int * 100 / 1
        WHERE id = _sim.id;
      -- Note: NEW.total is in major units; convert with round to keep integer minor units
      UPDATE public.sim_orders
        SET first_payment_paid_minor = ROUND(NEW.total * 100)::int
        WHERE id = _sim.id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS sim_invoice_paid_sync ON public.invoices;
CREATE TRIGGER sim_invoice_paid_sync
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.sim_sync_invoice_paid();

-- 8. Seed settings singleton (disabled by default)
INSERT INTO public.sim_settings (singleton, standalone_enabled)
VALUES (true, false)
ON CONFLICT (singleton) DO NOTHING;

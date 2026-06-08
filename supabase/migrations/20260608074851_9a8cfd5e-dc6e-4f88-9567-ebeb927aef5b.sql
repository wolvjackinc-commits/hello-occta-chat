
-- Enums
DO $$ BEGIN
  CREATE TYPE public.quote_margin_check_status AS ENUM ('unknown','green','amber','red');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.supplier_api_mode AS ENUM ('manual','live','testing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ supplier_profiles ============
CREATE TABLE IF NOT EXISTS public.supplier_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name text NOT NULL,
  supplier_type text NOT NULL CHECK (supplier_type IN ('broadband','sim','voice','business','mixed')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','testing','archived')),
  contact_name text,
  contact_email text,
  contact_phone text,
  portal_url text,
  api_mode public.supplier_api_mode NOT NULL DEFAULT 'manual',
  vat_treatment_notes text,
  reverse_charge_possible boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_profiles TO authenticated;
GRANT ALL ON public.supplier_profiles TO service_role;
ALTER TABLE public.supplier_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_read_staff" ON public.supplier_profiles FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));
CREATE POLICY "suppliers_write_finance" ON public.supplier_profiles FOR ALL TO authenticated
USING (public.has_finance_access(auth.uid())) WITH CHECK (public.has_finance_access(auth.uid()));

CREATE TRIGGER trg_supplier_profiles_updated_at BEFORE UPDATE ON public.supplier_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ supplier_products ============
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.supplier_profiles(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  service_type text NOT NULL CHECK (service_type IN ('broadband','sim','digital_voice','business','router','install','other')),
  supplier_product_id text,
  technology text CHECK (technology IN ('FTTP','FTTC','SOGEA','ADSL','SIM','VOIP','OTHER')),
  download_speed_label text,
  upload_speed_label text,
  supplier_monthly_net numeric(12,2),
  supplier_setup_net numeric(12,2),
  supplier_router_net numeric(12,2),
  supplier_delivery_net numeric(12,2),
  supplier_install_net numeric(12,2),
  supplier_cease_fee_net numeric(12,2),
  supplier_vat_rate numeric(5,2) NOT NULL DEFAULT 20,
  reverse_charge boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_products TO authenticated;
GRANT ALL ON public.supplier_products TO service_role;
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sup_products_read_staff" ON public.supplier_products FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));
CREATE POLICY "sup_products_write_finance" ON public.supplier_products FOR ALL TO authenticated
USING (public.has_finance_access(auth.uid())) WITH CHECK (public.has_finance_access(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON public.supplier_products(supplier_id);
CREATE TRIGGER trg_supplier_products_updated_at BEFORE UPDATE ON public.supplier_products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ plan_categories ============
CREATE TABLE IF NOT EXISTS public.plan_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  service_type text NOT NULL CHECK (service_type IN ('broadband','sim','digital_voice','business','router','install','other')),
  plan_type text NOT NULL CHECK (plan_type IN ('flex','contract_saver','sim','digital_voice','business')),
  description text,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_categories TO authenticated;
GRANT ALL ON public.plan_categories TO service_role;
ALTER TABLE public.plan_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_cats_read_staff" ON public.plan_categories FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));
CREATE POLICY "plan_cats_write_finance" ON public.plan_categories FOR ALL TO authenticated
USING (public.has_finance_access(auth.uid())) WITH CHECK (public.has_finance_access(auth.uid()));

CREATE TRIGGER trg_plan_categories_updated_at BEFORE UPDATE ON public.plan_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ pricing_rules ============
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_category_id uuid NOT NULL REFERENCES public.plan_categories(id) ON DELETE RESTRICT,
  supplier_product_id uuid REFERENCES public.supplier_products(id) ON DELETE SET NULL,
  public_plan_name text NOT NULL,
  customer_type text NOT NULL CHECK (customer_type IN ('residential','business','both')),
  contract_length_months integer,
  monthly_sell_net numeric(12,2) NOT NULL DEFAULT 0,
  monthly_vat_rate numeric(5,2) NOT NULL DEFAULT 20,
  monthly_vat_amount numeric(12,2) NOT NULL DEFAULT 0,
  monthly_sell_gross numeric(12,2) NOT NULL DEFAULT 0,
  setup_sell_net numeric(12,2) NOT NULL DEFAULT 0,
  setup_vat_amount numeric(12,2) NOT NULL DEFAULT 0,
  setup_sell_gross numeric(12,2) NOT NULL DEFAULT 0,
  router_sell_net numeric(12,2) NOT NULL DEFAULT 0,
  router_vat_amount numeric(12,2) NOT NULL DEFAULT 0,
  router_sell_gross numeric(12,2) NOT NULL DEFAULT 0,
  delivery_sell_net numeric(12,2) NOT NULL DEFAULT 0,
  delivery_vat_amount numeric(12,2) NOT NULL DEFAULT 0,
  delivery_sell_gross numeric(12,2) NOT NULL DEFAULT 0,
  install_sell_net numeric(12,2) NOT NULL DEFAULT 0,
  install_vat_amount numeric(12,2) NOT NULL DEFAULT 0,
  install_sell_gross numeric(12,2) NOT NULL DEFAULT 0,
  cease_fee_gross numeric(12,2),
  price_rise_policy text,
  notice_period text,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT ALL ON public.pricing_rules TO service_role;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_rules_read_staff" ON public.pricing_rules FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));
CREATE POLICY "pricing_rules_write_finance" ON public.pricing_rules FOR ALL TO authenticated
USING (public.has_finance_access(auth.uid())) WITH CHECK (public.has_finance_access(auth.uid()));

-- Block activating a pricing rule when VAT settings are incomplete.
CREATE OR REPLACE FUNCTION public.pricing_rule_block_active_without_vat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.active = true AND NOT public.is_vat_active() THEN
    RAISE EXCEPTION 'Cannot activate pricing rule while VAT settings are incomplete';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_pricing_rules_vat_guard BEFORE INSERT OR UPDATE ON public.pricing_rules
FOR EACH ROW EXECUTE FUNCTION public.pricing_rule_block_active_without_vat();
CREATE TRIGGER trg_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ margin_rules ============
CREATE TABLE IF NOT EXISTS public.margin_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL CHECK (service_type IN ('broadband','sim','digital_voice','business','router','install','other')),
  plan_type text NOT NULL CHECK (plan_type IN ('flex','contract_saver','sim','digital_voice','business')),
  customer_type text NOT NULL CHECK (customer_type IN ('residential','business','both')),
  minimum_monthly_margin numeric(12,2) NOT NULL DEFAULT 0,
  minimum_first_3_month_margin numeric(12,2) NOT NULL DEFAULT 0,
  minimum_contract_margin numeric(12,2) NOT NULL DEFAULT 0,
  support_cost_buffer numeric(12,2) NOT NULL DEFAULT 0,
  payment_processing_buffer numeric(12,2) NOT NULL DEFAULT 0,
  failed_payment_risk_buffer numeric(12,2) NOT NULL DEFAULT 0,
  reward_cost_buffer numeric(12,2) NOT NULL DEFAULT 0,
  router_cost_buffer numeric(12,2) NOT NULL DEFAULT 0,
  install_cost_buffer numeric(12,2) NOT NULL DEFAULT 0,
  cease_risk_buffer numeric(12,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.margin_rules TO authenticated;
GRANT ALL ON public.margin_rules TO service_role;
ALTER TABLE public.margin_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "margin_rules_read_staff" ON public.margin_rules FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));
CREATE POLICY "margin_rules_write_finance" ON public.margin_rules FOR ALL TO authenticated
USING (public.has_finance_access(auth.uid())) WITH CHECK (public.has_finance_access(auth.uid()));

CREATE TRIGGER trg_margin_rules_updated_at BEFORE UPDATE ON public.margin_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ quote_margin_checks ============
CREATE TABLE IF NOT EXISTS public.quote_margin_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  supplier_monthly_cost numeric(12,2),
  total_monthly_sell numeric(12,2),
  estimated_monthly_margin numeric(12,2),
  first_3_month_margin numeric(12,2),
  estimated_contract_margin numeric(12,2),
  reward_cost_assumption numeric(12,2),
  status public.quote_margin_check_status NOT NULL DEFAULT 'unknown',
  reason text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT ON public.quote_margin_checks TO authenticated;
GRANT ALL ON public.quote_margin_checks TO service_role;
ALTER TABLE public.quote_margin_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qmc_read_staff" ON public.quote_margin_checks FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));
CREATE POLICY "qmc_insert_staff" ON public.quote_margin_checks FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_qmc_quote ON public.quote_margin_checks(quote_id, checked_at DESC);

-- ============ Helper functions ============
CREATE OR REPLACE FUNCTION public.can_override_red_margin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_send_quote(_quote_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status public.quote_margin_check_status;
  v_reason text;
BEGIN
  SELECT status, reason INTO v_status, v_reason
  FROM public.quote_margin_checks
  WHERE quote_id = _quote_id
  ORDER BY checked_at DESC
  LIMIT 1;

  IF v_status IS NULL THEN
    RETURN true; -- no check yet, unknown allowed
  END IF;

  IF v_status = 'red' THEN
    -- Allow only if an OVERRIDE row exists after the red
    RETURN EXISTS (
      SELECT 1 FROM public.quote_margin_checks
      WHERE quote_id = _quote_id
        AND status = 'green'
        AND reason LIKE 'OVERRIDE:%'
        AND checked_at >= (
          SELECT MAX(checked_at) FROM public.quote_margin_checks
          WHERE quote_id = _quote_id AND status = 'red'
        )
    );
  END IF;

  RETURN true;
END;
$$;

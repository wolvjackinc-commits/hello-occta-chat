-- SIM launch: schema for consumer/business plans, seed catalogue, enable public

-- 1. Extend sim_plans with segment + supplier + pricing breakdown
ALTER TABLE public.sim_plans
  ADD COLUMN IF NOT EXISTS customer_segment text NOT NULL DEFAULT 'consumer',
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS source_product text,
  ADD COLUMN IF NOT EXISTS source_network text,
  ADD COLUMN IF NOT EXISTS source_tariff_code text,
  ADD COLUMN IF NOT EXISTS supplier_cost_ex_vat_minor integer,
  ADD COLUMN IF NOT EXISTS occta_margin_ex_vat_minor integer,
  ADD COLUMN IF NOT EXISTS retail_price_ex_vat_minor integer,
  ADD COLUMN IF NOT EXISTS retail_price_inc_vat_minor integer,
  ADD COLUMN IF NOT EXISTS term_type text,
  ADD COLUMN IF NOT EXISTS plan_category text,
  ADD COLUMN IF NOT EXISTS fair_usage_applies boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS annual_price_adjustment_applies boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS early_termination_fee_applies boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cease_fee_note text;

ALTER TABLE public.sim_plans DROP CONSTRAINT IF EXISTS sim_plans_customer_segment_check;
ALTER TABLE public.sim_plans ADD CONSTRAINT sim_plans_customer_segment_check CHECK (customer_segment IN ('consumer','business'));
ALTER TABLE public.sim_plans DROP CONSTRAINT IF EXISTS sim_plans_term_type_check;
ALTER TABLE public.sim_plans ADD CONSTRAINT sim_plans_term_type_check CHECK (term_type IS NULL OR term_type IN ('30_day','24_month'));
ALTER TABLE public.sim_plans DROP CONSTRAINT IF EXISTS sim_plans_plan_category_check;
ALTER TABLE public.sim_plans ADD CONSTRAINT sim_plans_plan_category_check CHECK (plan_category IS NULL OR plan_category IN ('single_user','mobile_broadband','promo_unlimited'));

-- 2. Extend sim_orders with segment + business fields
ALTER TABLE public.sim_orders
  ADD COLUMN IF NOT EXISTS customer_segment text NOT NULL DEFAULT 'consumer',
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS company_number text,
  ADD COLUMN IF NOT EXISTS vat_number text;

ALTER TABLE public.sim_orders DROP CONSTRAINT IF EXISTS sim_orders_customer_segment_check;
ALTER TABLE public.sim_orders ADD CONSTRAINT sim_orders_customer_segment_check CHECK (customer_segment IN ('consumer','business'));

-- 3. Refresh public view to include new customer-facing fields
DROP VIEW IF EXISTS public.sim_plans_public;
CREATE VIEW public.sim_plans_public AS
SELECT
  id, slug, name, network_display_name, plan_type,
  data_label, calls_label, texts_label, features,
  monthly_price_minor, first_payment_minor, setup_fee_minor, delivery_fee_minor,
  min_term_months, is_rolling, esim_available, physical_sim_available,
  vat_mode, vat_rate, sort_order, terms_url,
  customer_segment, source_network, term_type, plan_category,
  retail_price_ex_vat_minor, retail_price_inc_vat_minor,
  fair_usage_applies, annual_price_adjustment_applies,
  early_termination_fee_applies, cease_fee_note
FROM public.sim_plans
WHERE is_active = true AND checkout_visible = true;

GRANT SELECT ON public.sim_plans_public TO anon, authenticated;

-- 4. Clear any prior Giacom-sourced seed rows (idempotent re-seed)
DELETE FROM public.sim_plans WHERE supplier_name = 'Giacom';

-- 5. Seed all consumer + business plans (auto-generated below)

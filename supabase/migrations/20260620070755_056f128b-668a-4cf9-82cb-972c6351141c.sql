
-- Phase 5: invoice adjustments + cancellation/ETF tracking

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS adjustment_of_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS adjustment_reason text,
  ADD COLUMN IF NOT EXISTS is_permanent_addition boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_invoices_adjustment_of ON public.invoices(adjustment_of_invoice_id);

-- Permanent recurring add-ons attached to a service (e.g. monthly fault charge)
CREATE TABLE IF NOT EXISTS public.recurring_billing_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_id uuid,
  description text NOT NULL,
  amount_ex_vat numeric(10,2) NOT NULL,
  vat_rate numeric(5,2) NOT NULL DEFAULT 20,
  active boolean NOT NULL DEFAULT true,
  starts_on date NOT NULL DEFAULT current_date,
  ends_on date,
  source_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_billing_addons TO authenticated;
GRANT ALL ON public.recurring_billing_addons TO service_role;

ALTER TABLE public.recurring_billing_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own recurring addons"
  ON public.recurring_billing_addons FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage recurring addons"
  ON public.recurring_billing_addons FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ETF / cancellation breakdown snapshots
CREATE TABLE IF NOT EXISTS public.cancellation_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_id uuid,
  order_id uuid,
  plan_type text NOT NULL CHECK (plan_type IN ('flex','contract')),
  monthly_amount numeric(10,2) NOT NULL DEFAULT 0,
  remaining_months integer NOT NULL DEFAULT 0,
  outstanding_charges numeric(10,2) NOT NULL DEFAULT 0,
  etf_amount numeric(10,2) NOT NULL DEFAULT 0,
  notice_days integer NOT NULL DEFAULT 0,
  termination_date date,
  breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'preview' CHECK (status IN ('preview','accepted','cancelled','expired')),
  created_by uuid,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cancellation_quotes TO authenticated;
GRANT ALL ON public.cancellation_quotes TO service_role;

ALTER TABLE public.cancellation_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own cancellation quotes"
  ON public.cancellation_quotes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers create own cancellation quotes"
  ON public.cancellation_quotes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage cancellation quotes"
  ON public.cancellation_quotes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_recurring_billing_addons_updated_at
  BEFORE UPDATE ON public.recurring_billing_addons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cancellation_quotes_updated_at
  BEFORE UPDATE ON public.cancellation_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

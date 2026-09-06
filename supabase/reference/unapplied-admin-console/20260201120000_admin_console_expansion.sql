-- Extend roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'billing';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'provisioning';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'read_only';

-- Note visibility
CREATE TYPE public.note_visibility AS ENUM ('internal', 'customer');

-- Services
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  service_type service_type NOT NULL,
  identifiers JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  supplier_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own services"
ON public.services FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins and provisioning can manage services"
ON public.services FOR ALL
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'provisioning')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'provisioning')
);

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoices
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_id UUID,
  issue_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own invoices"
ON public.invoices FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Billing and admins can manage invoices"
ON public.invoices FOR ALL
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'billing')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'billing')
);

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Billing and admins can manage invoice lines"
ON public.invoice_lines FOR ALL
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'billing')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'billing')
);

CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  method TEXT,
  reference TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Billing and admins can manage receipts"
ON public.receipts FOR ALL
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'billing')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'billing')
);

CREATE TABLE public.invoice_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Billing and admins can manage adjustments"
ON public.invoice_adjustments FOR ALL
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'billing')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'billing')
);

CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  credit_number TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Billing and admins can manage credit notes"
ON public.credit_notes FOR ALL
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'billing')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'billing')
);

-- Direct debit and payments
CREATE TABLE public.dd_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL,
  mandate_reference TEXT,
  bank_last4 TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dd_mandates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own mandates"
ON public.dd_mandates FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Billing and admins can manage mandates"
ON public.dd_mandates FOR ALL
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'billing')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'billing')
);

CREATE TRIGGER update_dd_mandates_updated_at
  BEFORE UPDATE ON public.dd_mandates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own payments"
ON public.payment_attempts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Billing and admins can manage payments"
ON public.payment_attempts FOR ALL
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'billing')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'billing')
);

-- Plans
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  effective_from DATE,
  effective_to DATE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage plans"
ON public.plans FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Compliance
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS internal_notes TEXT;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
ON public.audit_log FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs"
ON public.audit_log FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.communications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  channel TEXT NOT NULL,
  template_key TEXT,
  subject TEXT,
  to_address TEXT,
  status TEXT,
  provider_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.communications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their communications"
ON public.communications_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage communications"
ON public.communications_log FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Customer notes
CREATE TABLE public.customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  note TEXT NOT NULL,
  visibility note_visibility NOT NULL DEFAULT 'internal',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their visible notes"
ON public.customer_notes FOR SELECT
USING (auth.uid() = user_id AND visibility = 'customer');

CREATE POLICY "Admins can manage notes"
ON public.customer_notes FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- App config
CREATE TABLE public.app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage app config"
ON public.app_config FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit triggers
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (
    actor_user_id,
    action,
    table_name,
    record_id,
    before,
    after
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_orders_update
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_guest_orders_update
  AFTER UPDATE ON public.guest_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_support_tickets_update
  AFTER UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_invoices_update
  AFTER UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_services_update
  AFTER UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

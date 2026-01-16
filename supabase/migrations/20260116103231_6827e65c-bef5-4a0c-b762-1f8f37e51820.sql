-- Create billing_settings table for auto-pay preferences
CREATE TABLE public.billing_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  auto_pay_enabled BOOLEAN NOT NULL DEFAULT false,
  preferred_payment_method TEXT DEFAULT 'card',
  late_fee_grace_days INTEGER DEFAULT 7,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own billing settings"
  ON public.billing_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own billing settings"
  ON public.billing_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own billing settings"
  ON public.billing_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all billing settings"
  ON public.billing_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_billing_settings_updated_at
  BEFORE UPDATE ON public.billing_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add late_fee_amount column to invoices if not exists
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS late_fee_amount NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS late_fee_applied_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS overdue_notified_at TIMESTAMP WITH TIME ZONE;
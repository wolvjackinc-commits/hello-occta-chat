-- Monthly Billing v1: Extend billing_settings with billing mode and VAT defaults

-- Add new columns to billing_settings table
ALTER TABLE public.billing_settings 
ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'anniversary' CHECK (billing_mode IN ('fixed_day', 'anniversary')),
ADD COLUMN IF NOT EXISTS billing_day integer CHECK (billing_day >= 1 AND billing_day <= 28),
ADD COLUMN IF NOT EXISTS vat_enabled_default boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS vat_rate_default numeric NOT NULL DEFAULT 20 CHECK (vat_rate_default >= 0 AND vat_rate_default <= 100),
ADD COLUMN IF NOT EXISTS next_invoice_date date,
ADD COLUMN IF NOT EXISTS payment_terms_days integer NOT NULL DEFAULT 7 CHECK (payment_terms_days >= 1 AND payment_terms_days <= 90);

-- Add indexes for invoice generation queries
CREATE INDEX IF NOT EXISTS idx_billing_settings_next_invoice ON public.billing_settings (next_invoice_date) WHERE next_invoice_date IS NOT NULL;

-- Add vat_enabled and billing_period columns to invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS vat_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 20,
ADD COLUMN IF NOT EXISTS billing_period_start date,
ADD COLUMN IF NOT EXISTS billing_period_end date;

-- Create index for duplicate invoice prevention
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_user_period ON public.invoices (user_id, billing_period_start, billing_period_end) WHERE billing_period_start IS NOT NULL AND billing_period_end IS NOT NULL;

-- Add price_monthly column to services for auto-invoicing
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS price_monthly numeric NOT NULL DEFAULT 0 CHECK (price_monthly >= 0),
ADD COLUMN IF NOT EXISTS plan_name text;

-- Create function to calculate next invoice date
CREATE OR REPLACE FUNCTION public.calculate_next_invoice_date(
  p_billing_mode text,
  p_billing_day integer,
  p_current_date date DEFAULT CURRENT_DATE
)
RETURNS date
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_date date;
  v_year integer;
  v_month integer;
  v_day integer;
BEGIN
  IF p_billing_mode = 'fixed_day' THEN
    -- Fixed day billing: use the billing_day of the next month
    v_year := EXTRACT(YEAR FROM p_current_date)::integer;
    v_month := EXTRACT(MONTH FROM p_current_date)::integer;
    v_day := COALESCE(p_billing_day, 1);
    
    -- Clamp day to valid range for the month
    v_day := LEAST(v_day, 28);
    
    v_next_date := make_date(v_year, v_month, v_day);
    
    -- If the date is in the past, move to next month
    IF v_next_date <= p_current_date THEN
      v_next_date := v_next_date + INTERVAL '1 month';
    END IF;
  ELSE
    -- Anniversary billing: add 1 month from current date
    v_next_date := p_current_date + INTERVAL '1 month';
  END IF;
  
  RETURN v_next_date;
END;
$$;

-- Create function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix text := 'INV-';
  v_year_month text;
  v_seq integer;
  v_number text;
BEGIN
  v_year_month := TO_CHAR(CURRENT_DATE, 'YYMM');
  
  -- Get next sequence number for this month
  SELECT COALESCE(MAX(
    CAST(NULLIF(REGEXP_REPLACE(invoice_number, '^INV-[0-9]{4}-', ''), '') AS integer)
  ), 0) + 1
  INTO v_seq
  FROM public.invoices
  WHERE invoice_number LIKE v_prefix || v_year_month || '-%';
  
  v_number := v_prefix || v_year_month || '-' || LPAD(v_seq::text, 4, '0');
  
  RETURN v_number;
END;
$$;
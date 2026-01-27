-- Fix function search path mutable warnings

-- Update calculate_next_invoice_date to set search_path
CREATE OR REPLACE FUNCTION public.calculate_next_invoice_date(
  p_billing_mode text,
  p_billing_day integer,
  p_current_date date DEFAULT CURRENT_DATE
)
RETURNS date
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_next_date date;
  v_year integer;
  v_month integer;
  v_day integer;
BEGIN
  IF p_billing_mode = 'fixed_day' THEN
    v_year := EXTRACT(YEAR FROM p_current_date)::integer;
    v_month := EXTRACT(MONTH FROM p_current_date)::integer;
    v_day := COALESCE(p_billing_day, 1);
    v_day := LEAST(v_day, 28);
    v_next_date := make_date(v_year, v_month, v_day);
    IF v_next_date <= p_current_date THEN
      v_next_date := v_next_date + INTERVAL '1 month';
    END IF;
  ELSE
    v_next_date := p_current_date + INTERVAL '1 month';
  END IF;
  RETURN v_next_date;
END;
$$;

-- Update generate_invoice_number to set search_path
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_prefix text := 'INV-';
  v_year_month text;
  v_seq integer;
  v_number text;
BEGIN
  v_year_month := TO_CHAR(CURRENT_DATE, 'YYMM');
  
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
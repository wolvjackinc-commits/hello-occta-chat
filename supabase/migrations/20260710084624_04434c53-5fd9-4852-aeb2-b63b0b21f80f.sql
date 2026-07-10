CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text := 'INV-';
  v_year_month text;
  v_seq integer;
  v_number text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('public.invoices.invoice_number'));

  v_year_month := to_char(current_date, 'YYMM');

  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(invoice_number, '^INV-[0-9]{4}-', ''), '') AS integer)
  ), 0) + 1
  INTO v_seq
  FROM public.invoices
  WHERE invoice_number LIKE v_prefix || v_year_month || '-%';

  v_number := v_prefix || v_year_month || '-' || lpad(v_seq::text, 4, '0');

  RETURN v_number;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO service_role;

CREATE OR REPLACE FUNCTION public.invoices_before_insert_assign_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR btrim(NEW.invoice_number) = '' THEN
    NEW.invoice_number := public.generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_assign_number ON public.invoices;
CREATE TRIGGER trg_invoices_assign_number
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.invoices_before_insert_assign_number();
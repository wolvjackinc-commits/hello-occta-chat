CREATE OR REPLACE FUNCTION public.generate_payment_request_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix text := 'PR-';
  v_ym text := to_char(CURRENT_DATE, 'YYMM');
  v_seq int;
  v_num text;
BEGIN
  SELECT COALESCE(MAX(
    CAST(regexp_replace(payment_request_number, '^PR-[0-9]{4}-', '') AS integer)
  ), 0) + 1
  INTO v_seq
  FROM public.payment_requests
  WHERE payment_request_number ~ ('^' || v_prefix || v_ym || '-[0-9]+$');
  v_num := v_prefix || v_ym || '-' || LPAD(v_seq::text, 4, '0');
  RETURN v_num;
END;
$function$;
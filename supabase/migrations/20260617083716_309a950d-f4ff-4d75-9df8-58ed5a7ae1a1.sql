
CREATE SEQUENCE IF NOT EXISTS public.account_number_seq START 50000000 INCREMENT 1;

CREATE OR REPLACE FUNCTION public.generate_safe_account_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate text;
  v_exists boolean;
  v_tries int := 0;
BEGIN
  LOOP
    v_candidate := 'OCC' || lpad(nextval('public.account_number_seq')::text, 8, '0');
    SELECT EXISTS(
      SELECT 1 FROM public.profiles WHERE account_number = v_candidate
      UNION ALL
      SELECT 1 FROM public.guest_orders WHERE account_number = v_candidate
    ) INTO v_exists;
    EXIT WHEN NOT v_exists;
    v_tries := v_tries + 1;
    IF v_tries > 10 THEN
      RETURN public.generate_user_account_number();
    END IF;
  END LOOP;
  RETURN v_candidate;
END;
$$;

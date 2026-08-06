CREATE OR REPLACE FUNCTION public.protect_internal_order_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  is_staff boolean;
  col text;
  editable text[];
  self_claim boolean := false;
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT public.has_role(uid, 'admin')
      OR public.has_role(uid, 'super_admin')
      OR public.has_role(uid, 'support_agent')
      OR public.has_role(uid, 'sales_agent')
      OR public.has_role(uid, 'finance_admin')
    INTO is_staff;

  IF COALESCE(is_staff, false) THEN
    RETURN NEW;
  END IF;

  self_claim := (to_jsonb(OLD) ->> 'user_id') IS NULL AND (to_jsonb(NEW) ->> 'user_id') = uid::text;

  IF TG_TABLE_NAME = 'orders' THEN
    editable := ARRAY['notes','preferred_start_date','updated_at'];
    IF (OLD.customer_id IS NULL AND NEW.customer_id = uid) OR self_claim THEN
      editable := editable || ARRAY['customer_id','user_id'];
    END IF;
  ELSE
    editable := ARRAY['user_id','updated_at'];
    IF self_claim THEN
      editable := editable || ARRAY['linked_at','linked_order_id','customer_id'];
    END IF;
  END IF;

  FOR col IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = TG_TABLE_NAME
  LOOP
    IF NOT (col = ANY(editable)) THEN
      IF to_jsonb(NEW) -> col IS DISTINCT FROM to_jsonb(OLD) -> col THEN
        RAISE EXCEPTION 'Field % cannot be changed', col USING ERRCODE = '42501';
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;
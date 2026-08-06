-- Protect internal/staff-only columns on orders and guest_orders from customer edits.
CREATE OR REPLACE FUNCTION public.protect_internal_order_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_staff boolean;
  col text;
  editable text[];
BEGIN
  -- service_role / internal processes and unauthenticated server contexts skip this.
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

  IF TG_TABLE_NAME = 'orders' THEN
    editable := ARRAY['notes','preferred_start_date','updated_at'];
  ELSE
    editable := ARRAY['user_id','updated_at'];
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
$$;

DROP TRIGGER IF EXISTS trg_protect_internal_orders ON public.orders;
CREATE TRIGGER trg_protect_internal_orders
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.protect_internal_order_columns();

DROP TRIGGER IF EXISTS trg_protect_internal_guest_orders ON public.guest_orders;
CREATE TRIGGER trg_protect_internal_guest_orders
BEFORE UPDATE ON public.guest_orders
FOR EACH ROW EXECUTE FUNCTION public.protect_internal_order_columns();

-- Tighten the customer UPDATE policies so ownership cannot be reassigned.
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
CREATE POLICY "Users can update their own orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own linked orders" ON public.guest_orders;
CREATE POLICY "Users can update their own linked orders"
ON public.guest_orders
FOR UPDATE
TO authenticated
USING ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Block non-staff users from modifying internal fields on orders
CREATE OR REPLACE FUNCTION public.prevent_customer_internal_orders_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / staff bypass
  IF public.is_staff(auth.uid()) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    OR NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status
    OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
    OR NEW.internal_notes IS DISTINCT FROM OLD.internal_notes
    OR NEW.giacom_reference IS DISTINCT FROM OLD.giacom_reference
    OR NEW.giacom_product_ref IS DISTINCT FROM OLD.giacom_product_ref
    OR NEW.router_reference IS DISTINCT FROM OLD.router_reference
    OR NEW.entered_in_giacom_at IS DISTINCT FROM OLD.entered_in_giacom_at
    OR NEW.expected_activation_date IS DISTINCT FROM OLD.expected_activation_date
    OR NEW.cancellation_requested_at IS DISTINCT FROM OLD.cancellation_requested_at
    OR NEW.cease_date IS DISTINCT FROM OLD.cease_date
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.occta_order_number IS DISTINCT FROM OLD.occta_order_number
  THEN
    RAISE EXCEPTION 'permission denied: cannot modify internal order fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_customer_internal_orders_update ON public.orders;
CREATE TRIGGER trg_prevent_customer_internal_orders_update
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.prevent_customer_internal_orders_update();

-- Block non-staff users from modifying internal fields on guest_orders
CREATE OR REPLACE FUNCTION public.prevent_customer_internal_guest_orders_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_staff(auth.uid()) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
    OR NEW.account_number IS DISTINCT FROM OLD.account_number
    OR NEW.linked_order_id IS DISTINCT FROM OLD.linked_order_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.email IS DISTINCT FROM OLD.email
  THEN
    RAISE EXCEPTION 'permission denied: cannot modify internal guest order fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_customer_internal_guest_orders_update ON public.guest_orders;
CREATE TRIGGER trg_prevent_customer_internal_guest_orders_update
BEFORE UPDATE ON public.guest_orders
FOR EACH ROW EXECUTE FUNCTION public.prevent_customer_internal_guest_orders_update();

-- Block non-staff users from modifying staff fields on support_tickets
CREATE OR REPLACE FUNCTION public.prevent_customer_internal_support_tickets_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_staff(auth.uid()) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    OR NEW.priority IS DISTINCT FROM OLD.priority
    OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
    OR NEW.closed_at IS DISTINCT FROM OLD.closed_at
  THEN
    RAISE EXCEPTION 'permission denied: cannot modify staff-only ticket fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_customer_internal_support_tickets_update ON public.support_tickets;
CREATE TRIGGER trg_prevent_customer_internal_support_tickets_update
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.prevent_customer_internal_support_tickets_update();

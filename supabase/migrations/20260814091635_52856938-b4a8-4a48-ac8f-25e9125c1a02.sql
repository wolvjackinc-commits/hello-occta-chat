CREATE OR REPLACE FUNCTION public.protect_order_internal_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role / backend jobs and staff bypass
  IF auth.uid() IS NULL OR public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.status := OLD.status;
  IF to_jsonb(OLD) ? 'lifecycle_status' THEN
    NEW.lifecycle_status := OLD.lifecycle_status;
  END IF;
  IF to_jsonb(OLD) ? 'internal_notes' THEN
    NEW.internal_notes := OLD.internal_notes;
  END IF;
  IF to_jsonb(OLD) ? 'giacom_reference' THEN
    NEW.giacom_reference := OLD.giacom_reference;
  END IF;
  IF to_jsonb(OLD) ? 'activation_date' THEN
    NEW.activation_date := OLD.activation_date;
  END IF;
  IF to_jsonb(OLD) ? 'activated_at' THEN
    NEW.activated_at := OLD.activated_at;
  END IF;
  IF to_jsonb(OLD) ? 'cease_date' THEN
    NEW.cease_date := OLD.cease_date;
  END IF;
  IF to_jsonb(OLD) ? 'cancelled_at' THEN
    NEW.cancelled_at := OLD.cancelled_at;
  END IF;
  IF to_jsonb(OLD) ? 'user_id' THEN
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_order_internal_fields ON public.orders;
CREATE TRIGGER trg_protect_order_internal_fields
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.protect_order_internal_fields();

CREATE OR REPLACE FUNCTION public.protect_ticket_internal_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.status := OLD.status;
  NEW.priority := OLD.priority;
  IF to_jsonb(OLD) ? 'assigned_to' THEN
    NEW.assigned_to := OLD.assigned_to;
  END IF;
  IF to_jsonb(OLD) ? 'vulnerable_customer_flag' THEN
    NEW.vulnerable_customer_flag := OLD.vulnerable_customer_flag;
  END IF;
  IF to_jsonb(OLD) ? 'user_id' THEN
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_ticket_internal_fields ON public.support_tickets;
CREATE TRIGGER trg_protect_ticket_internal_fields
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.protect_ticket_internal_fields();
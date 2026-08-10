CREATE OR REPLACE FUNCTION public.trg_order_live_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text IN ('active','live','service_live','provisioned')
     AND (OLD.status::text IS DISTINCT FROM NEW.status::text) THEN
    PERFORM public.notify_admin_event('order_live', jsonb_build_object(
      'id', NEW.id,
      'order_number', NEW.order_number,
      'user_id', NEW.user_id,
      'status', NEW.status,
      'plan_name', NEW.plan_name,
      'customer_email', NEW.customer_email,
      'customer_name', NEW.customer_name
    ));
  END IF;
  RETURN NEW;
END;
$$;
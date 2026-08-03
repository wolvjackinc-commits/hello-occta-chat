CREATE OR REPLACE FUNCTION public.trg_invoice_paid_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    PERFORM public.notify_admin_event('invoice_paid', jsonb_build_object(
      'id', NEW.id,
      'invoice_number', NEW.invoice_number,
      'user_id', NEW.user_id,
      'amount', NEW.total,
      'currency', NEW.currency,
      'paid_at', now()
    ));
  END IF;
  RETURN NEW;
END;
$$;
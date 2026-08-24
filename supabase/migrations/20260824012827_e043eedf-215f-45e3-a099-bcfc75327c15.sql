-- 1. Fix order triggers to use occta_order_number instead of order_number
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
      'order_number', NEW.occta_order_number,
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

CREATE OR REPLACE FUNCTION public.tg_order_live_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('live','active') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.notify_admin_event('order_live', NEW.id,
      jsonb_build_object('reference', NEW.occta_order_number, 'status', NEW.status, 'activated_at', now()));
  END IF;
  RETURN NEW;
END; $$;

-- 2. Add missing columns to business_leads
ALTER TABLE public.business_leads 
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS team_size text,
  ADD COLUMN IF NOT EXISTS interest text,
  ADD COLUMN IF NOT EXISTS sla_preference text,
  ADD COLUMN IF NOT EXISTS secondary_contact_name text,
  ADD COLUMN IF NOT EXISTS secondary_contact_email text,
  ADD COLUMN IF NOT EXISTS secondary_contact_phone text,
  ADD COLUMN IF NOT EXISTS billing_contact_name text,
  ADD COLUMN IF NOT EXISTS billing_contact_email text,
  ADD COLUMN IF NOT EXISTS billing_contact_phone text,
  ADD COLUMN IF NOT EXISTS site_address_line1 text,
  ADD COLUMN IF NOT EXISTS site_address_line2 text,
  ADD COLUMN IF NOT EXISTS site_city text,
  ADD COLUMN IF NOT EXISTS site_postcode text;

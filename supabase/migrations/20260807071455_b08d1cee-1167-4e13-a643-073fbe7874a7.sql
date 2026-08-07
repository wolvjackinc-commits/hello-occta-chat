CREATE OR REPLACE FUNCTION public.log_ticket_message_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.business_ticket_activity (ticket_id, actor_id, actor_type, event_type, metadata)
  VALUES (
    NEW.ticket_id,
    NEW.user_id,
    CASE
      WHEN public.has_role(NEW.user_id, 'admin'::public.app_role)
        OR public.has_role(NEW.user_id, 'super_admin'::public.app_role)
      THEN 'admin'
      ELSE 'customer'
    END,
    'reply',
    jsonb_build_object('message_id', NEW.id)
  );
  RETURN NEW;
END;
$$;
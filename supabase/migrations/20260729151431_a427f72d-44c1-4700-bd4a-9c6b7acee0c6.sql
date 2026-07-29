-- 1. Chat handoff: the app sets status 'human_requested', trigger only matched 'awaiting_human'
CREATE OR REPLACE FUNCTION public.trg_chat_handoff_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.status IN ('human_requested','awaiting_human')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.notify_admin_event('human_chat_request', jsonb_build_object(
      'id', NEW.id,
      'session_id', NEW.session_id,
      'customer_name', NEW.customer_name,
      'customer_email', NEW.customer_email,
      'summary', NEW.summary,
      'trigger_reason', NEW.handoff_reason,
      'user_id', NEW.user_id,
      'created_at', NEW.created_at
    ));
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_chat_handoff_notify ON public.chat_conversations;
CREATE TRIGGER trg_chat_handoff_notify
AFTER INSERT OR UPDATE OF status ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.trg_chat_handoff_notify();

-- 2. New support ticket alerts
CREATE OR REPLACE FUNCTION public.trg_support_ticket_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  prof RECORD;
BEGIN
  SELECT full_name, email INTO prof FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.notify_admin_event('new_ticket', jsonb_build_object(
    'id', NEW.id,
    'subject', NEW.subject,
    'message', NEW.description,
    'category', NEW.category,
    'priority', NEW.priority,
    'status', NEW.status,
    'user_id', NEW.user_id,
    'customer_name', COALESCE(prof.full_name, 'Customer'),
    'customer_email', prof.email,
    'created_at', NEW.created_at
  ));
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_support_ticket_notify ON public.support_tickets;
CREATE TRIGGER trg_support_ticket_notify
AFTER INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.trg_support_ticket_notify();

-- 3. Remove duplicate legacy triggers (one email per event)
DROP TRIGGER IF EXISTS dd_mandate_notify_trg ON public.dd_mandates;
DROP TRIGGER IF EXISTS invoice_paid_notify_trg ON public.invoices;
DROP TRIGGER IF EXISTS contract_signed_notify_trg ON public.contract_acceptances;
DROP TRIGGER IF EXISTS order_live_notify_trg ON public.orders;
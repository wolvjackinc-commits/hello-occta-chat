
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DROP POLICY IF EXISTS "chat_att_admin_all" ON storage.objects;
CREATE POLICY "chat_att_admin_all" ON storage.objects FOR ALL
  USING (bucket_id = 'chat-attachments' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')))
  WITH CHECK (bucket_id = 'chat-attachments' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));

DROP POLICY IF EXISTS "chat_att_user_own" ON storage.objects;
CREATE POLICY "chat_att_user_own" ON storage.objects FOR ALL
  USING (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = 'user' AND (storage.foldername(name))[2] = auth.uid()::text)
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = 'user' AND (storage.foldername(name))[2] = auth.uid()::text);

DROP POLICY IF EXISTS "chat_att_guest_insert" ON storage.objects;
CREATE POLICY "chat_att_guest_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = 'guest');

CREATE OR REPLACE FUNCTION public.notify_admin_event(_type TEXT, _id UUID, _extra JSONB DEFAULT '{}'::jsonb)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  fn_url TEXT := 'https://oexgjmuvgdndizsufipe.supabase.co/functions/v1/admin-notify';
  anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9leGdqbXV2Z2RuZGl6c3VmaXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2Nzk5NDksImV4cCI6MjA4MzI1NTk0OX0.GnviK6x-kwCSFww-Wa4fcCtQGOQ1iMx8rZTrrU46Pto';
  body JSONB;
BEGIN
  body := jsonb_build_object('type', _type, 'data', jsonb_build_object('id', _id) || COALESCE(_extra,'{}'::jsonb));
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||anon_key,
      'x-internal-trigger','db'
    ),
    body := body
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notify_admin_event failed: %', SQLERRM;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_chat_conv_handoff()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'human_requested' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.notify_admin_event('human_chat_request', NEW.id,
      jsonb_build_object(
        'reference', substring(NEW.id::text,1,8),
        'customer_name', COALESCE(NEW.customer_name,'Guest visitor'),
        'customer_email', COALESCE(NEW.customer_email,''),
        'summary', COALESCE(NEW.summary,''),
        'trigger_reason', COALESCE(NEW.handoff_reason,'human_requested')
      ));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS chat_conv_handoff_trg ON public.chat_conversations;
CREATE TRIGGER chat_conv_handoff_trg AFTER UPDATE ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.tg_chat_conv_handoff();

CREATE OR REPLACE FUNCTION public.tg_dd_mandate_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admin_event('dd_mandate_submitted', NEW.id,
    jsonb_build_object('reference', COALESCE(NEW.mandate_reference, substring(NEW.id::text,1,8)), 'status', COALESCE(NEW.status,'pending')));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS dd_mandate_notify_trg ON public.dd_mandates;
CREATE TRIGGER dd_mandate_notify_trg AFTER INSERT ON public.dd_mandates
FOR EACH ROW EXECUTE FUNCTION public.tg_dd_mandate_notify();

CREATE OR REPLACE FUNCTION public.tg_invoice_paid_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.notify_admin_event('invoice_paid', NEW.id,
      jsonb_build_object('reference', NEW.invoice_number, 'amount', NEW.total_amount, 'paid_at', COALESCE(NEW.paid_at, now())));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS invoice_paid_notify_trg ON public.invoices;
CREATE TRIGGER invoice_paid_notify_trg AFTER UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_paid_notify();

CREATE OR REPLACE FUNCTION public.tg_contract_signed_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admin_event('contract_signed', NEW.id,
    jsonb_build_object('reference', substring(NEW.id::text,1,8), 'signed_at', COALESCE(NEW.created_at, now())));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS contract_signed_notify_trg ON public.contract_acceptances;
CREATE TRIGGER contract_signed_notify_trg AFTER INSERT ON public.contract_acceptances
FOR EACH ROW EXECUTE FUNCTION public.tg_contract_signed_notify();

CREATE OR REPLACE FUNCTION public.tg_order_live_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('live','active') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.notify_admin_event('order_live', NEW.id,
      jsonb_build_object('reference', NEW.order_number, 'status', NEW.status, 'activated_at', now()));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS order_live_notify_trg ON public.orders;
CREATE TRIGGER order_live_notify_trg AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_order_live_notify();

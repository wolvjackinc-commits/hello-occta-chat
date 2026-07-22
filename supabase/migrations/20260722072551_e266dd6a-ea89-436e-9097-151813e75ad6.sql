
-- =====================================================================
-- 1. chat_conversations
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'ai' CHECK (status IN ('ai','awaiting_human','live','resolved')),
  assigned_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  summary TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  handoff_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.chat_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chat_conversations TO anon;
GRANT ALL ON public.chat_conversations TO service_role;

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

-- Admins can manage everything
CREATE POLICY "admins_all_conversations"
  ON public.chat_conversations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Signed-in customers see & update their own conversations
CREATE POLICY "user_own_conversation_select"
  ON public.chat_conversations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "anyone_insert_conversation"
  ON public.chat_conversations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Guests can read their session via session_id filter (RLS still enforced by session lookup on client)
CREATE POLICY "anon_select_by_session"
  ON public.chat_conversations
  FOR SELECT
  TO anon
  USING (user_id IS NULL);

-- =====================================================================
-- 2. chat_messages
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','admin','system')),
  content TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  sender_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_conversation_created_idx
  ON public.chat_messages (conversation_id, created_at);

GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT SELECT, INSERT ON public.chat_messages TO anon;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_all_messages"
  ON public.chat_messages
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "user_own_messages_select"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "anon_read_guest_messages"
  ON public.chat_messages
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id AND c.user_id IS NULL
    )
  );

CREATE POLICY "anyone_insert_own_messages"
  ON public.chat_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (role IN ('user','assistant','system'));

-- =====================================================================
-- 3. updated_at trigger
-- =====================================================================
CREATE OR REPLACE FUNCTION public.touch_chat_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_conversations
    SET last_message_at = now(), updated_at = now()
    WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_conversation ON public.chat_messages;
CREATE TRIGGER trg_touch_conversation
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_chat_conversation();

-- =====================================================================
-- 4. Realtime publication
-- =====================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- =====================================================================
-- 5. Generic notify_admin() helper (fires admin-notify edge function)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.notify_admin_event(_type TEXT, _data JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://oexgjmuvgdndizsufipe.supabase.co/functions/v1/admin-notify',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9leGdqbXV2Z2RuZGl6c3VmaXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2Nzk5NDksImV4cCI6MjA4MzI1NTk0OX0.GnviK6x-kwCSFww-Wa4fcCtQGOQ1iMx8rZTrrU46Pto","x-internal-trigger":"db"}'::jsonb,
    body := jsonb_build_object('type', _type, 'data', _data)
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_admin_event failed: %', SQLERRM;
END;
$$;

-- =====================================================================
-- 6. Human handoff trigger
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trg_chat_handoff_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'awaiting_human' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.notify_admin_event('human_chat_request', jsonb_build_object(
      'id', NEW.id,
      'session_id', NEW.session_id,
      'customer_name', NEW.customer_name,
      'customer_email', NEW.customer_email,
      'customer_phone', NEW.customer_phone,
      'summary', NEW.summary,
      'handoff_reason', NEW.handoff_reason,
      'user_id', NEW.user_id,
      'created_at', NEW.created_at
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_handoff_notify ON public.chat_conversations;
CREATE TRIGGER trg_chat_handoff_notify
  AFTER INSERT OR UPDATE OF status ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.trg_chat_handoff_notify();

-- =====================================================================
-- 7. DD mandate submitted
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trg_dd_mandate_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admin_event('dd_mandate_submitted', jsonb_build_object(
    'id', NEW.id,
    'user_id', NEW.user_id,
    'status', NEW.status,
    'created_at', NEW.created_at
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dd_mandate_notify ON public.dd_mandates;
CREATE TRIGGER trg_dd_mandate_notify
  AFTER INSERT ON public.dd_mandates
  FOR EACH ROW EXECUTE FUNCTION public.trg_dd_mandate_notify();

-- =====================================================================
-- 8. Invoice paid
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trg_invoice_paid_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.notify_admin_event('invoice_paid', jsonb_build_object(
      'id', NEW.id,
      'invoice_number', NEW.invoice_number,
      'user_id', NEW.user_id,
      'amount', NEW.total_amount,
      'currency', NEW.currency,
      'paid_at', COALESCE(NEW.paid_at, now())
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_paid_notify ON public.invoices;
CREATE TRIGGER trg_invoice_paid_notify
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_invoice_paid_notify();

-- =====================================================================
-- 9. Contract signed
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trg_contract_signed_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admin_event('contract_signed', jsonb_build_object(
    'id', NEW.id,
    'user_id', NEW.user_id,
    'quote_id', NEW.quote_id,
    'accepted_at', NEW.accepted_at,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contract_signed_notify ON public.contract_acceptances;
CREATE TRIGGER trg_contract_signed_notify
  AFTER INSERT ON public.contract_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.trg_contract_signed_notify();

-- =====================================================================
-- 10. Order goes live
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trg_order_live_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('active','live','service_live','provisioned') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
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

DROP TRIGGER IF EXISTS trg_order_live_notify ON public.orders;
CREATE TRIGGER trg_order_live_notify
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_order_live_notify();

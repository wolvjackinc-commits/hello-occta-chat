
-- Business contacts
CREATE TABLE public.business_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary','billing','technical','other')),
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 200),
  phone TEXT,
  receives_invoices BOOLEAN NOT NULL DEFAULT false,
  receives_updates BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_business_contacts_profile ON public.business_contacts(business_profile_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_contacts TO authenticated;
GRANT ALL ON public.business_contacts TO service_role;
ALTER TABLE public.business_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members manage own contacts"
  ON public.business_contacts FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.business_users bu
      WHERE bu.business_profile_id = business_contacts.business_profile_id
        AND bu.user_id = auth.uid())
    OR business_profile_id = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.business_users bu
      WHERE bu.business_profile_id = business_contacts.business_profile_id
        AND bu.user_id = auth.uid())
    OR business_profile_id = auth.uid()
  );

CREATE TRIGGER trg_business_contacts_updated_at
  BEFORE UPDATE ON public.business_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Business ticket activity log
CREATE TABLE public.business_ticket_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL DEFAULT 'system' CHECK (actor_type IN ('system','customer','admin')),
  event_type TEXT NOT NULL CHECK (event_type IN ('status_change','assignment','attachment_added','reply','priority_change','created')),
  from_value TEXT,
  to_value TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bta_ticket ON public.business_ticket_activity(ticket_id, created_at DESC);
GRANT SELECT, INSERT ON public.business_ticket_activity TO authenticated;
GRANT ALL ON public.business_ticket_activity TO service_role;
ALTER TABLE public.business_ticket_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ticket owner or admin can read activity"
  ON public.business_ticket_activity FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.support_tickets t
      WHERE t.id = business_ticket_activity.ticket_id AND t.user_id = auth.uid())
  );

CREATE POLICY "Admin or ticket owner insert"
  ON public.business_ticket_activity FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.support_tickets t
      WHERE t.id = business_ticket_activity.ticket_id AND t.user_id = auth.uid())
  );

-- Trigger: log status / assignment / priority changes on support_tickets
CREATE OR REPLACE FUNCTION public.log_support_ticket_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.business_ticket_activity (ticket_id, actor_id, actor_type, event_type, to_value)
    VALUES (NEW.id, NEW.user_id, 'customer', 'created', NEW.status::text);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.business_ticket_activity (ticket_id, actor_id, actor_type, event_type, from_value, to_value)
    VALUES (NEW.id, auth.uid(),
      CASE WHEN has_role(auth.uid(),'admin'::app_role) THEN 'admin' ELSE 'customer' END,
      'status_change', OLD.status::text, NEW.status::text);
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.business_ticket_activity (ticket_id, actor_id, actor_type, event_type, from_value, to_value)
    VALUES (NEW.id, auth.uid(), 'admin', 'assignment',
      COALESCE(OLD.assigned_to::text,''), COALESCE(NEW.assigned_to::text,''));
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.business_ticket_activity (ticket_id, actor_id, actor_type, event_type, from_value, to_value)
    VALUES (NEW.id, auth.uid(),
      CASE WHEN has_role(auth.uid(),'admin'::app_role) THEN 'admin' ELSE 'customer' END,
      'priority_change', OLD.priority::text, NEW.priority::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_tickets_activity
  AFTER INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_support_ticket_activity();

-- Trigger: log ticket_messages replies as activity
CREATE OR REPLACE FUNCTION public.log_ticket_message_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.business_ticket_activity (ticket_id, actor_id, actor_type, event_type, metadata)
  VALUES (NEW.ticket_id, NEW.sender_id,
    CASE WHEN has_role(NEW.sender_id,'admin'::app_role) THEN 'admin' ELSE 'customer' END,
    'reply', jsonb_build_object('message_id', NEW.id));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ticket_messages_activity
  AFTER INSERT ON public.ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_message_activity();

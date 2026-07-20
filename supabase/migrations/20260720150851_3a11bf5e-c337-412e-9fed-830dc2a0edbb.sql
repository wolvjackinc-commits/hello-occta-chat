
CREATE OR REPLACE FUNCTION public.has_any_admin_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin','super_admin','business_admin','ticket_admin','sales_admin','moderator')
  )
$$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(user_id) WHERE read_at IS NULL;

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_any_admin_role(auth.uid()));

DROP POLICY IF EXISTS "Users mark own notifications read" ON public.notifications;
CREATE POLICY "Users mark own notifications read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.notify_on_ticket_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
  v_title TEXT;
  v_body TEXT;
  v_link TEXT;
  v_recipients UUID[];
  v_uid UUID;
BEGIN
  IF NEW.event_type NOT IN ('status_change','priority_change','message','attachment_uploaded','assignment') THEN
    RETURN NEW;
  END IF;

  SELECT id, subject, user_id, assigned_to, status, priority
    INTO v_ticket
  FROM public.support_tickets
  WHERE id = NEW.ticket_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  CASE NEW.event_type
    WHEN 'status_change' THEN
      v_title := 'Ticket status updated';
      v_body := 'Status changed to ' || COALESCE(NEW.metadata->>'to', v_ticket.status);
    WHEN 'priority_change' THEN
      v_title := 'Ticket priority updated';
      v_body := 'Priority changed to ' || COALESCE(NEW.metadata->>'to', v_ticket.priority);
    WHEN 'message' THEN
      v_title := 'New reply on your ticket';
      v_body := LEFT(COALESCE(NEW.metadata->>'preview', 'A new message was added'), 200);
    WHEN 'attachment_uploaded' THEN
      v_title := 'New attachment on ticket';
      v_body := COALESCE(NEW.metadata->>'file_name', 'A file was attached');
    WHEN 'assignment' THEN
      v_title := 'Ticket assignment updated';
      v_body := COALESCE(NEW.metadata->>'note', 'Assignment changed');
    ELSE
      RETURN NEW;
  END CASE;

  v_link := '/business/support?ticket=' || v_ticket.id::text;

  v_recipients := ARRAY[]::UUID[];
  IF v_ticket.user_id IS NOT NULL THEN
    v_recipients := array_append(v_recipients, v_ticket.user_id);
  END IF;
  IF v_ticket.assigned_to IS NOT NULL AND NOT (v_ticket.assigned_to = ANY(v_recipients)) THEN
    v_recipients := array_append(v_recipients, v_ticket.assigned_to);
  END IF;

  FOREACH v_uid IN ARRAY v_recipients LOOP
    IF NEW.actor_id IS NULL OR NEW.actor_id <> v_uid THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
      VALUES (
        v_uid,
        'ticket_' || NEW.event_type,
        v_title,
        v_body,
        v_link,
        jsonb_build_object('ticket_id', v_ticket.id, 'subject', v_ticket.subject)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ticket_activity ON public.business_ticket_activity;
CREATE TRIGGER trg_notify_ticket_activity
AFTER INSERT ON public.business_ticket_activity
FOR EACH ROW EXECUTE FUNCTION public.notify_on_ticket_activity();

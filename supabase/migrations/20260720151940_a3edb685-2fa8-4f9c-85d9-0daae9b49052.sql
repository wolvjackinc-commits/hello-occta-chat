
-- =========================================================================
-- 1. Storage RLS: business-ticket-attachments (tighten + broaden admin roles)
-- =========================================================================
DROP POLICY IF EXISTS "Owners read own ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete own ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owners upload own ticket attachments" ON storage.objects;

-- Ticket owner OR authorised staff may read
CREATE POLICY "Ticket attachments read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'business-ticket-attachments'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'business_admin')
    OR public.has_role(auth.uid(), 'ticket_admin')
    OR public.has_role(auth.uid(), 'support_agent')
  )
);

-- Only the owner uploads into their own path (staff use signed uploads elsewhere)
CREATE POLICY "Ticket attachments upload own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'business-ticket-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Owner or authorised staff may delete
CREATE POLICY "Ticket attachments delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'business-ticket-attachments'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'business_admin')
    OR public.has_role(auth.uid(), 'ticket_admin')
  )
);

-- =========================================================================
-- 2. Notification preferences
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app_status_changes boolean NOT NULL DEFAULT true,
  email_status_changes  boolean NOT NULL DEFAULT true,
  in_app_attachments    boolean NOT NULL DEFAULT true,
  email_attachments     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own prefs read"   ON public.notification_preferences;
DROP POLICY IF EXISTS "own prefs write"  ON public.notification_preferences;
DROP POLICY IF EXISTS "own prefs update" ON public.notification_preferences;
DROP POLICY IF EXISTS "own prefs delete" ON public.notification_preferences;

CREATE POLICY "own prefs read"   ON public.notification_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own prefs write"  ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prefs update" ON public.notification_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prefs delete" ON public.notification_preferences FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_notification_preferences_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_notification_prefs_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notification_prefs_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_notification_preferences_updated_at();

-- =========================================================================
-- 3. Audit trigger on user_roles (grant/revoke logging)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.audit_user_roles_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  target uuid;
  role_val text;
  action_val text;
  before_roles text[];
  after_roles text[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    target := NEW.user_id;
    role_val := NEW.role::text;
    action_val := 'role.grant';
  ELSIF TG_OP = 'DELETE' THEN
    target := OLD.user_id;
    role_val := OLD.role::text;
    action_val := 'role.revoke';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Snapshot of current roles for the target after this change committed within-txn
  SELECT COALESCE(array_agg(role::text ORDER BY role::text), ARRAY[]::text[])
    INTO after_roles FROM public.user_roles WHERE user_id = target;

  IF TG_OP = 'INSERT' THEN
    before_roles := (SELECT COALESCE(array_agg(x ORDER BY x), ARRAY[]::text[])
                     FROM unnest(after_roles) x WHERE x <> role_val);
  ELSE
    before_roles := (SELECT COALESCE(array_agg(x ORDER BY x), ARRAY[]::text[])
                     FROM unnest(after_roles || ARRAY[role_val]) x);
  END IF;

  INSERT INTO public.audit_logs(actor_user_id, action, entity, entity_id, metadata)
  VALUES (
    actor,
    action_val,
    'user_roles',
    target,
    jsonb_build_object(
      'role', role_val,
      'target_user_id', target,
      'before_roles', before_roles,
      'after_roles',  after_roles
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_roles_ins ON public.user_roles;
DROP TRIGGER IF EXISTS trg_audit_user_roles_del ON public.user_roles;

CREATE TRIGGER trg_audit_user_roles_ins
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles_change();

CREATE TRIGGER trg_audit_user_roles_del
AFTER DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles_change();

-- =========================================================================
-- 4. New-business-invoice → send-business-invoice-email (pg_net)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_new_business_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9leGdqbXV2Z2RuZGl6c3VmaXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2Nzk5NDksImV4cCI6MjA4MzI1NTk0OX0.GnviK6x-kwCSFww-Wa4fcCtQGOQ1iMx8rZTrrU46Pto';
  is_business boolean;
BEGIN
  SELECT (business_profile_id IS NOT NULL OR company_name IS NOT NULL)
    INTO is_business
    FROM public.profiles WHERE id = NEW.user_id;

  IF COALESCE(is_business, false) THEN
    PERFORM net.http_post(
      url := 'https://oexgjmuvgdndizsufipe.supabase.co/functions/v1/send-business-invoice-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := jsonb_build_object('invoice_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_business_invoice ON public.invoices;
CREATE TRIGGER trg_notify_new_business_invoice
AFTER INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.notify_new_business_invoice();

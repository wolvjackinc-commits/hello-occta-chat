
-- =========================================================================
-- PHASE 6 — Support / Complaints / Communications / Knowledge Base
-- =========================================================================

-- 1) Extend ticket_status & ticket_priority enums (add-only)
ALTER TYPE public.ticket_status ADD VALUE IF NOT EXISTS 'waiting_customer';
ALTER TYPE public.ticket_status ADD VALUE IF NOT EXISTS 'waiting_occta';
ALTER TYPE public.ticket_priority ADD VALUE IF NOT EXISTS 'normal';

-- 2) Extend support_tickets
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS vulnerable_customer_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS related_order_id uuid,
  ADD COLUMN IF NOT EXISTS related_invoice_id uuid,
  ADD COLUMN IF NOT EXISTS related_quote_id uuid,
  ADD COLUMN IF NOT EXISTS related_service_id uuid,
  ADD COLUMN IF NOT EXISTS first_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- Auto SLA + closed_at trigger
CREATE OR REPLACE FUNCTION public.support_tickets_set_sla()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_first interval;
  v_res   interval;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_first := CASE NEW.priority
      WHEN 'urgent' THEN interval '4 hours'
      WHEN 'high'   THEN interval '1 day'
      WHEN 'low'    THEN interval '5 days'
      ELSE interval '2 days'
    END;
    v_res := CASE NEW.priority
      WHEN 'urgent' THEN interval '2 days'
      WHEN 'high'   THEN interval '5 days'
      WHEN 'low'    THEN interval '20 days'
      ELSE interval '10 days'
    END;
    IF NEW.first_response_due_at IS NULL THEN NEW.first_response_due_at := NEW.created_at + v_first; END IF;
    IF NEW.resolution_due_at  IS NULL THEN NEW.resolution_due_at  := NEW.created_at + v_res;   END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IN ('resolved','closed') AND OLD.status NOT IN ('resolved','closed') THEN
    NEW.closed_at := COALESCE(NEW.closed_at, now());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_support_tickets_sla ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_sla
  BEFORE INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.support_tickets_set_sla();

-- 3) ticket_internal_notes (staff-only)
CREATE TABLE IF NOT EXISTS public.ticket_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ticket_internal_notes TO authenticated;
GRANT ALL ON public.ticket_internal_notes TO service_role;
ALTER TABLE public.ticket_internal_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal notes staff read" ON public.ticket_internal_notes FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "internal notes staff insert" ON public.ticket_internal_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- =========================================================================
-- 4) Complaints
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.complaint_status AS ENUM ('open','investigating','waiting_customer','resolved','deadlock_issued','referred_to_adr','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.complaint_priority AS ENUM ('normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  complaint_reference text NOT NULL UNIQUE,
  linked_ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  category text NOT NULL,
  status public.complaint_status NOT NULL DEFAULT 'open',
  priority public.complaint_priority NOT NULL DEFAULT 'normal',
  summary text NOT NULL,
  customer_desired_outcome text,
  assigned_to uuid,
  opened_at timestamptz NOT NULL DEFAULT now(),
  first_response_due_at timestamptz,
  six_week_adr_eligible_at timestamptz NOT NULL,
  deadlock_issued_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  adr_provider text,
  adr_reference text,
  contact_email text,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers see own complaints" ON public.complaints FOR SELECT TO authenticated
  USING (customer_id = auth.uid());
CREATE POLICY "customers create own complaints" ON public.complaints FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid() OR customer_id IS NULL);
CREATE POLICY "staff read all complaints" ON public.complaints FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "compliance manage complaints" ON public.complaints FOR ALL TO authenticated
  USING (public.has_compliance_access(auth.uid()))
  WITH CHECK (public.has_compliance_access(auth.uid()));

-- Reference generator
CREATE OR REPLACE FUNCTION public.generate_complaint_reference()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref text; v_exists boolean;
BEGIN
  LOOP
    v_ref := 'CMP-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    SELECT EXISTS(SELECT 1 FROM public.complaints WHERE complaint_reference = v_ref) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_ref;
END $$;

CREATE OR REPLACE FUNCTION public.complaints_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.complaint_reference IS NULL OR NEW.complaint_reference = '' THEN
    NEW.complaint_reference := public.generate_complaint_reference();
  END IF;
  NEW.six_week_adr_eligible_at := COALESCE(NEW.opened_at, now()) + interval '42 days';
  IF NEW.first_response_due_at IS NULL THEN
    NEW.first_response_due_at := COALESCE(NEW.opened_at, now()) + interval '5 days';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_complaints_before_insert ON public.complaints;
CREATE TRIGGER trg_complaints_before_insert BEFORE INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.complaints_before_insert();

CREATE OR REPLACE FUNCTION public.complaints_before_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'resolved' AND OLD.status <> 'resolved' THEN NEW.resolved_at := COALESCE(NEW.resolved_at, now()); END IF;
  IF NEW.status = 'closed'   AND OLD.status <> 'closed'   THEN NEW.closed_at   := COALESCE(NEW.closed_at, now());   END IF;
  IF NEW.status = 'deadlock_issued' AND OLD.status <> 'deadlock_issued' THEN NEW.deadlock_issued_at := COALESCE(NEW.deadlock_issued_at, now()); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_complaints_before_update ON public.complaints;
CREATE TRIGGER trg_complaints_before_update BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.complaints_before_update();

-- complaint_events (append-only)
CREATE TABLE IF NOT EXISTS public.complaint_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_type text NOT NULL DEFAULT 'system',
  actor_id uuid,
  visibility text NOT NULL DEFAULT 'customer', -- customer | internal
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.complaint_events TO authenticated;
GRANT ALL ON public.complaint_events TO service_role;
ALTER TABLE public.complaint_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers read own complaint events" ON public.complaint_events FOR SELECT TO authenticated
  USING (visibility = 'customer' AND EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_events.complaint_id AND c.customer_id = auth.uid()));
CREATE POLICY "staff read all complaint events" ON public.complaint_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "compliance insert complaint events" ON public.complaint_events FOR INSERT TO authenticated
  WITH CHECK (public.has_compliance_access(auth.uid()) OR public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.complaint_events_block_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'complaint_events is append-only'; END $$;
DROP TRIGGER IF EXISTS trg_complaint_events_no_update ON public.complaint_events;
CREATE TRIGGER trg_complaint_events_no_update BEFORE UPDATE OR DELETE ON public.complaint_events
  FOR EACH ROW EXECUTE FUNCTION public.complaint_events_block_mutation();

-- complaint_evidence_links
CREATE TABLE IF NOT EXISTS public.complaint_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  related_id uuid,
  title text NOT NULL,
  url text,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.complaint_evidence_links TO authenticated;
GRANT ALL ON public.complaint_evidence_links TO service_role;
ALTER TABLE public.complaint_evidence_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage evidence" ON public.complaint_evidence_links FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- complaint_letters
CREATE TABLE IF NOT EXISTS public.complaint_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  letter_type text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.complaint_letters TO authenticated;
GRANT ALL ON public.complaint_letters TO service_role;
ALTER TABLE public.complaint_letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers see sent letters" ON public.complaint_letters FOR SELECT TO authenticated
  USING (status = 'sent' AND EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_letters.complaint_id AND c.customer_id = auth.uid()));
CREATE POLICY "compliance manage letters" ON public.complaint_letters FOR ALL TO authenticated
  USING (public.has_compliance_access(auth.uid())) WITH CHECK (public.has_compliance_access(auth.uid()));

-- =========================================================================
-- 5) Communications Centre
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.communication_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  subject text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  related_ticket_id uuid,
  related_complaint_id uuid,
  related_quote_id uuid,
  related_order_id uuid,
  related_invoice_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.communication_threads TO authenticated;
GRANT ALL ON public.communication_threads TO service_role;
ALTER TABLE public.communication_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers see own threads" ON public.communication_threads FOR SELECT TO authenticated
  USING (customer_id = auth.uid());
CREATE POLICY "staff manage threads" ON public.communication_threads FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.communication_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.communication_threads(id) ON DELETE CASCADE,
  direction text NOT NULL, -- inbound | outbound | internal
  channel text NOT NULL,
  sender_type text NOT NULL,
  sender_id uuid,
  subject text,
  body text NOT NULL,
  attachments_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.communication_messages TO authenticated;
GRANT ALL ON public.communication_messages TO service_role;
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers see own non-internal messages" ON public.communication_messages FOR SELECT TO authenticated
  USING (direction <> 'internal' AND EXISTS (
    SELECT 1 FROM public.communication_threads t WHERE t.id = communication_messages.thread_id AND t.customer_id = auth.uid()
  ));
CREATE POLICY "staff manage messages" ON public.communication_messages FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========================================================================
-- 6) Knowledge Base
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.kb_visibility AS ENUM ('public','internal','support_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.kb_status AS ENUM ('draft','approved','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.kb_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kb_categories TO anon, authenticated;
GRANT ALL ON public.kb_categories TO service_role;
ALTER TABLE public.kb_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read kb categories" ON public.kb_categories FOR SELECT USING (active = true);
CREATE POLICY "compliance manage kb categories" ON public.kb_categories FOR ALL TO authenticated
  USING (public.has_compliance_access(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_compliance_access(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE IF NOT EXISTS public.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.kb_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  content text NOT NULL,
  visibility public.kb_visibility NOT NULL DEFAULT 'public',
  status public.kb_status NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kb_articles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.kb_articles TO authenticated;
GRANT ALL ON public.kb_articles TO service_role;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read approved public kb" ON public.kb_articles FOR SELECT
  USING (visibility = 'public' AND status = 'approved');
CREATE POLICY "staff read all kb" ON public.kb_articles FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "compliance manage kb" ON public.kb_articles FOR ALL TO authenticated
  USING (public.has_compliance_access(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_compliance_access(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE IF NOT EXISTS public.kb_article_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.kb_article_versions TO authenticated;
GRANT ALL ON public.kb_article_versions TO service_role;
ALTER TABLE public.kb_article_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read kb versions" ON public.kb_article_versions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "compliance write kb versions" ON public.kb_article_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_compliance_access(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE OR REPLACE FUNCTION public.kb_article_snapshot_on_approve()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.content IS DISTINCT FROM NEW.content) THEN
    NEW.approved_at := COALESCE(NEW.approved_at, now());
    INSERT INTO public.kb_article_versions(article_id, version, title, content, created_by)
    VALUES (NEW.id, NEW.version, NEW.title, NEW.content, NEW.approved_by);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_kb_article_snapshot ON public.kb_articles;
CREATE TRIGGER trg_kb_article_snapshot BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.kb_article_snapshot_on_approve();

CREATE TABLE IF NOT EXISTS public.ai_handoff_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type text NOT NULL,
  rule_text text NOT NULL,
  action text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_handoff_rules TO authenticated;
GRANT ALL ON public.ai_handoff_rules TO service_role;
ALTER TABLE public.ai_handoff_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read handoff rules" ON public.ai_handoff_rules FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "compliance manage handoff rules" ON public.ai_handoff_rules FOR ALL TO authenticated
  USING (public.has_compliance_access(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_compliance_access(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- =========================================================================
-- 7) Customer-safe RPCs
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_customer_tickets()
RETURNS TABLE(id uuid, subject text, category text, status text, priority text, created_at timestamptz, updated_at timestamptz, first_response_due_at timestamptz, resolution_due_at timestamptz, closed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, subject, category, status::text, priority::text, created_at, updated_at, first_response_due_at, resolution_due_at, closed_at
  FROM public.support_tickets WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 200
$$;

CREATE OR REPLACE FUNCTION public.get_customer_ticket_messages(_ticket_id uuid)
RETURNS TABLE(id uuid, message text, is_staff_reply boolean, sender_role text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.message, m.is_staff_reply, m.sender_role, m.created_at
  FROM public.ticket_messages m
  JOIN public.support_tickets t ON t.id = m.ticket_id
  WHERE m.ticket_id = _ticket_id AND t.user_id = auth.uid()
  ORDER BY m.created_at ASC
$$;

CREATE OR REPLACE FUNCTION public.get_customer_complaints()
RETURNS TABLE(id uuid, complaint_reference text, category text, status text, priority text, summary text, opened_at timestamptz, six_week_adr_eligible_at timestamptz, resolved_at timestamptz, deadlock_issued_at timestamptz, adr_provider text, adr_reference text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, complaint_reference, category, status::text, priority::text, summary, opened_at, six_week_adr_eligible_at, resolved_at, deadlock_issued_at, adr_provider, adr_reference
  FROM public.complaints WHERE customer_id = auth.uid() ORDER BY opened_at DESC LIMIT 100
$$;

CREATE OR REPLACE FUNCTION public.get_customer_complaint_events(_complaint_id uuid)
RETURNS TABLE(id uuid, event_type text, title text, actor_type text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.event_type, e.title, e.actor_type, e.created_at
  FROM public.complaint_events e
  JOIN public.complaints c ON c.id = e.complaint_id
  WHERE e.complaint_id = _complaint_id AND c.customer_id = auth.uid() AND e.visibility = 'customer'
  ORDER BY e.created_at ASC
$$;

CREATE OR REPLACE FUNCTION public.get_customer_communication_threads()
RETURNS TABLE(id uuid, subject text, channel text, status text, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, subject, channel, status, created_at, updated_at
  FROM public.communication_threads WHERE customer_id = auth.uid() ORDER BY updated_at DESC LIMIT 100
$$;

CREATE OR REPLACE FUNCTION public.get_customer_communication_messages(_thread_id uuid)
RETURNS TABLE(id uuid, direction text, channel text, sender_type text, subject text, body text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.direction, m.channel, m.sender_type, m.subject, m.body, m.created_at
  FROM public.communication_messages m
  JOIN public.communication_threads t ON t.id = m.thread_id
  WHERE m.thread_id = _thread_id AND t.customer_id = auth.uid() AND m.direction <> 'internal'
  ORDER BY m.created_at ASC
$$;

CREATE OR REPLACE FUNCTION public.get_public_kb_articles()
RETURNS TABLE(id uuid, title text, slug text, content text, category_id uuid, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, title, slug, content, category_id, updated_at
  FROM public.kb_articles WHERE visibility = 'public' AND status = 'approved' ORDER BY updated_at DESC LIMIT 500
$$;

CREATE OR REPLACE FUNCTION public.get_customer_complaint_letters()
RETURNS TABLE(id uuid, complaint_id uuid, letter_type text, subject text, body text, sent_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, l.complaint_id, l.letter_type, l.subject, l.body, l.sent_at
  FROM public.complaint_letters l
  JOIN public.complaints c ON c.id = l.complaint_id
  WHERE c.customer_id = auth.uid() AND l.status = 'sent'
  ORDER BY l.sent_at DESC NULLS LAST
$$;

-- Customer write RPCs
CREATE OR REPLACE FUNCTION public.customer_create_ticket(_subject text, _description text, _category text, _priority text DEFAULT 'normal', _vulnerable boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_uid uuid := auth.uid(); v_pri public.ticket_priority;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF length(coalesce(_subject,'')) < 3 OR length(coalesce(_description,'')) < 3 THEN RAISE EXCEPTION 'subject/description too short'; END IF;
  v_pri := CASE _priority WHEN 'urgent' THEN 'urgent'::public.ticket_priority WHEN 'high' THEN 'high'::public.ticket_priority WHEN 'low' THEN 'low'::public.ticket_priority ELSE 'normal'::public.ticket_priority END;
  INSERT INTO public.support_tickets(user_id, subject, description, category, priority, status, vulnerable_customer_flag)
  VALUES (v_uid, left(_subject,200), left(_description,5000), _category, v_pri, 'open'::public.ticket_status, COALESCE(_vulnerable,false))
  RETURNING id INTO v_id;
  PERFORM public.log_event('customer','support_ticket_created','Customer created ticket',
    jsonb_build_object('ticket_id',v_id,'category',_category,'priority',_priority,'vulnerable',_vulnerable),
    v_uid, NULL, NULL, NULL, NULL, v_id, NULL, NULL, NULL, NULL, NULL, 'support', 'info');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.customer_add_ticket_message(_ticket_id uuid, _message text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.support_tickets WHERE id = _ticket_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'ticket not found';
  END IF;
  IF length(coalesce(_message,'')) < 1 THEN RAISE EXCEPTION 'empty message'; END IF;
  INSERT INTO public.ticket_messages(ticket_id, user_id, message, is_staff_reply, sender_role)
  VALUES (_ticket_id, v_uid, left(_message,5000), false, 'customer') RETURNING id INTO v_id;
  UPDATE public.support_tickets SET status = 'waiting_occta'::public.ticket_status, updated_at = now() WHERE id = _ticket_id;
  PERFORM public.log_event('customer','support_response_sent','Customer replied to ticket',
    jsonb_build_object('ticket_id',_ticket_id), v_uid, NULL, NULL, NULL, NULL, _ticket_id, NULL, NULL, NULL, NULL, NULL,'support','info');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.customer_create_complaint(_category text, _summary text, _desired_outcome text DEFAULT NULL, _contact_email text DEFAULT NULL, _contact_phone text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF length(coalesce(_summary,'')) < 5 THEN RAISE EXCEPTION 'summary too short'; END IF;
  INSERT INTO public.complaints(customer_id, complaint_reference, category, summary, customer_desired_outcome, contact_email, contact_phone, status, priority)
  VALUES (v_uid, '', _category, left(_summary,4000), left(coalesce(_desired_outcome,''),2000), _contact_email, _contact_phone, 'open'::public.complaint_status, 'normal'::public.complaint_priority)
  RETURNING id INTO v_id;
  INSERT INTO public.complaint_events(complaint_id, event_type, title, details, actor_type, actor_id, visibility)
  VALUES (v_id, 'created','Complaint received', jsonb_build_object('category',_category), 'customer', v_uid, 'customer');
  PERFORM public.log_event('customer','complaint_created','Complaint created',
    jsonb_build_object('complaint_id',v_id,'category',_category), v_uid, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,'complaints','info');
  RETURN v_id;
END $$;

-- Allow anon/auth call of public KB only
REVOKE ALL ON FUNCTION public.get_public_kb_articles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_kb_articles() TO anon, authenticated;


-- Sequence for human-readable task numbers
CREATE SEQUENCE IF NOT EXISTS public.admin_tasks_number_seq;

-- Main task table
CREATE TABLE public.admin_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_number text UNIQUE NOT NULL DEFAULT ('TSK-' || lpad(nextval('public.admin_tasks_number_seq')::text, 6, '0')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR char_length(description) <= 4000),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting_customer','waiting_supplier','resolved','cancelled')),
  related_customer_id uuid,
  related_account_number text,
  related_quote_id uuid,
  related_contract_summary_id uuid,
  related_payment_request_id uuid,
  assigned_to uuid,
  due_date timestamptz,
  created_by uuid NOT NULL,
  cancelled_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.admin_tasks TO authenticated;
GRANT ALL ON public.admin_tasks TO service_role;
GRANT USAGE ON SEQUENCE public.admin_tasks_number_seq TO authenticated, service_role;

ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins select tasks" ON public.admin_tasks
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert tasks" ON public.admin_tasks
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());
CREATE POLICY "Admins update tasks" ON public.admin_tasks
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- No DELETE policy — cancellation is soft.

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.admin_tasks_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    NEW.cancelled_at = now();
  END IF;
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
    NEW.resolved_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_admin_tasks_updated_at
  BEFORE UPDATE ON public.admin_tasks
  FOR EACH ROW EXECUTE FUNCTION public.admin_tasks_set_updated_at();

-- Audit trigger
CREATE OR REPLACE FUNCTION public.admin_tasks_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_meta jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_meta := jsonb_build_object('task_number', NEW.task_number, 'status', NEW.status, 'priority', NEW.priority);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_meta := jsonb_build_object(
      'task_number', NEW.task_number,
      'status_from', OLD.status, 'status_to', NEW.status,
      'priority_from', OLD.priority, 'priority_to', NEW.priority,
      'assigned_from', OLD.assigned_to, 'assigned_to', NEW.assigned_to
    );
  END IF;
  INSERT INTO public.audit_logs (action, entity, entity_id, metadata, user_id)
  VALUES (v_action, 'admin_task', NEW.id, v_meta, auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_admin_tasks_audit
  AFTER INSERT OR UPDATE ON public.admin_tasks
  FOR EACH ROW EXECUTE FUNCTION public.admin_tasks_audit();

-- Notes table (append-only)
CREATE TABLE public.admin_task_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.admin_tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.admin_task_notes TO authenticated;
GRANT ALL ON public.admin_task_notes TO service_role;

ALTER TABLE public.admin_task_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins select task notes" ON public.admin_task_notes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert task notes" ON public.admin_task_notes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND author_id = auth.uid());
-- No UPDATE, no DELETE policy — append-only.

CREATE INDEX idx_admin_tasks_status ON public.admin_tasks(status);
CREATE INDEX idx_admin_tasks_assigned_to ON public.admin_tasks(assigned_to);
CREATE INDEX idx_admin_tasks_related_customer ON public.admin_tasks(related_customer_id);
CREATE INDEX idx_admin_task_notes_task_id ON public.admin_task_notes(task_id);

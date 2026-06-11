
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
  INSERT INTO public.audit_logs (action, entity, entity_id, metadata, actor_user_id)
  VALUES (v_action, 'admin_task', NEW.id, v_meta, auth.uid());
  RETURN NEW;
END;
$$;

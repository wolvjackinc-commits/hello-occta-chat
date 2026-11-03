-- If a Care mandate is cancelled before it was lodged, staff must not lodge it: close its open "Lodge" task.
CREATE OR REPLACE FUNCTION public.care_close_lodge_task() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IN ('awaiting_lodgement','on_hold') THEN
    UPDATE public.admin_tasks SET status = 'cancelled', updated_at = now()
     WHERE status IN ('open','in_progress') AND title LIKE 'Lodge%' AND position(NEW.reference IN coalesce(title, '') || ' ' || coalesce(description, '')) > 0;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.care_close_lodge_task() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS care_close_lodge_task ON public.care_mandates;
CREATE TRIGGER care_close_lodge_task AFTER UPDATE OF status ON public.care_mandates FOR EACH ROW EXECUTE FUNCTION public.care_close_lodge_task();
-- Close any already left open.
UPDATE public.admin_tasks t SET status = 'cancelled', updated_at = now()
  FROM public.care_mandates m
 WHERE m.status = 'cancelled' AND m.lodged_at IS NULL AND t.status IN ('open','in_progress') AND t.title LIKE 'Lodge%'
   AND position(m.reference IN coalesce(t.title, '') || ' ' || coalesce(t.description, '')) > 0;

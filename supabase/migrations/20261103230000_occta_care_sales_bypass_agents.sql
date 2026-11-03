-- Agents may bypass the call check on their own sales; a saved bypass reason can never be changed.
CREATE OR REPLACE FUNCTION public.care_sales_decide(p_sale uuid, p_decision text, p_note text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r text := public.care_sales_require(); uid uuid := auth.uid(); s record;
BEGIN
  IF p_decision NOT IN ('approve','decline','bypass') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF p_decision <> 'bypass' AND r <> 'supervisor' THEN RAISE EXCEPTION 'supervisor_only'; END IF;
  IF p_decision = 'bypass' AND length(coalesce(btrim(p_note), '')) < 20 THEN RAISE EXCEPTION 'bypass_reason_required_min_20_chars'; END IF;
  IF length(coalesce(btrim(p_note), '')) < 10 THEN RAISE EXCEPTION 'note_required_min_10_chars'; END IF;
  SELECT * INTO s FROM public.care_sales WHERE id = p_sale FOR UPDATE;
  IF NOT FOUND OR (r <> 'supervisor' AND s.agent_id <> uid) THEN RAISE EXCEPTION 'not_found'; END IF;
  IF s.supervisor_decision = 'bypass' THEN RAISE EXCEPTION 'already_bypassed'; END IF;
  IF p_decision = 'bypass' THEN
    IF s.status NOT IN ('awaiting_recording','scoring','held','declined') THEN RAISE EXCEPTION 'nothing_to_bypass'; END IF;
  ELSIF s.status NOT IN ('passed','held','declined') THEN RAISE EXCEPTION 'sale_not_scored_or_already_actioned'; END IF;
  IF p_decision = 'approve' AND s.agent_id = uid THEN RAISE EXCEPTION 'cannot_approve_your_own_sale'; END IF;
  IF p_decision = 'approve' AND (s.qa->'red_flags') @> '[{"severity":"decline"}]'::jsonb THEN
    RAISE EXCEPTION 'sale_has_a_decline_red_flag: use Bypass with a reason if you have checked the call yourself';
  END IF;
  UPDATE public.care_sales SET supervisor_id = uid, supervisor_decision = p_decision, supervisor_note = left(p_note, 2000), supervisor_at = now(),
    status = CASE WHEN p_decision = 'decline' THEN 'declined' ELSE 'approved' END WHERE id = s.id;
  PERFORM public.care_log(NULL, s.customer_id, 'staff', uid, 'care_sale_' || p_decision,
    jsonb_build_object('sale_id', s.id, 'note', p_note, 'qa_decision', s.qa_decision, 'qa_score', s.qa_score, 'status_before', s.status));
  RETURN jsonb_build_object('ok', true);
END $function$;

-- Once a bypass is saved, nobody (staff, functions or SQL) can change who, why or when.
CREATE OR REPLACE FUNCTION public.care_sales_lock_bypass() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.supervisor_decision = 'bypass' AND (NEW.supervisor_decision IS DISTINCT FROM OLD.supervisor_decision
     OR NEW.supervisor_note IS DISTINCT FROM OLD.supervisor_note OR NEW.supervisor_id IS DISTINCT FROM OLD.supervisor_id
     OR NEW.supervisor_at IS DISTINCT FROM OLD.supervisor_at) THEN
    RAISE EXCEPTION 'bypass_reason_is_locked';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS care_sales_lock_bypass ON public.care_sales;
CREATE TRIGGER care_sales_lock_bypass BEFORE UPDATE ON public.care_sales FOR EACH ROW EXECUTE FUNCTION public.care_sales_lock_bypass();

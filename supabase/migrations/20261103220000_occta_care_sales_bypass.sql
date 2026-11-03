-- Sales Desk: a supervisor can bypass a failed, held or unchecked call so the sale continues.
-- Needs a reason (20+ characters), can't be used on your own sale, and is logged and shown in the evidence pack.
ALTER TABLE public.care_sales DROP CONSTRAINT IF EXISTS care_sales_supervisor_decision_check;
ALTER TABLE public.care_sales ADD CONSTRAINT care_sales_supervisor_decision_check
  CHECK (supervisor_decision IS NULL OR supervisor_decision IN ('approve','decline','bypass'));

CREATE OR REPLACE FUNCTION public.care_sales_decide(p_sale uuid, p_decision text, p_note text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r text := public.care_sales_require(); uid uuid := auth.uid(); s record;
BEGIN
  IF r <> 'supervisor' THEN RAISE EXCEPTION 'supervisor_only'; END IF;
  IF p_decision NOT IN ('approve','decline','bypass') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF p_decision = 'bypass' AND length(coalesce(btrim(p_note), '')) < 20 THEN RAISE EXCEPTION 'bypass_reason_required_min_20_chars'; END IF;
  IF length(coalesce(btrim(p_note), '')) < 10 THEN RAISE EXCEPTION 'note_required_min_10_chars'; END IF;
  SELECT * INTO s FROM public.care_sales WHERE id = p_sale FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p_decision = 'bypass' THEN
    IF s.status NOT IN ('awaiting_recording','scoring','held','declined') THEN RAISE EXCEPTION 'nothing_to_bypass'; END IF;
  ELSIF s.status NOT IN ('passed','held','declined') THEN RAISE EXCEPTION 'sale_not_scored_or_already_actioned'; END IF;
  IF p_decision IN ('approve','bypass') AND s.agent_id = uid THEN RAISE EXCEPTION 'cannot_approve_your_own_sale'; END IF;
  IF p_decision = 'approve' AND (s.qa->'red_flags') @> '[{"severity":"decline"}]'::jsonb THEN
    RAISE EXCEPTION 'sale_has_a_decline_red_flag: use Bypass with a reason if you have checked the call yourself';
  END IF;
  UPDATE public.care_sales SET supervisor_id = uid, supervisor_decision = p_decision, supervisor_note = left(p_note, 2000), supervisor_at = now(),
    status = CASE WHEN p_decision = 'decline' THEN 'declined' ELSE 'approved' END WHERE id = s.id;
  PERFORM public.care_log(NULL, s.customer_id, 'staff', uid, 'care_sale_' || p_decision,
    jsonb_build_object('sale_id', s.id, 'note', p_note, 'qa_decision', s.qa_decision, 'qa_score', s.qa_score, 'status_before', s.status));
  RETURN jsonb_build_object('ok', true);
END $function$;

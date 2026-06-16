-- Phase G correction: cancellation trigger improvements
-- 1) Expand auto-cancel guest_orders statuses
-- 2) Flag manual_review_required when guest_order in non-eligible status
-- 3) Surface admin_tasks insert failure via durable journey_cancellation_events
-- Switch to BEFORE UPDATE so we can mutate NEW.manual_review_required

DROP TRIGGER IF EXISTS trg_on_journey_cancelled ON public.order_journeys;

CREATE OR REPLACE FUNCTION public.on_journey_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_order_status text;
  v_auto_cancelable boolean := false;
  v_task_err text;
  v_task_ok boolean := false;
  v_needs_review boolean := false;
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    SELECT id, order_number, status::text
      INTO v_order_id, v_order_number, v_order_status
    FROM public.guest_orders
    WHERE admin_notes ILIKE '%journey:' || NEW.id::text || '%'
    LIMIT 1;

    -- Statuses eligible for automatic cancellation
    v_auto_cancelable := v_order_status IS NOT NULL AND v_order_status IN (
      'pending','pending_provisioning','submitted','received','new','draft','awaiting_payment','quote_continued'
    );

    IF v_auto_cancelable THEN
      UPDATE public.guest_orders
      SET status = 'cancelled',
          admin_notes = COALESCE(admin_notes,'') ||
            E'\n[journey-cancelled ' || to_char(now() at time zone 'UTC','YYYY-MM-DD HH24:MI:SS') ||
            ' UTC] reason=' || COALESCE(NEW.cancellation_reason,'(none)')
      WHERE id = v_order_id;
    ELSIF v_order_id IS NOT NULL AND v_order_status <> 'cancelled' THEN
      -- Non-eligible status (active/completed/compliance-locked): preserve order, flag for review
      v_needs_review := true;
      NEW.manual_review_required := true;
      UPDATE public.guest_orders
      SET admin_notes = COALESCE(admin_notes,'') ||
            E'\n[journey-cancelled-manual-review ' || to_char(now() at time zone 'UTC','YYYY-MM-DD HH24:MI:SS') ||
            ' UTC] order_status=' || v_order_status ||
            ' reason=' || COALESCE(NEW.cancellation_reason,'(none)')
      WHERE id = v_order_id;

      BEGIN
        INSERT INTO public.journey_cancellation_events
          (journey_id, event_type, reason_code, reason_text, actor_type, details)
        VALUES
          (NEW.id, 'reconciliation_required', NEW.cancellation_reason,
           'Linked guest_order in non-eligible status; manual review required.',
           'system',
           jsonb_build_object(
             'order_id', v_order_id,
             'order_number', v_order_number,
             'order_status', v_order_status,
             'timestamp', now()
           ));
      EXCEPTION WHEN OTHERS THEN
        NULL; -- event already logged via task; never break cancellation
      END;
    END IF;

    -- Always try to create an admin task for visibility
    BEGIN
      INSERT INTO public.admin_tasks
        (title, description, priority, status, source_module, related_id, related_type)
      VALUES (
        CASE WHEN v_needs_review
             THEN 'Cooling-off cancellation — MANUAL REVIEW required'
             ELSE 'Cooling-off cancellation — verify off-platform actions' END,
        'Customer cancelled unified-journey order ' || COALESCE(v_order_number,'(no linked order)') ||
        ' for journey ' || NEW.id::text ||
        '. Linked order status: ' || COALESCE(v_order_status,'(none)') ||
        '. Reason: ' || COALESCE(NEW.cancellation_reason,'(none)') ||
        '. Verify Giacom / supplier / billing pipelines for any manual cleanup.',
        'high', 'open', 'journey', NEW.id, 'order_journey'
      );
      v_task_ok := true;
    EXCEPTION WHEN OTHERS THEN
      v_task_err := SQLERRM;
      v_task_ok := false;
    END;

    -- Surface task creation failure via durable reconciliation event
    IF NOT v_task_ok THEN
      NEW.manual_review_required := true;
      BEGIN
        INSERT INTO public.journey_cancellation_events
          (journey_id, event_type, reason_code, reason_text, actor_type, details)
        VALUES
          (NEW.id, 'reconciliation_required', NEW.cancellation_reason,
           'admin_tasks insert failed; manual reconciliation required.',
           'system',
           jsonb_build_object(
             'failure', COALESCE(v_task_err,'unknown'),
             'order_id', v_order_id,
             'order_number', v_order_number,
             'order_status', v_order_status,
             'timestamp', now()
           ));
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- BEFORE UPDATE so trigger can set NEW.manual_review_required
CREATE TRIGGER trg_on_journey_cancelled
  BEFORE UPDATE ON public.order_journeys
  FOR EACH ROW
  EXECUTE FUNCTION public.on_journey_cancelled();
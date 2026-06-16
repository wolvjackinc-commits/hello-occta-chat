
ALTER TABLE public.order_journeys
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_notes text,
  ADD COLUMN IF NOT EXISTS cancellation_token_hash text,
  ADD COLUMN IF NOT EXISTS cancellation_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_token_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS link_nonce_hash text,
  ADD COLUMN IF NOT EXISTS link_nonce_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_customer_id uuid,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_review_required boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS order_journeys_cancel_token_hash_uidx
  ON public.order_journeys (cancellation_token_hash)
  WHERE cancellation_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS order_journeys_link_nonce_hash_uidx
  ON public.order_journeys (link_nonce_hash)
  WHERE link_nonce_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS order_journeys_linked_customer_idx
  ON public.order_journeys (linked_customer_id)
  WHERE linked_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.journey_cancellation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.order_journeys(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  reason_code text,
  reason_text text,
  confirmation_text_version text,
  ip text,
  ua text,
  actor_type text NOT NULL DEFAULT 'public',
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journey_cancellation_events_event_chk
    CHECK (event_type IN ('requested','confirmed','email_sent','email_failed','reconciliation_required')),
  CONSTRAINT journey_cancellation_events_actor_chk
    CHECK (actor_type IN ('public','customer','staff','system'))
);

CREATE INDEX IF NOT EXISTS journey_cancellation_events_journey_idx
  ON public.journey_cancellation_events (journey_id, created_at DESC);

GRANT SELECT ON public.journey_cancellation_events TO authenticated;
GRANT ALL ON public.journey_cancellation_events TO service_role;
ALTER TABLE public.journey_cancellation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS jce_owner_select ON public.journey_cancellation_events;
CREATE POLICY jce_owner_select ON public.journey_cancellation_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_journeys j
      WHERE j.id = journey_cancellation_events.journey_id
        AND j.linked_customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS jce_staff_select ON public.journey_cancellation_events;
CREATE POLICY jce_staff_select ON public.journey_cancellation_events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE OR REPLACE FUNCTION public.on_journey_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    SELECT id, order_number INTO v_order_id, v_order_number
    FROM public.guest_orders
    WHERE admin_notes ILIKE '%journey:' || NEW.id::text || '%'
    LIMIT 1;

    IF v_order_id IS NOT NULL THEN
      UPDATE public.guest_orders
      SET status = 'cancelled',
          admin_notes = COALESCE(admin_notes,'') || E'\n[journey-cancelled ' || to_char(now() at time zone 'UTC','YYYY-MM-DD HH24:MI:SS') || ' UTC] reason=' || COALESCE(NEW.cancellation_reason,'(none)')
      WHERE id = v_order_id
        AND status IN ('pending_provisioning','pending','submitted','received','new');
    END IF;

    BEGIN
      INSERT INTO public.admin_tasks (title, description, priority, status, source_module, related_id, related_type)
      VALUES (
        'Cooling-off cancellation — verify off-platform actions',
        'Customer cancelled unified-journey order ' || COALESCE(v_order_number, '(no linked order)') ||
        ' for journey ' || NEW.id::text ||
        '. Reason: ' || COALESCE(NEW.cancellation_reason,'(none)') ||
        '. Check Giacom / supplier / billing pipelines for any manual cleanup.',
        'high',
        'open',
        'journey',
        NEW.id,
        'order_journey'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_journey_cancelled ON public.order_journeys;
CREATE TRIGGER trg_on_journey_cancelled
  AFTER UPDATE ON public.order_journeys
  FOR EACH ROW
  EXECUTE FUNCTION public.on_journey_cancelled();

-- Lock journey_cancellation_events base table to staff-only reads; expose a
-- safe view without ip/ua for customers.
DROP POLICY IF EXISTS jce_owner_select ON public.journey_cancellation_events;

CREATE OR REPLACE VIEW public.customer_journey_cancellation_events
WITH (security_invoker = on) AS
SELECT
  e.id,
  e.journey_id,
  e.event_type,
  e.reason_code,
  e.reason_text,
  e.confirmation_text_version,
  e.actor_type,
  e.details,
  e.created_at
FROM public.journey_cancellation_events e
WHERE EXISTS (
  SELECT 1 FROM public.order_journeys j
  WHERE j.id = e.journey_id
    AND j.linked_customer_id = auth.uid()
);

GRANT SELECT ON public.customer_journey_cancellation_events TO authenticated;
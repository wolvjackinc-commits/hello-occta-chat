
-- Drop customer base-table read policies exposing internal fields
DROP POLICY IF EXISTS "customers read own history" ON public.cancellation_case_history;
DROP POLICY IF EXISTS "qe_customer_select_own" ON public.quote_events;

-- Column-whitelisted views for customers (no metadata/details jsonb, no actor internals)
CREATE OR REPLACE VIEW public.cancellation_case_history_customer
WITH (security_invoker = true) AS
SELECT h.id, h.case_id, h.from_status, h.to_status, h.reason, h.created_at
FROM public.cancellation_case_history h
WHERE EXISTS (
  SELECT 1 FROM public.service_cancellation_cases c
  WHERE c.id = h.case_id AND c.customer_id = auth.uid()
);

CREATE OR REPLACE VIEW public.quote_events_customer
WITH (security_invoker = true) AS
SELECT e.id, e.quote_request_id, e.quote_id, e.contract_summary_id,
       e.event_type, e.title, e.created_at
FROM public.quote_events e
WHERE e.quote_request_id IN (SELECT id FROM public.quote_requests WHERE customer_id = auth.uid())
   OR e.quote_id IN (SELECT id FROM public.quotes WHERE customer_id = auth.uid());

GRANT SELECT ON public.cancellation_case_history_customer TO authenticated;
GRANT SELECT ON public.quote_events_customer TO authenticated;

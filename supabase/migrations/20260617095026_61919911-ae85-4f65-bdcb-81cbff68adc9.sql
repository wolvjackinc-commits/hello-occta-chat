-- 1. contract_acceptances: drop customer base-table SELECT; expose whitelisted view.
DROP POLICY IF EXISTS ca_customer_select_own ON public.contract_acceptances;

CREATE OR REPLACE VIEW public.customer_contract_acceptances
WITH (security_barrier = true) AS
SELECT
  id, contract_summary_id, quote_id, quote_request_id, customer_id, account_number,
  accepted_by_name, accepted_by_email, accepted_at, accepted_at_europe_london,
  acceptance_text, acceptance_text_version, cs_version, terms_version, privacy_version,
  checkbox_confirmed, address_confirmed, checkbox_received_read, checkbox_details_correct,
  checkbox_understand_charges, checkbox_consent, journey_id, source_route, created_at
FROM public.contract_acceptances
WHERE customer_id IS NOT NULL AND customer_id = auth.uid();

ALTER VIEW public.customer_contract_acceptances OWNER TO postgres;
REVOKE ALL ON public.customer_contract_acceptances FROM PUBLIC;
REVOKE ALL ON public.customer_contract_acceptances FROM anon;
GRANT SELECT ON public.customer_contract_acceptances TO authenticated;

-- 2. order_journeys: drop customer base-table SELECT; expose whitelisted view.
DROP POLICY IF EXISTS "Customers read their own journey" ON public.order_journeys;

DROP POLICY IF EXISTS oj_staff_select_all ON public.order_journeys;
CREATE POLICY oj_staff_select_all
ON public.order_journeys
FOR SELECT
TO authenticated
USING (is_staff(auth.uid()));

CREATE OR REPLACE VIEW public.customer_order_journeys
WITH (security_barrier = true) AS
SELECT
  id, quote_id, contract_summary_id, contract_acceptance_id, customer_id,
  current_step, status, decline_reason, declined_at,
  quote_continued_at, contract_accepted_at,
  cooling_off_ends_at, cooling_off_acknowledged, cooling_off_acknowledged_at,
  preferred_start_date, start_date_selected_at, earliest_selectable_start_date,
  payment_method, billing_anchor_day,
  submitted_at, completed_at, consolidated_email_sent_at,
  cancelled_at, cancellation_reason, order_id, created_at, updated_at
FROM public.order_journeys
WHERE customer_id = auth.uid();

ALTER VIEW public.customer_order_journeys OWNER TO postgres;
REVOKE ALL ON public.customer_order_journeys FROM PUBLIC;
REVOKE ALL ON public.customer_order_journeys FROM anon;
GRANT SELECT ON public.customer_order_journeys TO authenticated;

-- 3. quote_requests: remove the JWT-email fallback in customer SELECT policy.
DROP POLICY IF EXISTS qr_customer_select_own ON public.quote_requests;

CREATE POLICY qr_customer_select_own
ON public.quote_requests
FOR SELECT
TO authenticated
USING (customer_id IS NOT NULL AND customer_id = auth.uid());
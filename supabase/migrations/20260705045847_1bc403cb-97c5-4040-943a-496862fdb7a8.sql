-- Restrict customer access to services and service_cancellation_cases via column-whitelisted views.
-- Base tables become staff-only for SELECT; customers read safe columns through views.

-- 1) customer_services view
CREATE OR REPLACE VIEW public.customer_services
WITH (security_invoker = on) AS
SELECT
  id,
  user_id,
  service_type,
  plan_name,
  status,
  activation_date,
  actual_activation_date,
  price_monthly,
  billing_anchor_day,
  billing_enabled,
  next_billing_date,
  minimum_term_months,
  minimum_term_end_date,
  notice_period_days,
  contract_type,
  service_address,
  selected_addons,
  order_id,
  contract_summary_id,
  journey_id,
  created_at,
  updated_at
FROM public.services
WHERE user_id = auth.uid();

GRANT SELECT ON public.customer_services TO authenticated;

-- 2) customer_cancellation_cases view (whitelist columns + safe customer_preview jsonb)
CREATE OR REPLACE VIEW public.customer_cancellation_cases
WITH (security_invoker = on) AS
SELECT
  id,
  customer_id,
  service_id,
  order_id,
  contract_summary_id,
  status,
  source,
  reason_code,
  notes,
  requested_date,
  proposed_cease_date,
  actual_cease_date,
  notice_period_days,
  minimum_term_end_date,
  approved_at,
  withdrawn_at,
  withdrawn_reason,
  supplier_confirmed_cease_date,
  cease_committed_at,
  completed_at,
  jsonb_build_object(
    'proposed_cease_date', preview_snapshot->>'proposed_cease_date',
    'notice_period_days',  preview_snapshot->'notice_period_days',
    'unbilled_service_minor', preview_snapshot->'unbilled_service_minor',
    'unpaid_invoices_minor', preview_snapshot->'unpaid_invoices_minor',
    'etf_minor',           preview_snapshot->'etf_minor',
    'credits_minor',       preview_snapshot->'credits_minor',
    'final_balance_minor', preview_snapshot->'final_balance_minor'
  ) AS customer_preview,
  created_at,
  updated_at
FROM public.service_cancellation_cases
WHERE customer_id = auth.uid();

GRANT SELECT ON public.customer_cancellation_cases TO authenticated;

-- 3) Lock base-table SELECT to staff only. Customers must go via the views.
DROP POLICY IF EXISTS services_select_own ON public.services;
CREATE POLICY services_admin_select
  ON public.services
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "customers can view own cancellation cases" ON public.service_cancellation_cases;
-- The pre-existing "admins manage cancellation cases" ALL policy already covers staff SELECT;
-- no separate customer SELECT policy remains on the base table.

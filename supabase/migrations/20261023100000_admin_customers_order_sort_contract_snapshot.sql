-- Admin Customers list: newest orders first + contract snapshot at a glance.
--
-- 1. Security: the view previously ran with its owner's rights and was granted
--    to `anon`, so anyone holding the public site key could read every
--    customer's name, email, phone and date of birth. It now runs with the
--    caller's rights (RLS applies) and anon/authenticated non-admins get nothing.
-- 2. Ordering: `latest_order_at` is when the customer's most recent order
--    actually came in (order, guest order or signed Contract Summary). Profile
--    edits no longer push old customers to the top.
-- 3. Contract snapshot: what the customer signed for — plan, monthly price,
--    router, setup/installation and other one-off charges, add-ons — so staff
--    can check an incoming order without opening the PDF.
-- Columns are only appended, so CREATE OR REPLACE keeps existing consumers working.

CREATE OR REPLACE VIEW public.admin_customer_search_view
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.full_name,
  p.email,
  p.phone,
  p.account_number,
  p.date_of_birth,
  p.created_at,
  p.updated_at,
  COALESCE(latest_order.postcode, latest_guest.postcode, p.postcode) AS latest_postcode,
  upper(replace(COALESCE(latest_order.postcode, latest_guest.postcode, p.postcode), ' ', '')) AS latest_postcode_normalized,
  GREATEST(
    p.created_at,
    COALESCE(p.updated_at, p.created_at),
    COALESCE(latest_order.created_at, p.created_at),
    COALESCE(latest_guest.created_at, p.created_at)
  ) AS latest_activity_at,
  -- When the most recent order came in (NULL = never ordered/signed).
  NULLIF(GREATEST(
    COALESCE(latest_order.created_at, '-infinity'::timestamptz),
    COALESCE(any_guest.created_at, '-infinity'::timestamptz),
    COALESCE(cs.accepted_at, '-infinity'::timestamptz)
  ), '-infinity'::timestamptz) AS latest_order_at,
  (latest_order.created_at IS NOT NULL OR any_guest.created_at IS NOT NULL) AS has_submitted_order,
  cs.id AS cs_id,
  cs.cs_number,
  cs.status AS cs_status,
  cs.accepted_at AS cs_accepted_at,
  cs.service_type AS cs_service_type,
  cs.plan_name AS cs_plan_name,
  cs.plan_term AS cs_plan_term,
  cs.minimum_term_months AS cs_minimum_term_months,
  cs.monthly_price_incl_vat AS cs_monthly_price_incl_vat,
  cs.router_option AS cs_router_option,
  cs.router_charge AS cs_router_charge,
  cs.setup_option AS cs_setup_option,
  cs.setup_charge AS cs_setup_charge,
  cs.installation_charge AS cs_installation_charge,
  cs.delivery_charge AS cs_delivery_charge,
  cs.one_off_charges_snapshot AS cs_one_off_charges,
  cs.selected_addons AS cs_selected_addons,
  cs.digital_voice_addon_snapshot AS cs_digital_voice,
  cs.likely_service_date AS cs_likely_service_date,
  EXISTS (SELECT 1 FROM public.services s WHERE s.user_id = p.id) AS has_service
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT o.postcode, o.created_at
  FROM public.orders o
  WHERE o.user_id = p.id OR o.customer_id = p.id
  ORDER BY o.created_at DESC
  LIMIT 1
) latest_order ON true
LEFT JOIN LATERAL (
  SELECT g.postcode, g.created_at
  FROM public.guest_orders g
  WHERE g.user_id = p.id
  ORDER BY g.created_at DESC
  LIMIT 1
) latest_guest ON latest_order.postcode IS NULL
LEFT JOIN LATERAL (
  SELECT g.created_at
  FROM public.guest_orders g
  WHERE g.user_id = p.id
  ORDER BY g.created_at DESC
  LIMIT 1
) any_guest ON true
LEFT JOIN LATERAL (
  SELECT c.*
  FROM public.contract_summaries c
  WHERE c.customer_id = p.id
    AND c.is_information_update IS NOT TRUE
    AND c.archived_at IS NULL
    AND c.status <> 'superseded'
  ORDER BY (c.status = 'accepted') DESC, c.accepted_at DESC NULLS LAST, c.created_at DESC
  LIMIT 1
) cs ON true
WHERE p.archived_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.role = ANY (ARRAY['admin'::public.app_role, 'super_admin'::public.app_role])
  );

-- Customer data is admin-only; the anonymous site key must never read it.
REVOKE ALL ON public.admin_customer_search_view FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.admin_customer_search_view FROM authenticated;
GRANT SELECT ON public.admin_customer_search_view TO authenticated;

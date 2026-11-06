-- Fix: Admin → Customers "Failed to load customers".
-- admin_customer_search_view runs as the logged-in admin (security_invoker) and
-- 20261105 added is_care_only, which read care_subscriptions / care_applications.
-- Those tables are server-only (no SELECT for authenticated), so the whole view
-- errored with "permission denied". Read them through a staff-only definer helper.

CREATE OR REPLACE FUNCTION public.has_care_record(p_customer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(auth.uid()) AND (
    EXISTS (SELECT 1 FROM public.care_subscriptions WHERE customer_id = p_customer_id)
    OR EXISTS (SELECT 1 FROM public.care_applications WHERE customer_id = p_customer_id));
$$;
REVOKE ALL ON FUNCTION public.has_care_record(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_care_record(uuid) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.admin_customer_search_view WITH (security_invoker = true) AS
 SELECT p.id,
    p.full_name,
    p.email,
    p.phone,
    p.account_number,
    p.date_of_birth,
    p.created_at,
    p.updated_at,
    COALESCE(latest_order.postcode, latest_guest.postcode, p.postcode) AS latest_postcode,
    upper(replace(COALESCE(latest_order.postcode, latest_guest.postcode, p.postcode), ' '::text, ''::text)) AS latest_postcode_normalized,
    GREATEST(p.created_at, COALESCE(p.updated_at, p.created_at), COALESCE(latest_order.created_at, p.created_at), COALESCE(latest_guest.created_at, p.created_at)) AS latest_activity_at,
    NULLIF(GREATEST(COALESCE(latest_order.created_at, '-infinity'::timestamp with time zone), COALESCE(any_guest.created_at, '-infinity'::timestamp with time zone), COALESCE(cs.accepted_at, '-infinity'::timestamp with time zone)), '-infinity'::timestamp with time zone) AS latest_order_at,
    latest_order.created_at IS NOT NULL OR any_guest.created_at IS NOT NULL AS has_submitted_order,
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
    (EXISTS (SELECT 1 FROM services s WHERE s.user_id = p.id)) AS has_service,
    public.has_care_record(p.id)
      AND latest_order.created_at IS NULL AND any_guest.created_at IS NULL AND cs.id IS NULL
      AND NOT (EXISTS (SELECT 1 FROM services s WHERE s.user_id = p.id)) AS is_care_only
   FROM profiles p
     LEFT JOIN LATERAL (SELECT o.postcode, o.created_at FROM orders o
          WHERE o.user_id = p.id OR o.customer_id = p.id
          ORDER BY o.created_at DESC LIMIT 1) latest_order ON true
     LEFT JOIN LATERAL (SELECT g.postcode, g.created_at FROM guest_orders g
          WHERE g.user_id = p.id ORDER BY g.created_at DESC LIMIT 1) latest_guest ON latest_order.postcode IS NULL
     LEFT JOIN LATERAL (SELECT g.created_at FROM guest_orders g
          WHERE g.user_id = p.id ORDER BY g.created_at DESC LIMIT 1) any_guest ON true
     LEFT JOIN LATERAL (SELECT c.* FROM contract_summaries c
          WHERE c.customer_id = p.id AND c.is_information_update IS NOT TRUE AND c.archived_at IS NULL
            AND c.status <> 'superseded'::contract_summary_status_kind
          ORDER BY (c.status = 'accepted'::contract_summary_status_kind) DESC, c.accepted_at DESC NULLS LAST, c.created_at DESC
          LIMIT 1) cs ON true
  WHERE p.archived_at IS NULL AND NOT (EXISTS (SELECT 1 FROM user_roles ur
          WHERE ur.user_id = p.id AND (ur.role = ANY (ARRAY['admin'::app_role, 'super_admin'::app_role]))));

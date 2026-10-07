-- Surface newly active/reused customers by their latest operational activity,
-- not only by the date the underlying profile was first created.
CREATE OR REPLACE VIEW public.admin_customer_search_view AS
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
  ) AS latest_activity_at
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
WHERE p.archived_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.role = ANY (ARRAY['admin'::public.app_role, 'super_admin'::public.app_role])
  );

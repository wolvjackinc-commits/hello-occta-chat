-- Drop and recreate the view with LEFT JOIN LATERAL for better performance
DROP VIEW IF EXISTS admin_customer_search_view;

CREATE VIEW admin_customer_search_view AS
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
  UPPER(REPLACE(COALESCE(latest_order.postcode, latest_guest.postcode, p.postcode), ' ', '')) AS latest_postcode_normalized
FROM profiles p
LEFT JOIN LATERAL (
  SELECT postcode, created_at
  FROM orders
  WHERE orders.user_id = p.id
  ORDER BY created_at DESC
  LIMIT 1
) latest_order ON true
LEFT JOIN LATERAL (
  SELECT postcode, created_at
  FROM guest_orders
  WHERE guest_orders.user_id = p.id
  ORDER BY created_at DESC
  LIMIT 1
) latest_guest ON latest_order.postcode IS NULL;

-- Add comment to document admin-only access
COMMENT ON VIEW admin_customer_search_view IS 'Admin-only view for customer search. Inherits RLS from profiles table via security_invoker.';

-- Ensure the view uses security invoker (inherits caller RLS)
ALTER VIEW admin_customer_search_view SET (security_invoker = true);

-- The profiles table already has proper RLS:
-- - "Admins can view all profiles" (SELECT for admins)
-- - "Deny anonymous access to profiles" (blocks anon)
-- - "Users can view their own profile" (users see only themselves)

-- The orders table already has proper RLS:
-- - "Admins can view all orders" (SELECT for admins)
-- - "Users can view their own orders" (users see only themselves)

-- The guest_orders table already has proper RLS:
-- - "Admins can manage all guest orders" (ALL for admins)
-- - "Deny anonymous access to guest orders" (blocks anon)
-- - "Users can view their linked orders" (users see only their linked orders)

-- All tables have RLS enabled and proper policies - no changes needed
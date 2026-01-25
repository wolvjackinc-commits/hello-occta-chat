-- Fix the view to use security invoker (caller's permissions) instead of definer
-- This ensures RLS policies are respected based on the querying user
ALTER VIEW admin_customer_search_view SET (security_invoker = true);
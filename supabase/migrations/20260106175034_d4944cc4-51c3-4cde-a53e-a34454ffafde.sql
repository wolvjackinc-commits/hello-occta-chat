-- Drop the dangerous RLS policy that exposes unlinked guest orders
DROP POLICY IF EXISTS "Allow selecting unlinked orders by order_number" ON public.guest_orders;
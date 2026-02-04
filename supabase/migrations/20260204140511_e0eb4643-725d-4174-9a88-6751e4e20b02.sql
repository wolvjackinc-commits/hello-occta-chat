-- Fix RLS policy for guest_orders to allow anonymous users to submit orders
-- Currently only admins can insert, but guest checkout requires anon insert

-- Drop the restrictive admin-only insert policy
DROP POLICY IF EXISTS "Only admins can insert guest orders" ON public.guest_orders;

-- Create new policy allowing anonymous users to insert guest orders
CREATE POLICY "Anyone can create guest orders" 
ON public.guest_orders 
FOR INSERT 
TO public
WITH CHECK (true);

-- Note: The existing SELECT policies correctly restrict viewing to:
-- 1. Admins (can see all)
-- 2. Users who have linked their orders (user_id = auth.uid())
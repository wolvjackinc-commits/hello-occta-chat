-- Add explicit denial of anonymous access to profiles table
-- This ensures unauthenticated users cannot access profile data even if RLS is bypassed
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add explicit denial of anonymous access to guest_orders table
-- This ensures unauthenticated users cannot access guest order data
CREATE POLICY "Deny anonymous access to guest orders"
ON public.guest_orders
FOR SELECT
USING (auth.uid() IS NOT NULL);
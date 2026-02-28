
-- Drop the restrictive INSERT policies
DROP POLICY IF EXISTS "Anon can create validated guest orders" ON public.guest_orders;
DROP POLICY IF EXISTS "Authenticated can create validated guest orders" ON public.guest_orders;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Anon can create validated guest orders"
ON public.guest_orders
FOR INSERT
TO anon
WITH CHECK (
  (gdpr_consent = true)
  AND (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'::text)
  AND (length(full_name) >= 2) AND (length(full_name) <= 120)
  AND (length(phone) >= 7) AND (length(phone) <= 30)
  AND (length(postcode) >= 5) AND (length(postcode) <= 10)
  AND (length(address_line1) >= 3) AND (length(address_line1) <= 200)
  AND (length(city) >= 2) AND (length(city) <= 100)
  AND (length(plan_name) >= 1)
  AND (length(service_type) >= 1)
  AND (user_id IS NULL)
  AND (status = 'pending'::text)
);

CREATE POLICY "Authenticated can create validated guest orders"
ON public.guest_orders
FOR INSERT
TO authenticated
WITH CHECK (
  (gdpr_consent = true)
  AND (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'::text)
  AND (length(full_name) >= 2) AND (length(full_name) <= 120)
  AND (length(phone) >= 7) AND (length(phone) <= 30)
  AND (length(postcode) >= 5) AND (length(postcode) <= 10)
  AND (length(address_line1) >= 3) AND (length(address_line1) <= 200)
  AND (length(city) >= 2) AND (length(city) <= 100)
  AND (length(plan_name) >= 1)
  AND (length(service_type) >= 1)
  AND (status = 'pending'::text)
);

-- Also fix the SELECT/UPDATE/DELETE policies that need to be permissive for admins
-- The admin ALL policy should be permissive so admins can actually access
DROP POLICY IF EXISTS "Admins can manage all guest orders" ON public.guest_orders;
CREATE POLICY "Admins can manage all guest orders"
ON public.guest_orders
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fix SELECT policies - need at least one permissive
DROP POLICY IF EXISTS "Deny anonymous access to guest orders" ON public.guest_orders;
DROP POLICY IF EXISTS "Users can view their linked orders" ON public.guest_orders;
DROP POLICY IF EXISTS "Users can view their own linked orders" ON public.guest_orders;

CREATE POLICY "Deny anonymous access to guest orders"
ON public.guest_orders
FOR SELECT
TO anon
USING (false);

CREATE POLICY "Users can view their own linked orders"
ON public.guest_orders
FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Fix UPDATE policies
DROP POLICY IF EXISTS "Users can update their linked orders" ON public.guest_orders;
DROP POLICY IF EXISTS "Users can update their own linked orders" ON public.guest_orders;

CREATE POLICY "Users can update their own linked orders"
ON public.guest_orders
FOR UPDATE
TO authenticated
USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Fix DELETE policy
DROP POLICY IF EXISTS "Only admins can delete guest orders" ON public.guest_orders;
CREATE POLICY "Only admins can delete guest orders"
ON public.guest_orders
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

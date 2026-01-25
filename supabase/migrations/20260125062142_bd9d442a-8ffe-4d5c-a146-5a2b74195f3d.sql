-- Fix 1: Add RLS policies for guest_orders table
-- Users can only see their own linked orders, admins can see all

CREATE POLICY "Users can view their own linked orders"
ON public.guest_orders
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR public.is_admin()
);

CREATE POLICY "Users can update their own linked orders"
ON public.guest_orders
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR public.is_admin()
);

CREATE POLICY "Only admins can insert guest orders"
ON public.guest_orders
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete guest orders"
ON public.guest_orders
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Fix 2: Add RLS policies for technicians table (admin only)

CREATE POLICY "Only admins can view technicians"
ON public.technicians
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Only admins can insert technicians"
ON public.technicians
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update technicians"
ON public.technicians
FOR UPDATE
TO authenticated
USING (public.is_admin());

CREATE POLICY "Only admins can delete technicians"
ON public.technicians
FOR DELETE
TO authenticated
USING (public.is_admin());
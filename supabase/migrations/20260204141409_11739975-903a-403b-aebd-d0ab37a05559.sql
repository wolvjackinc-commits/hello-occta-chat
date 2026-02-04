-- Fix RLS: Explicitly allow anon role to insert guest orders
-- The previous policy targeted 'public' but we need to explicitly allow 'anon' role

-- Drop the existing insert policy
DROP POLICY IF EXISTS "Anyone can create guest orders" ON public.guest_orders;

-- Create explicit policy for anon role to insert
CREATE POLICY "Anon can create guest orders" 
ON public.guest_orders 
FOR INSERT 
TO anon
WITH CHECK (true);

-- Also allow authenticated users to create guest orders (edge case where they're logged in but use guest checkout)
CREATE POLICY "Authenticated can create guest orders" 
ON public.guest_orders 
FOR INSERT 
TO authenticated
WITH CHECK (true);
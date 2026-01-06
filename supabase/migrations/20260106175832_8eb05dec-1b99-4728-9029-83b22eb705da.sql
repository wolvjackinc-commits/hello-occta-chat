-- Add date_of_birth column to guest_orders for proper verification
ALTER TABLE public.guest_orders ADD COLUMN IF NOT EXISTS date_of_birth date NULL;

-- Drop the overly permissive RLS policy for guest order creation
DROP POLICY IF EXISTS "Anyone can create guest orders" ON public.guest_orders;

-- Create a new policy that validates GDPR consent is true for inserts
-- This ensures the user has consented before creating an order
CREATE POLICY "Guest orders require GDPR consent" 
ON public.guest_orders 
FOR INSERT 
WITH CHECK (gdpr_consent = true);
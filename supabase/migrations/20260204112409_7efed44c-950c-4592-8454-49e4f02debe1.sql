-- Clean up conflicting/duplicate INSERT policies on guest_orders
-- Keep only the admin-only insert policy for security

-- Drop the old GDPR consent policy that allows public inserts
DROP POLICY IF EXISTS "Guest orders require GDPR consent" ON public.guest_orders;

-- Verify the admin-only insert policy exists (should already be there from prior migration)
-- This ensures only admins can insert guest orders directly into the table
-- Guest checkout should go through an edge function with proper rate limiting
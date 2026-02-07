
-- Tighten guest_orders INSERT policies to enforce server-side validation
-- instead of WITH CHECK (true)

-- Drop the overly permissive INSERT policies
DROP POLICY IF EXISTS "Anon can create guest orders" ON public.guest_orders;
DROP POLICY IF EXISTS "Authenticated can create guest orders" ON public.guest_orders;

-- Create validated INSERT policy for anonymous users
CREATE POLICY "Anon can create validated guest orders"
ON public.guest_orders
FOR INSERT
TO anon
WITH CHECK (
  gdpr_consent = true
  AND email ~* '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
  AND length(full_name) >= 2
  AND length(full_name) <= 120
  AND length(phone) >= 7
  AND length(phone) <= 30
  AND length(postcode) >= 5
  AND length(postcode) <= 10
  AND length(address_line1) >= 3
  AND length(address_line1) <= 200
  AND length(city) >= 2
  AND length(city) <= 100
  AND length(plan_name) >= 1
  AND length(service_type) >= 1
  AND user_id IS NULL
  AND status = 'pending'
);

-- Create validated INSERT policy for authenticated users
CREATE POLICY "Authenticated can create validated guest orders"
ON public.guest_orders
FOR INSERT
TO authenticated
WITH CHECK (
  gdpr_consent = true
  AND email ~* '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
  AND length(full_name) >= 2
  AND length(full_name) <= 120
  AND length(phone) >= 7
  AND length(phone) <= 30
  AND length(postcode) >= 5
  AND length(postcode) <= 10
  AND length(address_line1) >= 3
  AND length(address_line1) <= 200
  AND length(city) >= 2
  AND length(city) <= 100
  AND length(plan_name) >= 1
  AND length(service_type) >= 1
  AND status = 'pending'
);

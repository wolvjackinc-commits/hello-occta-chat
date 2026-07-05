DROP POLICY IF EXISTS "Authenticated can create validated guest orders" ON public.guest_orders;

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
  AND (user_id IS NULL OR user_id = auth.uid())
);
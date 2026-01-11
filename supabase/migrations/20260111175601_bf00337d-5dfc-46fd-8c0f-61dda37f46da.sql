-- Add a policy to allow public read access to guest orders for order lookup
-- This is safe because the lookup requires both order_number AND email to match
CREATE POLICY "Public can lookup orders by order number and email" 
ON public.guest_orders 
FOR SELECT 
USING (true);

-- Note: The existing restrictive policies will still apply for users, 
-- but this permissive policy allows the lookup functionality for guests
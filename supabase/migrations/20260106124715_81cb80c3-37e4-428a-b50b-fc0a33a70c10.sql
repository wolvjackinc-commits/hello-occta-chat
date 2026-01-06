-- Add a policy to allow selecting by order_number for linking purposes
CREATE POLICY "Allow selecting unlinked orders by order_number"
ON public.guest_orders
FOR SELECT
USING (user_id IS NULL);
-- Allow authenticated users to create payment requests for themselves
CREATE POLICY "Users can create own payment requests"
ON public.payment_requests
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own payment requests
CREATE POLICY "Users can view own payment requests"
ON public.payment_requests
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own guest orders"
ON public.guest_orders
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);
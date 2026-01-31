-- Fix profiles SELECT visibility: current SELECT policies are RESTRICTIVE and get AND-ed,
-- which can unintentionally block admin reads (e.g., requiring both admin role AND auth.uid()=id).

-- Recreate policies as PERMISSIVE so either condition can grant access.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = id);

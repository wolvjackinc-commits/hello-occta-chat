-- Fix the restrictive policy that blocks all access
-- The current policy uses USING(false) which blocks everyone including admins
-- Change it to only block anonymous users

DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;

-- Create a proper restrictive policy that denies anonymous users only
CREATE POLICY "Deny anonymous access to profiles" 
ON public.profiles 
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
-- FIX: Add RESTRICTIVE policy to completely block anonymous/unauthenticated access to profiles
-- This policy acts as a gatekeeper - ALL access requires authentication first

-- First, ensure RLS is enabled and forced (even for table owner)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Add a RESTRICTIVE policy that blocks anonymous users completely
-- RESTRICTIVE policies use AND logic with PERMISSIVE policies
-- This means: user must be authenticated AND pass one of the PERMISSIVE policies
CREATE POLICY "Block all anonymous access to profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);

-- Update existing policies to target only 'authenticated' role for defense in depth
-- Drop and recreate SELECT policies with proper role targeting

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Drop and recreate UPDATE policies with proper role targeting
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Drop and recreate INSERT policy with proper role targeting
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);
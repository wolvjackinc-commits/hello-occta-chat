-- FIX: Remove the problematic "Deny anonymous access to profiles" policy
-- This policy is PERMISSIVE and checks (auth.uid() IS NOT NULL), which means
-- ANY authenticated user gets access to ALL profiles, bypassing the owner-specific policy.
-- The fix is to remove it entirely and rely only on proper owner/admin policies.

-- Drop the problematic policy that grants access to all authenticated users
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;

-- Verify the remaining policies are correct:
-- 1. "Users can view their own profile" - (auth.uid() = id) - CORRECT
-- 2. "Admins can view all profiles" - has_role check - CORRECT
-- 3. "Users can update their own profile" - (auth.uid() = id) - CORRECT
-- 4. "Admins can update all profiles" - has_role check - CORRECT
-- 5. "Users can insert their own profile" - (auth.uid() = id) - CORRECT

-- These policies are already correct and restrict access to:
-- - Users can only see/modify their OWN profile (auth.uid() = id)
-- - Admins can see/modify ALL profiles (has_role check)
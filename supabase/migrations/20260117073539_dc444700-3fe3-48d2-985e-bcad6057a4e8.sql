-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can insert deletion records" ON public.account_deletions;

-- The account_deletions table should only be written by edge functions using service role key
-- No frontend policy needed - the service role bypasses RLS
-- This is intentional as only the delete-account edge function should insert records
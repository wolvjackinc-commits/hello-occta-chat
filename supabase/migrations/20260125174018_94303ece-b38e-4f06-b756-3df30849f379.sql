-- Fix RLS warning on rate_limits table (not used by customer search view, but needs policies)
-- This table is used internally for rate limiting, should only be accessible via security definer functions

-- Allow service role / internal functions only (no direct user access)
CREATE POLICY "rate_limits_internal_only"
ON public.rate_limits
FOR ALL
USING (false)
WITH CHECK (false);

-- Note: The check_rate_limit function uses SECURITY DEFINER so it bypasses RLS
-- This policy ensures no direct table access from client
-- Create rate_limits table for tracking request frequency
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS rate_limits_lookup_idx 
ON public.rate_limits (identifier, action, window_start);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct access policies - only accessed via function
-- This prevents users from manipulating their own rate limits

-- Create rate limiting function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _identifier text,
  _action text,
  _max_requests integer DEFAULT 5,
  _window_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total_count integer;
BEGIN
  -- Clean up old entries (older than 2 hours)
  DELETE FROM rate_limits 
  WHERE window_start < now() - interval '2 hours';
  
  -- Count requests in the current window
  SELECT COALESCE(SUM(request_count), 0) INTO _total_count
  FROM rate_limits
  WHERE identifier = _identifier
    AND action = _action
    AND window_start > now() - (_window_minutes || ' minutes')::interval;
  
  -- Check if limit exceeded
  IF _total_count >= _max_requests THEN
    RETURN false;
  END IF;
  
  -- Record this request
  INSERT INTO rate_limits (identifier, action, request_count, window_start)
  VALUES (_identifier, _action, 1, now());
  
  RETURN true;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO anon;
-- Fix security issues for chat_analytics

-- Drop the security definer view and recreate with invoker security
DROP VIEW IF EXISTS public.chat_analytics_summary;

-- Recreate view with SECURITY INVOKER (default, respects RLS of querying user)
CREATE VIEW public.chat_analytics_summary 
WITH (security_invoker = true)
AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  detected_intent,
  detected_category,
  COUNT(*) FILTER (WHERE message_type = 'user') as user_messages,
  COUNT(*) FILTER (WHERE message_type = 'assistant') as assistant_messages,
  COUNT(DISTINCT session_id) as unique_sessions,
  AVG(response_time_ms) FILTER (WHERE response_time_ms IS NOT NULL) as avg_response_time_ms,
  COUNT(*) FILTER (WHERE was_helpful = true) as helpful_count,
  COUNT(*) FILTER (WHERE was_helpful = false) as unhelpful_count
FROM public.chat_analytics
GROUP BY DATE_TRUNC('day', created_at), detected_intent, detected_category
ORDER BY date DESC;

-- Drop the overly permissive insert policy
DROP POLICY IF EXISTS "Service role can insert chat analytics" ON public.chat_analytics;

-- Create a more restrictive insert policy - only authenticated users can insert their own analytics
CREATE POLICY "Users can insert their own chat analytics"
ON public.chat_analytics
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Allow anonymous inserts for non-logged-in users (tracked by session_id only)
CREATE POLICY "Anonymous users can insert chat analytics"
ON public.chat_analytics
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);
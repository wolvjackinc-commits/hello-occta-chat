-- Create chat_analytics table for tracking IRA conversation data
CREATE TABLE public.chat_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('user', 'assistant')),
  message_content TEXT NOT NULL,
  detected_intent TEXT,
  detected_category TEXT,
  tool_used TEXT,
  response_time_ms INTEGER,
  was_helpful BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_chat_analytics_session ON public.chat_analytics(session_id);
CREATE INDEX idx_chat_analytics_intent ON public.chat_analytics(detected_intent);
CREATE INDEX idx_chat_analytics_created_at ON public.chat_analytics(created_at);
CREATE INDEX idx_chat_analytics_user_id ON public.chat_analytics(user_id);

-- Enable RLS
ALTER TABLE public.chat_analytics ENABLE ROW LEVEL SECURITY;

-- Admins can view all analytics
CREATE POLICY "Admins can view all chat analytics"
ON public.chat_analytics
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow insert from edge function (service role)
CREATE POLICY "Service role can insert chat analytics"
ON public.chat_analytics
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create a view for analytics summary (admin only)
CREATE OR REPLACE VIEW public.chat_analytics_summary AS
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
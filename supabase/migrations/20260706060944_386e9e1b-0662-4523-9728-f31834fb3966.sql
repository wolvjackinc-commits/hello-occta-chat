
-- Fix 1: ticket_messages — prevent customers from spoofing staff replies
DROP POLICY IF EXISTS "Users can add messages to their tickets" ON public.ticket_messages;
CREATE POLICY "Users can add messages to their tickets"
ON public.ticket_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND is_staff_reply = false
  AND (sender_role IS NULL OR sender_role = 'customer')
  AND EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE support_tickets.id = ticket_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
  )
);

-- Fix 2: help_article_feedback — remove WITH CHECK (true)
DROP POLICY IF EXISTS "anyone insert kb feedback" ON public.help_article_feedback;
CREATE POLICY "insert kb feedback"
ON public.help_article_feedback
FOR INSERT
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND char_length(coalesce(note, '')) <= 2000
);

-- Fix 3: help_search_logs — remove WITH CHECK (true)
DROP POLICY IF EXISTS "anyone insert search log" ON public.help_search_logs;
CREATE POLICY "insert search log"
ON public.help_search_logs
FOR INSERT
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND char_length(coalesce(query, '')) <= 500
);

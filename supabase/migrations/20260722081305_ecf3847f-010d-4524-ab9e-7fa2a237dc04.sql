
-- 1) Scope anon reads on chat_conversations to a matching x-session-id header
DROP POLICY IF EXISTS anon_select_by_session ON public.chat_conversations;
CREATE POLICY anon_select_by_session ON public.chat_conversations
  FOR SELECT
  TO anon
  USING (
    user_id IS NULL
    AND session_id IS NOT NULL
    AND session_id::text = NULLIF(
      current_setting('request.headers', true)::json ->> 'x-session-id',
      ''
    )
  );

-- 2) Scope anon reads on chat_messages to messages whose parent conversation
--    is a guest conversation matching the requester's x-session-id header
DROP POLICY IF EXISTS anon_read_guest_messages ON public.chat_messages;
CREATE POLICY anon_read_guest_messages ON public.chat_messages
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.user_id IS NULL
        AND c.session_id IS NOT NULL
        AND c.session_id::text = NULLIF(
          current_setting('request.headers', true)::json ->> 'x-session-id',
          ''
        )
    )
  );

-- 3) Replace permissive WITH CHECK (true) on chat_conversations INSERT with a
--    scoped check that ties ownership to the caller (guest or signed-in user)
DROP POLICY IF EXISTS anyone_insert_conversation ON public.chat_conversations;
CREATE POLICY anyone_insert_conversation ON public.chat_conversations
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );


-- 1. chat_messages INSERT ownership check
DROP POLICY IF EXISTS anyone_insert_own_messages ON public.chat_messages;

CREATE POLICY chat_messages_insert_scoped
ON public.chat_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])
  AND EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND (
        (auth.uid() IS NOT NULL AND c.user_id = auth.uid())
        OR (
          auth.uid() IS NULL
          AND c.user_id IS NULL
          AND c.session_id IS NOT NULL
          AND c.session_id = NULLIF(((current_setting('request.headers'::text, true))::json ->> 'x-session-id'), '')
        )
      )
  )
);

-- 2. Storage: scope guest chat attachments by session subfolder
DROP POLICY IF EXISTS chat_attachments_guest_rw ON storage.objects;

CREATE POLICY chat_attachments_guest_rw
ON storage.objects
FOR ALL
TO anon, authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = 'guest'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND (storage.foldername(name))[2] = NULLIF(((current_setting('request.headers'::text, true))::json ->> 'x-session-id'), '')
)
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = 'guest'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND (storage.foldername(name))[2] = NULLIF(((current_setting('request.headers'::text, true))::json ->> 'x-session-id'), '')
);

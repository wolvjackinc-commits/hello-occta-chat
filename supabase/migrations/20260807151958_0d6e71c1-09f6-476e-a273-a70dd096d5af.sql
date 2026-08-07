-- =========================================================
-- 1. Guest chat: require cryptographically-random session ids
-- =========================================================
ALTER TABLE public.chat_conversations
  DROP CONSTRAINT IF EXISTS chat_conversations_session_id_random_chk;

ALTER TABLE public.chat_conversations
  ADD CONSTRAINT chat_conversations_session_id_random_chk
  CHECK (
    session_id IS NULL
    OR session_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.current_guest_session_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN sid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN sid
    ELSE NULL
  END
  FROM (
    SELECT NULLIF(
      (current_setting('request.headers', true)::json ->> 'x-session-id'),
      ''
    ) AS sid
  ) h
$$;

DROP POLICY IF EXISTS anon_select_by_session ON public.chat_conversations;
CREATE POLICY anon_select_by_session
ON public.chat_conversations
FOR SELECT
TO anon
USING (
  user_id IS NULL
  AND session_id IS NOT NULL
  AND public.current_guest_session_id() IS NOT NULL
  AND session_id = public.current_guest_session_id()
);

DROP POLICY IF EXISTS anon_read_guest_messages ON public.chat_messages;
CREATE POLICY anon_read_guest_messages
ON public.chat_messages
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND c.user_id IS NULL
      AND c.session_id IS NOT NULL
      AND public.current_guest_session_id() IS NOT NULL
      AND c.session_id = public.current_guest_session_id()
  )
);

DROP POLICY IF EXISTS chat_messages_insert_scoped ON public.chat_messages;
CREATE POLICY chat_messages_insert_scoped
ON public.chat_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  role = ANY (ARRAY['user','assistant','system'])
  AND EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND (
        (auth.uid() IS NOT NULL AND c.user_id = auth.uid())
        OR (
          auth.uid() IS NULL
          AND c.user_id IS NULL
          AND c.session_id IS NOT NULL
          AND public.current_guest_session_id() IS NOT NULL
          AND c.session_id = public.current_guest_session_id()
        )
      )
  )
);

-- Guest chat attachments in storage: same hardening
DROP POLICY IF EXISTS chat_attachments_guest_rw ON storage.objects;
CREATE POLICY chat_attachments_guest_rw
ON storage.objects
FOR ALL
TO anon
USING (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = 'guest'
  AND public.current_guest_session_id() IS NOT NULL
  AND (storage.foldername(name))[2] = public.current_guest_session_id()
)
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = 'guest'
  AND public.current_guest_session_id() IS NOT NULL
  AND (storage.foldername(name))[2] = public.current_guest_session_id()
);

-- =========================================================
-- 2. Help search logs / article feedback: DB-level throttling
-- =========================================================
CREATE OR REPLACE FUNCTION public.throttle_public_help_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ident text;
  _max integer := TG_ARGV[0]::integer;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    _ident := 'user:' || auth.uid()::text;
  ELSE
    _ident := 'anon:' || COALESCE(
      NULLIF(split_part(COALESCE(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1), ''),
      NULLIF(current_setting('request.headers', true)::json ->> 'cf-connecting-ip', ''),
      'unknown'
    );
  END IF;

  IF NOT public.check_rate_limit(_ident, TG_TABLE_NAME, _max, 10) THEN
    RAISE EXCEPTION 'Too many submissions, please try again later';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS throttle_help_search_logs ON public.help_search_logs;
CREATE TRIGGER throttle_help_search_logs
BEFORE INSERT ON public.help_search_logs
FOR EACH ROW EXECUTE FUNCTION public.throttle_public_help_write('30');

DROP TRIGGER IF EXISTS throttle_help_article_feedback ON public.help_article_feedback;
CREATE TRIGGER throttle_help_article_feedback
BEFORE INSERT ON public.help_article_feedback
FOR EACH ROW EXECUTE FUNCTION public.throttle_public_help_write('10');

-- Feedback may only reference published/approved articles
DROP POLICY IF EXISTS "insert kb feedback" ON public.help_article_feedback;
CREATE POLICY "insert kb feedback"
ON public.help_article_feedback
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND char_length(COALESCE(note, '')) <= 2000
  AND EXISTS (
    SELECT 1 FROM public.kb_articles a
    WHERE a.id = help_article_feedback.article_id
      AND a.status = 'approved'::kb_status
      AND a.visibility = 'public'::kb_visibility
  )
);

DROP POLICY IF EXISTS "insert search log" ON public.help_search_logs;
CREATE POLICY "insert search log"
ON public.help_search_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND char_length(COALESCE(query, '')) BETWEEN 1 AND 200
);

-- =========================================================
-- 3. Installation slots: hide operational capacity from public
-- =========================================================
DROP POLICY IF EXISTS "Anyone can view available slots" ON public.installation_slots;

CREATE POLICY "Authenticated users can view active slots"
ON public.installation_slots
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE OR REPLACE VIEW public.installation_slots_public
WITH (security_invoker = false) AS
SELECT
  s.id,
  s.slot_date,
  s.slot_time,
  (s.booked_count < s.capacity) AS has_availability
FROM public.installation_slots s
WHERE s.is_active = true
  AND s.booked_count < s.capacity;

GRANT SELECT ON public.installation_slots_public TO anon, authenticated;
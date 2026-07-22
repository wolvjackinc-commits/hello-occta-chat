
-- Admin full access
CREATE POLICY "chat_attachments_admin_all"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

-- Authenticated users: files stored under user/<their-uid>/...
CREATE POLICY "chat_attachments_user_rw"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = 'user'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = 'user'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Guests: files stored under guest/<session-id>/...
CREATE POLICY "chat_attachments_guest_rw"
  ON storage.objects FOR ALL TO anon
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = 'guest'
  )
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = 'guest'
  );

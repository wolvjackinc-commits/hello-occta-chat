
-- 1) UPDATE policy on user_files table (owner only)
DROP POLICY IF EXISTS "Users can update their own files" ON public.user_files;
CREATE POLICY "Users can update their own files"
ON public.user_files
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND auth.uid() = uploaded_by);

-- 2) UPDATE policy on storage.objects for the user-files bucket (folder = uid)
DROP POLICY IF EXISTS "Users can update own files in user-files bucket" ON storage.objects;
CREATE POLICY "Users can update own files in user-files bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'user-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Admins can update any file in user-files bucket" ON storage.objects;
CREATE POLICY "Admins can update any file in user-files bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'user-files' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'user-files' AND public.has_role(auth.uid(), 'admin'::public.app_role));

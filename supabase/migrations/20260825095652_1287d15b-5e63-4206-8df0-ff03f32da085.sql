-- 1. installation_slots: remove broad full-row read for authenticated users.
DROP POLICY IF EXISTS "Authenticated users can view active slots" ON public.installation_slots;

-- Sanitized view runs with owner rights so customers only ever see the safe columns.
ALTER VIEW public.installation_slots_public SET (security_invoker = false);

-- 2. chat-attachments: remove redundant duplicate policies (keep the role-scoped set).
DROP POLICY IF EXISTS "chat_att_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "chat_att_user_own" ON storage.objects;

-- 3. email-assets: restrict writes to staff, keep public read.
DROP POLICY IF EXISTS "email_assets_public_read" ON storage.objects;
CREATE POLICY "email_assets_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets');

DROP POLICY IF EXISTS "email_assets_staff_insert" ON storage.objects;
CREATE POLICY "email_assets_staff_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'email-assets' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)));

DROP POLICY IF EXISTS "email_assets_staff_update" ON storage.objects;
CREATE POLICY "email_assets_staff_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'email-assets' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)))
WITH CHECK (bucket_id = 'email-assets' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)));

DROP POLICY IF EXISTS "email_assets_staff_delete" ON storage.objects;
CREATE POLICY "email_assets_staff_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'email-assets' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)));
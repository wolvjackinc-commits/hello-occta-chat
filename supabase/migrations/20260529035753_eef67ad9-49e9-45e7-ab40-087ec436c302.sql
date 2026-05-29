
-- 1. user_roles privilege escalation
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins may write user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Realtime channel authorization
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can subscribe to own topics" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to own topics"
ON realtime.messages FOR SELECT TO authenticated
USING (
  (realtime.topic() = ('user:' || auth.uid()::text))
  OR (realtime.topic() LIKE ('user:' || auth.uid()::text || ':%'))
);

-- 3. Audit logs: remove direct write policy; inserts must go through log_audit_action()
DROP POLICY IF EXISTS audit_logs_admin_write ON public.audit_logs;

-- 4. Payment request events: users can view their own
CREATE POLICY "Users can view own payment request events"
ON public.payment_request_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.payment_requests pr
  WHERE pr.id = payment_request_events.request_id
    AND pr.user_id = auth.uid()
));

-- 5. user_files: scope inserts/deletes to owner
CREATE POLICY "Users can insert their own files"
ON public.user_files FOR INSERT TO authenticated
WITH CHECK (auth.uid() = uploaded_by AND auth.uid() = user_id);

CREATE POLICY "Users can delete their own files"
ON public.user_files FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'user-files'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete from their own folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'user-files'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 6. Remove broad SELECT on public email-assets bucket (direct file URLs still work)
DROP POLICY IF EXISTS "Email assets are publicly accessible" ON storage.objects;

-- 7. Revoke EXECUTE on SECURITY DEFINER trigger/internal functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_guest_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_profile_account_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_account_number_on_active() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_dd_mandate_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_dd_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_slot_booking() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_slot_booking() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_payment_requests_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_account_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_user_account_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_next_invoice_date(text, integer, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.anonymize_old_account_deletions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_action(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

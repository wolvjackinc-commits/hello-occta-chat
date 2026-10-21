-- 1. Admin profile edits silently updated 0 rows.
-- "Users can update their own profile" was recreated AS RESTRICTIVE in
-- 20260129111655, so Postgres ANDs it with "Admins can update all profiles"
-- and an admin can only ever update their own row. 20260131122409 already put
-- the SELECT policies back to PERMISSIVE; do the same for UPDATE. Customers
-- still only match their own row, and guard_profiles_customer_update keeps
-- them off admin-controlled columns.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2. Admin console audit writes failed with 42501.
-- Direct inserts into audit_logs were removed in favour of log_audit_action()
-- (20260529035753), but EXECUTE was then revoked from authenticated because the
-- function had no caller check. Only staff (or the service role) may log, and
-- the actor is always taken from the session, never from the caller.
CREATE OR REPLACE FUNCTION public.log_audit_action(
  _action text,
  _entity text,
  _entity_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _audit_id uuid;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.has_any_admin_role(auth.uid())) THEN
    RAISE EXCEPTION 'not authorised to write audit logs' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.audit_logs (actor_user_id, action, entity, entity_id, metadata)
  VALUES (auth.uid(), _action, _entity, _entity_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _audit_id;

  RETURN _audit_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_audit_action(text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit_action(text, text, uuid, jsonb) TO authenticated, service_role;

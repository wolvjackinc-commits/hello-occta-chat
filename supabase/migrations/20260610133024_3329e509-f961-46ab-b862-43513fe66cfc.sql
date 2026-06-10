-- Phase B: Quote-to-Account linking + dashboard invite support

-- 1) Customer-facing self-link RPC. Requires authenticated user; will only link
--    quote_requests where the row email matches the authenticated user's email.
CREATE OR REPLACE FUNCTION public.link_quote_requests_to_user(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF _user_id IS NULL OR _user_id <> v_uid THEN
    RAISE EXCEPTION 'user id mismatch';
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL OR length(v_email) = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.quote_requests
  SET customer_id = v_uid, updated_at = now()
  WHERE customer_id IS NULL
    AND lower(email) = v_email;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.link_quote_requests_to_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_quote_requests_to_user(uuid) TO authenticated;

-- 2) Extend handle_new_user() to backfill quote_requests by email at signup.
--    Uses NEW.id and NEW.email directly (auth.uid() is not reliable in this context).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  -- Backfill any guest quote_requests submitted with the same email.
  IF NEW.email IS NOT NULL AND length(NEW.email) > 0 THEN
    UPDATE public.quote_requests
    SET customer_id = NEW.id, updated_at = now()
    WHERE customer_id IS NULL
      AND lower(email) = lower(NEW.email);
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Extend customer self-select RLS policy so a freshly-signed-up user can see
--    their guest quote even before any backfill runs. Uses verified JWT email claim.
DROP POLICY IF EXISTS "qr_customer_select_own" ON public.quote_requests;
CREATE POLICY "qr_customer_select_own"
ON public.quote_requests
FOR SELECT
TO authenticated
USING (
  (customer_id IS NOT NULL AND customer_id = auth.uid())
  OR (
    customer_id IS NULL
    AND auth.uid() IS NOT NULL
    AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    AND length(COALESCE(auth.jwt() ->> 'email', '')) > 0
  )
);

-- 4) Admin manual link RPC with audit logging. Staff-only.
CREATE OR REPLACE FUNCTION public.admin_link_quote_request(
  _qr_id uuid,
  _new_user_id uuid,
  _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old uuid;
  v_email text;
  v_target_email text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT public.is_staff(v_actor) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _qr_id IS NULL OR _new_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid args';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 4 THEN
    RAISE EXCEPTION 'reason required';
  END IF;

  SELECT customer_id, lower(email) INTO v_old, v_email
  FROM public.quote_requests WHERE id = _qr_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'quote_request not found'; END IF;

  SELECT lower(email) INTO v_target_email FROM auth.users WHERE id = _new_user_id;
  IF v_target_email IS NULL THEN RAISE EXCEPTION 'target user not found'; END IF;

  UPDATE public.quote_requests
  SET customer_id = _new_user_id, updated_at = now()
  WHERE id = _qr_id;

  INSERT INTO public.audit_logs (actor_user_id, action, entity, entity_id, metadata)
  VALUES (
    v_actor,
    'admin_link_quote_request',
    'quote_requests',
    _qr_id,
    jsonb_build_object(
      'old_customer_id', v_old,
      'new_customer_id', _new_user_id,
      'reason', left(_reason, 1000),
      'email_matched', (v_email = v_target_email),
      'qr_email', v_email,
      'target_email', v_target_email,
      'timestamp', now()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_link_quote_request(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_link_quote_request(uuid, uuid, text) TO authenticated;

-- 5) Customer dashboard view of own quote_requests (safe columns only — no
--    supplier / margin fields exist on this table, but we expose a narrow set).
CREATE OR REPLACE FUNCTION public.get_customer_quote_requests()
RETURNS TABLE (
  id uuid,
  reference text,
  postcode text,
  service_interest text,
  plan_preference text,
  customer_type text,
  status text,
  message text,
  source text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, reference, postcode,
         service_interest::text, plan_preference::text, customer_type::text,
         status::text, message, source, created_at
  FROM public.quote_requests
  WHERE (customer_id IS NOT NULL AND customer_id = auth.uid())
     OR (
       customer_id IS NULL
       AND auth.uid() IS NOT NULL
       AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
       AND length(COALESCE(auth.jwt() ->> 'email', '')) > 0
     )
  ORDER BY created_at DESC
  LIMIT 200
$$;

REVOKE ALL ON FUNCTION public.get_customer_quote_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_quote_requests() TO authenticated;
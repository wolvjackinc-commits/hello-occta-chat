ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS unified_journey_opt_in boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.quotes.unified_journey_opt_in IS 'Admin-only per-quote opt-in to render the unified /quote/:token journey before the global platform_settings flag is enabled.';

CREATE OR REPLACE FUNCTION public.admin_set_quote_unified_opt_in(_quote_id uuid, _enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (public.has_role(v_uid, 'admin'::app_role)
       OR public.has_role(v_uid, 'super_admin'::app_role)
       OR public.has_role(v_uid, 'compliance_admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.quotes
     SET unified_journey_opt_in = COALESCE(_enabled, false)
   WHERE id = _quote_id;

  INSERT INTO public.audit_logs (actor_user_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'quote_unified_journey_opt_in_set', 'quotes', _quote_id::text,
          jsonb_build_object('enabled', COALESCE(_enabled, false)));

  RETURN COALESCE(_enabled, false);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_quote_unified_opt_in(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_quote_unified_opt_in(uuid, boolean) TO authenticated, service_role;
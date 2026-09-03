-- Fix Journey Control timeline for Journey 2 sessions.
-- public.activity_log uses `ts` as its timestamp column, not `created_at`.
-- Keep the RPC return contract unchanged by aliasing `ts` as `created_at`.

CREATE OR REPLACE FUNCTION public.admin_checkout_timeline(_source text, _session_id uuid)
RETURNS TABLE (
  id uuid,
  event_type text,
  title text,
  stage text,
  severity text,
  details jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'staff access required';
  END IF;

  IF _source = 'journey2' THEN
    RETURN QUERY
    SELECT
      a.id,
      a.event_type,
      a.title,
      coalesce(a.details->>'stage', a.details->>'from_stage')::text,
      coalesce(a.severity, 'info')::text,
      a.details,
      a.ts AS created_at
    FROM public.activity_log a
    WHERE (
      a.details->>'journey_session_id' = _session_id::text
      OR a.details->>'session_id' = _session_id::text
    )
      AND (a.event_type LIKE 'checkout_%' OR a.event_type LIKE 'journey2_%')
    ORDER BY a.ts ASC;
  ELSE
    RETURN QUERY
    SELECT
      e.id,
      e.event_type,
      initcap(replace(e.event_type, '_', ' '))::text,
      e.stage,
      e.severity,
      e.details,
      e.created_at
    FROM public.checkout_tracking_events e
    WHERE e.tracking_session_id = _session_id
    ORDER BY e.created_at ASC;
  END IF;
END;
$function$;

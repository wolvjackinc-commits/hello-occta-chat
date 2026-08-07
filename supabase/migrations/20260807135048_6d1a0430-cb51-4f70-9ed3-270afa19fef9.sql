CREATE OR REPLACE FUNCTION public.admin_checkout_session_list(_limit integer DEFAULT 150)
 RETURNS TABLE(source text, session_id uuid, journey_session_id uuid, journey_version text, status text, current_stage text, progress_percent integer, customer_name text, customer_email text, postcode text, plan_label text, current_route text, started_at timestamp with time zone, last_activity_at timestamp with time zone, stage_started_at timestamp with time zone, completed_at timestamp with time zone, abandoned_at timestamp with time zone, reminder_count integer, error_count integer, last_error text, order_id uuid, quote_id uuid, utm_source text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role)) THEN RAISE EXCEPTION 'admin access required'; END IF;
 RETURN QUERY SELECT * FROM (
  SELECT 'journey2'::text AS source, s.id AS session_id, s.id AS journey_session_id, s.journey_version AS journey_version,
    CASE WHEN s.abandoned_at IS NOT NULL AND s.completed_at IS NULL THEN 'abandoned' ELSE s.status END::text AS status,
    s.current_step::text AS current_stage, public.checkout_stage_progress(s.current_step) AS progress_percent,
    nullif(s.customer_details->>'full_name','') AS customer_name, nullif(s.customer_details->>'email','') AS customer_email,
    s.postcode::text AS postcode,
    concat_ws(' · ',nullif(s.speed_bucket,''),nullif(s.plan_term,''))::text AS plan_label, '/order'::text AS current_route,
    coalesce(s.checkout_tracking_started_at,s.created_at) AS started_at, s.last_activity_at AS last_activity_at,
    coalesce(s.current_step_started_at,s.last_activity_at) AS stage_started_at, s.completed_at AS completed_at, s.abandoned_at AS abandoned_at,
    coalesce(s.reminder_count,0)::integer AS reminder_count, coalesce(s.error_count,0)::integer AS error_count, left(s.last_error,500)::text AS last_error,
    s.order_id AS order_id, s.quote_id AS quote_id, nullif(s.utm_snapshot->>'utm_source','')::text AS utm_source
  FROM public.customer_journey_sessions s WHERE NOT coalesce(s.test_session,false)
  UNION ALL
  SELECT 'web'::text, w.id, NULL::uuid, coalesce(w.journey_version,'legacy')::text, w.status::text, w.current_stage::text, w.progress_percent::integer, NULL::text, NULL::text, NULL::text, NULL::text, w.current_route::text, w.started_at, w.last_activity_at, w.stage_started_at, w.completed_at, w.abandoned_at, 0::integer, w.error_count::integer, left(w.last_error,500)::text, NULL::uuid, NULL::uuid, NULL::text
  FROM public.checkout_tracking_sessions w WHERE w.journey_session_id IS NULL
 ) x ORDER BY x.started_at DESC LIMIT greatest(1,least(coalesce(_limit,150),500));
END; $function$;
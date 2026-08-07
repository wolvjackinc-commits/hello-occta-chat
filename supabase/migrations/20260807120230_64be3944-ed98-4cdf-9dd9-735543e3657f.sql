CREATE OR REPLACE FUNCTION public.has_any_admin_role(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN (
        'admin'::public.app_role,
        'super_admin'::public.app_role,
        'business_admin'::public.app_role,
        'ticket_admin'::public.app_role,
        'sales_admin'::public.app_role
      )
  )
$function$;

CREATE OR REPLACE FUNCTION public.checkout_stage_progress(_stage text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE lower(coalesce(_stage, '')) WHEN 'address' THEN 10 WHEN 'plan' THEN 20 WHEN 'router' THEN 30 WHEN 'extras' THEN 40 WHEN 'details' THEN 50 WHEN 'start_date' THEN 60 WHEN 'billing' THEN 70 WHEN 'contract' THEN 80 WHEN 'agreement' THEN 80 WHEN 'review' THEN 90 WHEN 'payment' THEN 90 WHEN 'complete' THEN 100 ELSE NULL END
$function$;
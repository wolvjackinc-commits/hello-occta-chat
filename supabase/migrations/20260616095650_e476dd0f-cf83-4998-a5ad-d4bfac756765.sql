DROP TRIGGER IF EXISTS trg_set_journey_cooling_off ON public.order_journeys;
DROP TRIGGER IF EXISTS trg_set_journey_cooling_off_ins ON public.order_journeys;
DROP FUNCTION IF EXISTS public.set_journey_cooling_off();
DROP FUNCTION IF EXISTS public.set_journey_cooling_off_ins();

ALTER TABLE public.order_journeys
  DROP COLUMN IF EXISTS early_start_waived,
  DROP COLUMN IF EXISTS early_start_waived_at,
  DROP COLUMN IF EXISTS early_start_waiver_text,
  DROP COLUMN IF EXISTS early_start_waiver_text_hash,
  DROP COLUMN IF EXISTS early_start_waiver_ip;

ALTER TABLE public.order_journeys
  ADD COLUMN IF NOT EXISTS earliest_selectable_start_date date;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS start_date_max_days integer NOT NULL DEFAULT 90;

CREATE OR REPLACE FUNCTION public.compute_cooling_off(_accepted_at timestamptz)
RETURNS TABLE (
  cooling_off_ends_at timestamptz,
  earliest_selectable_start_date date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_london_day date;
BEGIN
  v_london_day := (_accepted_at AT TIME ZONE 'Europe/London')::date;
  cooling_off_ends_at :=
    ((v_london_day + 14)::timestamp + time '23:59:59') AT TIME ZONE 'Europe/London';
  earliest_selectable_start_date := v_london_day + 15;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.compute_cooling_off(timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.compute_cooling_off(timestamptz) TO authenticated, service_role;

DROP POLICY IF EXISTS "acceptance_certs_owner_select"   ON storage.objects;
DROP POLICY IF EXISTS "acceptance_certs_staff_select"   ON storage.objects;

CREATE POLICY "acceptance_certs_owner_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'acceptance-certificates'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "acceptance_certs_staff_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'acceptance-certificates'
  AND (public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'super_admin')
       OR public.has_role(auth.uid(), 'support_agent')
       OR public.has_role(auth.uid(), 'compliance_admin'))
);
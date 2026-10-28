-- 1. Restore the public catalogue views.
--
-- sim_plans_public and platform_settings_public were made security_invoker on
-- 2026-08-24 (linter clean-up). anon has no read access to the base tables
-- (sim_plans holds supplier cost and margin columns, revoked on 2026-07-10),
-- so every visitor got "permission denied": /sim showed "Not currently
-- available" and public pages fell back to default platform settings.
--
-- These views are the deliberate, column-limited public surface, so they run
-- with the owner's rights. Write privileges are revoked so a definer view can
-- never be used to modify the base tables.
ALTER VIEW public.sim_plans_public SET (security_invoker = false);
ALTER VIEW public.platform_settings_public SET (security_invoker = false);

REVOKE ALL ON public.sim_plans_public FROM anon, authenticated;
REVOKE ALL ON public.platform_settings_public FROM anon, authenticated;
GRANT SELECT ON public.sim_plans_public TO anon, authenticated;
GRANT SELECT ON public.platform_settings_public TO anon, authenticated;

COMMENT ON VIEW public.sim_plans_public IS
  'Public SIM catalogue. Intentionally NOT security_invoker: anon must read active plans without access to supplier cost/margin columns on sim_plans. Read-only grants.';
COMMENT ON VIEW public.platform_settings_public IS
  'Public platform settings. Intentionally NOT security_invoker: anon reads safe settings columns only. Read-only grants.';

-- 2. Service status: incidents and planned maintenance shown on /status.
CREATE TABLE IF NOT EXISTS public.service_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('incident', 'maintenance')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  summary text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved', 'scheduled', 'in_progress', 'completed')),
  impact text NOT NULL DEFAULT 'minor' CHECK (impact IN ('none', 'minor', 'major', 'critical')),
  affected_services text[] NOT NULL DEFAULT '{}'
    CHECK (affected_services <@ ARRAY['broadband', 'digital_voice', 'mobile', 'account', 'billing', 'support']::text[]),
  affected_areas text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  resolved_at timestamptz,
  is_public boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_incident_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.service_incidents(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved', 'scheduled', 'in_progress', 'completed')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 3 AND 2000),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_incidents_public_recent_idx ON public.service_incidents (is_public, starts_at DESC);
CREATE INDEX IF NOT EXISTS service_incident_updates_incident_idx ON public.service_incident_updates (incident_id, created_at DESC);

DROP TRIGGER IF EXISTS service_incidents_updated_at ON public.service_incidents;
CREATE TRIGGER service_incidents_updated_at BEFORE UPDATE ON public.service_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.service_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_incident_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service incidents public read" ON public.service_incidents;
CREATE POLICY "service incidents public read" ON public.service_incidents
  FOR SELECT TO anon, authenticated USING (is_public = true);

DROP POLICY IF EXISTS "service incidents admin all" ON public.service_incidents;
CREATE POLICY "service incidents admin all" ON public.service_incidents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "service incident updates public read" ON public.service_incident_updates;
CREATE POLICY "service incident updates public read" ON public.service_incident_updates
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.service_incidents i WHERE i.id = incident_id AND i.is_public = true));

DROP POLICY IF EXISTS "service incident updates admin all" ON public.service_incident_updates;
CREATE POLICY "service incident updates admin all" ON public.service_incident_updates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON public.service_incidents FROM anon;
REVOKE ALL ON public.service_incident_updates FROM anon;
GRANT SELECT ON public.service_incidents TO anon;
GRANT SELECT ON public.service_incident_updates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_incidents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_incident_updates TO authenticated;
GRANT ALL ON public.service_incidents TO service_role;
GRANT ALL ON public.service_incident_updates TO service_role;

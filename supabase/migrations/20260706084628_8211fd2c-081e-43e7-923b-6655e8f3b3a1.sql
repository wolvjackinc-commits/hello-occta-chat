-- Compliance tables: add missing GRANTs so PostgREST + RLS work correctly.
-- Without these, client-side reads silently 403 even when RLS policy allows.
-- No new access is granted beyond what RLS policies already permit.

GRANT SELECT ON public.contract_summaries          TO authenticated;
GRANT ALL    ON public.contract_summaries          TO service_role;

GRANT SELECT ON public.contract_acceptances        TO authenticated;
GRANT ALL    ON public.contract_acceptances        TO service_role;

GRANT SELECT ON public.contract_information_packs  TO authenticated;
GRANT ALL    ON public.contract_information_packs  TO service_role;

GRANT SELECT ON public.acceptance_audit_records    TO authenticated;
GRANT ALL    ON public.acceptance_audit_records    TO service_role;

GRANT SELECT ON public.acceptance_certificates     TO authenticated;
GRANT ALL    ON public.acceptance_certificates     TO service_role;

-- Staff pilot allowlist: only whitelisted user_ids can hit the two-doc flow
-- while the global two_document_contract_flow_enabled flag stays false.
CREATE TABLE IF NOT EXISTS public.two_doc_pilot_allowlist (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by      uuid REFERENCES auth.users(id),
  note          text,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT ON public.two_doc_pilot_allowlist TO authenticated;
GRANT ALL    ON public.two_doc_pilot_allowlist TO service_role;

ALTER TABLE public.two_doc_pilot_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pilot allowlist"
  ON public.two_doc_pilot_allowlist
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can see their own pilot enrollment"
  ON public.two_doc_pilot_allowlist
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Pilot event log — every access attempt to the two-doc flow gets a row.
CREATE TABLE IF NOT EXISTS public.two_doc_pilot_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type    text NOT NULL,          -- 'access_granted' | 'access_denied' | 'pdf_issued' | 'accepted'
  order_id      uuid,
  document_id   uuid,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.two_doc_pilot_events TO authenticated;
GRANT ALL    ON public.two_doc_pilot_events TO service_role;

ALTER TABLE public.two_doc_pilot_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view pilot events"
  ON public.two_doc_pilot_events
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Resolver: is the two-doc flow active for a given user?
-- Returns true if the global flag is on, OR if the user is in the active allowlist.
CREATE OR REPLACE FUNCTION public.is_two_doc_flow_enabled_for(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT two_document_contract_flow_enabled FROM public.platform_settings LIMIT 1), false)
    OR EXISTS (
      SELECT 1 FROM public.two_doc_pilot_allowlist
      WHERE user_id = _user_id AND active = true
    );
$$;

REVOKE ALL ON FUNCTION public.is_two_doc_flow_enabled_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_two_doc_flow_enabled_for(uuid) TO authenticated, service_role;

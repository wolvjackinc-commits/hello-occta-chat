
-- 1) webhook_deliveries
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  event_type TEXT,
  external_reference TEXT,
  signature_valid BOOLEAN,
  status TEXT NOT NULL DEFAULT 'received',
  http_status INT,
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  replay_count INT NOT NULL DEFAULT 0,
  last_replayed_at TIMESTAMPTZ,
  last_replayed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_created_idx ON public.webhook_deliveries (created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_deliveries_source_status_idx ON public.webhook_deliveries (source, status);

GRANT SELECT, UPDATE ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins view webhook deliveries"
  ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "admins update webhook deliveries"
  ON public.webhook_deliveries FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.touch_webhook_deliveries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;$$;

DROP TRIGGER IF EXISTS trg_webhook_deliveries_updated ON public.webhook_deliveries;
CREATE TRIGGER trg_webhook_deliveries_updated
  BEFORE UPDATE ON public.webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.touch_webhook_deliveries_updated_at();

-- 2) admin_notification_prefs
CREATE TABLE IF NOT EXISTS public.admin_notification_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notification_prefs TO authenticated;
GRANT ALL ON public.admin_notification_prefs TO service_role;
ALTER TABLE public.admin_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage own notif prefs"
  ON public.admin_notification_prefs FOR ALL TO authenticated
  USING (user_id = auth.uid() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')))
  WITH CHECK (user_id = auth.uid() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));

DROP TRIGGER IF EXISTS trg_admin_notif_prefs_updated ON public.admin_notification_prefs;
CREATE TRIGGER trg_admin_notif_prefs_updated
  BEFORE UPDATE ON public.admin_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.touch_webhook_deliveries_updated_at();

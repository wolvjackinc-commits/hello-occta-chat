
CREATE TABLE public.chat_attachment_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  conversation_id uuid,
  status text NOT NULL DEFAULT 'pending',
  reasons jsonb,
  size_bytes bigint,
  content_type text,
  scanned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chat_attachment_scans TO authenticated;
GRANT ALL ON public.chat_attachment_scans TO service_role;
ALTER TABLE public.chat_attachment_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view chat attachment scans"
  ON public.chat_attachment_scans FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE INDEX chat_attachment_scans_status_idx ON public.chat_attachment_scans (status);
CREATE INDEX chat_attachment_scans_conv_idx ON public.chat_attachment_scans (conversation_id);

CREATE TABLE public.admin_notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  subject text,
  recipients text[],
  success boolean NOT NULL DEFAULT true,
  error_message text,
  reference_url text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_notification_events TO authenticated;
GRANT ALL ON public.admin_notification_events TO service_role;
ALTER TABLE public.admin_notification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view admin notification events"
  ON public.admin_notification_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE INDEX admin_notification_events_created_idx ON public.admin_notification_events (created_at DESC);
CREATE INDEX admin_notification_events_type_idx ON public.admin_notification_events (event_type);

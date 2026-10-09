-- OCCTA Campaign Manager: additive, no historical billing/contract changes.
-- All recipient dispatch remains disabled until a campaign is approved and started.
CREATE TABLE IF NOT EXISTS public.marketing_contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL UNIQUE CHECK (email=lower(btrim(email)) AND length(email)<=320),
 full_name text,
 company text,
 tags text[] NOT NULL DEFAULT '{}',
 consent_basis text NOT NULL DEFAULT 'explicit_opt_in' CHECK (consent_basis='explicit_opt_in'),
 consent_evidence text NOT NULL CHECK(length(btrim(consent_evidence))>=10),
 consent_source text NOT NULL CHECK(length(btrim(consent_source))>=3),
 consent_at timestamptz NOT NULL,
 consent_status text NOT NULL DEFAULT 'subscribed' CHECK(consent_status IN ('subscribed','unsubscribed')),
 created_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.marketing_suppressions (
 email text PRIMARY KEY CHECK (email=lower(btrim(email))),
 reason text NOT NULL CHECK(reason IN ('unsubscribe','complaint','hard_bounce','manual')),
 source text NOT NULL DEFAULT 'campaign_manager',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.campaign_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
 recipient_id uuid REFERENCES public.campaign_recipients(id) ON DELETE SET NULL,
 provider_event_id text UNIQUE,
 event_type text NOT NULL,
 event_at timestamptz NOT NULL DEFAULT now(),
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS campaign_events_campaign_time ON public.campaign_events(campaign_id, event_at DESC);
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id);
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS audience_type text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS subject_snapshot text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS html_snapshot text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS text_snapshot text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS track_opens boolean NOT NULL DEFAULT false;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.marketing_contacts(id);
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS clicked_at timestamptz;
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS complained_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipient_dedup_idx ON public.campaign_recipients(campaign_id,lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS campaign_unsubscribe_token_idx ON public.campaign_recipients(unsubscribe_token);
CREATE INDEX IF NOT EXISTS campaign_recipient_provider_idx ON public.campaign_recipients(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS campaign_pending_idx ON public.campaign_recipients(campaign_id,status) WHERE status='queued';

ALTER TABLE public.marketing_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketing_contacts_admin_select ON public.marketing_contacts FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY marketing_suppressions_admin_select ON public.marketing_suppressions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY campaign_events_admin_select ON public.campaign_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));
-- Campaign state transitions must never be writable from a browser. Service-role edge functions own all writes.
REVOKE INSERT, UPDATE, DELETE ON public.campaigns FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.campaign_recipients FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.marketing_contacts FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.marketing_suppressions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.campaign_events FROM authenticated;

-- Atomically lease pending recipients so concurrent worker runs do not double-dispatch.
CREATE OR REPLACE FUNCTION public.claim_campaign_mail(p_limit integer DEFAULT 30)
RETURNS SETOF public.campaign_recipients
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  UPDATE public.campaigns
     SET status='sending', started_at=COALESCE(started_at,now()), updated_at=now()
   WHERE status IN ('scheduled','ready') AND approved_at IS NOT NULL
     AND (scheduled_at IS NULL OR scheduled_at<=now());
  RETURN QUERY
  WITH selected AS (
    SELECT r.id FROM public.campaign_recipients r
    JOIN public.campaigns c ON c.id=r.campaign_id
    WHERE r.status='queued' AND c.status='sending' AND c.approved_at IS NOT NULL
    ORDER BY r.queued_at, r.id
    LIMIT LEAST(GREATEST(p_limit,1),30)
    FOR UPDATE OF r SKIP LOCKED
  )
  UPDATE public.campaign_recipients r
     SET status='processing'
  FROM selected WHERE r.id=selected.id
  RETURNING r.*;
END
$$;
REVOKE ALL ON FUNCTION public.claim_campaign_mail(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign_mail(integer) TO service_role;

-- Media are explicitly public campaign artwork only, never customer information.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('campaign-artwork','campaign-artwork',true,5242880,ARRAY['image/png','image/jpeg','image/webp','image/gif'])
ON CONFLICT(id) DO NOTHING;
CREATE POLICY campaign_artwork_admin_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='campaign-artwork' AND public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY campaign_artwork_admin_update ON storage.objects FOR UPDATE TO authenticated
 USING(bucket_id='campaign-artwork' AND public.has_role(auth.uid(),'admin'::public.app_role))
 WITH CHECK(bucket_id='campaign-artwork' AND public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY campaign_artwork_admin_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='campaign-artwork' AND public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY campaign_artwork_admin_list ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='campaign-artwork' AND public.has_role(auth.uid(),'admin'::public.app_role));

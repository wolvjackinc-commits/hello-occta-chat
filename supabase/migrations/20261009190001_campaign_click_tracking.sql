ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS track_clicks boolean NOT NULL DEFAULT false;
-- Acknowledgement tracking is opt-in per campaign; delivery webhooks work independently.
CREATE INDEX IF NOT EXISTS marketing_contacts_consent_idx ON public.marketing_contacts(consent_status);

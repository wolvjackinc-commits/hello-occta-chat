ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_email_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_sms_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_updates_consent boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS consent_updated_at timestamp with time zone;
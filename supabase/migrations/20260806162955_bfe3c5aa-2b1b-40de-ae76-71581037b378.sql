CREATE TABLE public.sms_otp_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id uuid NOT NULL UNIQUE,
  journey_type text NOT NULL CHECK (journey_type IN ('journey_1','journey_2')),
  session_or_order_reference text NOT NULL,
  phone_masked text NOT NULL,
  phone_hash text NOT NULL,
  sms_message_id text,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  consumed_at timestamptz,
  send_attempts integer NOT NULL DEFAULT 1,
  verify_attempts integer NOT NULL DEFAULT 0,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.sms_otp_challenges TO service_role;

ALTER TABLE public.sms_otp_challenges ENABLE ROW LEVEL SECURITY;

-- Deliberately no policies for anon/authenticated: all access is server-side
-- through the service role, which bypasses RLS.
CREATE POLICY "Admins can view sms otp challenges"
ON public.sms_otp_challenges
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_sms_otp_active ON public.sms_otp_challenges (session_or_order_reference, journey_type, created_at DESC);
CREATE INDEX idx_sms_otp_challenge_id ON public.sms_otp_challenges (challenge_id);

CREATE TRIGGER trg_sms_otp_challenges_updated_at
BEFORE UPDATE ON public.sms_otp_challenges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS contract_sms_otp_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS contract_sms_otp_bypass_reason text;
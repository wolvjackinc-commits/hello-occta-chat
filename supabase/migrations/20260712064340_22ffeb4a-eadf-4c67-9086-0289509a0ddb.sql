-- 1. Table
CREATE TABLE IF NOT EXISTS public.consent_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  consent_type text NOT NULL CHECK (consent_type IN ('marketing_email', 'marketing_sms', 'service_updates')),
  previous_value boolean,
  new_value boolean NOT NULL,
  source text NOT NULL DEFAULT 'dashboard',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consent_history_user_created_idx
  ON public.consent_history (user_id, created_at DESC);

-- 2. Grants
GRANT SELECT, INSERT ON public.consent_history TO authenticated;
GRANT ALL ON public.consent_history TO service_role;

-- 3. RLS
ALTER TABLE public.consent_history ENABLE ROW LEVEL SECURITY;

-- 4. Policies
CREATE POLICY "Users read their own consent history"
  ON public.consent_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own consent history"
  ON public.consent_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Trigger to record automatically when profile consent changes
CREATE OR REPLACE FUNCTION public.record_consent_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (COALESCE(OLD.marketing_email_consent, false) IS DISTINCT FROM COALESCE(NEW.marketing_email_consent, false)) THEN
    INSERT INTO public.consent_history (user_id, consent_type, previous_value, new_value, source)
    VALUES (NEW.id, 'marketing_email', OLD.marketing_email_consent, NEW.marketing_email_consent, 'profile_update');
  END IF;
  IF (COALESCE(OLD.marketing_sms_consent, false) IS DISTINCT FROM COALESCE(NEW.marketing_sms_consent, false)) THEN
    INSERT INTO public.consent_history (user_id, consent_type, previous_value, new_value, source)
    VALUES (NEW.id, 'marketing_sms', OLD.marketing_sms_consent, NEW.marketing_sms_consent, 'profile_update');
  END IF;
  IF (COALESCE(OLD.service_updates_consent, true) IS DISTINCT FROM COALESCE(NEW.service_updates_consent, true)) THEN
    INSERT INTO public.consent_history (user_id, consent_type, previous_value, new_value, source)
    VALUES (NEW.id, 'service_updates', OLD.service_updates_consent, NEW.service_updates_consent, 'profile_update');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_consent_history_trg ON public.profiles;
CREATE TRIGGER profiles_consent_history_trg
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.record_consent_changes();
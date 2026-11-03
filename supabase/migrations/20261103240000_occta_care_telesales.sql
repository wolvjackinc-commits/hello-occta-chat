-- Telesales: the whole Care sign-up is completed on the recorded call in the Sales Desk.
-- The call recording is the customer's verification, and email is optional (letters are posted).
ALTER TABLE public.care_verifications DROP CONSTRAINT IF EXISTS care_verifications_method_check;
ALTER TABLE public.care_verifications ADD CONSTRAINT care_verifications_method_check CHECK (method IN ('sms_otp','email_code','call_recording'));
ALTER TABLE public.care_consents DROP CONSTRAINT IF EXISTS care_consents_verification_method_check;
ALTER TABLE public.care_consents ADD CONSTRAINT care_consents_verification_method_check
  CHECK (verification_method IS NULL OR verification_method IN ('sms_otp','email_code','call_recording'));

-- No email is fine: every Care letter is posted.
DO $do$
DECLARE def text := pg_get_functiondef('public.care_eligibility(uuid)'::regprocedure);
BEGIN
  def := replace(def, E'    IF pr.email IS NULL THEN reasons := array_append(reasons, ''no_email''); END IF;\n', '');
  IF position('no_email' IN def) > 0 THEN RAISE EXCEPTION 'care_eligibility no_email line not found'; END IF;
  EXECUTE def;
END $do$;

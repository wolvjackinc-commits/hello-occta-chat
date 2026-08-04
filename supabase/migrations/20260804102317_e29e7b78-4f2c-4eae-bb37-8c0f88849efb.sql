
-- Follow-up channel + outcome enums
DO $$ BEGIN
  CREATE TYPE public.followup_channel AS ENUM ('phone','email','sms','whatsapp','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.followup_outcome AS ENUM (
    'not_contacted','no_answer','spoke_to_customer','information_requested',
    'quote_discussed','call_back_requested','interested','not_interested',
    'converted','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.quote_request_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  followup_at timestamptz NOT NULL,
  channel public.followup_channel NOT NULL DEFAULT 'phone',
  outcome public.followup_outcome NOT NULL DEFAULT 'not_contacted',
  notes text NOT NULL DEFAULT '',
  next_followup_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- customer send tracking
  sent_at timestamptz,
  sent_to text,
  sent_subject text,
  sent_message_html text,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  send_reference text,
  send_status text,
  -- soft delete / audit trail
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.quote_request_followups TO authenticated;
GRANT ALL ON public.quote_request_followups TO service_role;

ALTER TABLE public.quote_request_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view quote request follow-ups"
  ON public.quote_request_followups FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

CREATE POLICY "Admins can create quote request follow-ups"
  ON public.quote_request_followups FOR INSERT TO authenticated
  WITH CHECK (public.has_any_admin_role(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Admins can update quote request follow-ups"
  ON public.quote_request_followups FOR UPDATE TO authenticated
  USING (public.has_any_admin_role(auth.uid()))
  WITH CHECK (public.has_any_admin_role(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_qr_followups_request ON public.quote_request_followups (quote_request_id, followup_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_followups_next ON public.quote_request_followups (next_followup_at) WHERE deleted_at IS NULL AND next_followup_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qr_followups_live ON public.quote_request_followups (quote_request_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.qr_followups_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qr_followups_touch ON public.quote_request_followups;
CREATE TRIGGER trg_qr_followups_touch
  BEFORE UPDATE ON public.quote_request_followups
  FOR EACH ROW EXECUTE FUNCTION public.qr_followups_touch();

CREATE OR REPLACE FUNCTION public.qr_followups_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'quote_followup_created';
  ELSIF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    v_action := 'quote_followup_deleted';
  ELSIF NEW.sent_at IS NOT NULL AND OLD.sent_at IS DISTINCT FROM NEW.sent_at THEN
    v_action := 'quote_followup_sent';
  ELSE
    v_action := 'quote_followup_updated';
  END IF;

  INSERT INTO public.audit_logs (actor_user_id, action, entity, entity_id, metadata)
  VALUES (
    auth.uid(), v_action, 'quote_request_followups', NEW.id,
    jsonb_build_object(
      'quote_request_id', NEW.quote_request_id,
      'followup_at', NEW.followup_at,
      'channel', NEW.channel,
      'outcome', NEW.outcome,
      'next_followup_at', NEW.next_followup_at,
      'sent_to', NEW.sent_to,
      'send_reference', NEW.send_reference
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qr_followups_audit ON public.quote_request_followups;
CREATE TRIGGER trg_qr_followups_audit
  AFTER INSERT OR UPDATE ON public.quote_request_followups
  FOR EACH ROW EXECUTE FUNCTION public.qr_followups_audit();

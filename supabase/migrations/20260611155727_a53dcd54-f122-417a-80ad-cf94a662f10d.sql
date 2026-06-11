
-- 1) Journey internal notes (admin-only)
CREATE TABLE IF NOT EXISTS public.journey_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  payment_request_id uuid NULL,
  quote_id uuid NULL,
  contract_summary_id uuid NULL,
  author_user_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.journey_internal_notes TO authenticated;
GRANT ALL ON public.journey_internal_notes TO service_role;

ALTER TABLE public.journey_internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read journey notes"
  ON public.journey_internal_notes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert journey notes"
  ON public.journey_internal_notes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND author_user_id = auth.uid());

CREATE POLICY "Authors edit own journey notes within 15m"
  ON public.journey_internal_notes FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND author_user_id = auth.uid()
    AND created_at > (now() - interval '15 minutes')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND author_user_id = auth.uid()
  );

-- Block all deletes (no policy = denied; trigger gives a clear error if service_role tries)
CREATE OR REPLACE FUNCTION public.journey_notes_block_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'journey_internal_notes are append-only and cannot be deleted';
END;
$$;

CREATE TRIGGER trg_journey_notes_no_delete
  BEFORE DELETE ON public.journey_internal_notes
  FOR EACH ROW EXECUTE FUNCTION public.journey_notes_block_delete();

-- Audit mirror (insert + update)
CREATE OR REPLACE FUNCTION public.journey_notes_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_user_id, action, entity, entity_id, metadata)
  VALUES (
    COALESCE(auth.uid(), NEW.author_user_id),
    CASE WHEN TG_OP = 'INSERT' THEN 'journey_note_created' ELSE 'journey_note_updated' END,
    'journey_internal_note',
    NEW.id,
    jsonb_build_object(
      'customer_id', NEW.customer_id,
      'payment_request_id', NEW.payment_request_id,
      'quote_id', NEW.quote_id,
      'contract_summary_id', NEW.contract_summary_id
    )
  );
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_journey_notes_audit
  BEFORE INSERT OR UPDATE ON public.journey_internal_notes
  FOR EACH ROW EXECUTE FUNCTION public.journey_notes_audit();

CREATE INDEX IF NOT EXISTS idx_journey_notes_customer ON public.journey_internal_notes(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_notes_pr ON public.journey_internal_notes(payment_request_id);

-- 2) email_templates.auto_send for draft/manual flag
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS auto_send boolean NOT NULL DEFAULT false;

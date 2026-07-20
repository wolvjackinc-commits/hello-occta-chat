
ALTER TABLE public.business_leads
  ADD COLUMN IF NOT EXISTS sla_preference text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS billing_contact_name text,
  ADD COLUMN IF NOT EXISTS billing_contact_email text,
  ADD COLUMN IF NOT EXISTS billing_contact_phone text,
  ADD COLUMN IF NOT EXISTS secondary_contact_name text,
  ADD COLUMN IF NOT EXISTS secondary_contact_email text,
  ADD COLUMN IF NOT EXISTS secondary_contact_phone text,
  ADD COLUMN IF NOT EXISTS site_address_line1 text,
  ADD COLUMN IF NOT EXISTS site_address_line2 text,
  ADD COLUMN IF NOT EXISTS site_city text,
  ADD COLUMN IF NOT EXISTS site_postcode text;

ALTER TABLE public.business_leads DROP CONSTRAINT IF EXISTS business_leads_sla_check;
ALTER TABLE public.business_leads
  ADD CONSTRAINT business_leads_sla_check
  CHECK (sla_preference IN ('standard','priority','enhanced'));

ALTER TABLE public.business_leads DROP CONSTRAINT IF EXISTS business_leads_status_check;
ALTER TABLE public.business_leads
  ADD CONSTRAINT business_leads_status_check
  CHECK (status IN ('new','contacted','qualified','quoted','won','lost'));

CREATE TABLE IF NOT EXISTS public.business_lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.business_leads(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_lead_notes TO authenticated;
GRANT ALL ON public.business_lead_notes TO service_role;
ALTER TABLE public.business_lead_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage lead notes" ON public.business_lead_notes;
CREATE POLICY "Admins manage lead notes" ON public.business_lead_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_business_lead_notes_lead ON public.business_lead_notes(lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.business_quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  site_count integer NOT NULL DEFAULT 1,
  services text[] NOT NULL DEFAULT '{}',
  requirements jsonb NOT NULL DEFAULT '{}',
  sla_preference text DEFAULT 'standard',
  message text,
  status text NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  internal_notes text,
  source text,
  utm jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_quotes_sla_check CHECK (sla_preference IN ('standard','priority','enhanced')),
  CONSTRAINT business_quotes_status_check CHECK (status IN ('new','reviewing','quoted','won','lost'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_quote_requests TO authenticated;
GRANT ALL ON public.business_quote_requests TO service_role;
ALTER TABLE public.business_quote_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can submit quote requests" ON public.business_quote_requests;
CREATE POLICY "Anyone can submit quote requests" ON public.business_quote_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admins read quote requests" ON public.business_quote_requests;
CREATE POLICY "Admins read quote requests" ON public.business_quote_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins update quote requests" ON public.business_quote_requests;
CREATE POLICY "Admins update quote requests" ON public.business_quote_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_business_quote_requests_status ON public.business_quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_business_quote_requests_created ON public.business_quote_requests(created_at DESC);
DROP TRIGGER IF EXISTS trg_business_quote_requests_updated_at ON public.business_quote_requests;
CREATE TRIGGER trg_business_quote_requests_updated_at
  BEFORE UPDATE ON public.business_quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.business_quote_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.business_quote_requests(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_quote_notes TO authenticated;
GRANT ALL ON public.business_quote_notes TO service_role;
ALTER TABLE public.business_quote_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage quote notes" ON public.business_quote_notes;
CREATE POLICY "Admins manage quote notes" ON public.business_quote_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owners read own ticket attachments" ON storage.objects;
CREATE POLICY "Owners read own ticket attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'business-ticket-attachments'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'))
  );

DROP POLICY IF EXISTS "Owners upload own ticket attachments" ON storage.objects;
CREATE POLICY "Owners upload own ticket attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-ticket-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Owners delete own ticket attachments" ON storage.objects;
CREATE POLICY "Owners delete own ticket attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'business-ticket-attachments'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'))
  );

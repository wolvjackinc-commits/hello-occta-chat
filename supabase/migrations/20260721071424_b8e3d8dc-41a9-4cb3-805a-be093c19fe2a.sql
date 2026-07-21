
CREATE TABLE public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  postcode text not null,
  interest text not null check (interest in ('broadband','sim','router','landline','business','other')),
  message text,
  source text,
  page_path text,
  status text not null default 'new' check (status in ('new','contacted','qualified','converted','archived')),
  assigned_to uuid,
  utm jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_leads TO authenticated;
GRANT ALL ON public.marketing_leads TO service_role;

ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

-- Only admins can read/manage leads. Inserts go through the edge function using service role.
CREATE POLICY "admins read marketing leads" ON public.marketing_leads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'business_admin'));

CREATE POLICY "admins update marketing leads" ON public.marketing_leads
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'business_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'business_admin'));

CREATE INDEX marketing_leads_status_idx ON public.marketing_leads (status, created_at DESC);
CREATE INDEX marketing_leads_interest_idx ON public.marketing_leads (interest, created_at DESC);

CREATE TRIGGER trg_marketing_leads_updated
  BEFORE UPDATE ON public.marketing_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

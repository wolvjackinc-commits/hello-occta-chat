
-- 1. business_leads
CREATE TABLE public.business_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company_size text,
  services text[] NOT NULL DEFAULT '{}',
  site_count int NOT NULL DEFAULT 1,
  message text,
  source text,
  utm jsonb,
  status text NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES auth.users(id),
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.business_leads TO anon, authenticated;
GRANT SELECT, UPDATE ON public.business_leads TO authenticated;
GRANT ALL ON public.business_leads TO service_role;

ALTER TABLE public.business_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a business lead"
  ON public.business_leads FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read business leads"
  ON public.business_leads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update business leads"
  ON public.business_leads FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_business_leads_updated_at
  BEFORE UPDATE ON public.business_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_business_leads_status ON public.business_leads(status);
CREATE INDEX idx_business_leads_created ON public.business_leads(created_at DESC);

-- 2. business_users
CREATE TYPE public.business_user_role AS ENUM ('owner', 'billing', 'tech', 'viewer');

CREATE TABLE public.business_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.business_user_role NOT NULL DEFAULT 'viewer',
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_profile_id, user_id)
);

GRANT SELECT ON public.business_users TO authenticated;
GRANT ALL ON public.business_users TO service_role;

ALTER TABLE public.business_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read their own business memberships"
  ON public.business_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage business users"
  ON public.business_users FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_business_users_updated_at
  BEFORE UPDATE ON public.business_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Security-definer helper
CREATE OR REPLACE FUNCTION public.has_business_role(
  _user_id uuid,
  _business_profile_id uuid,
  _role public.business_user_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_users
    WHERE user_id = _user_id
      AND business_profile_id = _business_profile_id
      AND role = _role
  );
$$;

-- 4. profiles additions
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'residential';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_company_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_trading_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_vat_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_company_number text;

-- 5. orders additions
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS business_po_number text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS business_billing_contact text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS business_tech_contact text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seats int;

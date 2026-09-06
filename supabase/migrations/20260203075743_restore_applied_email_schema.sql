-- Email Templates table for reusable email templates
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  variables TEXT[] DEFAULT ARRAY['first_name', 'last_name', 'full_name', 'account_number', 'email', 'phone', 'support_email', 'company_name'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Campaigns table for bulk email sends
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES public.email_templates(id),
  status TEXT NOT NULL DEFAULT 'draft',
  recipient_filter JSONB,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Campaign Recipients table for per-recipient tracking
CREATE TABLE public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  email TEXT NOT NULL,
  full_name TEXT,
  account_number TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  provider_message_id TEXT,
  queued_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  open_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_templates (admin only)
CREATE POLICY "Admins can view all templates"
ON public.email_templates FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create templates"
ON public.email_templates FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update templates"
ON public.email_templates FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete templates"
ON public.email_templates FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for campaigns (admin only)
CREATE POLICY "Admins can view all campaigns"
ON public.campaigns FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create campaigns"
ON public.campaigns FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update campaigns"
ON public.campaigns FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete campaigns"
ON public.campaigns FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for campaign_recipients (admin only)
CREATE POLICY "Admins can view all campaign recipients"
ON public.campaign_recipients FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create campaign recipients"
ON public.campaign_recipients FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update campaign recipients"
ON public.campaign_recipients FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for performance
CREATE INDEX idx_email_templates_category ON public.email_templates(category);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_template_id ON public.campaigns(template_id);
CREATE INDEX idx_campaign_recipients_campaign_id ON public.campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_status ON public.campaign_recipients(status);
CREATE INDEX idx_campaign_recipients_email ON public.campaign_recipients(email);

-- Trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

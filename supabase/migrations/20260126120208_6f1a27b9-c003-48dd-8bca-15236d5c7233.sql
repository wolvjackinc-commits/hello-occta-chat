-- Create communications_log table for tracking outbound emails
CREATE TABLE public.communications_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
    template_name TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    provider_message_id TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.communications_log ENABLE ROW LEVEL SECURITY;

-- Admin-only read access
CREATE POLICY "communications_log_admin_read"
ON public.communications_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin-only write access
CREATE POLICY "communications_log_admin_write"
ON public.communications_log
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for efficient querying
CREATE INDEX idx_communications_log_invoice_created 
ON public.communications_log (invoice_id, created_at DESC);

CREATE INDEX idx_communications_log_user_created 
ON public.communications_log (user_id, created_at DESC);

CREATE INDEX idx_communications_log_payment_request 
ON public.communications_log (payment_request_id, created_at DESC);

CREATE INDEX idx_communications_log_status 
ON public.communications_log (status);

-- Update timestamp trigger
CREATE TRIGGER update_communications_log_updated_at
BEFORE UPDATE ON public.communications_log
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
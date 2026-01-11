-- Create technicians table
CREATE TABLE public.technicians (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  specializations TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;

-- Admins can manage technicians
CREATE POLICY "Admins can manage technicians"
ON public.technicians
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add technician assignment to installation_bookings
ALTER TABLE public.installation_bookings
ADD COLUMN technician_id UUID REFERENCES public.technicians(id) ON DELETE SET NULL,
ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Create index for reminder queries
CREATE INDEX idx_installation_bookings_reminder 
ON public.installation_bookings(reminder_sent, status) 
WHERE reminder_sent = false AND status = 'confirmed';

-- Add trigger for updated_at
CREATE TRIGGER update_technicians_updated_at
  BEFORE UPDATE ON public.technicians
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
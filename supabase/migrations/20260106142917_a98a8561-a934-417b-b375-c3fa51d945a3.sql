-- Add columns for order notes (internal) and admin messages
ALTER TABLE public.guest_orders ADD COLUMN IF NOT EXISTS admin_notes text;

-- Create order_messages table for admin-customer communication
CREATE TABLE public.order_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL,
  order_type text NOT NULL CHECK (order_type IN ('guest_order', 'order')),
  sender_id uuid NOT NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('admin', 'customer')),
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on order_messages
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Policies for order_messages
CREATE POLICY "Admins can manage all order messages"
ON public.order_messages FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view messages for their orders"
ON public.order_messages FOR SELECT
USING (
  (order_type = 'guest_order' AND EXISTS (
    SELECT 1 FROM public.guest_orders 
    WHERE id = order_messages.order_id 
    AND user_id = auth.uid()
  ))
  OR
  (order_type = 'order' AND EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = order_messages.order_id 
    AND user_id = auth.uid()
  ))
);

CREATE POLICY "Users can reply to messages on their orders"
ON public.order_messages FOR INSERT
WITH CHECK (
  sender_type = 'customer' AND
  sender_id = auth.uid() AND
  (
    (order_type = 'guest_order' AND EXISTS (
      SELECT 1 FROM public.guest_orders 
      WHERE id = order_messages.order_id 
      AND user_id = auth.uid()
    ))
    OR
    (order_type = 'order' AND EXISTS (
      SELECT 1 FROM public.orders 
      WHERE id = order_messages.order_id 
      AND user_id = auth.uid()
    ))
  )
);

-- Add columns to orders table for consistency
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_notes text;

-- Add additional profile fields for admin editing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;

-- Create user_files table for admin-uploaded files
CREATE TABLE public.user_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size integer,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on user_files
ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;

-- Policies for user_files
CREATE POLICY "Admins can manage all user files"
ON public.user_files FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own files"
ON public.user_files FOR SELECT
USING (auth.uid() = user_id);

-- Create storage bucket for user files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-files',
  'user-files',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Admins can upload user files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user-files' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all user files"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-files' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own user files"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can delete user files"
ON storage.objects FOR DELETE
USING (bucket_id = 'user-files' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Add RLS policy for admins to view and update all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for order_messages for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;

-- Enable realtime for ticket_messages (already exists but ensure it's enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
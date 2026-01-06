-- Create guest_orders table for storing pre-checkout orders before account creation
CREATE TABLE public.guest_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  postcode TEXT NOT NULL,
  current_provider TEXT,
  in_contract BOOLEAN DEFAULT false,
  contract_end_date DATE,
  preferred_switch_date DATE,
  additional_notes TEXT,
  gdpr_consent BOOLEAN NOT NULL DEFAULT false,
  marketing_consent BOOLEAN DEFAULT false,
  plan_name TEXT NOT NULL,
  plan_price NUMERIC NOT NULL,
  service_type TEXT NOT NULL,
  selected_addons JSONB DEFAULT '[]'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guest_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert guest orders (no auth required for initial submission)
CREATE POLICY "Anyone can create guest orders"
ON public.guest_orders
FOR INSERT
WITH CHECK (true);

-- Policy: Users can view their own linked orders
CREATE POLICY "Users can view their linked orders"
ON public.guest_orders
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can update their own linked orders
CREATE POLICY "Users can update their linked orders"
ON public.guest_orders
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Allow updating orders by order_number and email (for linking before auth)
CREATE POLICY "Allow linking orders by email match"
ON public.guest_orders
FOR UPDATE
USING (user_id IS NULL)
WITH CHECK (true);

-- Policy: Admins can manage all guest orders
CREATE POLICY "Admins can manage all guest orders"
ON public.guest_orders
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_guest_orders_updated_at
BEFORE UPDATE ON public.guest_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_guest_orders_email ON public.guest_orders(email);
CREATE INDEX idx_guest_orders_order_number ON public.guest_orders(order_number);
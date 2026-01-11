-- Create installation slots table for managing available installation dates
CREATE TABLE public.installation_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_date DATE NOT NULL,
  slot_time TEXT NOT NULL, -- e.g., "09:00-12:00", "12:00-15:00", "15:00-18:00"
  capacity INTEGER NOT NULL DEFAULT 3,
  booked_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(slot_date, slot_time)
);

-- Enable RLS
ALTER TABLE public.installation_slots ENABLE ROW LEVEL SECURITY;

-- Anyone can view active slots with availability
CREATE POLICY "Anyone can view available slots"
ON public.installation_slots
FOR SELECT
USING (is_active = true AND booked_count < capacity);

-- Admins can manage all slots
CREATE POLICY "Admins can manage all slots"
ON public.installation_slots
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create bookings table to track slot reservations
CREATE TABLE public.installation_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID NOT NULL REFERENCES public.installation_slots(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('guest_order', 'order')),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.installation_bookings ENABLE ROW LEVEL SECURITY;

-- Admins can manage all bookings
CREATE POLICY "Admins can manage all bookings"
ON public.installation_bookings
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own bookings (via order linkage)
CREATE POLICY "Users can view their bookings via guest_orders"
ON public.installation_bookings
FOR SELECT
USING (
  order_type = 'guest_order' AND EXISTS (
    SELECT 1 FROM public.guest_orders 
    WHERE id = installation_bookings.order_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their bookings via orders"
ON public.installation_bookings
FOR SELECT
USING (
  order_type = 'order' AND EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = installation_bookings.order_id 
    AND user_id = auth.uid()
  )
);

-- Function to increment booked count when booking is made
CREATE OR REPLACE FUNCTION public.increment_slot_booking()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.installation_slots 
  SET booked_count = booked_count + 1, updated_at = now()
  WHERE id = NEW.slot_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to decrement booked count when booking is cancelled
CREATE OR REPLACE FUNCTION public.decrement_slot_booking()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
    UPDATE public.installation_slots 
    SET booked_count = booked_count - 1, updated_at = now()
    WHERE id = OLD.slot_id AND booked_count > 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Triggers
CREATE TRIGGER on_booking_created
  AFTER INSERT ON public.installation_bookings
  FOR EACH ROW EXECUTE FUNCTION public.increment_slot_booking();

CREATE TRIGGER on_booking_cancelled
  AFTER UPDATE ON public.installation_bookings
  FOR EACH ROW EXECUTE FUNCTION public.decrement_slot_booking();

-- Add trigger for updated_at
CREATE TRIGGER update_installation_slots_updated_at
  BEFORE UPDATE ON public.installation_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_installation_bookings_updated_at
  BEFORE UPDATE ON public.installation_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Add status column to guest_orders for tracking fulfillment
ALTER TABLE public.guest_orders 
ADD COLUMN status text NOT NULL DEFAULT 'pending';

-- Add index for status queries
CREATE INDEX idx_guest_orders_status ON public.guest_orders(status);
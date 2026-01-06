-- Add account_number column to guest_orders
ALTER TABLE public.guest_orders 
ADD COLUMN IF NOT EXISTS account_number TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_guest_orders_account_number ON public.guest_orders(account_number);

-- Create function to generate account number
CREATE OR REPLACE FUNCTION public.generate_account_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_account_number TEXT;
  account_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate format: OCC + 8 random digits
    new_account_number := 'OCC' || LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0');
    
    -- Check if it already exists
    SELECT EXISTS(SELECT 1 FROM guest_orders WHERE account_number = new_account_number) INTO account_exists;
    
    EXIT WHEN NOT account_exists;
  END LOOP;
  
  RETURN new_account_number;
END;
$$;

-- Create trigger function to auto-assign account number when order becomes active
CREATE OR REPLACE FUNCTION public.assign_account_number_on_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only assign if status changed to 'active' and no account number exists
  IF NEW.status = 'active' AND OLD.status != 'active' AND NEW.account_number IS NULL THEN
    NEW.account_number := public.generate_account_number();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_assign_account_number ON public.guest_orders;
CREATE TRIGGER trigger_assign_account_number
  BEFORE UPDATE ON public.guest_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_account_number_on_active();
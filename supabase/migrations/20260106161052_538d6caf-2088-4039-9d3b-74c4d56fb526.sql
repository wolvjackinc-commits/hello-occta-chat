-- Fix #1: Add validation trigger for guest_orders
-- Creates server-side validation to prevent malformed data insertion

CREATE OR REPLACE FUNCTION public.validate_guest_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate email format
  IF NEW.email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  
  -- Validate email length
  IF LENGTH(NEW.email) < 5 OR LENGTH(NEW.email) > 100 THEN
    RAISE EXCEPTION 'Email must be between 5 and 100 characters';
  END IF;
  
  -- Validate full name length
  IF LENGTH(NEW.full_name) < 2 OR LENGTH(NEW.full_name) > 100 THEN
    RAISE EXCEPTION 'Full name must be between 2 and 100 characters';
  END IF;
  
  -- Validate phone length
  IF LENGTH(NEW.phone) < 10 OR LENGTH(NEW.phone) > 15 THEN
    RAISE EXCEPTION 'Phone must be between 10 and 15 characters';
  END IF;
  
  -- Validate address length
  IF LENGTH(NEW.address_line1) < 3 OR LENGTH(NEW.address_line1) > 100 THEN
    RAISE EXCEPTION 'Address must be between 3 and 100 characters';
  END IF;
  
  -- Validate city length
  IF LENGTH(NEW.city) < 2 OR LENGTH(NEW.city) > 50 THEN
    RAISE EXCEPTION 'City must be between 2 and 50 characters';
  END IF;
  
  -- Validate postcode length
  IF LENGTH(NEW.postcode) < 5 OR LENGTH(NEW.postcode) > 10 THEN
    RAISE EXCEPTION 'Postcode must be between 5 and 10 characters';
  END IF;
  
  -- Normalize data
  NEW.full_name := trim(NEW.full_name);
  NEW.email := lower(trim(NEW.email));
  NEW.phone := trim(NEW.phone);
  NEW.address_line1 := trim(NEW.address_line1);
  NEW.city := trim(NEW.city);
  NEW.postcode := upper(trim(NEW.postcode));
  
  RETURN NEW;
END;
$$;

-- Create trigger for validation
DROP TRIGGER IF EXISTS validate_guest_order_trigger ON public.guest_orders;
CREATE TRIGGER validate_guest_order_trigger
BEFORE INSERT OR UPDATE ON public.guest_orders
FOR EACH ROW EXECUTE FUNCTION public.validate_guest_order();

-- Fix #2: Remove dangerous RLS policies that expose PII
DROP POLICY IF EXISTS "Allow selecting unlinked orders by order_number" ON public.guest_orders;
DROP POLICY IF EXISTS "Allow linking orders by email match" ON public.guest_orders;
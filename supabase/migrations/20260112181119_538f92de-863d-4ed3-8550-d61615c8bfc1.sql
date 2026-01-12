-- Add account_number column to profiles
ALTER TABLE public.profiles 
ADD COLUMN account_number TEXT UNIQUE;

-- Create index for account number lookups
CREATE INDEX idx_profiles_account_number ON public.profiles(account_number);

-- Create function to generate user account number (OCC + 8 digits)
CREATE OR REPLACE FUNCTION public.generate_user_account_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_account_number TEXT;
  account_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate format: OCC + 8 random digits
    new_account_number := 'OCC' || LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0');
    
    -- Check if it already exists in profiles or guest_orders
    SELECT EXISTS(
      SELECT 1 FROM profiles WHERE account_number = new_account_number
      UNION
      SELECT 1 FROM guest_orders WHERE account_number = new_account_number
    ) INTO account_exists;
    
    EXIT WHEN NOT account_exists;
  END LOOP;
  
  RETURN new_account_number;
END;
$$;

-- Create trigger function to assign account number on profile creation
CREATE OR REPLACE FUNCTION public.assign_profile_account_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_number IS NULL THEN
    NEW.account_number := public.generate_user_account_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for new profiles
CREATE TRIGGER trigger_assign_profile_account_number
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_profile_account_number();

-- Assign account numbers to existing profiles that don't have one
UPDATE public.profiles 
SET account_number = public.generate_user_account_number()
WHERE account_number IS NULL;
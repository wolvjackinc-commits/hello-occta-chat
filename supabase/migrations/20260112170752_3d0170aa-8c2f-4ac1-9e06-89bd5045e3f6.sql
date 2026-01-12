-- Remove the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public can lookup orders by order number and email" ON public.guest_orders;

-- Create a secure RPC function for order lookup that requires matching order_number AND email
-- This function only returns non-sensitive fields needed for order tracking
CREATE OR REPLACE FUNCTION public.lookup_guest_order(
  _order_number text,
  _email text
)
RETURNS TABLE(
  id uuid,
  order_number text,
  full_name text,
  email text,
  service_type text,
  plan_name text,
  plan_price numeric,
  status text,
  created_at timestamptz,
  address_line1 text,
  city text,
  postcode text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate inputs
  IF _order_number IS NULL OR trim(_order_number) = '' THEN
    RAISE EXCEPTION 'Order number is required';
  END IF;
  
  IF _email IS NULL OR trim(_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  
  -- Rate limiting - 10 lookups per 15 minutes per email
  IF NOT check_rate_limit(lower(trim(_email)), 'order_lookup', 10, 15) THEN
    RAISE EXCEPTION 'Too many lookup attempts. Please try again later.';
  END IF;
  
  -- Return only the fields needed for order tracking (no sensitive PII like phone, DOB, account_number, etc.)
  RETURN QUERY
  SELECT 
    go.id,
    go.order_number,
    go.full_name,
    go.email,
    go.service_type,
    go.plan_name,
    go.plan_price,
    go.status,
    go.created_at,
    go.address_line1,
    go.city,
    go.postcode
  FROM guest_orders go
  WHERE go.order_number = upper(trim(_order_number))
    AND go.email = lower(trim(_email));
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.lookup_guest_order(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_guest_order(text, text) TO authenticated;
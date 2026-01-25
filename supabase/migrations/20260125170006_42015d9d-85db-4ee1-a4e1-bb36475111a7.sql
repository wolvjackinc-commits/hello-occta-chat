-- Create view for admin customer search with latest postcode
CREATE OR REPLACE VIEW admin_customer_search_view AS
SELECT 
  p.id,
  p.full_name,
  p.email,
  p.phone,
  p.account_number,
  p.date_of_birth,
  p.created_at,
  p.updated_at,
  COALESCE(
    (SELECT o.postcode FROM orders o WHERE o.user_id = p.id ORDER BY o.created_at DESC LIMIT 1),
    (SELECT go.postcode FROM guest_orders go WHERE go.user_id = p.id ORDER BY go.created_at DESC LIMIT 1),
    p.postcode
  ) AS latest_postcode,
  UPPER(REPLACE(COALESCE(
    (SELECT o.postcode FROM orders o WHERE o.user_id = p.id ORDER BY o.created_at DESC LIMIT 1),
    (SELECT go.postcode FROM guest_orders go WHERE go.user_id = p.id ORDER BY go.created_at DESC LIMIT 1),
    p.postcode
  ), ' ', '')) AS latest_postcode_normalized
FROM profiles p;

-- Index for case-insensitive name search
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_lower 
  ON profiles (LOWER(full_name));

-- Index for DOB exact match
CREATE INDEX IF NOT EXISTS idx_profiles_date_of_birth 
  ON profiles (date_of_birth);

-- Index for efficient latest order lookup
CREATE INDEX IF NOT EXISTS idx_orders_user_created 
  ON orders (user_id, created_at DESC);

-- Index for guest orders latest lookup  
CREATE INDEX IF NOT EXISTS idx_guest_orders_user_created 
  ON guest_orders (user_id, created_at DESC);

-- Index for postcode search on orders (normalized)
CREATE INDEX IF NOT EXISTS idx_orders_postcode_normalized 
  ON orders (UPPER(REPLACE(postcode, ' ', '')));

-- Index for postcode search on guest_orders (normalized)
CREATE INDEX IF NOT EXISTS idx_guest_orders_postcode_normalized 
  ON guest_orders (UPPER(REPLACE(postcode, ' ', '')));
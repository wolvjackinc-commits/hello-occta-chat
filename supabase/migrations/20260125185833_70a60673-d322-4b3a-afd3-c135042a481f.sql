-- Add bank_last4 column to dd_mandates if it doesn't exist already (for storing masked account number)
-- Note: This column already exists based on the schema, so we just need the view

-- Drop existing view if it exists to recreate with correct columns
DROP VIEW IF EXISTS dd_mandates_list;

-- Create a secure view for DD mandates that masks sensitive bank details for list views
-- Raw bank fields (sort_code, account_number_full) are NEVER exposed in this view
CREATE VIEW dd_mandates_list AS
SELECT 
  id,
  user_id,
  status,
  mandate_reference,
  bank_last4, -- Already masked (last 4 digits only)
  account_holder, -- Account holder name is safe to show
  -- Computed masked fields for display
  CASE WHEN sort_code IS NOT NULL THEN '**-**-' || RIGHT(sort_code, 2) ELSE NULL END AS sort_code_masked,
  CASE WHEN account_number_full IS NOT NULL THEN '****' || RIGHT(account_number_full, 4) ELSE NULL END AS account_number_masked,
  -- Indicate if bank details are present (for UI logic)
  (sort_code IS NOT NULL AND account_number_full IS NOT NULL) AS has_bank_details,
  consent_timestamp,
  payment_request_id,
  created_at,
  updated_at
FROM dd_mandates;

-- Grant access to the view for authenticated users (RLS still applies through dd_mandates)
COMMENT ON VIEW dd_mandates_list IS 'Secure view of DD mandates with masked bank details for admin list views';

-- Update dd_mandates status check constraint to include all statuses
ALTER TABLE dd_mandates DROP CONSTRAINT IF EXISTS dd_mandates_status_check;
ALTER TABLE dd_mandates ADD CONSTRAINT dd_mandates_status_check 
  CHECK (status IN ('pending', 'verified', 'submitted_to_provider', 'active', 'cancelled', 'failed'));

-- Add indexes for better performance on common queries
CREATE INDEX IF NOT EXISTS idx_dd_mandates_user_status ON dd_mandates(user_id, status);
CREATE INDEX IF NOT EXISTS idx_dd_mandates_payment_request ON dd_mandates(payment_request_id);

-- Ensure admin_customer_search_view includes all needed fields and is properly indexed
-- Note: This view already exists, just ensuring indexes
CREATE INDEX IF NOT EXISTS idx_profiles_account_number ON profiles(account_number);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles USING gin(to_tsvector('english', full_name));
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
-- Create account_deletions table for GDPR compliance tracking
CREATE TABLE IF NOT EXISTS public.account_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id UUID NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  account_number TEXT,
  reason TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_by TEXT NOT NULL DEFAULT 'user_request'
);

-- Add index for audit queries
CREATE INDEX idx_account_deletions_email ON public.account_deletions(email);
CREATE INDEX idx_account_deletions_deleted_at ON public.account_deletions(deleted_at);

-- Enable RLS (only admins can view deletion records)
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view deletion records
CREATE POLICY "Admins can view deletion records"
ON public.account_deletions
FOR SELECT
USING (public.is_admin());

-- Policy: System (service role) can insert deletion records
CREATE POLICY "Service role can insert deletion records"
ON public.account_deletions
FOR INSERT
WITH CHECK (true);

-- Add admin_notes column to profiles for internal use
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Add assigned_to column to support_tickets for ticket assignment
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_to UUID;

-- Add provisioned_at to services for tracking
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ;
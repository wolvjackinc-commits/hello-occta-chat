-- OCCTA Admin Core Schema Updates
-- Creates audit_logs table and is_admin helper function

-- =========================
-- AUDIT LOGS TABLE
-- =========================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs policies - only admins can read/write
DROP POLICY IF EXISTS audit_logs_admin_read ON public.audit_logs;
CREATE POLICY audit_logs_admin_read ON public.audit_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS audit_logs_admin_write ON public.audit_logs;
CREATE POLICY audit_logs_admin_write ON public.audit_logs
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =========================
-- IS_ADMIN HELPER FUNCTION
-- =========================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
  )
$$;

-- =========================
-- UPDATE INVOICES TABLE - Add missing columns
-- =========================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'tax') THEN
    ALTER TABLE public.invoices ADD COLUMN tax numeric DEFAULT 0;
  END IF;
END $$;

-- =========================
-- UPDATE DD_MANDATES TABLE - Add account_holder column
-- =========================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dd_mandates' AND column_name = 'account_holder') THEN
    ALTER TABLE public.dd_mandates ADD COLUMN account_holder text;
  END IF;
END $$;

-- =========================
-- UPDATE PAYMENT_ATTEMPTS TABLE - Add provider_ref column
-- =========================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_attempts' AND column_name = 'provider_ref') THEN
    ALTER TABLE public.payment_attempts ADD COLUMN provider_ref text;
  END IF;
END $$;

-- =========================
-- UPDATE TICKET_MESSAGES TABLE - Add sender_role column
-- =========================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ticket_messages' AND column_name = 'sender_role') THEN
    ALTER TABLE public.ticket_messages ADD COLUMN sender_role text DEFAULT 'customer';
  END IF;
END $$;

-- =========================
-- UPDATE SERVICES TABLE - Add supplier_ref alias
-- =========================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'supplier_ref') THEN
    ALTER TABLE public.services ADD COLUMN supplier_ref text;
  END IF;
END $$;

-- =========================
-- CREATE FUNCTION TO LOG AUDIT ACTIONS
-- =========================
CREATE OR REPLACE FUNCTION public.log_audit_action(
  _action text,
  _entity text,
  _entity_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _audit_id uuid;
BEGIN
  INSERT INTO public.audit_logs (actor_user_id, action, entity, entity_id, metadata)
  VALUES (auth.uid(), _action, _entity, _entity_id, _metadata)
  RETURNING id INTO _audit_id;
  
  RETURN _audit_id;
END;
$$;
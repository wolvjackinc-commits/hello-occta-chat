-- Restore browser access to Direct Debit mandate rows for authenticated users.
-- Row-level security remains authoritative: customers can only access their own
-- permitted rows and privileged staff access is constrained by the existing
-- dd_mandates RLS policies. This migration changes no mandate data or status.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dd_mandates TO authenticated;

COMMENT ON TABLE public.dd_mandates IS
  'Direct Debit mandate records. Browser access is protected by RLS; authenticated table grants are required for the admin/customer mandate views to function.';

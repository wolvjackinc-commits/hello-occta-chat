-- The 2026-08-24 hardening migration revoked EXECUTE on these helpers from
-- `authenticated`, but 19 RLS policies call them (supplier_products,
-- pricing_rules, margin_rules, supplier_profiles, plan_categories, rewards,
-- points_ledger, compliance and marketing tables). Postgres evaluates every
-- applicable policy, so the revoke made those tables fail with
-- "permission denied for function has_finance_access" even for admins.
--
-- They are pure role lookups (SECURITY DEFINER, boolean), exactly like
-- is_staff() and has_role(), which authenticated can already execute.
-- Anonymous visitors stay revoked.
GRANT EXECUTE ON FUNCTION public.has_finance_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_compliance_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_marketing_access(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_finance_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_compliance_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_marketing_access(uuid) FROM anon;

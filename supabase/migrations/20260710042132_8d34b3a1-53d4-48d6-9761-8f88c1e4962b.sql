-- Remove the permissive read rule that exposed full sim_plans rows (including
-- supplier_cost_ex_vat_minor, occta_margin_ex_vat_minor, supplier_name,
-- source_network, source_tariff_code, internal_notes) to anon and authenticated.
DROP POLICY IF EXISTS "sim_plans public visible read" ON public.sim_plans;

-- Revoke any column-level SELECT grants previously issued to anon/authenticated
-- on the base table. Public reads must go through public.sim_plans_public only.
REVOKE SELECT ON public.sim_plans FROM anon;
REVOKE SELECT ON public.sim_plans FROM authenticated;

-- Public view stays readable. It is owned by postgres and not defined with
-- security_invoker, so it reads the base table with owner privileges and is
-- unaffected by the policy/grant changes above.
GRANT SELECT ON public.sim_plans_public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sim_plans TO authenticated;
GRANT ALL ON public.sim_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sim_settings TO authenticated;
GRANT ALL ON public.sim_settings TO service_role;
GRANT EXECUTE ON FUNCTION public.is_vat_active() TO authenticated, anon, service_role;
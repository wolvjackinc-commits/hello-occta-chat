-- OCCTA Care terms v3: section 5 names both Direct Debit collectors (AccessPay or FastPay). Nothing else changes.
INSERT INTO public.care_terms_versions(version, effective_from, summary, terms_sha256, rules)
SELECT 'care-2026-11-v3', '2026-11-03T00:00:00Z', summary,
  '20e30c56ec34de6c8b82515262f35b5dc631a40a2e74ee73820a4f2b37b29878', rules
FROM public.care_terms_versions WHERE version = 'care-2026-11-v2'
ON CONFLICT (version) DO NOTHING;
UPDATE public.care_settings SET current_terms_version = 'care-2026-11-v3', updated_at = now() WHERE singleton;

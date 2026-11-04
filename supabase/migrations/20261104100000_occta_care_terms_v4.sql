-- OCCTA Care terms v4: payment day is the day agreed when joining (1st-28th), not only the 1st or 15th. Nothing else changes.
INSERT INTO public.care_terms_versions(version, effective_from, summary, terms_sha256, rules)
SELECT 'care-2026-11-v4', '2026-11-04T00:00:00Z', summary,
  'c031364312507d1d5edebf92e219381fbc047959bf8850d22f2115effc70b118', rules
FROM public.care_terms_versions WHERE version = 'care-2026-11-v3'
ON CONFLICT (version) DO NOTHING;
UPDATE public.care_settings SET current_terms_version = 'care-2026-11-v4', updated_at = now() WHERE singleton;

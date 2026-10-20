-- Digital Voice add-on: one price everywhere.
--
-- Marketing pages advertise Digital Voice from £4.95/mo (voice catalogue
-- 'home-phone-payg'), and the /pre-checkout path bills that, but the Build
-- Plan add-on was still seeded at £5.99. Future quotes and builds use £4.95.
-- Existing customer service prices and accepted Contract Summaries are
-- deliberately untouched.
UPDATE public.platform_settings
SET fair_pricing = jsonb_set(fair_pricing, '{addons,digitalVoiceMonthly}', '4.95'::jsonb, true),
    updated_at = now()
WHERE singleton = true;

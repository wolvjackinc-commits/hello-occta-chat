ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS fair_pricing JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS speed_bucket TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS plan_term TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS router_option JSONB;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS setup_option JSONB;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS selected_addons JSONB;

ALTER TABLE public.contract_summaries ADD COLUMN IF NOT EXISTS speed_bucket TEXT;
ALTER TABLE public.contract_summaries ADD COLUMN IF NOT EXISTS plan_term TEXT;
ALTER TABLE public.contract_summaries ADD COLUMN IF NOT EXISTS router_option JSONB;
ALTER TABLE public.contract_summaries ADD COLUMN IF NOT EXISTS setup_option JSONB;
ALTER TABLE public.contract_summaries ADD COLUMN IF NOT EXISTS selected_addons JSONB;

-- Seed sensible defaults into fair_pricing if empty
UPDATE public.platform_settings
SET fair_pricing = jsonb_build_object(
  'enabled', true,
  'priceLockEnabled', true,
  'flex30Enabled', true,
  'headline', jsonb_build_object(
    'essential',  jsonb_build_object('lock24', 29.99, 'flex30', 32.99),
    'superfast',  jsonb_build_object('lock24', 34.99, 'flex30', 37.99),
    'ultrafast',  jsonb_build_object('lock24', 39.99, 'flex30', 44.99),
    'gigabit',    jsonb_build_object('lock24', 44.99, 'flex30', 49.99)
  ),
  'router', jsonb_build_object(
    'standardOneOff', 79.99, 'standardMonthly', 4.99,
    'premiumOneOff', 129.99, 'premiumMonthly', 7.99
  ),
  'setup', jsonb_build_object(
    'remote', 0, 'standard', 49.99, 'engineer', 99.99
  ),
  'addons', jsonb_build_object(
    'priorityMonthly', 6.99, 'staticIpMonthly', 5.00,
    'digitalVoiceMonthly', 5.99, 'paperBillingMonthly', 2.50
  ),
  'buffers', jsonb_build_object(
    'support', 1.00, 'paymentFailure', 0.50,
    'lockRisk', 1.00, 'flexRisk', 2.00, 'rewards', 0.00
  ),
  'floors', jsonb_build_object(
    'essentialLockByo', 1.50, 'essentialFlex', 3.50,
    'superfast', 3.50, 'ultrafast', 4.50, 'gigabit', 4.50
  ),
  'fallback', 'auto_bump'
)
WHERE singleton = true AND (fair_pricing = '{}'::jsonb OR fair_pricing IS NULL);
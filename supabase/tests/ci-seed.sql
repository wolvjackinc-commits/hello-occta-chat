-- CI seed: dedicated TEST-only catalogue and safety settings.
-- Never seeds customers, orders, invoices or any live queue data.
DO $$ BEGIN
  IF current_setting('cron.launch_active_jobs', true) IS DISTINCT FROM 'off' THEN
    RAISE EXCEPTION 'CI seed requires the isolated stack with cron disabled';
  END IF;
END $$;

insert into public.platform_settings (singleton)
values (true)
on conflict (singleton) do nothing;

update public.platform_settings set
  customer_journey_v1_enabled = true,
  customer_journey_v2_enabled = false,
  customer_journey_default = 'v1',
  customer_journey_v2_kill_switch = true,
  customer_journey_v2_test_mode = true,
  customer_journey_v2_rollout_percentage = 0,
  vat_default_rate = 20
where singleton = true;

-- Imported ratecard rows are intentionally inactive on a fresh database.
-- Supply the exact path the real engine suite exercises, clearly labelled as
-- synthetic rather than enabling an unreviewed wholesale import.
WITH supplier AS (
  SELECT id FROM public.supplier_profiles WHERE supplier_name ILIKE '%Giacom%'
  ORDER BY created_at LIMIT 1
)
INSERT INTO public.supplier_products (
  supplier_id, supplier_product_id, product_name, service_type, technology,
  network, download_speed_mbps, upload_speed_mbps, min_term_months,
  supplier_monthly_net, supplier_router_net, connection_fee_net,
  migration_fee_net, care_level_uplift_net, router_required,
  disconnect_fee_in_12m_net, disconnect_fee_after_12m_net,
  bucket_hint, quote_only, active, tags, notes
)
SELECT id, 'TEST-CI-SUPERFAST-FLEX', 'TEST CI Superfast 330/50', 'broadband', 'FTTP',
  'TEST', 330, 50, 1, 15, 40, 10, 0, 0, false, 0, 0,
  'superfast', false, true, ARRAY['TEST','CI'], 'Synthetic local engine fixture; never deploy this seed'
FROM supplier
ON CONFLICT (supplier_id, supplier_product_id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.supplier_products WHERE supplier_product_id='TEST-CI-SUPERFAST-FLEX') THEN
    RAISE EXCEPTION 'Canonical Giacom supplier is missing from the replay';
  END IF;
END $$;

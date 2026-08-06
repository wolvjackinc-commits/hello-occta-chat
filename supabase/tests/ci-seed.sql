-- CI seed: dedicated TEST-only catalogue and safety settings.
-- Never seeds customers, orders, invoices or any live queue data.
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

-- Contract Summary / Giacom Broadband Ratecard V4.0 hardening
-- Effective ratecard: 1 August 2026.
-- This migration updates internal supplier economics only for future pricing.
-- It does NOT rewrite any accepted customer Contract Summary or PDF.

ALTER TABLE public.contract_summaries
  ADD COLUMN IF NOT EXISTS is_information_update boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contract_summaries.is_information_update IS
  'True only for a non-acceptance customer information refresh that preserves an earlier accepted agreement.';

-- Keep customer portal visibility while allowing the UI to distinguish a
-- non-signable information refresh from a Contract Summary requiring acceptance.
CREATE OR REPLACE VIEW public.customer_contract_summaries AS
SELECT
  id, cs_number, quote_id, quote_request_id, customer_id, version, status,
  customer_email_snapshot, customer_name_snapshot, service_address, plan_name,
  service_type, plan_type, customer_type, monthly_price_incl_vat,
  business_monthly_ex_vat, business_monthly_incl_vat, one_off_charges_json,
  setup_charge, router_charge, delivery_charge, installation_charge,
  cease_cancellation_charges, contract_length, notice_period,
  estimated_download_speed, estimated_upload_speed, speed_notes,
  price_rise_policy, digital_voice_warning, complaints_adr_info,
  payment_schedule, terms_version, privacy_version, token_expires_at,
  issued_at, accepted_at, pdf_url, emailed_at, created_at, updated_at,
  speed_bucket, plan_term, router_option, setup_option, selected_addons,
  pdf_storage_key, pdf_generated_at, account_number, is_information_update
FROM public.contract_summaries
WHERE customer_id = auth.uid();

-- V4.0 supplier economics. All figures are Giacom wholesale net/ex-VAT.
-- For automatic quoting, connection_fee_net is deliberately the conservative
-- standard new-connection charge for the product/term. The resolver turns this
-- into a disclosed retail setup/activation charge and never treats NULL as zero.
UPDATE public.supplier_products sp
SET
  source_document = 'giacom_broadband_ratecard_v4.0',
  source_page = CASE sp.network
    WHEN 'Sky' THEN 'p3-p5,p12'
    WHEN 'CityFibre' THEN 'p6,p12-p13'
    WHEN 'BT' THEN 'p8-p9,p12-p13'
    WHEN 'Vodafone' THEN 'p10,p12-p13'
    ELSE sp.source_page
  END,
  source_section = CASE sp.network
    WHEN 'Sky' THEN 'Sky Business Wholesale rentals/connections; termination fees'
    WHEN 'CityFibre' THEN 'CityFibre rentals/connections; termination fees; routers'
    WHEN 'BT' THEN 'BT Wholesale rentals/connections; termination fees; routers'
    WHEN 'Vodafone' THEN 'Vodafone rentals/connections; termination fees; routers'
    ELSE sp.source_section
  END,
  bucket_hint = CASE WHEN sp.download_speed_mbps = 330 THEN 'superfast' ELSE sp.bucket_hint END,
  connection_fee_net = CASE
    WHEN sp.network = 'Sky' AND sp.min_term_months = 1 AND sp.technology = 'FTTP' THEN 69.00
    WHEN sp.network = 'Sky' AND sp.min_term_months = 1 AND sp.technology = 'SOGEA' THEN 67.00
    WHEN sp.network = 'Sky' AND sp.min_term_months IN (24,36) THEN 0.00
    WHEN sp.network = 'BT' AND sp.min_term_months = 12 AND sp.technology = 'FTTP' THEN 69.00
    WHEN sp.network = 'BT' AND sp.min_term_months = 1 AND sp.technology = 'SOGEA' THEN 69.00
    WHEN sp.network = 'BT' AND sp.min_term_months IN (24,36) THEN 0.00
    WHEN sp.network = 'Vodafone' AND sp.min_term_months = 1 THEN 69.00
    WHEN sp.network = 'CityFibre' AND sp.min_term_months = 1 THEN 59.00
    ELSE sp.connection_fee_net
  END,
  migration_fee_net = CASE
    WHEN sp.network = 'Sky' AND sp.technology = 'FTTP' THEN 16.00
    WHEN sp.network = 'Sky' AND sp.technology = 'SOGEA' THEN 0.00
    WHEN sp.network = 'BT' AND sp.technology = 'FTTP' THEN 16.75
    WHEN sp.network = 'BT' AND sp.technology = 'SOGEA' THEN 0.00
    WHEN sp.network IN ('Vodafone','CityFibre') THEN 0.00
    ELSE sp.migration_fee_net
  END,
  supplier_router_net = CASE
    WHEN sp.network IN ('BT','Vodafone','CityFibre') THEN 72.00
    WHEN sp.network = 'Sky' THEN NULL
    ELSE sp.supplier_router_net
  END,
  disconnect_fee_in_12m_net = CASE
    WHEN sp.network = 'Sky' THEN 95.00
    WHEN sp.network = 'CityFibre' THEN 75.00
    WHEN sp.network = 'BT' THEN 85.59
    WHEN sp.network = 'Vodafone' THEN 75.00
    ELSE sp.disconnect_fee_in_12m_net
  END,
  disconnect_fee_after_12m_net = CASE
    WHEN sp.network = 'Sky' THEN 50.00
    WHEN sp.network = 'CityFibre' THEN 25.00
    WHEN sp.network = 'BT' THEN 35.59
    WHEN sp.network = 'Vodafone' THEN 25.00
    ELSE sp.disconnect_fee_after_12m_net
  END,
  etf_applies = true,
  updated_at = now()
FROM public.supplier_profiles s
WHERE sp.supplier_id = s.id
  AND s.supplier_name ILIKE '%Giacom%'
  AND sp.service_type = 'broadband'
  AND sp.active = true
  AND sp.network IN ('Sky','CityFibre','BT','Vodafone');

-- Future public/admin headline prices. Existing customer service prices and
-- accepted Contract Summaries are deliberately untouched.
UPDATE public.platform_settings
SET fair_pricing = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(fair_pricing,
            '{headline,superfast,lock24}', '43.99'::jsonb, true),
          '{headline,superfast,flex30}', '45.99'::jsonb, true),
        '{headline,ultrafast,lock24}', '51.99'::jsonb, true),
      '{headline,gigabit,lock24}', '57.99'::jsonb, true),
    '{headline,gigabit,flex30}', '58.99'::jsonb, true),
  '{router,standardOneOff}', '94.99'::jsonb, true),
  updated_at = now()
WHERE singleton = true;

UPDATE public.platform_settings
SET fair_pricing = jsonb_set(fair_pricing, '{setup,engineer}', '134.99'::jsonb, true),
    updated_at = now()
WHERE singleton = true;

UPDATE public.retail_price_floors
SET floor_monthly_gross = CASE
  WHEN speed_bucket = 'essential' AND plan_term = 'price_lock_24' THEN 34.99
  WHEN speed_bucket = 'essential' AND plan_term = 'flex_30' THEN 37.99
  WHEN speed_bucket = 'superfast' AND plan_term = 'price_lock_24' THEN 43.99
  WHEN speed_bucket = 'superfast' AND plan_term = 'flex_30' THEN 45.99
  WHEN speed_bucket = 'ultrafast' AND plan_term = 'price_lock_24' THEN 51.99
  WHEN speed_bucket = 'ultrafast' AND plan_term = 'flex_30' THEN 52.99
  WHEN speed_bucket = 'gigabit' AND plan_term = 'price_lock_24' THEN 57.99
  WHEN speed_bucket = 'gigabit' AND plan_term = 'flex_30' THEN 58.99
  ELSE floor_monthly_gross
END,
updated_at = now()
WHERE service_type = 'broadband' AND active = true;

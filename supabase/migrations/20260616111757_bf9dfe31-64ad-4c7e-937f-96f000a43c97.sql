
CREATE OR REPLACE VIEW public.customer_profile AS
SELECT id, email, full_name, phone, address_line1, address_line2, city, postcode,
       date_of_birth, account_number, created_at, updated_at
FROM public.profiles
WHERE id = auth.uid();
GRANT SELECT ON public.customer_profile TO authenticated;

CREATE OR REPLACE VIEW public.customer_orders AS
SELECT id, user_id, service_type, plan_name, plan_price, status, postcode,
       address_line1, address_line2, city, installation_date, notes,
       created_at, updated_at, journey_id, payment_method, billing_anchor_day,
       preferred_start_date, cooling_off_ends_at
FROM public.orders
WHERE user_id = auth.uid();
GRANT SELECT ON public.customer_orders TO authenticated;

CREATE OR REPLACE VIEW public.customer_guest_orders AS
SELECT id, order_number, email, full_name, phone, address_line1, address_line2,
       city, postcode, current_provider, in_contract, contract_end_date,
       preferred_switch_date, additional_notes, gdpr_consent, marketing_consent,
       plan_name, plan_price, service_type, selected_addons, user_id, linked_at,
       created_at, updated_at, status, account_number
FROM public.guest_orders
WHERE user_id = auth.uid();
GRANT SELECT ON public.customer_guest_orders TO authenticated;

CREATE OR REPLACE VIEW public.customer_contract_summaries AS
SELECT id, cs_number, quote_id, quote_request_id, customer_id, version, status,
       customer_email_snapshot, customer_name_snapshot, service_address, plan_name,
       service_type, plan_type, customer_type, monthly_price_incl_vat,
       business_monthly_ex_vat, business_monthly_incl_vat, one_off_charges_json,
       setup_charge, router_charge, delivery_charge, installation_charge,
       cease_cancellation_charges, contract_length, notice_period,
       estimated_download_speed, estimated_upload_speed, speed_notes,
       price_rise_policy, digital_voice_warning, complaints_adr_info,
       payment_schedule, terms_version, privacy_version,
       token_expires_at, issued_at, accepted_at, pdf_url, emailed_at,
       created_at, updated_at, speed_bucket, plan_term, router_option, setup_option,
       selected_addons, pdf_storage_key, pdf_generated_at, account_number
FROM public.contract_summaries
WHERE customer_id = auth.uid();
GRANT SELECT ON public.customer_contract_summaries TO authenticated;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own linked orders" ON public.guest_orders;
DROP POLICY IF EXISTS "cs_customer_select_own" ON public.contract_summaries;

DROP FUNCTION IF EXISTS public.get_customer_contract_summary_by_id(uuid);
CREATE FUNCTION public.get_customer_contract_summary_by_id(_id uuid)
RETURNS TABLE(
  id uuid, cs_number text, quote_id uuid, quote_request_id uuid, version integer, status text,
  customer_name_snapshot text, customer_email_snapshot text, service_address text,
  plan_name text, service_type text, plan_type text, customer_type text,
  monthly_price_incl_vat numeric, business_monthly_ex_vat numeric, business_monthly_incl_vat numeric,
  one_off_charges_json jsonb, setup_charge numeric, router_charge numeric, delivery_charge numeric,
  installation_charge numeric, cease_cancellation_charges text, contract_length text, notice_period text,
  estimated_download_speed integer, estimated_upload_speed integer, speed_notes text,
  price_rise_policy text, digital_voice_warning text, complaints_adr_info text,
  payment_schedule text, terms_version text, privacy_version text,
  issued_at timestamp with time zone, accepted_at timestamp with time zone,
  account_number text, pdf_storage_key text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT cs.id, cs.cs_number, cs.quote_id, cs.quote_request_id,
         cs.version, cs.status::text,
         cs.customer_name_snapshot, cs.customer_email_snapshot,
         cs.service_address, cs.plan_name,
         cs.service_type::text, cs.plan_type::text, cs.customer_type::text,
         cs.monthly_price_incl_vat, cs.business_monthly_ex_vat, cs.business_monthly_incl_vat,
         cs.one_off_charges_json, cs.setup_charge, cs.router_charge, cs.delivery_charge,
         cs.installation_charge, cs.cease_cancellation_charges, cs.contract_length, cs.notice_period,
         cs.estimated_download_speed, cs.estimated_upload_speed, cs.speed_notes,
         cs.price_rise_policy, cs.digital_voice_warning, cs.complaints_adr_info,
         cs.payment_schedule, cs.terms_version, cs.privacy_version,
         cs.issued_at, cs.accepted_at, cs.account_number, cs.pdf_storage_key
  FROM public.contract_summaries cs
  WHERE cs.id = _id AND cs.customer_id = auth.uid()
  LIMIT 1
$function$;

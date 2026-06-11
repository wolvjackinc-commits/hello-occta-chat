
-- 1. Enum values
ALTER TYPE public.quote_request_status ADD VALUE IF NOT EXISTS 'contract_summary_generated';
ALTER TYPE public.quote_request_status ADD VALUE IF NOT EXISTS 'contract_summary_accepted';
ALTER TYPE public.quote_status_kind ADD VALUE IF NOT EXISTS 'contract_summary_generated';
ALTER TYPE public.quote_status_kind ADD VALUE IF NOT EXISTS 'contract_summary_accepted';

-- 2. contract_summaries PDF metadata columns
ALTER TABLE public.contract_summaries
  ADD COLUMN IF NOT EXISTS pdf_storage_key   text,
  ADD COLUMN IF NOT EXISTS pdf_sha256        text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_generated_by  uuid,
  ADD COLUMN IF NOT EXISTS account_number    text;

-- 3. contract_acceptances vault snapshot columns
ALTER TABLE public.contract_acceptances
  ADD COLUMN IF NOT EXISTS quote_request_id  uuid,
  ADD COLUMN IF NOT EXISTS account_number    text,
  ADD COLUMN IF NOT EXISTS accepted_by_user  uuid,
  ADD COLUMN IF NOT EXISTS cs_version        integer,
  ADD COLUMN IF NOT EXISTS terms_version     text,
  ADD COLUMN IF NOT EXISTS privacy_version   text,
  ADD COLUMN IF NOT EXISTS pdf_storage_key   text,
  ADD COLUMN IF NOT EXISTS pdf_sha256        text,
  ADD COLUMN IF NOT EXISTS acceptance_text_version text;

-- 4. Customer-safe RPC: view own CS by id (no token, no public_token_hash exposed)
CREATE OR REPLACE FUNCTION public.get_customer_contract_summary_by_id(_id uuid)
RETURNS TABLE(
  id uuid, cs_number text, quote_id uuid, quote_request_id uuid,
  version integer, status text,
  customer_name_snapshot text, customer_email_snapshot text,
  service_address text, plan_name text,
  service_type text, plan_type text, customer_type text,
  monthly_price_incl_vat numeric, business_monthly_ex_vat numeric, business_monthly_incl_vat numeric,
  one_off_charges_json jsonb,
  setup_charge numeric, router_charge numeric, delivery_charge numeric, installation_charge numeric,
  cease_cancellation_charges text, contract_length text, notice_period text,
  estimated_download_speed integer, estimated_upload_speed integer, speed_notes text,
  price_rise_policy text, digital_voice_warning text, vulnerable_customer_note text,
  complaints_adr_info text, payment_schedule text,
  terms_version text, privacy_version text,
  issued_at timestamptz, accepted_at timestamptz, account_number text,
  pdf_storage_key text, pdf_sha256 text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cs.id, cs.cs_number, cs.quote_id, cs.quote_request_id,
         cs.version, cs.status::text,
         cs.customer_name_snapshot, cs.customer_email_snapshot,
         cs.service_address, cs.plan_name,
         cs.service_type::text, cs.plan_type::text, cs.customer_type::text,
         cs.monthly_price_incl_vat, cs.business_monthly_ex_vat, cs.business_monthly_incl_vat,
         cs.one_off_charges_json,
         cs.setup_charge, cs.router_charge, cs.delivery_charge, cs.installation_charge,
         cs.cease_cancellation_charges, cs.contract_length, cs.notice_period,
         cs.estimated_download_speed, cs.estimated_upload_speed, cs.speed_notes,
         cs.price_rise_policy, cs.digital_voice_warning, cs.vulnerable_customer_note,
         cs.complaints_adr_info, cs.payment_schedule,
         cs.terms_version, cs.privacy_version,
         cs.issued_at, cs.accepted_at, cs.account_number,
         cs.pdf_storage_key, cs.pdf_sha256
  FROM public.contract_summaries cs
  WHERE cs.id = _id
    AND cs.customer_id = auth.uid()
$$;

-- 5. Customer-safe RPC: acceptance receipt
CREATE OR REPLACE FUNCTION public.get_customer_contract_summary_acceptance(_cs_id uuid)
RETURNS TABLE(
  id uuid, contract_summary_id uuid, accepted_at timestamptz,
  accepted_by_name text, accepted_by_email text,
  acceptance_text text, cs_version integer,
  terms_version text, privacy_version text,
  pdf_sha256 text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ca.id, ca.contract_summary_id, ca.accepted_at,
         ca.accepted_by_name, ca.accepted_by_email,
         ca.acceptance_text, ca.cs_version,
         ca.terms_version, ca.privacy_version,
         ca.pdf_sha256
  FROM public.contract_acceptances ca
  JOIN public.contract_summaries cs ON cs.id = ca.contract_summary_id
  WHERE ca.contract_summary_id = _cs_id
    AND cs.customer_id = auth.uid()
  LIMIT 1
$$;

-- 6. Authenticated customer acceptance RPC. Wraps writes server-side.
CREATE OR REPLACE FUNCTION public.customer_accept_contract_summary(
  _cs_id uuid,
  _acceptance_text text,
  _ip text,
  _user_agent text,
  _checkbox_confirmed boolean
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cs  public.contract_summaries%ROWTYPE;
  v_acc public.contract_acceptances%ROWTYPE;
  v_email text;
  v_name  text;
  v_account text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;
  IF _checkbox_confirmed IS NOT TRUE THEN
    RAISE EXCEPTION 'checkbox must be confirmed';
  END IF;
  IF _acceptance_text IS NULL OR length(trim(_acceptance_text)) < 8 THEN
    RAISE EXCEPTION 'acceptance text missing';
  END IF;

  SELECT * INTO v_cs FROM public.contract_summaries WHERE id = _cs_id;
  IF v_cs.id IS NULL THEN RAISE EXCEPTION 'cs not found'; END IF;
  IF v_cs.customer_id IS NULL OR v_cs.customer_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Idempotent: already accepted?
  SELECT * INTO v_acc FROM public.contract_acceptances
    WHERE contract_summary_id = _cs_id LIMIT 1;
  IF v_acc.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true, 'already_accepted', true,
      'contract_summary_id', _cs_id,
      'acceptance_id', v_acc.id,
      'accepted_at', v_acc.accepted_at
    );
  END IF;

  IF v_cs.status NOT IN ('draft','issued','viewed') THEN
    RAISE EXCEPTION 'not_acceptable: %', v_cs.status;
  END IF;

  SELECT email, COALESCE(full_name, email), account_number
    INTO v_email, v_name, v_account
  FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.contract_acceptances(
    contract_summary_id, quote_id, quote_request_id, customer_id,
    accepted_by_name, accepted_by_email, accepted_by_user,
    accepted_at, ip, user_agent,
    acceptance_text, acceptance_text_version, checkbox_confirmed,
    cs_version, terms_version, privacy_version,
    pdf_storage_key, pdf_sha256, account_number
  ) VALUES (
    v_cs.id, v_cs.quote_id, v_cs.quote_request_id, v_uid,
    COALESCE(v_name, v_cs.customer_name_snapshot),
    COALESCE(v_email, v_cs.customer_email_snapshot),
    v_uid,
    now(), left(COALESCE(_ip,''), 64), left(COALESCE(_user_agent,''), 400),
    left(_acceptance_text, 2000), v_cs.terms_version, true,
    v_cs.version, v_cs.terms_version, v_cs.privacy_version,
    v_cs.pdf_storage_key, v_cs.pdf_sha256, COALESCE(v_account, v_cs.account_number)
  ) RETURNING * INTO v_acc;

  UPDATE public.contract_summaries
    SET status = 'accepted',
        accepted_at = v_acc.accepted_at,
        accepted_ip = v_acc.ip,
        accepted_user_agent = v_acc.user_agent
  WHERE id = v_cs.id;

  UPDATE public.quotes
    SET status = 'contract_summary_accepted'
  WHERE id = v_cs.quote_id;

  UPDATE public.quote_requests
    SET status = 'contract_summary_accepted', updated_at = now()
  WHERE id = v_cs.quote_request_id;

  INSERT INTO public.quote_events(
    quote_id, quote_request_id, contract_summary_id,
    event_type, title, actor_type, actor_id, details
  ) VALUES (
    v_cs.quote_id, v_cs.quote_request_id, v_cs.id,
    'contract_summary_accepted', 'Contract Summary accepted (customer)',
    'customer', v_uid,
    jsonb_build_object('cs_number', v_cs.cs_number, 'cs_version', v_cs.version)
  );

  INSERT INTO public.audit_logs(actor_user_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'contract_summary_accepted', 'contract_summaries', v_cs.id,
    jsonb_build_object('cs_number', v_cs.cs_number, 'cs_version', v_cs.version, 'pdf_sha256', v_cs.pdf_sha256));

  RETURN jsonb_build_object(
    'ok', true, 'already_accepted', false,
    'contract_summary_id', v_cs.id,
    'acceptance_id', v_acc.id,
    'accepted_at', v_acc.accepted_at
  );
END $$;

REVOKE ALL ON FUNCTION public.customer_accept_contract_summary(uuid,text,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_accept_contract_summary(uuid,text,text,text,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.get_customer_contract_summary_by_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_contract_summary_by_id(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_customer_contract_summary_acceptance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_contract_summary_acceptance(uuid) TO authenticated;

-- 7. Storage policies for contract-pdfs bucket
DROP POLICY IF EXISTS "contract_pdfs_customer_select" ON storage.objects;
CREATE POLICY "contract_pdfs_customer_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'contract-pdfs'
    AND EXISTS (
      SELECT 1 FROM public.contract_summaries cs
      WHERE cs.pdf_storage_key = storage.objects.name
        AND cs.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "contract_pdfs_staff_select" ON storage.objects;
CREATE POLICY "contract_pdfs_staff_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'contract-pdfs'
    AND public.is_staff(auth.uid())
  );

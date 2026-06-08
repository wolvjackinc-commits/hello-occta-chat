
-- ========================================
-- Phase 5: Rewards, Referrals, Campaigns
-- ========================================

-- ENUMS
DO $$ BEGIN CREATE TYPE public.reward_account_status AS ENUM ('active','suspended','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.referral_code_status AS ENUM ('active','paused','expired','blocked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.referral_event_type AS ENUM (
  'clicked','quote_started','quote_submitted','quote_sent','contract_accepted',
  'payment_cleared','service_activated','reward_eligible','reward_approved','reward_reversed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.points_ledger_source AS ENUM (
  'bill_payment','referral','contract_bonus','admin_adjustment','reversal','expiry','campaign'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.points_ledger_status AS ENUM ('pending','approved','used','reversed','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.reward_type AS ENUM (
  'bill_credit','points','streaming_gift','gift_card','contract_benefit','partner_commission'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.reward_status AS ENUM (
  'pending','eligible','approved','issued','used','reversed','expired','blocked'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.reward_unlock_rule AS ENUM ('first_cleared_payment','second_cleared_payment','custom_rule'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.contract_benefit_type AS ENUM (
  'streaming_reward','bill_credit','extra_points','setup_discount','router_delivery','digital_voice_setup','bundle_discount','custom'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.benefit_plan_type AS ENUM ('flex','contract_saver','both'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.benefit_customer_type AS ENUM ('residential','business','both'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.fraud_flag_type AS ENUM (
  'self_referral','duplicate_email','duplicate_phone','duplicate_address','duplicate_payment',
  'suspicious_pattern','failed_payment','cancellation_before_unlock','manual_review'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.fraud_flag_severity AS ENUM ('low','medium','high'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.fraud_flag_status AS ENUM ('open','reviewed','dismissed','confirmed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.campaign_draft_type AS ENUM (
  'homepage_banner','landing_page','referral_offer','contract_saver_offer','b2b_offer',
  'email','sms','seo_draft','ads_copy','winback','failed_payment_recovery'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.campaign_margin_status AS ENUM ('not_checked','green','amber','red'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.campaign_compliance_status AS ENUM ('not_checked','passed','failed','needs_review'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.campaign_approval_status AS ENUM (
  'draft','margin_check','compliance_check','admin_approval','approved','published','paused','rejected'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================
-- reward_accounts
-- =====================
CREATE TABLE IF NOT EXISTS public.reward_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  points_balance_cached integer NOT NULL DEFAULT 0,
  bill_credit_balance_cached numeric(12,2) NOT NULL DEFAULT 0,
  status public.reward_account_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_accounts TO authenticated;
GRANT ALL ON public.reward_accounts TO service_role;
ALTER TABLE public.reward_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ra_admin_select ON public.reward_accounts FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY ra_owner_select ON public.reward_accounts FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

-- =====================
-- referral_codes
-- =====================
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  partner_id uuid,
  code text NOT NULL UNIQUE,
  status public.referral_code_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  usage_count integer NOT NULL DEFAULT 0,
  max_uses integer
);
GRANT SELECT ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY rc_admin_all ON public.referral_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_marketing_access(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_marketing_access(auth.uid()));
CREATE POLICY rc_owner_select ON public.referral_codes FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

-- =====================
-- referral_events
-- =====================
CREATE TABLE IF NOT EXISTS public.referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid REFERENCES public.referral_codes(id) ON DELETE SET NULL,
  referrer_customer_id uuid,
  referred_customer_id uuid,
  referred_quote_request_id uuid,
  referred_quote_id uuid,
  referred_order_id uuid,
  event_type public.referral_event_type NOT NULL,
  ip_hash text,
  user_agent_hash text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_events TO authenticated;
GRANT ALL ON public.referral_events TO service_role;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY re_staff_select ON public.referral_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
      OR public.has_marketing_access(auth.uid()) OR public.has_role(auth.uid(),'support_agent')
      OR public.has_role(auth.uid(),'auditor'));

-- =====================
-- points_ledger (append-only)
-- =====================
CREATE TABLE IF NOT EXISTS public.points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type public.points_ledger_source NOT NULL,
  source_id uuid,
  points_delta integer NOT NULL DEFAULT 0,
  bill_credit_delta numeric(12,2) NOT NULL DEFAULT 0,
  status public.points_ledger_status NOT NULL DEFAULT 'pending',
  reason text NOT NULL,
  available_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Append-only: revoke modify from clients
GRANT SELECT ON public.points_ledger TO authenticated;
GRANT ALL ON public.points_ledger TO service_role;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY pl_owner_select ON public.points_ledger FOR SELECT TO authenticated
  USING (customer_id = auth.uid());
CREATE POLICY pl_staff_select ON public.points_ledger FOR SELECT TO authenticated
  USING (public.has_finance_access(auth.uid()) OR public.has_role(auth.uid(),'auditor'));

CREATE OR REPLACE FUNCTION public.points_ledger_block_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'points_ledger is append-only';
END;
$$;
DROP TRIGGER IF EXISTS trg_points_ledger_no_update ON public.points_ledger;
CREATE TRIGGER trg_points_ledger_no_update BEFORE UPDATE OR DELETE ON public.points_ledger
  FOR EACH ROW EXECUTE FUNCTION public.points_ledger_block_mutation();

-- =====================
-- rewards
-- =====================
CREATE TABLE IF NOT EXISTS public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type public.reward_type NOT NULL,
  reward_value numeric(12,2),
  reward_currency text NOT NULL DEFAULT 'GBP',
  status public.reward_status NOT NULL DEFAULT 'pending',
  unlock_rule public.reward_unlock_rule,
  related_referral_event_id uuid REFERENCES public.referral_events(id) ON DELETE SET NULL,
  related_quote_id uuid,
  related_order_id uuid,
  related_invoice_id uuid,
  margin_check_status public.quote_margin_check_status,
  admin_approved_by uuid,
  admin_approved_at timestamptz,
  reversal_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY rw_owner_select ON public.rewards FOR SELECT TO authenticated
  USING (customer_id = auth.uid());
CREATE POLICY rw_staff_select ON public.rewards FOR SELECT TO authenticated
  USING (public.has_finance_access(auth.uid()) OR public.has_role(auth.uid(),'support_agent')
      OR public.has_role(auth.uid(),'sales_agent') OR public.has_role(auth.uid(),'auditor'));

-- =====================
-- contract_benefits
-- =====================
CREATE TABLE IF NOT EXISTS public.contract_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benefit_name text NOT NULL,
  benefit_type public.contract_benefit_type NOT NULL,
  plan_type public.benefit_plan_type NOT NULL DEFAULT 'both',
  customer_type public.benefit_customer_type NOT NULL DEFAULT 'both',
  description text,
  value_label text,
  internal_cost_estimate numeric(12,2),
  requires_margin_green boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  terms_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contract_benefits TO authenticated;
GRANT ALL ON public.contract_benefits TO service_role;
ALTER TABLE public.contract_benefits ENABLE ROW LEVEL SECURITY;
CREATE POLICY cb_staff_all ON public.contract_benefits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_marketing_access(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_marketing_access(auth.uid()));
CREATE POLICY cb_auditor_select ON public.contract_benefits FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'auditor'));

-- =====================
-- fraud_flags (admin only)
-- =====================
CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  referral_event_id uuid REFERENCES public.referral_events(id) ON DELETE SET NULL,
  reward_id uuid REFERENCES public.rewards(id) ON DELETE SET NULL,
  flag_type public.fraud_flag_type NOT NULL,
  severity public.fraud_flag_severity NOT NULL DEFAULT 'low',
  status public.fraud_flag_status NOT NULL DEFAULT 'open',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz
);
GRANT SELECT ON public.fraud_flags TO authenticated;
GRANT ALL ON public.fraud_flags TO service_role;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY ff_admin_all ON public.fraud_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_compliance_access(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_compliance_access(auth.uid()));

-- =====================
-- campaign_drafts
-- =====================
CREATE TABLE IF NOT EXISTS public.campaign_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_type public.campaign_draft_type NOT NULL,
  title text NOT NULL,
  target_audience text,
  draft_copy text,
  offer_terms text,
  margin_check_status public.campaign_margin_status NOT NULL DEFAULT 'not_checked',
  compliance_check_status public.campaign_compliance_status NOT NULL DEFAULT 'not_checked',
  approval_status public.campaign_approval_status NOT NULL DEFAULT 'draft',
  created_by uuid,
  approved_by uuid,
  published_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  performance_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campaign_drafts TO authenticated;
GRANT ALL ON public.campaign_drafts TO service_role;
ALTER TABLE public.campaign_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY cd_staff_select ON public.campaign_drafts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
      OR public.has_marketing_access(auth.uid()) OR public.has_compliance_access(auth.uid())
      OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY cd_marketing_insert ON public.campaign_drafts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_marketing_access(auth.uid()));
CREATE POLICY cd_marketing_update ON public.campaign_drafts FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
    OR (public.has_marketing_access(auth.uid()) AND approval_status IN ('draft','margin_check','compliance_check','rejected'))
  )
  WITH CHECK (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
    OR (public.has_marketing_access(auth.uid()) AND approval_status IN ('draft','margin_check','compliance_check','rejected','admin_approval'))
  );

-- ==========================
-- Triggers: rewards & campaigns guards
-- ==========================
CREATE OR REPLACE FUNCTION public.rewards_block_red_margin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('approved','issued') AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.margin_check_status = 'red' THEN
      -- Only allow if admin/super_admin and an override note exists in reversal_reason or reason fields
      IF NOT (public.has_role(NEW.admin_approved_by,'admin') OR public.has_role(NEW.admin_approved_by,'super_admin')) THEN
        RAISE EXCEPTION 'Reward with red margin requires admin/super_admin approval';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_rewards_block_red_margin ON public.rewards;
CREATE TRIGGER trg_rewards_block_red_margin BEFORE UPDATE ON public.rewards
  FOR EACH ROW EXECUTE FUNCTION public.rewards_block_red_margin();

CREATE OR REPLACE FUNCTION public.campaign_drafts_block_publish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.approval_status = 'published' OR NEW.active = true)
     AND (OLD.approval_status IS DISTINCT FROM NEW.approval_status OR OLD.active IS DISTINCT FROM NEW.active) THEN
    IF NEW.margin_check_status NOT IN ('green','amber') THEN
      RAISE EXCEPTION 'Campaign cannot be published without green/amber margin check';
    END IF;
    IF NEW.compliance_check_status <> 'passed' THEN
      RAISE EXCEPTION 'Campaign cannot be published without passing compliance';
    END IF;
    IF NEW.approval_status NOT IN ('approved','published') THEN
      RAISE EXCEPTION 'Campaign must be approved before publishing';
    END IF;
    IF NEW.starts_at IS NOT NULL AND NEW.ends_at IS NOT NULL AND NEW.ends_at <= NEW.starts_at THEN
      RAISE EXCEPTION 'Campaign end date must be after start date';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_campaign_drafts_block_publish ON public.campaign_drafts;
CREATE TRIGGER trg_campaign_drafts_block_publish BEFORE UPDATE ON public.campaign_drafts
  FOR EACH ROW EXECUTE FUNCTION public.campaign_drafts_block_publish();

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_reward_accounts_updated_at ON public.reward_accounts;
CREATE TRIGGER trg_reward_accounts_updated_at BEFORE UPDATE ON public.reward_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_rewards_updated_at ON public.rewards;
CREATE TRIGGER trg_rewards_updated_at BEFORE UPDATE ON public.rewards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_contract_benefits_updated_at ON public.contract_benefits;
CREATE TRIGGER trg_contract_benefits_updated_at BEFORE UPDATE ON public.contract_benefits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_campaign_drafts_updated_at ON public.campaign_drafts;
CREATE TRIGGER trg_campaign_drafts_updated_at BEFORE UPDATE ON public.campaign_drafts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================
-- Helper functions
-- ==========================
CREATE OR REPLACE FUNCTION public.recompute_reward_balances(_customer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_points integer;
  v_credit numeric(12,2);
BEGIN
  SELECT COALESCE(SUM(points_delta) FILTER (WHERE status IN ('approved','used','expired','reversed')),0),
         COALESCE(SUM(bill_credit_delta) FILTER (WHERE status IN ('approved','used','expired','reversed')),0)
  INTO v_points, v_credit
  FROM public.points_ledger
  WHERE customer_id = _customer_id;

  INSERT INTO public.reward_accounts (customer_id, points_balance_cached, bill_credit_balance_cached)
  VALUES (_customer_id, v_points, v_credit)
  ON CONFLICT (customer_id) DO UPDATE
    SET points_balance_cached = EXCLUDED.points_balance_cached,
        bill_credit_balance_cached = EXCLUDED.bill_credit_balance_cached,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.current_reward_unlock_rule()
RETURNS public.reward_unlock_rule LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT rewards_unlock_rule::text::public.reward_unlock_rule
     FROM public.platform_settings WHERE singleton = true LIMIT 1),
    'first_cleared_payment'::public.reward_unlock_rule
  );
$$;

-- ==========================
-- Customer-safe & public views
-- ==========================
CREATE OR REPLACE VIEW public.customer_reward_accounts_view AS
SELECT id, customer_id, points_balance_cached, bill_credit_balance_cached, status, created_at, updated_at
FROM public.reward_accounts
WHERE customer_id = auth.uid();
GRANT SELECT ON public.customer_reward_accounts_view TO authenticated;

CREATE OR REPLACE VIEW public.customer_points_ledger_view AS
SELECT id, customer_id, source_type, points_delta, bill_credit_delta, status, reason, available_at, expires_at, created_at
FROM public.points_ledger
WHERE customer_id = auth.uid();
GRANT SELECT ON public.customer_points_ledger_view TO authenticated;

CREATE OR REPLACE VIEW public.customer_rewards_view AS
SELECT id, customer_id, reward_type, reward_value, reward_currency, status, unlock_rule, created_at, updated_at
FROM public.rewards
WHERE customer_id = auth.uid();
GRANT SELECT ON public.customer_rewards_view TO authenticated;

CREATE OR REPLACE VIEW public.customer_referral_codes_view AS
SELECT id, customer_id, code, status, created_at, expires_at, usage_count, max_uses
FROM public.referral_codes
WHERE customer_id = auth.uid();
GRANT SELECT ON public.customer_referral_codes_view TO authenticated;

CREATE OR REPLACE VIEW public.public_contract_benefits_view AS
SELECT id, benefit_name, benefit_type, plan_type, customer_type, description, value_label, terms_text, starts_at, ends_at, active
FROM public.contract_benefits
WHERE active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at > now());
GRANT SELECT ON public.public_contract_benefits_view TO anon, authenticated;

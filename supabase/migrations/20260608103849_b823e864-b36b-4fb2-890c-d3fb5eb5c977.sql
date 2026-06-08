
-- 1. Drop customer-facing RLS policies on sensitive base tables (column-leak risk)
DROP POLICY IF EXISTS "ra_owner_select" ON public.reward_accounts;
DROP POLICY IF EXISTS "rw_owner_select" ON public.rewards;
DROP POLICY IF EXISTS "pl_owner_select" ON public.points_ledger;
DROP POLICY IF EXISTS "rc_owner_select" ON public.referral_codes;

-- 2. Lock down points_ledger writes: only service_role
REVOKE INSERT, UPDATE, DELETE ON public.points_ledger FROM anon, authenticated;
-- existing trigger trg_points_ledger_no_update already blocks UPDATE/DELETE for everyone

-- 3. Customer-safe RPCs (SECURITY DEFINER, fixed search_path, only safe columns)

CREATE OR REPLACE FUNCTION public.get_customer_reward_account()
RETURNS TABLE (
  points_balance integer,
  bill_credit_balance numeric(12,2),
  status text,
  updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT points_balance_cached, bill_credit_balance_cached, status::text, updated_at
  FROM public.reward_accounts
  WHERE customer_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_customer_points_ledger(_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  source_type text,
  points_delta integer,
  bill_credit_delta numeric(12,2),
  status text,
  reason text,
  available_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, source_type::text, points_delta, bill_credit_delta, status::text,
         -- Strip any OVERRIDE: prefix so internal notes are not exposed
         CASE WHEN reason ILIKE '%OVERRIDE:%' THEN regexp_replace(reason, '\s*\(OVERRIDE:[^)]*\)', '', 'g') ELSE reason END,
         available_at, expires_at, created_at
  FROM public.points_ledger
  WHERE customer_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 50), 200))
$$;

CREATE OR REPLACE FUNCTION public.get_customer_rewards()
RETURNS TABLE (
  id uuid,
  reward_type text,
  reward_value numeric(12,2),
  reward_currency text,
  status text,
  unlock_rule text,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, reward_type::text, reward_value, reward_currency, status::text,
         unlock_rule::text, created_at
  FROM public.rewards
  WHERE customer_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 100
$$;

CREATE OR REPLACE FUNCTION public.get_customer_referral_codes()
RETURNS TABLE (
  id uuid,
  code text,
  status text,
  usage_count integer,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, code, status::text, usage_count, expires_at, created_at
  FROM public.referral_codes
  WHERE customer_id = auth.uid()
  ORDER BY created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.get_public_contract_benefits()
RETURNS TABLE (
  id uuid,
  benefit_name text,
  benefit_type text,
  plan_type text,
  customer_type text,
  description text,
  value_label text,
  terms_text text,
  starts_at timestamptz,
  ends_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, benefit_name, benefit_type::text, plan_type::text, customer_type::text,
         description, value_label, terms_text, starts_at, ends_at
  FROM public.contract_benefits
  WHERE active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  ORDER BY benefit_name
$$;

-- 4. Grants for the RPCs
REVOKE ALL ON FUNCTION public.get_customer_reward_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_customer_points_ledger(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_customer_rewards() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_customer_referral_codes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_contract_benefits() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_customer_reward_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_points_ledger(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_rewards() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_referral_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_contract_benefits() TO anon, authenticated;

-- 5. Strengthen campaign publish trigger (date validity already enforced; re-create idempotently)
CREATE OR REPLACE FUNCTION public.campaign_drafts_block_publish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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

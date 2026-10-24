-- Letting-agent partner programme.
--
-- A partner (letting agent, landlord) gets a reference code. Tenants arrive
-- through /p/<CODE> or type the code in the order form's "Offer or reference
-- code" box; both already land on customer_journey_sessions (utm_snapshot cc
-- and customer_details.offer_code), so attribution needs no new capture path.
--
-- Commission is NEVER paid automatically. It becomes "eligible" only when the
-- referred order is live-or-billing, not cancelled, the customer is not in
-- arrears and at least two broadband invoices for that order are PAID
-- (status 'paid' is only set once money is confirmed received — AGENTS.md).
-- An admin records each bank transfer; payouts are append-only.
--
-- Re-runnable: applied by .github/workflows/deploy-partners.yml.

-- ---------------------------------------------------------------------------
-- Access helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_partner_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _uid
       AND role::text IN ('admin', 'super_admin')
  );
$$;
REVOKE ALL ON FUNCTION public.is_partner_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_partner_staff(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Partners
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9-]{3,24}$'),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 120),
  partner_type text NOT NULL DEFAULT 'letting_agent'
    CHECK (partner_type IN ('letting_agent', 'landlord', 'other')),
  contact_name text CHECK (contact_name IS NULL OR length(contact_name) <= 120),
  contact_email text CHECK (contact_email IS NULL OR (contact_email = lower(btrim(contact_email))
    AND contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  contact_phone text CHECK (contact_phone IS NULL OR length(contact_phone) <= 40),
  website text CHECK (website IS NULL OR length(website) <= 300),
  address text CHECK (address IS NULL OR length(address) <= 300),
  postcode text CHECK (postcode IS NULL OR length(postcode) <= 10),
  commission_amount numeric(10,2) NOT NULL DEFAULT 25 CHECK (commission_amount >= 0 AND commission_amount <= 500),
  -- How finance pays them (e.g. "bank details held in Xero"). Never account numbers.
  payout_note text CHECK (payout_note IS NULL OR length(payout_note) <= 300),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  outreach_contact_id uuid REFERENCES public.outreach_contacts(id) ON DELETE SET NULL,
  notes text CHECK (notes IS NULL OR length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_partners_status ON public.partners (status);

-- A partner code must never collide with a promotion code (e.g. SWITCH50),
-- otherwise a typed code would be read as both.
CREATE OR REPLACE FUNCTION public.partners_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.code := upper(btrim(NEW.code));
  IF EXISTS (SELECT 1 FROM public.offer_campaigns c WHERE upper(c.code) = NEW.code) THEN
    RAISE EXCEPTION 'partner_code_reserved_by_offer' USING ERRCODE = '23505';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.code IS DISTINCT FROM OLD.code
     AND EXISTS (SELECT 1 FROM public.partner_commission_payouts p WHERE p.partner_id = OLD.id) THEN
    RAISE EXCEPTION 'partner_code_locked_after_payout';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- Payouts (append-only record of bank transfers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_commission_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  paid_on date NOT NULL,
  bank_reference text NOT NULL CHECK (length(btrim(bank_reference)) BETWEEN 1 AND 120),
  note text CHECK (note IS NULL OR length(note) <= 500),
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner ON public.partner_commission_payouts (partner_id);

DROP TRIGGER IF EXISTS trg_partners_guard ON public.partners;
CREATE TRIGGER trg_partners_guard BEFORE INSERT OR UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.partners_guard();

CREATE OR REPLACE FUNCTION public.partner_payouts_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'partner_payouts_append_only';
END $$;
DROP TRIGGER IF EXISTS trg_partner_payouts_immutable ON public.partner_commission_payouts;
CREATE TRIGGER trg_partner_payouts_immutable BEFORE UPDATE OR DELETE ON public.partner_commission_payouts
  FOR EACH ROW EXECUTE FUNCTION public.partner_payouts_immutable();

-- ---------------------------------------------------------------------------
-- RLS: staff manage partners; payouts are read-only to staff (insert via RPC)
-- ---------------------------------------------------------------------------
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_commission_payouts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.partners FROM anon, authenticated;
REVOKE ALL ON public.partner_commission_payouts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.partners TO authenticated;
GRANT SELECT ON public.partner_commission_payouts TO authenticated;
GRANT ALL ON public.partners, public.partner_commission_payouts TO service_role;

DROP POLICY IF EXISTS partners_staff_all ON public.partners;
CREATE POLICY partners_staff_all ON public.partners FOR ALL TO authenticated
  USING (public.is_partner_staff(auth.uid()))
  WITH CHECK (public.is_partner_staff(auth.uid()));

DROP POLICY IF EXISTS partner_payouts_staff_select ON public.partner_commission_payouts;
CREATE POLICY partner_payouts_staff_select ON public.partner_commission_payouts FOR SELECT TO authenticated
  USING (public.is_partner_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- Referral evaluation (single source of truth for the admin page and payouts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_referrals_internal(p_partner_id uuid DEFAULT NULL, p_order_id uuid DEFAULT NULL)
RETURNS TABLE (
  partner_id uuid,
  partner_code text,
  partner_name text,
  order_id uuid,
  order_number text,
  order_created_at timestamptz,
  customer_id uuid,
  plan_name text,
  order_status text,
  lifecycle_status text,
  attributed_by text,
  paid_invoices integer,
  in_arrears boolean,
  cancelled boolean,
  commission_amount numeric,
  commission_status text,
  status_reason text,
  paid_on date,
  bank_reference text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sess AS (
    SELECT DISTINCT ON (o.id)
      o.id AS order_id,
      upper(nullif(btrim(coalesce(s.utm_snapshot->'first_touch'->>'cc', s.utm_snapshot->>'cc')), '')) AS link_code,
      upper(nullif(btrim(s.customer_details->>'offer_code'), '')) AS typed_code
    FROM public.orders o
    JOIN public.customer_journey_sessions s
      ON (s.order_id = o.id OR (o.checkout_session_id IS NOT NULL AND s.checkout_session_id = o.checkout_session_id))
     AND NOT coalesce(s.test_session, false)
    WHERE (p_order_id IS NULL OR o.id = p_order_id)
    ORDER BY o.id, (s.order_id IS NOT DISTINCT FROM o.id) DESC, s.created_at DESC
  ),
  matched AS (
    SELECT sess.order_id, p.id AS partner_id, p.code, p.display_name, p.commission_amount,
           CASE WHEN p.code IS NOT DISTINCT FROM sess.link_code THEN 'link' ELSE 'typed_code' END AS attributed_by
    FROM sess
    JOIN LATERAL (
      SELECT pp.* FROM public.partners pp
       WHERE pp.code IN (sess.link_code, sess.typed_code)
         AND (p_partner_id IS NULL OR pp.id = p_partner_id)
       ORDER BY (pp.code IS NOT DISTINCT FROM sess.link_code) DESC
       LIMIT 1
    ) p ON true
  ),
  facts AS (
    SELECT m.*, o.occta_order_number, o.created_at AS order_created_at,
      coalesce(o.customer_id, o.user_id) AS cust_id, o.plan_name, o.status::text AS order_status, o.lifecycle_status,
      (
        lower(coalesce(o.lifecycle_status, '')) ~ '(cancel|cease|failed|rejected|closed)'
        OR o.status::text IN ('cancelled', 'failed', 'rejected')
        OR o.cancellation_requested_at IS NOT NULL
        OR o.cease_date IS NOT NULL
        OR EXISTS (SELECT 1 FROM public.service_cancellation_cases c
                    WHERE c.order_id = o.id AND c.withdrawn_at IS NULL AND c.status NOT IN ('withdrawn', 'rejected'))
      ) AS is_cancelled,
      (
        SELECT count(*)::int FROM public.invoices i
         WHERE i.user_id = coalesce(o.customer_id, o.user_id) AND i.total > 0
           AND i.status::text = 'paid'
           AND i.invoice_type IN ('monthly', 'first_pro_rata')
           AND (i.order_id = o.id OR (i.order_id IS NULL AND EXISTS (
                SELECT 1 FROM public.services sv WHERE sv.id = i.service_id AND sv.order_id = o.id)))
      ) AS paid_count,
      EXISTS (
        SELECT 1 FROM public.invoices i
         WHERE i.user_id = coalesce(o.customer_id, o.user_id) AND i.total > 0
           AND i.due_date < (now() AT TIME ZONE 'Europe/London')::date
           AND i.status::text NOT IN ('paid', 'draft', 'void', 'voided', 'cancelled', 'refunded')
      ) AS arrears
    FROM matched m
    JOIN public.orders o ON o.id = m.order_id
  )
  SELECT f.partner_id, f.code, f.display_name, f.order_id, f.occta_order_number, f.order_created_at,
    f.cust_id, f.plan_name, f.order_status, f.lifecycle_status, f.attributed_by,
    f.paid_count, f.arrears, f.is_cancelled,
    coalesce(po.amount, f.commission_amount),
    CASE
      WHEN po.id IS NOT NULL THEN 'paid'
      WHEN f.is_cancelled THEN 'not_eligible'
      WHEN f.cust_id IS NULL THEN 'awaiting_payments'
      WHEN f.arrears THEN 'on_hold'
      WHEN f.paid_count >= 2 THEN 'eligible'
      ELSE 'awaiting_payments'
    END,
    CASE
      WHEN po.id IS NOT NULL THEN 'Commission paid'
      WHEN f.is_cancelled THEN 'Order cancelled or ceased'
      WHEN f.cust_id IS NULL THEN 'Account not linked yet'
      WHEN f.arrears THEN 'Customer has an overdue invoice'
      WHEN f.paid_count >= 2 THEN 'Two payments received'
      ELSE format('%s of 2 payments received', f.paid_count)
    END,
    po.paid_on, po.bank_reference
  FROM facts f
  LEFT JOIN public.partner_commission_payouts po ON po.order_id = f.order_id
  ORDER BY f.order_created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.partner_referrals_internal(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.partner_referrals_internal(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_list_partner_referrals(p_partner_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_partner_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM public.partner_referrals_internal(p_partner_id, NULL) r), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.admin_list_partner_referrals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_partner_referrals(uuid) TO authenticated;

-- Records a bank transfer. Re-checks eligibility inside the same transaction.
CREATE OR REPLACE FUNCTION public.admin_record_partner_payout(
  p_order_id uuid,
  p_paid_on date,
  p_bank_reference text,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; v_id uuid;
BEGIN
  IF NOT public.is_partner_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_paid_on IS NULL OR p_paid_on > (now() AT TIME ZONE 'Europe/London')::date THEN
    RAISE EXCEPTION 'payout_date_invalid';
  END IF;
  IF nullif(btrim(coalesce(p_bank_reference, '')), '') IS NULL THEN
    RAISE EXCEPTION 'bank_reference_required';
  END IF;
  PERFORM 1 FROM public.orders WHERE id = p_order_id FOR UPDATE;
  SELECT * INTO r FROM public.partner_referrals_internal(NULL, p_order_id) LIMIT 1;
  IF r.order_id IS NULL THEN RAISE EXCEPTION 'not_a_partner_referral'; END IF;
  IF r.commission_status = 'paid' THEN RAISE EXCEPTION 'already_paid'; END IF;
  IF r.commission_status <> 'eligible' THEN RAISE EXCEPTION 'not_eligible: %', r.status_reason; END IF;
  IF r.commission_amount IS NULL OR r.commission_amount <= 0 THEN RAISE EXCEPTION 'no_commission_set'; END IF;

  INSERT INTO public.partner_commission_payouts (partner_id, order_id, amount, paid_on, bank_reference, note, recorded_by)
  VALUES (r.partner_id, p_order_id, r.commission_amount, p_paid_on, btrim(p_bank_reference), nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;

  PERFORM public.log_event(
    _actor_type => 'admin',
    _event_type => 'partner_commission_paid',
    _title => format('Partner commission £%s recorded for %s', r.commission_amount, r.partner_name),
    _details => jsonb_build_object('partner_id', r.partner_id, 'partner_code', r.partner_code,
      'payout_id', v_id, 'amount', r.commission_amount, 'paid_on', p_paid_on),
    _order_id => p_order_id,
    _source_module => 'partners'
  );
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_record_partner_payout(uuid, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_record_partner_payout(uuid, date, text, text) TO authenticated;

-- Public: the tenant landing page shows only the partner's display name.
CREATE OR REPLACE FUNCTION public.get_partner_landing(p_code text)
RETURNS TABLE (code text, display_name text, partner_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.code, p.display_name, p.partner_type
    FROM public.partners p
   WHERE p.status = 'active'
     AND p.code = upper(btrim(coalesce(p_code, '')))
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_partner_landing(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_landing(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Outreach email template for the letting-agent programme
-- ---------------------------------------------------------------------------
INSERT INTO public.outreach_templates (template_key, name, flyer_ref, subject, preheader, body_html, body_text, cta_label, cta_path, is_active)
VALUES (
  'letting-agent-partners',
  'Letting agents — tenant broadband partner programme',
  'LETTINGS-1',
  'Broadband for {{business_name}} tenants + £25 per move-in',
  'Tenants get 30-day rolling broadband; your agency earns £25 for each tenant who signs up. Nothing to sign.',
  $html$<p style="margin:0 0 14px;font-size:17px;font-weight:700;color:#0d0d0d">Hello {{business_name}} team,</p>
<p style="margin:0 0 14px">The first thing most tenants chase after moving in is the internet. OCCTA is a UK broadband provider, based in Huddersfield, and we'd like to help your tenants get connected without tying them into a long contract.</p>
<p style="margin:0 0 12px;font-size:12px;letter-spacing:2px;font-weight:700;color:#777;text-transform:uppercase">How the partner programme works</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px">
<tr><td width="48" valign="top" style="padding:0 12px 14px 0"><div style="width:36px;height:36px;line-height:36px;text-align:center;background:#0d0d0d;color:#ffe500;font-weight:900;font-size:15px">01</div></td><td valign="top" style="padding:0 0 14px"><strong>We give you a link and a flyer</strong><br><span style="color:#555;font-size:14px">Add one line to your welcome email or move-in pack.</span></td></tr>
<tr><td width="48" valign="top" style="padding:0 12px 14px 0"><div style="width:36px;height:36px;line-height:36px;text-align:center;background:#0d0d0d;color:#ffe500;font-weight:900;font-size:15px">02</div></td><td valign="top" style="padding:0 0 14px"><strong>Tenants order themselves</strong><br><span style="color:#555;font-size:14px">You never pass us their details, so there's no admin or data handling for your team.</span></td></tr>
<tr><td width="48" valign="top" style="padding:0 12px 14px 0"><div style="width:36px;height:36px;line-height:36px;text-align:center;background:#0d0d0d;color:#ffe500;font-weight:900;font-size:15px">03</div></td><td valign="top" style="padding:0 0 14px"><strong>We pay you &pound;25 per tenant</strong><br><span style="color:#555;font-size:14px">By bank transfer each month, with a statement of who signed up.</span></td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px"><tr><td style="background:#ffe500;border:2px solid #0d0d0d"><a href="{{cta_url}}" style="display:inline-block;padding:13px 24px;color:#0d0d0d;font:700 16px Arial,Helvetica,sans-serif;text-decoration:none">Get my agency's partner link</a></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;margin:0 0 26px"><tr><td style="padding:22px 22px 8px;color:#ffffff;font:15px/1.55 Arial,Helvetica,sans-serif">
<p style="margin:0 0 16px;font-size:19px;font-weight:900;color:#ffe500">Why tenants like it</p>
<p style="margin:0 0 12px"><span style="color:#ffe500;font-weight:900">&#10003;</span>&nbsp; <strong>Flex 30.</strong> 30-day rolling broadband where available, so nobody is locked in past their tenancy.</p>
<p style="margin:0 0 12px"><span style="color:#ffe500;font-weight:900">&#10003;</span>&nbsp; <strong>The price shown first.</strong> Monthly price, setup and router cost are confirmed before they order.</p>
<p style="margin:0 0 14px"><span style="color:#ffe500;font-weight:900">&#10003;</span>&nbsp; <strong>UK-based support</strong>, with ticket tracking in their OCCTA dashboard.</p>
</td></tr></table>
<p style="margin:0 0 14px">Prefer to talk? Call <strong>0800 260 6626</strong> or simply reply to this email.</p>
<p style="margin:0 0 18px">Best regards,<br><strong>Saurabh, Partnerships</strong><br><span style="color:#666;font-size:13px">OCCTA Limited, 22 Pavilion View, Huddersfield</span></p>
<p style="margin:0;font-size:11px;line-height:1.5;color:#777">Commission is paid after the referred customer's second Direct Debit has been collected and is never charged to the tenant. Plans and speeds depend on the address and are confirmed before ordering.</p>$html$,
  $txt$Hello {{business_name}} team,

The first thing most tenants chase after moving in is the internet. OCCTA is a UK broadband provider, based in Huddersfield, and we'd like to help your tenants get connected without tying them into a long contract.

How the partner programme works:
1. We give you a link and a flyer. Add one line to your welcome email or move-in pack.
2. Tenants order themselves. You never pass us their details.
3. We pay you £25 per tenant, by bank transfer each month, with a statement.

Get your agency's partner link: {{cta_url}}

Why tenants like it:
- Flex 30: 30-day rolling broadband where available.
- The price shown first: monthly price, setup and router cost confirmed before ordering.
- UK-based support, with ticket tracking in their OCCTA dashboard.

Prefer to talk? Call 0800 260 6626 or reply to this email.

Best regards,
Saurabh, Partnerships
OCCTA Limited, 22 Pavilion View, Huddersfield

Commission is paid after the referred customer's second Direct Debit has been collected and is never charged to the tenant.$txt$,
  'Get my agency''s partner link',
  '/partners/letting-agents',
  true
)
ON CONFLICT (template_key) DO NOTHING;

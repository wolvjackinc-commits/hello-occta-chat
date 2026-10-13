-- Consumer campaigns for OCCTA customers who opted in to marketing emails.
--
-- PECR reg. 22: promotional emails to individuals need their consent. The
-- consent lives on profiles.marketing_email_consent (set at checkout or in
-- My OCCTA › Account). This keeps outreach_contacts in step with it, both ways:
--   * opting in adds or reactivates a consumer contact (category 'consumer',
--     lawful basis 'consent', with the evidence recorded), unless the address
--     is on the permanent suppression list;
--   * opting out in the account suppresses the address and cancels anything
--     still queued for it;
--   * unsubscribing from an outreach email turns the account setting off.
-- Consumer contacts are kept out of business campaigns by outreach-admin.

CREATE OR REPLACE FUNCTION public.outreach_sync_customer_optin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text := lower(btrim(coalesce(NEW.email, '')));
  _old_email text := CASE WHEN TG_OP = 'UPDATE' THEN lower(btrim(coalesce(OLD.email, ''))) ELSE '' END;
  _was_in boolean := CASE WHEN TG_OP = 'UPDATE' THEN coalesce(OLD.marketing_email_consent, false) ELSE false END;
  _is_in boolean := coalesce(NEW.marketing_email_consent, false);
  _first text := nullif(split_part(btrim(coalesce(NEW.full_name, '')), ' ', 1), '');
  _evidence text;
BEGIN
  -- Address changed while opted in: stop using the old one.
  IF _was_in AND _old_email <> '' AND _old_email <> _email THEN
    UPDATE public.outreach_contacts SET status = 'do_not_contact', updated_at = now()
     WHERE email = _old_email AND source = 'customer_optin' AND status = 'active';
    UPDATE public.outreach_messages SET status = 'suppressed', last_error = 'suppressed: customer email changed'
     WHERE email = _old_email AND status = 'queued';
  END IF;

  IF _email = '' OR _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN NEW;
  END IF;

  IF _is_in AND (NOT _was_in OR _old_email <> _email) THEN
    _evidence := format(
      'Opted in to OCCTA marketing emails in their customer account (profiles.marketing_email_consent = true) on %s. Profile %s.',
      to_char(coalesce(NEW.consent_updated_at, now()) AT TIME ZONE 'Europe/London', 'YYYY-MM-DD HH24:MI'),
      NEW.id
    );
    -- An earlier unsubscribe, bounce or complaint stays in force (the
    -- suppression list is permanent); the contact simply stays blocked.
    INSERT INTO public.outreach_contacts (
      business_name, email, email_type, category, lawful_basis, consent_evidence,
      tags, source, notes, status
    ) VALUES (
      left(coalesce(_first, 'there'), 300), _email, 'personal', 'consumer', 'consent', _evidence,
      ARRAY['customer', 'consumer-optin'], 'customer_optin', 'OCCTA customer (account opt-in)',
      CASE WHEN EXISTS (SELECT 1 FROM public.outreach_suppressions s WHERE s.email = _email)
           THEN 'do_not_contact' ELSE 'active' END
    )
    ON CONFLICT (email) DO UPDATE
      SET business_name = EXCLUDED.business_name,
          lawful_basis = 'consent',
          consent_evidence = EXCLUDED.consent_evidence,
          status = CASE WHEN EXISTS (SELECT 1 FROM public.outreach_suppressions s WHERE s.email = EXCLUDED.email)
                        THEN public.outreach_contacts.status ELSE 'active' END,
          updated_at = now()
      -- Never take over a business prospect that happens to share the address.
      WHERE public.outreach_contacts.source = 'customer_optin';
  ELSIF NOT _is_in AND _was_in THEN
    IF EXISTS (SELECT 1 FROM public.outreach_contacts WHERE email = _email AND source = 'customer_optin') THEN
      PERFORM public.outreach_suppress(_email, 'unsubscribed', 'customer_account_settings', NULL);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.outreach_sync_customer_optin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_outreach_sync_customer_optin ON public.profiles;
CREATE TRIGGER trg_outreach_sync_customer_optin
  AFTER INSERT OR UPDATE OF marketing_email_consent, email ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.outreach_sync_customer_optin();

-- Unsubscribing from an outreach email also turns off the account setting, so
-- the customer sees the same choice in My OCCTA.
CREATE OR REPLACE FUNCTION public.outreach_customer_unsubscribed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET marketing_email_consent = false,
         consent_updated_at = now()
   WHERE lower(btrim(email)) = NEW.email
     AND marketing_email_consent;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.outreach_customer_unsubscribed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_outreach_customer_unsubscribed ON public.outreach_contacts;
CREATE TRIGGER trg_outreach_customer_unsubscribed
  AFTER UPDATE OF status ON public.outreach_contacts
  FOR EACH ROW
  WHEN (NEW.source = 'customer_optin' AND OLD.status = 'active' AND NEW.status IN ('unsubscribed', 'complained'))
  EXECUTE FUNCTION public.outreach_customer_unsubscribed();

-- Customers who are already opted in.
INSERT INTO public.outreach_contacts (
  business_name, email, email_type, category, lawful_basis, consent_evidence,
  tags, source, notes, status
)
SELECT
  left(coalesce(nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''), 'there'), 300),
  lower(btrim(p.email)),
  'personal', 'consumer', 'consent',
  format(
    'Opted in to OCCTA marketing emails in their customer account (profiles.marketing_email_consent = true) on %s. Profile %s.',
    to_char(coalesce(p.consent_updated_at, p.updated_at, now()) AT TIME ZONE 'Europe/London', 'YYYY-MM-DD HH24:MI'),
    p.id
  ),
  ARRAY['customer', 'consumer-optin'], 'customer_optin', 'OCCTA customer (account opt-in)', 'active'
FROM public.profiles p
WHERE coalesce(p.marketing_email_consent, false)
  AND lower(btrim(coalesce(p.email, ''))) ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND NOT EXISTS (SELECT 1 FROM public.outreach_suppressions s WHERE s.email = lower(btrim(p.email)))
ON CONFLICT (email) DO NOTHING;

-- Consumer email for opted-in customers. No prices: they change, and the
-- website is the source of truth.
INSERT INTO public.outreach_templates (
  template_key, name, flyer_ref, subject, preheader, body_html, body_text, cta_label, cta_path, hero_image_url
) VALUES (
  'customer-home-switch-offer',
  'Customers: keep your number + more from OCCTA (opted-in only)',
  'HOME-A',
  '{{business_name}}, keep your home phone number when the old lines switch off',
  'Move your number to OCCTA Digital Voice, add a SIM, or check a faster speed. One UK team for all of it.',
  $html$<p style="margin:0 0 14px;font-size:17px;font-weight:700;color:#0d0d0d">Hi {{business_name}},</p>
<p style="margin:0 0 14px">Thanks for being with OCCTA. The UK's old copper phone lines are being switched off exchange by exchange, and Openreach aims to finish by <strong>January 2027</strong>. Here are three simple ways to stay ahead of it, and get more from your OCCTA account.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px">
<tr><td style="padding:16px;border:3px solid #0d0d0d;background:#fff8c4">
<div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#0d0d0d">01 · KEEP YOUR NUMBER</div>
<div style="margin:6px 0 6px;font-size:18px;font-weight:700;color:#0d0d0d">Move your home phone to OCCTA Digital Voice</div>
<div style="font-size:14px;line-height:1.6;color:#333">Keep the number friends and family already know. Your calls run over your broadband instead of the old copper line, so there's nothing to do when your exchange switches.</div>
<div style="margin-top:10px"><a href="https://www.occta.co.uk/landline" style="font-size:14px;font-weight:700;color:#0d0d0d">See Digital Voice &rarr;</a></div>
</td></tr>
<tr><td style="height:10px"></td></tr>
<tr><td style="padding:16px;border:3px solid #0d0d0d;background:#ffffff">
<div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#0d0d0d">02 · ADD A SIM</div>
<div style="margin:6px 0 6px;font-size:18px;font-weight:700;color:#0d0d0d">Mobile plans from the same UK team</div>
<div style="font-size:14px;line-height:1.6;color:#333">Add a SIM for yourself or the family and manage it alongside your broadband in My OCCTA.</div>
<div style="margin-top:10px"><a href="https://www.occta.co.uk/sim-plans" style="font-size:14px;font-weight:700;color:#0d0d0d">See SIM plans &rarr;</a></div>
</td></tr>
<tr><td style="height:10px"></td></tr>
<tr><td style="padding:16px;border:3px solid #0d0d0d;background:#ffffff">
<div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#0d0d0d">03 · CHECK YOUR SPEED</div>
<div style="margin:6px 0 6px;font-size:18px;font-weight:700;color:#0d0d0d">Is a faster plan available at your home?</div>
<div style="font-size:14px;line-height:1.6;color:#333">Full fibre keeps rolling out. Put in your postcode to see the plans available at your address today.</div>
<div style="margin-top:10px"><a href="https://www.occta.co.uk/broadband" style="font-size:14px;font-weight:700;color:#0d0d0d">Check my address &rarr;</a></div>
</td></tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#0d0d0d">
<tr><td style="padding:18px 20px">
<div style="font-size:16px;font-weight:700;color:#ffe500;margin:0 0 10px">Why customers stay with OCCTA</div>
<div style="font-size:14px;line-height:1.9;color:#ffffff">&#10003; UK-based support from a real team<br>&#10003; Clear prices shown before you agree<br>&#10003; 30-day rolling plans where eligible<br>&#10003; Broadband, phone and SIMs in one account</div>
</td></tr>
</table>

<p style="margin:0 0 14px">Got a telecare or personal alarm at home? Tell us before your line changes and we'll make sure it keeps working. Call <strong>0800 260 6626</strong>.</p>
<p style="margin:0 0 4px">Thanks,</p>
<p style="margin:0 0 18px;font-weight:700">The OCCTA team</p>$html$,
  $txt$Hi {{business_name}},

Thanks for being with OCCTA. The UK's old copper phone lines are being switched off exchange by exchange, and Openreach aims to finish by January 2027. Here are three simple ways to stay ahead of it, and get more from your OCCTA account.

01 KEEP YOUR NUMBER: Move your home phone to OCCTA Digital Voice
Keep the number friends and family already know. Your calls run over your broadband instead of the old copper line, so there's nothing to do when your exchange switches.
See Digital Voice: https://www.occta.co.uk/landline

02 ADD A SIM: Mobile plans from the same UK team
Add a SIM for yourself or the family and manage it alongside your broadband in My OCCTA.
See SIM plans: https://www.occta.co.uk/sim-plans

03 CHECK YOUR SPEED: Is a faster plan available at your home?
Full fibre keeps rolling out. Put in your postcode to see the plans available at your address today.
Check my address: https://www.occta.co.uk/broadband

WHY CUSTOMERS STAY WITH OCCTA
- UK-based support from a real team
- Clear prices shown before you agree
- 30-day rolling plans where eligible
- Broadband, phone and SIMs in one account

Got a telecare or personal alarm at home? Tell us before your line changes and we'll make sure it keeps working. Call 0800 260 6626.

Keep my number: {{cta_url}}

Thanks,
The OCCTA team$txt$,
  'Keep my number',
  '/landline',
  NULL
)
ON CONFLICT (template_key) DO NOTHING;

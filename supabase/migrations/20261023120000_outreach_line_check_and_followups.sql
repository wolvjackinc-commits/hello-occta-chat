-- Outreach conversion fixes (Oct 2026)
--
-- Results so far: ~50% opens, 3 clicks, 0 enquiries. The email promised a
-- free 15-minute line check but the button opened the generic sales form
-- (3 steps, billing and secondary contacts). This migration:
--   1. lets the new /business/line-check page greet the business by name
--      from the email link (token -> business name + inbox, nothing else);
--   2. adds automatic follow-ups: openers who did not click get one short
--      follow-up a few working days later (outreach_queue_followups, cron);
--   3. points every landline template at /business/line-check and adds the
--      short national and follow-up templates;
--   4. switches the live UK-A campaign's unsent emails to the short version.

-- ---------------------------------------------------------------------------
-- 1. Prefill for the line-check page
-- ---------------------------------------------------------------------------
-- The token is a 128-bit secret that only appears in that recipient's email,
-- so it may reveal what the email was already addressed to. Unknown tokens
-- return nothing (no error), so the function can't be used to probe.
CREATE OR REPLACE FUNCTION public.outreach_line_check_prefill(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row record;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{16,64}$' THEN
    RETURN NULL;
  END IF;
  SELECT m.business_name, m.email
    INTO _row
    FROM public.outreach_messages m
   WHERE m.token = p_token
     AND m.sent_at IS NOT NULL
     AND m.unsubscribed_at IS NULL
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('business_name', _row.business_name, 'email', _row.email);
END;
$$;
REVOKE ALL ON FUNCTION public.outreach_line_check_prefill(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.outreach_line_check_prefill(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Automatic follow-ups to openers who didn't click
-- ---------------------------------------------------------------------------
ALTER TABLE public.outreach_campaigns
  ADD COLUMN IF NOT EXISTS followup_source_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS followup_delay_days integer NOT NULL DEFAULT 5
    CHECK (followup_delay_days BETWEEN 1 AND 30);

COMMENT ON COLUMN public.outreach_campaigns.followup_source_ids IS
  'When set, this campaign is a follow-up: outreach_queue_followups() adds recipients of these campaigns who opened but did not click, reply, convert, bounce or unsubscribe, followup_delay_days after the first email.';

CREATE OR REPLACE FUNCTION public.outreach_queue_followups()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _fu record;
  _added integer;
  _total integer := 0;
BEGIN
  FOR _fu IN
    SELECT id, followup_source_ids, followup_delay_days
      FROM public.outreach_campaigns
     WHERE cardinality(followup_source_ids) > 0
       AND status IN ('sending', 'completed')
       AND launched_at IS NOT NULL
  LOOP
    WITH candidates AS (
      SELECT DISTINCT ON (src.email)
             src.email, src.contact_id, src.business_name
        FROM public.outreach_messages src
        JOIN public.outreach_contacts c ON c.id = src.contact_id
       WHERE src.campaign_id = ANY (_fu.followup_source_ids)
         AND src.sent_at IS NOT NULL
         AND src.sent_at <= now() - make_interval(days => _fu.followup_delay_days)
         AND src.sent_at > now() - interval '45 days'
         AND src.first_opened_at IS NOT NULL
         AND src.first_clicked_at IS NULL
         AND src.replied_at IS NULL
         AND src.converted_at IS NULL
         AND src.unsubscribed_at IS NULL
         AND src.bounced_at IS NULL
         AND src.complained_at IS NULL
         AND c.eligible
         AND NOT EXISTS (SELECT 1 FROM public.outreach_suppressions s WHERE s.email = src.email)
         -- Anyone who has since enquired doesn't need chasing.
         AND NOT EXISTS (SELECT 1 FROM public.business_leads bl WHERE lower(btrim(bl.email)) = src.email)
       ORDER BY src.email, src.sent_at
    ), ins AS (
      INSERT INTO public.outreach_messages (campaign_id, contact_id, email, business_name, token, status, next_attempt_at)
      SELECT _fu.id, cand.contact_id, cand.email, cand.business_name,
             translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_'),
             'queued',
             -- Warm contacts go ahead of the cold queue (the claim orders by next_attempt_at).
             now() - interval '365 days'
        FROM candidates cand
      ON CONFLICT ON CONSTRAINT outreach_messages_campaign_email_key DO NOTHING
      RETURNING 1
    )
    SELECT count(*) INTO _added FROM ins;

    IF _added > 0 THEN
      UPDATE public.outreach_campaigns
         SET status = 'sending',
             completed_at = NULL,
             started_at = coalesce(started_at, now()),
             total_recipients = (SELECT count(*) FROM public.outreach_messages WHERE campaign_id = _fu.id)
       WHERE id = _fu.id;
      _total := _total + _added;
    END IF;
  END LOOP;
  RETURN _total;
END;
$$;
REVOKE ALL ON FUNCTION public.outreach_queue_followups() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_queue_followups() TO service_role;

-- Weekday mornings, before the 9am send window opens (07:40 UTC).
DO $$
BEGIN
  PERFORM cron.unschedule('outreach-queue-followups')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'outreach-queue-followups');
  PERFORM cron.schedule('outreach-queue-followups', '40 7 * * 1-5', 'SELECT public.outreach_queue_followups()');
END $$;

-- ---------------------------------------------------------------------------
-- 3. Templates: land on the line-check page; short national + follow-up
-- ---------------------------------------------------------------------------
UPDATE public.outreach_templates
   SET cta_path = '/business/line-check'
 WHERE template_key IN ('last-orders-landline', 'card-machine-checklist', 'national-landline-switch-off')
   AND cta_path = '/business/contact-sales';

-- The national template's plain-text part still said "Huddersfield businesses".
UPDATE public.outreach_templates
   SET body_text = replace(body_text, 'WHY HUDDERSFIELD BUSINESSES CHOOSE OCCTA', 'WHY UK BUSINESSES CHOOSE OCCTA')
 WHERE template_key = 'national-landline-switch-off';

INSERT INTO public.outreach_templates (template_key, name, flyer_ref, subject, preheader, body_html, body_text, cta_label, cta_path, hero_image_url)
VALUES
(
  'national-line-check-short',
  'UK: Landline switch-off, short (line check)',
  'UK-A',
  'Is {{business_name}} ready for the January 2027 landline switch-off?',
  'Card machines, alarms and door entry often share your phone line. We''ll check yours free in 15 minutes.',
  $html$<p style="margin:0 0 14px;font-size:17px;font-weight:700;color:#0d0d0d">Hello {{business_name}} team,</p>
<p style="margin:0 0 14px">Openreach is switching off the UK's old copper phone lines exchange by exchange, and aims to finish by <strong>January 2027</strong>. When your area switches, anything still using that line can stop working.</p>
<p style="margin:0 0 14px">It's rarely just the desk phone. <strong>Card machines, alarms, door entry and lift lines</strong> often use the same line, and many businesses only find out when one of them stops.</p>
<p style="margin:0 0 20px"><strong>We'll check yours for free.</strong> One 15-minute call: we go through what's plugged into your line, check what's available at your address and, if anything needs to move, send a written quote. You keep your number and there's no obligation.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="background:#ffe500;border:2px solid #0d0d0d"><a href="{{cta_url}}" style="display:inline-block;padding:13px 24px;color:#0d0d0d;font:700 16px Arial,Helvetica,sans-serif;text-decoration:none">Book my free line check</a></td></tr></table>
<p style="margin:0 0 14px">Or just <strong>reply with a good time to call</strong> and we'll ring you. Prefer to phone us? <strong>0800 260 6626</strong>, Mon&ndash;Fri 9am&ndash;6pm.</p>
<p style="margin:0 0 18px">Thanks,<br><strong>The OCCTA Business team</strong><br><span style="color:#666;font-size:13px">UK-based support, no overseas call centre</span></p>
<p style="margin:0;font-size:11px;line-height:1.5;color:#777">OCCTA is not Openreach. Number porting is subject to eligibility. Compatibility of third-party equipment must be confirmed with its supplier.</p>$html$,
  $txt$Hello {{business_name}} team,

Openreach is switching off the UK's old copper phone lines exchange by exchange, and aims to finish by January 2027. When your area switches, anything still using that line can stop working.

It's rarely just the desk phone. Card machines, alarms, door entry and lift lines often use the same line, and many businesses only find out when one of them stops.

We'll check yours for free. One 15-minute call: we go through what's plugged into your line, check what's available at your address and, if anything needs to move, send a written quote. You keep your number and there's no obligation.

Book your free line check: {{cta_url}}

Or just reply with a good time to call and we'll ring you. Prefer to phone us? 0800 260 6626, Mon-Fri 9am-6pm.

Thanks,
The OCCTA Business team
UK-based support, no overseas call centre

OCCTA is not Openreach. Number porting is subject to eligibility. Compatibility of third-party equipment must be confirmed with its supplier.$txt$,
  'Book my free line check',
  '/business/line-check',
  NULL
),
(
  'line-check-follow-up',
  'Follow-up: quick question (openers who didn''t click)',
  'LCHK-FU',
  'Quick question about {{business_name}}''s phone line',
  'Do you know whether your card machine or alarm still uses it?',
  $html$<p style="margin:0 0 14px">Hello again,</p>
<p style="margin:0 0 14px">I emailed {{business_name}} last week about the landline switch-off. One quick question: <strong>do you know whether your card machine, alarm or door entry still uses your phone line?</strong></p>
<p style="margin:0 0 14px">Most businesses we speak to aren't sure, and it only becomes obvious when the line is switched and something stops working.</p>
<p style="margin:0 0 14px">If you'd like us to check, it's a free 15-minute call. Pick a time below, or just <strong>reply with the best time and number</strong> and we'll ring you.</p>
<p style="margin:0 0 6px">Thanks,<br><strong>The OCCTA Business team</strong><br><span style="color:#666;font-size:13px">0800 260 6626 &middot; Mon&ndash;Fri 9am&ndash;6pm</span></p>$html$,
  $txt$Hello again,

I emailed {{business_name}} last week about the landline switch-off. One quick question: do you know whether your card machine, alarm or door entry still uses your phone line?

Most businesses we speak to aren't sure, and it only becomes obvious when the line is switched and something stops working.

If you'd like us to check, it's a free 15-minute call. Pick a time here: {{cta_url}}

Or just reply with the best time and number and we'll ring you.

Thanks,
The OCCTA Business team
0800 260 6626, Mon-Fri 9am-6pm$txt$,
  'Pick a time for my free call',
  '/business/line-check',
  NULL
)
ON CONFLICT (template_key) DO NOTHING;

-- The follow-up campaign itself: always on, fed by outreach_queue_followups().
INSERT INTO public.outreach_campaigns (
  name, slug, status, template_id, subject, preheader, body_html, body_text, cta_label, cta_path,
  hero_image_url, flyer_ref, template_key, links, audience, launched_at, started_at, notes,
  followup_source_ids, followup_delay_days
)
SELECT
  'Follow-up: line check (openers who didn''t click)',
  'line-check-follow-up-openers',
  'sending',
  t.id, t.subject, t.preheader, t.body_html, t.body_text, t.cta_label, t.cta_path,
  NULL, t.flyer_ref, t.template_key,
  jsonb_build_array(jsonb_build_object(
    'original', NULL,
    'target', 'https://www.occta.co.uk/business/line-check?utm_source=occta_outreach&utm_medium=email&utm_campaign=line-check-follow-up-openers&utm_content=line-check-follow-up&cc=LCHK-FU'
  )),
  '{}'::jsonb, now(), now(),
  'Automatic: one follow-up to people who opened a landline email but did not click, reply, enquire, bounce or unsubscribe, 5 days after it was sent. Queued each weekday at 07:40 UTC by outreach_queue_followups(). To add a new first-touch campaign, append its id to followup_source_ids.',
  ARRAY(
    SELECT id FROM public.outreach_campaigns
     WHERE slug IN (
       'landline-switch-off-huddersfield-oct-2026-last-a-gxaqr',
       'card-machine-checklist-huddersfield-oct-2026-last-b-k7ptu',
       'uk-cities-landline-switch-off-oct-2026-uk-a-snwzf'
     )
  ),
  5
FROM public.outreach_templates t
WHERE t.template_key = 'line-check-follow-up'
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Live UK-A campaign: unsent emails use the short version
-- ---------------------------------------------------------------------------
-- Content is read at send time, so this only changes emails not yet sent.
-- The switch time is noted so the two versions can be compared afterwards.
UPDATE public.outreach_campaigns c
   SET preheader = t.preheader,
       body_html = t.body_html,
       body_text = t.body_text,
       cta_label = t.cta_label,
       cta_path = t.cta_path,
       hero_image_url = NULL,
       links = jsonb_build_array(jsonb_build_object(
         'original', NULL,
         'target', 'https://www.occta.co.uk/business/line-check?utm_source=occta_outreach&utm_medium=email&utm_campaign=' || c.slug || '&utm_content=national-line-check-short&cc=UK-A'
       )),
       notes = concat_ws(E'\n', nullif(c.notes, ''),
         'Version B (short copy, no flyer image, lands on /business/line-check) from ' || to_char(now() AT TIME ZONE 'Europe/London', 'YYYY-MM-DD HH24:MI') || ' UK time. Emails sent before then used version A (flyer, pricing grid, /business/contact-sales).')
  FROM public.outreach_templates t
 WHERE t.template_key = 'national-line-check-short'
   AND c.slug = 'uk-cities-landline-switch-off-oct-2026-uk-a-snwzf'
   AND c.status IN ('sending', 'paused')
   AND c.cta_path = '/business/contact-sales';

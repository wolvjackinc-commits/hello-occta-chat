-- Premium versions of the two business flyer emails (LAST-A, LAST-B):
-- flyer artwork as the header image, "what's on your line" grid, 4-step
-- plan, price cards, "why OCCTA" panel and a second call to action.
-- Claims are limited to what OCCTA can evidence (flyer prices, process,
-- Huddersfield address); no testimonials or statistics.
--
-- Draft campaigns created from these templates are refreshed too. Launched
-- campaigns keep the content they were sent with.

UPDATE public.outreach_templates SET
  subject = 'Is {{business_name}} ready for the January 2027 landline switch-off?',
  preheader = 'Card machines, alarms and door entry can depend on your phone line. Book a free 15-minute line check with our Huddersfield team.',
  cta_label = 'Book my free line check',
  hero_image_url = 'https://www.occta.co.uk/email/occta-last-orders.jpg',
  body_html = $html$<p style="margin:0 0 14px;font-size:17px;font-weight:700;color:#0d0d0d">Hello {{business_name}} team,</p>
<p style="margin:0 0 14px">The UK's analogue phone network is being switched off exchange by exchange, and Openreach aims to finish by <strong>January 2027</strong>. When your area switches, anything still relying on an old copper line can stop working.</p>
<p style="margin:0 0 18px">It isn't just the phone on the desk. Before your exchange moves, check what else uses your line:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px">
<tr>
<td width="33%" style="padding:4px"><div style="background:#f5f4ef;border-left:4px solid #ffe500;padding:10px 12px;font-weight:700;font-size:14px">Phones</div></td>
<td width="33%" style="padding:4px"><div style="background:#f5f4ef;border-left:4px solid #ffe500;padding:10px 12px;font-weight:700;font-size:14px">Card machine</div></td>
<td width="33%" style="padding:4px"><div style="background:#f5f4ef;border-left:4px solid #ffe500;padding:10px 12px;font-weight:700;font-size:14px">Alarm</div></td>
</tr>
<tr>
<td width="33%" style="padding:4px"><div style="background:#f5f4ef;border-left:4px solid #ffe500;padding:10px 12px;font-weight:700;font-size:14px">Door entry</div></td>
<td width="33%" style="padding:4px"><div style="background:#f5f4ef;border-left:4px solid #ffe500;padding:10px 12px;font-weight:700;font-size:14px">Lift line</div></td>
<td width="33%" style="padding:4px"><div style="background:#f5f4ef;border-left:4px solid #ffe500;padding:10px 12px;font-weight:700;font-size:14px">Fax</div></td>
</tr>
</table>
<p style="margin:0 0 12px;font-size:12px;letter-spacing:2px;font-weight:700;color:#777;text-transform:uppercase">How your free line check works</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px">
<tr><td width="48" valign="top" style="padding:0 12px 14px 0"><div style="width:36px;height:36px;line-height:36px;text-align:center;background:#0d0d0d;color:#ffe500;font-weight:900;font-size:15px">01</div></td><td valign="top" style="padding:0 0 14px"><strong>List what's on your line</strong><br><span style="color:#555;font-size:14px">Phones, card machine, alarm, door entry, lift, fax. 15 minutes by phone or video.</span></td></tr>
<tr><td width="48" valign="top" style="padding:0 12px 14px 0"><div style="width:36px;height:36px;line-height:36px;text-align:center;background:#0d0d0d;color:#ffe500;font-weight:900;font-size:15px">02</div></td><td valign="top" style="padding:0 0 14px"><strong>We check your site</strong><br><span style="color:#555;font-size:14px">Network, numbers and porting eligibility, before anything changes.</span></td></tr>
<tr><td width="48" valign="top" style="padding:0 12px 14px 0"><div style="width:36px;height:36px;line-height:36px;text-align:center;background:#0d0d0d;color:#ffe500;font-weight:900;font-size:15px">03</div></td><td valign="top" style="padding:0 0 14px"><strong>A real, written quote</strong><br><span style="color:#555;font-size:14px">Ex- and inc-VAT prices, setup and care level, before you sign.</span></td></tr>
<tr><td width="48" valign="top" style="padding:0 12px 14px 0"><div style="width:36px;height:36px;line-height:36px;text-align:center;background:#0d0d0d;color:#ffe500;font-weight:900;font-size:15px">04</div></td><td valign="top" style="padding:0 0 14px"><strong>Keep your number</strong><br><span style="color:#555;font-size:14px">Ports planned to minimise disruption, subject to eligibility.</span></td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 30px"><tr><td style="background:#ffe500;border:2px solid #0d0d0d"><a href="{{cta_url}}" style="display:inline-block;padding:13px 24px;color:#0d0d0d;font:700 16px Arial,Helvetica,sans-serif;text-decoration:none">Book my free 15-minute line check</a></td></tr></table>
<p style="margin:0 0 12px;font-size:12px;letter-spacing:2px;font-weight:700;color:#777;text-transform:uppercase">Clear business pricing</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px">
<tr>
<td width="50%" valign="top" style="padding:0 6px 12px 0"><div style="border:2px solid #0d0d0d;padding:14px"><div style="font-size:13px;font-weight:700">Hosted VoIP</div><div style="font-size:26px;font-weight:900;line-height:1.25">&pound;6.95<span style="font-size:12px;font-weight:600"> /seat/mo + VAT</span></div><div style="font-size:12px;color:#666">&pound;8.34 inc. VAT &middot; cloud phones</div></div></td>
<td width="50%" valign="top" style="padding:0 0 12px 6px"><div style="border:2px solid #0d0d0d;padding:14px"><div style="font-size:13px;font-weight:700">SIP trunks</div><div style="font-size:26px;font-weight:900;line-height:1.25">&pound;5.95<span style="font-size:12px;font-weight:600"> /trunk/mo + VAT</span></div><div style="font-size:12px;color:#666">&pound;7.14 inc. VAT &middot; for your phone system</div></div></td>
</tr>
<tr>
<td width="50%" valign="top" style="padding:0 6px 12px 0"><div style="border:2px solid #0d0d0d;padding:14px"><div style="font-size:13px;font-weight:700">Business broadband</div><div style="font-size:26px;font-weight:900;line-height:1.25">&pound;34.99<span style="font-size:12px;font-weight:600"> /mo + VAT</span></div><div style="font-size:12px;color:#666">&pound;41.99 inc. VAT &middot; the connection</div></div></td>
<td width="50%" valign="top" style="padding:0 0 12px 6px"><div style="border:2px solid #0d0d0d;padding:14px"><div style="font-size:13px;font-weight:700">Business SIMs</div><div style="font-size:26px;font-weight:900;line-height:1.25">&pound;7.50<span style="font-size:12px;font-weight:600"> /line/mo + VAT</span></div><div style="font-size:12px;color:#666">&pound;9.00 inc. VAT &middot; mobile lines</div></div></td>
</tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;margin:8px 0 26px"><tr><td style="padding:22px 22px 8px;color:#ffffff;font:15px/1.55 Arial,Helvetica,sans-serif">
<p style="margin:0 0 16px;font-size:19px;font-weight:900;color:#ffe500">Why Huddersfield businesses choose OCCTA</p>
<p style="margin:0 0 12px"><span style="color:#ffe500;font-weight:900">&#10003;</span>&nbsp; <strong>Local, UK-based support.</strong> We're based in Huddersfield, so you deal with real people who know the area.</p>
<p style="margin:0 0 12px"><span style="color:#ffe500;font-weight:900">&#10003;</span>&nbsp; <strong>The price in writing first.</strong> A written quote with ex- and inc-VAT prices, and a Contract Summary before you accept.</p>
<p style="margin:0 0 12px"><span style="color:#ffe500;font-weight:900">&#10003;</span>&nbsp; <strong>One provider, one bill.</strong> Broadband, phone lines and business mobiles together.</p>
<p style="margin:0 0 12px"><span style="color:#ffe500;font-weight:900">&#10003;</span>&nbsp; <strong>Your numbers stay yours.</strong> Ports planned to minimise disruption, subject to eligibility.</p>
<p style="margin:0 0 14px"><span style="color:#ffe500;font-weight:900">&#10003;</span>&nbsp; <strong>No hard sell.</strong> The line check is free and there's no obligation.</p>
</td></tr></table>
<p style="margin:0 0 14px">Your reference is <strong>{{flyer_ref}}</strong>. Prefer to talk? Call <strong>0800 260 6626</strong> (Mon&ndash;Fri, 9am&ndash;6pm) or simply reply to this email.</p>
<p style="margin:0 0 18px">Best regards,<br><strong>The OCCTA Business team</strong><br><span style="color:#666;font-size:13px">22 Pavilion View, Huddersfield</span></p>
<p style="margin:0 0 18px;font-size:14px"><strong>P.S.</strong> Areas are switched one by one, so it's worth checking before your exchange is scheduled rather than after something stops working.</p>
<p style="margin:0;font-size:11px;line-height:1.5;color:#777">Business prices exclude VAT; inc-VAT prices in brackets. "From" prices depend on address, route, term and eligibility; your quote and Contract Summary confirm exact prices before you accept. Number porting is subject to eligibility and the losing provider's records. Hosted voice needs power and a working internet connection, so emergency calls may not work in a power cut; ask us about back-up options. Compatibility of third-party equipment must be confirmed with its supplier. OCCTA is not Openreach.</p>$html$,
  body_text = $txt$Hello {{business_name}} team,

The UK's analogue phone network is being switched off exchange by exchange, and Openreach aims to finish by January 2027. When your area switches, anything still relying on an old copper line can stop working.

It isn't just the phone on the desk. Check what else uses your line: phones, card machine, alarm, door entry, lift line, fax.

HOW YOUR FREE LINE CHECK WORKS
01 List what's on your line - 15 minutes by phone or video.
02 We check your site - network, numbers and porting eligibility.
03 A real, written quote - ex- and inc-VAT, setup and care level, before you sign.
04 Keep your number - ports planned to minimise disruption, subject to eligibility.

Book your free 15-minute line check: {{cta_url}}

CLEAR BUSINESS PRICING
- Hosted VoIP from £6.95 per seat a month + VAT (£8.34 inc. VAT)
- SIP trunks from £5.95 per trunk a month + VAT (£7.14 inc. VAT)
- Business broadband from £34.99 a month + VAT (£41.99 inc. VAT)
- Business SIMs from £7.50 per line a month + VAT (£9.00 inc. VAT)

WHY HUDDERSFIELD BUSINESSES CHOOSE OCCTA
- Local, UK-based support: we're based in Huddersfield.
- The price in writing first: a written quote and a Contract Summary before you accept.
- One provider, one bill: broadband, phone lines and business mobiles together.
- Your numbers stay yours: ports planned to minimise disruption, subject to eligibility.
- No hard sell: the line check is free and there's no obligation.

Your reference is {{flyer_ref}}. Prefer to talk? Call 0800 260 6626 (Mon-Fri, 9am-6pm) or simply reply to this email.

Best regards,
The OCCTA Business team
22 Pavilion View, Huddersfield

P.S. Areas are switched one by one, so it's worth checking before your exchange is scheduled rather than after something stops working.

Business prices exclude VAT. "From" prices depend on address, route, term and eligibility; your quote and Contract Summary confirm exact prices before you accept. Number porting is subject to eligibility. Hosted voice needs power and a working internet connection, so emergency calls may not work in a power cut. OCCTA is not Openreach.$txt$
WHERE template_key = 'last-orders-landline';

UPDATE public.outreach_templates SET
  subject = '{{business_name}}: will your card machine still work after the switch-off?',
  preheader = 'A 2-minute checklist for card machines, alarms, door entry and lift lines, plus a free 15-minute line check.',
  cta_label = 'Book my free line check',
  hero_image_url = 'https://www.occta.co.uk/email/occta-card-machine.jpg',
  body_html = $html$<p style="margin:0 0 14px;font-size:17px;font-weight:700;color:#0d0d0d">Hello {{business_name}} team,</p>
<p style="margin:0 0 14px">Card machines, alarms, door entry and lift emergency phones can all depend on analogue phone lines, and those lines are being switched off area by area. Openreach aims to finish by <strong>January 2027</strong>.</p>
<p style="margin:0 0 20px">If a card terminal still dials out over a copper line, it can stop taking payments on the day your exchange switches. Here's a 2-minute checklist:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:2px solid #0d0d0d">
<tr><td colspan="2" style="background:#0d0d0d;color:#ffe500;padding:10px 14px;font-weight:900;font-size:15px">Your 2-minute switch-off checklist</td></tr>
<tr><td width="40" valign="top" style="padding:12px 0 10px 14px"><div style="width:18px;height:18px;border:2px solid #0d0d0d"></div></td><td valign="top" style="padding:12px 14px 10px 6px;border-bottom:1px solid #e5e5e5"><strong>Card machine (PDQ)</strong><br><span style="color:#555;font-size:14px">Phone line, broadband or SIM? Ask your terminal provider.</span></td></tr>
<tr><td width="40" valign="top" style="padding:12px 0 10px 14px"><div style="width:18px;height:18px;border:2px solid #0d0d0d"></div></td><td valign="top" style="padding:12px 14px 10px 6px;border-bottom:1px solid #e5e5e5"><strong>Intruder or fire alarm</strong><br><span style="color:#555;font-size:14px">Is it monitored? Ask your alarm company about digital.</span></td></tr>
<tr><td width="40" valign="top" style="padding:12px 0 10px 14px"><div style="width:18px;height:18px;border:2px solid #0d0d0d"></div></td><td valign="top" style="padding:12px 14px 10px 6px;border-bottom:1px solid #e5e5e5"><strong>Door entry or intercom</strong><br><span style="color:#555;font-size:14px">Does it dial out over a phone line?</span></td></tr>
<tr><td width="40" valign="top" style="padding:12px 0 10px 14px"><div style="width:18px;height:18px;border:2px solid #0d0d0d"></div></td><td valign="top" style="padding:12px 14px 10px 6px;border-bottom:1px solid #e5e5e5"><strong>Lift emergency phone</strong><br><span style="color:#555;font-size:14px">Ask your lift maintenance company.</span></td></tr>
<tr><td width="40" valign="top" style="padding:12px 0 10px 14px"><div style="width:18px;height:18px;border:2px solid #0d0d0d"></div></td><td valign="top" style="padding:12px 14px 10px 6px;border-bottom:1px solid #e5e5e5"><strong>Phones and numbers</strong><br><span style="color:#555;font-size:14px">How many lines, and which numbers must you keep?</span></td></tr>
<tr><td width="40" valign="top" style="padding:12px 0 12px 14px"><div style="width:18px;height:18px;border:2px solid #0d0d0d"></div></td><td valign="top" style="padding:12px 14px 12px 6px"><strong>Fax or franking machine</strong><br><span style="color:#555;font-size:14px">Still needed? Many can move to email or web.</span></td></tr>
</table>
<p style="margin:0 0 14px"><strong>Ticked anything?</strong> Book a free 15-minute line check by phone or video. We'll go through your list, check your site and send a written quote. There's no obligation.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 30px"><tr><td style="background:#ffe500;border:2px solid #0d0d0d"><a href="{{cta_url}}" style="display:inline-block;padding:13px 24px;color:#0d0d0d;font:700 16px Arial,Helvetica,sans-serif;text-decoration:none">Book my free 15-minute line check</a></td></tr></table>
<p style="margin:0 0 12px;font-size:12px;letter-spacing:2px;font-weight:700;color:#777;text-transform:uppercase">Clear business pricing</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px">
<tr>
<td width="50%" valign="top" style="padding:0 6px 12px 0"><div style="border:2px solid #0d0d0d;padding:14px"><div style="font-size:13px;font-weight:700">Business broadband</div><div style="font-size:26px;font-weight:900;line-height:1.25">&pound;34.99<span style="font-size:12px;font-weight:600"> /mo + VAT</span></div><div style="font-size:12px;color:#666">&pound;41.99 inc. VAT &middot; for card machines and more</div></div></td>
<td width="50%" valign="top" style="padding:0 0 12px 6px"><div style="border:2px solid #0d0d0d;padding:14px"><div style="font-size:13px;font-weight:700">Business SIMs</div><div style="font-size:26px;font-weight:900;line-height:1.25">&pound;7.50<span style="font-size:12px;font-weight:600"> /line/mo + VAT</span></div><div style="font-size:12px;color:#666">&pound;9.00 inc. VAT &middot; mobile lines</div></div></td>
</tr>
<tr>
<td width="50%" valign="top" style="padding:0 6px 12px 0"><div style="border:2px solid #0d0d0d;padding:14px"><div style="font-size:13px;font-weight:700">Hosted VoIP</div><div style="font-size:26px;font-weight:900;line-height:1.25">&pound;6.95<span style="font-size:12px;font-weight:600"> /seat/mo + VAT</span></div><div style="font-size:12px;color:#666">&pound;8.34 inc. VAT &middot; cloud phones</div></div></td>
<td width="50%" valign="top" style="padding:0 0 12px 6px"><div style="border:2px solid #0d0d0d;padding:14px"><div style="font-size:13px;font-weight:700">SIP trunks</div><div style="font-size:26px;font-weight:900;line-height:1.25">&pound;5.95<span style="font-size:12px;font-weight:600"> /trunk/mo + VAT</span></div><div style="font-size:12px;color:#666">&pound;7.14 inc. VAT &middot; for your phone system</div></div></td>
</tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;margin:8px 0 26px"><tr><td style="padding:22px 22px 8px;color:#ffffff;font:15px/1.55 Arial,Helvetica,sans-serif">
<p style="margin:0 0 16px;font-size:19px;font-weight:900;color:#ffe500">Why Huddersfield businesses choose OCCTA</p>
<p style="margin:0 0 12px"><span style="color:#ffe500;font-weight:900">&#10003;</span>&nbsp; <strong>Local, UK-based support.</strong> We're based in Huddersfield, so you deal with real people who know the area.</p>
<p style="margin:0 0 12px"><span style="color:#ffe500;font-weight:900">&#10003;</span>&nbsp; <strong>The price in writing first.</strong> A written quote with ex- and inc-VAT prices, and a Contract Summary before you accept.</p>
<p style="margin:0 0 12px"><span style="color:#ffe500;font-weight:900">&#10003;</span>&nbsp; <strong>One provider, one bill.</strong> Broadband, phone lines and business mobiles together.</p>
<p style="margin:0 0 12px"><span style="color:#ffe500;font-weight:900">&#10003;</span>&nbsp; <strong>Your numbers stay yours.</strong> Ports planned to minimise disruption, subject to eligibility.</p>
<p style="margin:0 0 14px"><span style="color:#ffe500;font-weight:900">&#10003;</span>&nbsp; <strong>No hard sell.</strong> The line check is free and there's no obligation.</p>
</td></tr></table>
<p style="margin:0 0 14px">Your reference is <strong>{{flyer_ref}}</strong>. Prefer to talk? Call <strong>0800 260 6626</strong> (Mon&ndash;Fri, 9am&ndash;6pm) or simply reply to this email.</p>
<p style="margin:0 0 18px">Best regards,<br><strong>The OCCTA Business team</strong><br><span style="color:#666;font-size:13px">22 Pavilion View, Huddersfield</span></p>
<p style="margin:0 0 18px;font-size:14px"><strong>P.S.</strong> If you take card payments, ask your terminal provider how your machine connects today. It's the one most businesses forget until it stops working.</p>
<p style="margin:0;font-size:11px;line-height:1.5;color:#777">Business prices exclude VAT; inc-VAT prices in brackets. "From" prices depend on address, route, term and eligibility; your quote and Contract Summary confirm exact prices before you accept. Compatibility of third-party equipment (card terminals, alarms, door entry, lift lines, telecare) must be confirmed with the equipment supplier. Hosted voice needs power and a working internet connection, so emergency calls may not work in a power cut. OCCTA is not Openreach.</p>$html$,
  body_text = $txt$Hello {{business_name}} team,

Card machines, alarms, door entry and lift emergency phones can all depend on analogue phone lines, and those lines are being switched off area by area. Openreach aims to finish by January 2027.

If a card terminal still dials out over a copper line, it can stop taking payments on the day your exchange switches.

YOUR 2-MINUTE SWITCH-OFF CHECKLIST
[ ] Card machine (PDQ): phone line, broadband or SIM? Ask your terminal provider.
[ ] Intruder or fire alarm: is it monitored? Ask your alarm company about digital.
[ ] Door entry or intercom: does it dial out over a phone line?
[ ] Lift emergency phone: ask your lift maintenance company.
[ ] Phones and numbers: how many lines, and which numbers must you keep?
[ ] Fax or franking machine: still needed? Many can move to email or web.

Ticked anything? Book a free 15-minute line check by phone or video. We'll go through your list, check your site and send a written quote. There's no obligation.

Book your free line check: {{cta_url}}

CLEAR BUSINESS PRICING
- Business broadband from £34.99 a month + VAT (£41.99 inc. VAT)
- Business SIMs from £7.50 per line a month + VAT (£9.00 inc. VAT)
- Hosted VoIP from £6.95 per seat a month + VAT (£8.34 inc. VAT)
- SIP trunks from £5.95 per trunk a month + VAT (£7.14 inc. VAT)

WHY HUDDERSFIELD BUSINESSES CHOOSE OCCTA
- Local, UK-based support: we're based in Huddersfield.
- The price in writing first: a written quote and a Contract Summary before you accept.
- One provider, one bill: broadband, phone lines and business mobiles together.
- Your numbers stay yours: ports planned to minimise disruption, subject to eligibility.
- No hard sell: the line check is free and there's no obligation.

Your reference is {{flyer_ref}}. Prefer to talk? Call 0800 260 6626 (Mon-Fri, 9am-6pm) or simply reply to this email.

Best regards,
The OCCTA Business team
22 Pavilion View, Huddersfield

P.S. If you take card payments, ask your terminal provider how your machine connects today. It's the one most businesses forget until it stops working.

Business prices exclude VAT. "From" prices depend on address, route, term and eligibility. Compatibility of third-party equipment must be confirmed with the equipment supplier. Hosted voice needs power and a working internet connection, so emergency calls may not work in a power cut. OCCTA is not Openreach.$txt$
WHERE template_key = 'card-machine-checklist';

-- Refresh drafts that were created from these templates.
UPDATE public.outreach_campaigns c SET
  subject = t.subject,
  preheader = t.preheader,
  body_html = t.body_html,
  body_text = t.body_text,
  cta_label = t.cta_label,
  hero_image_url = t.hero_image_url
FROM public.outreach_templates t
WHERE c.template_id = t.id
  AND c.status = 'draft'
  AND t.template_key IN ('last-orders-landline', 'card-machine-checklist');

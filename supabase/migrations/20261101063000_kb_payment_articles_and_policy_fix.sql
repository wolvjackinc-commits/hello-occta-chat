-- 1. Help articles failed for every signed-in user (customers and staff):
--    the KB policies call has_compliance_access(), whose EXECUTE was revoked
--    from authenticated on 2026-08-24, so Postgres raises "permission denied"
--    and the page shows 404. Rewrite those policies with has_role(), which
--    authenticated can already run. Same people get access as before
--    (admin, super_admin, compliance_admin); nothing is opened up.
do $$
declare
  cond text := '(has_role(auth.uid(), ''admin''::app_role) OR has_role(auth.uid(), ''super_admin''::app_role) OR has_role(auth.uid(), ''compliance_admin''::app_role))';
begin
  execute 'drop policy if exists "compliance manage kb" on public.kb_articles';
  execute format('create policy "compliance manage kb" on public.kb_articles for all to authenticated using %s with check %s', cond, cond);
  execute 'drop policy if exists "compliance manage kb categories" on public.kb_categories';
  execute format('create policy "compliance manage kb categories" on public.kb_categories for all to authenticated using %s with check %s', cond, cond);
  execute 'drop policy if exists "compliance write kb versions" on public.kb_article_versions';
  execute format('create policy "compliance write kb versions" on public.kb_article_versions for insert to authenticated with check %s', cond);
  execute 'drop policy if exists "staff manage template links" on public.email_template_help_links';
  execute format('create policy "staff manage template links" on public.email_template_help_links for all to authenticated using %s with check %s', cond, cond);
  execute 'drop policy if exists "staff read template links" on public.email_template_help_links';
  execute format('create policy "staff read template links" on public.email_template_help_links for select to authenticated using %s', cond);
  execute 'drop policy if exists "staff read kb feedback" on public.help_article_feedback';
  execute format('create policy "staff read kb feedback" on public.help_article_feedback for select to authenticated using %s', cond);
  execute 'drop policy if exists "staff read search logs" on public.help_search_logs';
  execute format('create policy "staff read search logs" on public.help_search_logs for select to authenticated using %s', cond);
end $$;

-- 2. Payment help content: OCCTA takes Direct Debit or bank transfer only.
insert into kb_articles (slug, kind, status, visibility, title, summary, seo_title, seo_description, tags, related_slugs, read_minutes, last_reviewed_at, approved_at, structured_data, content)
values
('how-to-pay-your-occta-bill','help','approved','public',
 'How to pay your OCCTA bill',
 'The two ways to pay: Direct Debit, or bank transfer to OCCTA LIMITED quoting your account number.',
 'How to pay your OCCTA bill | OCCTA Help',
 'OCCTA bills are paid by Direct Debit or bank transfer. Our bank details, the reference to use, and what to do if a payment is late.',
 array['payment','billing','direct debit','bank transfer'],
 array['how-direct-debit-setup-works','what-to-do-if-a-direct-debit-payment-fails','how-occta-billing-works'],
 2, now(), now(),
 '{"faqs":[{"question":"Can I pay by card or over the phone?","answer":"No. OCCTA takes payment by Direct Debit or bank transfer only."},{"question":"I forgot to add a reference.","answer":"Email hello@occta.co.uk with the amount, the date and the name on the paying account and we will match it."}]}'::jsonb,
$c$OCCTA takes payment in two ways: **Direct Debit** or **bank transfer**. We don't take card payments or payments over the phone.

## Direct Debit
If you have an active Direct Debit, there's nothing to do. We collect each bill on or after the date shown on it, and you're protected by the Direct Debit Guarantee.

## Bank transfer
Pay from your banking app using these details. They're also printed on every bill.

- **Account name:** OCCTA LIMITED
- **Bank:** Lloyds Bank
- **Sort code:** 30-98-97
- **Account number:** 61499362
- **Reference:** your OCCTA account number (it starts with OCC)

Transfers usually arrive the same day. We show the payment in your account within one working day of receiving it.

## Stay safe
Our bank details don't change. If you ever get a message saying OCCTA has new bank details, don't pay. Call us on 0800 260 6626 first. Your bank's Confirmation of Payee check should show **OCCTA LIMITED**.

## Can't pay on time?
Call us on 0800 260 6626 (Monday to Friday, 8am to 6pm) before the due date and we'll help.$c$),
('what-to-do-if-a-direct-debit-payment-fails','help','approved','public',
 'What to do if a Direct Debit payment fails',
 'Why a Direct Debit can be returned, how to pay that bill by bank transfer, and how to make sure the next one goes through.',
 'What to do if a Direct Debit payment fails | OCCTA Help',
 'If an OCCTA Direct Debit is returned by your bank, pay that bill by bank transfer and check your mandate so the next collection goes through.',
 array['direct debit','failed payment','billing'],
 array['how-to-pay-your-occta-bill','how-direct-debit-setup-works','how-occta-billing-works'],
 2, now(), now(), '{}'::jsonb,
$c$If your bank returns a Direct Debit, we'll email you. The bill is still due, so here's how to put it right.

## Pay that bill by bank transfer
- **Account name:** OCCTA LIMITED
- **Bank:** Lloyds Bank
- **Sort code:** 30-98-97
- **Account number:** 61499362
- **Reference:** your OCCTA account number

## Common reasons a Direct Debit fails
- Not enough money in the account on the collection day.
- The Direct Debit was cancelled at your bank.
- The bank account was changed or closed.

## Make sure the next one goes through
Keep enough in your account on the collection date shown on your bill. If your bank details have changed, set up a new Direct Debit from your account and let us know, so nothing is collected twice.

A late-payment charge may apply only after we've sent an overdue notice. If you're finding it hard to pay, call us on 0800 260 6626 before the due date. We'd much rather agree a plan with you.$c$)
on conflict (slug) do nothing;

update kb_articles set status='archived', updated_at=now()
 where slug in ('how-to-pay-by-invoice-link','invoice-link-payment-guide','what-to-do-if-your-card-payment-fails');

update kb_articles set related_slugs = (
  select coalesce(array_agg(distinct x), '{}') from unnest(array_replace(array_replace(array_replace(related_slugs,
    'how-to-pay-by-invoice-link','how-to-pay-your-occta-bill'),
    'invoice-link-payment-guide','how-to-pay-your-occta-bill'),
    'what-to-do-if-your-card-payment-fails','what-to-do-if-a-direct-debit-payment-fails')) x), updated_at=now()
 where related_slugs && array['how-to-pay-by-invoice-link','invoice-link-payment-guide','what-to-do-if-your-card-payment-fails'];

update kb_articles set updated_at=now(), last_reviewed_at=now(),
 content = replace(content, $o$## How you pay
You are either on invoice link or Direct Debit.
- Invoice link: we email you a link when a new invoice is ready. You are NOT automatically charged — you pay when you receive the link.
- Direct Debit: your bank pays us on the invoice due date once the mandate is active.$o$, $n$## How you pay
OCCTA takes payment by Direct Debit or bank transfer only. We don't take card or phone payments.
- Direct Debit: we collect each bill on or after its due date once your mandate is active.
- Bank transfer: pay OCCTA LIMITED, Lloyds Bank, sort code 30-98-97, account 61499362, quoting your OCCTA account number. See [How to pay your OCCTA bill](/help/how-to-pay-your-occta-bill).$n$),
 structured_data = '{"faqs":[{"question":"How can I pay my bill?","answer":"By Direct Debit or bank transfer. For bank transfer, pay OCCTA LIMITED, Lloyds Bank, sort code 30-98-97, account 61499362, quoting your OCCTA account number."},{"question":"Can I change my billing day?","answer":"Yes. Contact us and we will set your preferred billing day."}]}'::jsonb
 where slug='how-occta-billing-works';

update kb_articles set updated_at=now(), last_reviewed_at=now(),
 content = replace(replace(content,
  '- Direct Debit is NOT collected until the mandate is confirmed active. Any invoice issued before then is due manually via invoice link.',
  '- Direct Debit is NOT collected until the mandate is confirmed active. Any bill issued before then is paid by bank transfer (details on the bill).'),
  'Your bank tells us within 2 working days. We''ll email you and reissue the invoice as a payment link. No late fee applies for the first bank failure.',
  'Your bank tells us within 2 working days. We''ll email you, and you can pay that bill by bank transfer using the details on it. See [What to do if a Direct Debit payment fails](/help/what-to-do-if-a-direct-debit-payment-fails).')
 where slug='how-direct-debit-setup-works';

update kb_articles set updated_at=now(), last_reviewed_at=now(),
 content = replace(replace(content,
  'If paying by Direct Debit: we email you the invoice at least **3 working days before** we collect. If paying by card link: the invoice email contains a secure Worldpay link.',
  'If paying by Direct Debit: we email you the invoice at least **3 working days before** we collect. If paying by bank transfer: the bill shows our bank details and the reference to use.'),
  $o$- **Direct Debit** — set once, automatic.
- **Card via secure link** — one tap per invoice.
- We don't take card details over email or phone as a matter of routine.$o$,
  $n$- **Direct Debit** — set once, automatic.
- **Bank transfer** — OCCTA LIMITED, Lloyds Bank, sort code 30-98-97, account 61499362, quoting your OCCTA account number.
- We don't take card payments or payments over the phone.$n$)
 where slug='first-invoice-and-billing-timeline-guide';

update kb_articles set updated_at=now(),
 content = replace(content, '- Invoice link? Final invoice arrives by email.', '- Paying by bank transfer? Your final bill arrives by email with our bank details.')
 where slug='cancellation-and-final-bill-guide';

-- 3. Email "Helpful reading" boxes
delete from email_template_help_links where template_key in ('invoice_sent','overdue_reminder','payment_reminder','payment_received','receipt');
insert into email_template_help_links (template_key, article_slug, display_order) values
 ('invoice_sent','how-to-pay-your-occta-bill',0),('invoice_sent','why-your-first-bill-may-be-higher',1),('invoice_sent','how-occta-billing-works',2),
 ('overdue_reminder','how-to-pay-your-occta-bill',0),('overdue_reminder','what-to-do-if-a-direct-debit-payment-fails',1),('overdue_reminder','how-occta-billing-works',2),
 ('payment_reminder','how-to-pay-your-occta-bill',0),('payment_reminder','what-to-do-if-a-direct-debit-payment-fails',1),('payment_reminder','how-direct-debit-setup-works',2),
 ('payment_received','how-occta-billing-works',0),('payment_received','how-direct-debit-setup-works',1),('payment_received','how-to-pay-your-occta-bill',2),
 ('receipt','how-occta-billing-works',0),('receipt','how-direct-debit-setup-works',1),('receipt','how-to-pay-your-occta-bill',2);

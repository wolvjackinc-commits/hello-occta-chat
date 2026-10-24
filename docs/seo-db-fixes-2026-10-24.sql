-- OCCTA database fixes found during the SEO audit (24 Oct 2026).
-- Not a migration: review, then run once in the Supabase / Lovable Cloud SQL editor.

-- 1) SIM plans are invisible to every logged-out visitor.
--    Migration 20260824013157 set sim_plans_public to security_invoker = true.
--    Since 20260710042132 anon/authenticated have no SELECT on sim_plans and no
--    public RLS policy, so the view returns zero rows and /sim (and every SIM
--    landing page) says "SIM-only plans are not open for online ordering".
--    Running the view as its owner restores the July design: the public can read
--    only the view's customer-facing columns for active, checkout-visible plans;
--    the base table stays closed.
ALTER VIEW public.sim_plans_public SET (security_invoker = false);
-- Check (should return the active plan count, e.g. 72):
--   set role anon; select count(*) from public.sim_plans_public; reset role;

-- 2) Retired card-payment help articles (OCCTA takes Direct Debit or bank
--    transfer only). Their URLs already 301 to /pay-by-card in public/_redirects;
--    archiving removes them from the KB sitemap, search and Ollie's knowledge.
UPDATE public.kb_articles
SET status = 'archived', updated_at = now()
WHERE slug IN ('how-to-pay-by-invoice-link', 'invoice-link-payment-guide', 'what-to-do-if-your-card-payment-fails');

-- 3) Remove card/payment-link wording, rename the chatbot to Ollie, and correct
--    the "no-contract is our default" claim in the remaining articles.
UPDATE public.kb_articles
SET content = replace(replace(replace(replace(replace(replace(replace(content,
      'Any invoice issued before then is due manually via invoice link.',
      'Any invoice issued before then is paid by bank transfer, using the bank details and reference printed on the invoice.'),
      'We''ll email you and reissue the invoice as a payment link.',
      'We''ll email you and ask you to pay that invoice by bank transfer, using the details on the invoice.'),
      'If paying by card link: the invoice email contains a secure Worldpay link.',
      'If paying by bank transfer: the invoice shows OCCTA''s bank details and the reference to quote.'),
      E'- **Card via secure link** — one tap per invoice.\n- We don''t take card details over email or phone as a matter of routine.',
      E'- **Bank transfer** — pay each invoice using the bank details and reference on it.\n- OCCTA does not take card payments or payments over the phone.'),
      'Chat with Ira (fastest)', 'Chat with Ollie (fastest)'),
      'Ira answers most questions', 'Ollie answers most questions'),
      'At OCCTA, no-contract is our default. You pay one monthly price,',
      'At OCCTA this is Flex 30, offered where eligible alongside Price Lock 24 (a 24-month fixed price). On Flex 30 you pay one monthly price,'),
    updated_at = now(), last_reviewed_at = now()
WHERE slug IN ('how-direct-debit-setup-works', 'first-invoice-and-billing-timeline-guide',
               'how-to-raise-a-support-request', 'no-contract-broadband-what-it-means');

-- 4) One meta description is too short to be useful in search results.
UPDATE public.kb_articles
SET seo_description = 'How OCCTA billing works: when your first invoice arrives, what it covers, pro-rata charges and paying by Direct Debit or bank transfer.'
WHERE slug = 'how-occta-billing-works';

-- Optional local demo for the payment reconciliation screens.
-- NOT applied by migrations, CI, or a production deploy.
-- Fictional rows only. Prefer the CSV samples in docs/examples via the admin importer.

insert into public.payment_recon_accounts (
  row_key, customer_name, payer_name, bank_payer_name, name_aliases, occta_ref, method,
  reconciled_status, match_category, case_codes, balance_outstanding, balance_kind,
  invoiced_amount, uninvoiced_amount, accesspay_status, occta_mandate_status,
  next_action, notes
) values
  (
    'ref:OCC10000001', 'Olivia Example', null, null, '{}', 'OCC10000001', 'DD',
    'overdue', 'discrepancy', '{opening_balance_uninvoiced}', 120.00, 'opening includes uninvoiced',
    40.00, 80.00, 'Active', 'Active',
    'Invoice the uninvoiced months', 'Full from opening, including uninvoiced months'
  ),
  (
    'ref:OCC10000007', 'Nina Example', 'Harmonic Spa', 'HAIRMONIC HEAD SPA', '{HAIRMONIC HEAD SPA}', 'OCC10000007', 'Bank transfer',
    'paid', 'matched', '{}', 0, null,
    null, null, 'Active', null,
    'Allocate the receipt to the personal account', 'Personal name differs from the business payer'
  ),
  (
    'name:sample civic hall', 'Sample Civic Hall', null, null, '{}', null, 'Bank transfer',
    'genuine_unmatched', 'genuine_unmatched', '{genuine_unmatched}', 0, null,
    null, null, null, null,
    'Genuine business receipt with no Occta customer', 'Not a discrepancy'
  )
on conflict (row_key) do nothing;

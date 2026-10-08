-- Admin-only payment reconciliation workspace.
-- Holds imported AccessPay, bank and customer-status snapshots.
-- Does not alter invoices, payments, mandates, profiles or allocations.

create table if not exists public.payment_recon_imports (
  id uuid primary key default gen_random_uuid(),
  file_kind text not null check (file_kind in ('customer_status', 'payment_events', 'accesspay_daily', 'bank_statement')),
  file_name text not null,
  content_sha256 text not null,
  row_count integer not null,
  imported_by uuid,
  imported_by_email text,
  first_imported_at timestamptz not null default now(),
  last_imported_at timestamptz not null default now(),
  import_count integer not null default 1 check (import_count > 0),
  unique (file_kind, content_sha256)
);

create table if not exists public.payment_recon_accounts (
  id uuid primary key default gen_random_uuid(),
  row_key text not null unique,
  customer_name text not null,
  payer_name text,
  bank_payer_name text,
  name_aliases text[] not null default '{}',
  occta_ref text,
  method text,
  occta_method text,
  amount_due numeric,
  due_date_raw text,
  due_on date,
  last_payment_received text,
  seen_in text,
  status_raw text,
  reconciled_status text not null,
  match_category text not null check (match_category in ('matched', 'discrepancy', 'genuine_unmatched', 'unlinked')),
  case_codes text[] not null default '{}',
  balance_outstanding numeric,
  balance_kind text,
  invoiced_amount numeric,
  uninvoiced_amount numeric,
  next_action text,
  accesspay_status text,
  occta_mandate_status text,
  dd_status text,
  last_dd_date_raw text,
  last_dd_on date,
  last_dd_amount numeric,
  last_dd_result text,
  failure_treatment text,
  next_dd_date_raw text,
  next_dd_on date,
  next_dd_amount numeric,
  bank_payments text,
  matched_payout text,
  invoice_balance numeric,
  invoice_state text,
  occta_recorded boolean,
  notes text,
  linked_account_number text,
  linked_invoice_number text,
  draft_marked_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_recon_payments (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  account_key text,
  customer_name text,
  payer_name text,
  bank_payer_name text,
  name_aliases text[] not null default '{}',
  occta_ref text,
  payment_ref text,
  invoice_number text,
  method text,
  occta_method text,
  amount numeric,
  charge_kind text,
  submitted_at_raw text,
  submitted_on date,
  collection_date_raw text,
  collection_on date,
  failed_at_raw text,
  failed_on date,
  failure_reason text,
  failure_treatment text,
  processed_at_raw text,
  processed_on date,
  payout_ref text,
  bank_received_at_raw text,
  bank_received_on date,
  bank_description text,
  status_raw text,
  reconciled_status text not null,
  match_category text not null check (match_category in ('matched', 'discrepancy', 'genuine_unmatched', 'unlinked')),
  case_codes text[] not null default '{}',
  balance_after numeric,
  occta_recorded boolean,
  linked_account_number text,
  linked_invoice_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_recon_mandates (
  id uuid primary key default gen_random_uuid(),
  mandate_key text not null unique,
  account_key text,
  customer_name text,
  occta_ref text,
  payer_name text,
  mandate_reference text,
  status text,
  accesspay_status text,
  created_raw text,
  created_on date,
  submitted_raw text,
  submitted_on date,
  cancelled_raw text,
  cancelled_on date,
  is_test boolean not null default false,
  is_duplicate boolean not null default false,
  never_submitted boolean not null default false,
  linked_account_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_recon_bank_lines (
  id uuid primary key default gen_random_uuid(),
  line_key text not null unique,
  bank_date_raw text,
  bank_on date,
  amount numeric,
  description text,
  payer_name text,
  reference text,
  payout_ref text,
  match_category text not null check (match_category in ('matched', 'discrepancy', 'genuine_unmatched', 'unlinked')),
  matched_account_key text,
  matched_payment_ref text,
  matched_payout_ref text,
  linked_account_number text,
  linked_invoice_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_recon_payouts (
  id uuid primary key default gen_random_uuid(),
  payout_ref text not null unique,
  amount numeric,
  fee_amount numeric,
  bank_amount numeric,
  processed_raw text,
  processed_on date,
  bank_date_raw text,
  bank_on date,
  bank_description text,
  match_category text not null check (match_category in ('matched', 'discrepancy', 'genuine_unmatched', 'unlinked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_recon_timeline (
  id uuid primary key default gen_random_uuid(),
  timeline_key text not null unique,
  subject_type text not null,
  subject_key text not null,
  field_name text not null,
  previous_value text,
  new_value text,
  recorded_at timestamptz not null default now(),
  file_kind text,
  file_sha text,
  note text
);

create table if not exists public.payment_recon_audit (
  id uuid primary key default gen_random_uuid(),
  audit_key text not null unique,
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  action text not null,
  subject_type text not null,
  subject_key text not null,
  account_number text,
  invoice_number text,
  detail text
);

create index if not exists payment_recon_accounts_ref_idx on public.payment_recon_accounts (occta_ref);
create index if not exists payment_recon_accounts_category_idx on public.payment_recon_accounts (match_category);
create index if not exists payment_recon_payments_ref_idx on public.payment_recon_payments (occta_ref);
create index if not exists payment_recon_payments_payout_idx on public.payment_recon_payments (payout_ref);
create index if not exists payment_recon_payments_category_idx on public.payment_recon_payments (match_category);
create index if not exists payment_recon_bank_lines_category_idx on public.payment_recon_bank_lines (match_category);
create index if not exists payment_recon_timeline_subject_idx on public.payment_recon_timeline (subject_type, subject_key);

comment on table public.payment_recon_accounts is
  'Imported reconciliation snapshot. genuine_unmatched means a genuine business receipt with no Occta customer and is not a discrepancy. Manual links do not change the invoice ledger.';
comment on column public.payment_recon_accounts.case_codes is
  'opening_balance_uninvoiced, mandate_cancelled_occta_active, failed_attempt_existing_charge, bank_receipt_not_in_occta, mislabeled_card_was_transfer, accesspay_only_no_occta_record, draft_invoice_mark_due_no_email, unallocated_no_invoice';
comment on column public.payment_recon_accounts.name_aliases is
  'Trading names and bank-statement spellings used to auto-match a payer whose name differs from the customer personal name.';

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'payment_recon_imports',
    'payment_recon_accounts',
    'payment_recon_payments',
    'payment_recon_mandates',
    'payment_recon_bank_lines',
    'payment_recon_payouts',
    'payment_recon_timeline',
    'payment_recon_audit'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on table public.%I from anon, public', tbl);
    execute format('grant select, insert, update, delete on table public.%I to authenticated, service_role', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_admin_all', tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.has_role(auth.uid(), ''admin''::public.app_role) or public.has_role(auth.uid(), ''super_admin''::public.app_role)) with check (public.has_role(auth.uid(), ''admin''::public.app_role) or public.has_role(auth.uid(), ''super_admin''::public.app_role))',
      tbl || '_admin_all',
      tbl
    );
  end loop;
end $$;

-- OCCTA Admin Core Tables (Services, Billing, Direct Debit + Payments)

-- Helper: updated_at trigger function
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- SERVICES
-- =========================
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_type text not null check (service_type in ('landline','broadband','sim')),
  identifiers jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','active','suspended','ceased')),
  supplier_reference text,
  activation_date date,
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_services_updated_at on public.services;
create trigger trg_services_updated_at
before update on public.services
for each row execute function public.set_updated_at();

create index if not exists idx_services_user_id on public.services(user_id);
create index if not exists idx_services_type on public.services(service_type);
create index if not exists idx_services_status on public.services(status);

-- =========================
-- BILLING: INVOICES
-- =========================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  order_id uuid,
  status text not null default 'draft' check (status in ('draft','issued','sent','paid','overdue','cancelled')),
  issue_date date not null default current_date,
  due_date date,
  currency text not null default 'GBP',
  subtotal numeric not null default 0,
  vat_total numeric not null default 0,
  total numeric not null default 0,
  notes text,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create index if not exists idx_invoices_user_id on public.invoices(user_id);
create index if not exists idx_invoices_service_id on public.invoices(service_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_issue_date on public.invoices(issue_date);

-- Invoice lines
create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  qty numeric not null default 1,
  unit_price numeric not null default 0,
  vat_rate numeric not null default 0,
  line_total numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_lines_invoice_id on public.invoice_lines(invoice_id);

-- Receipts
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  paid_at timestamptz not null default now(),
  method text,
  reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_receipts_invoice_id on public.receipts(invoice_id);
create index if not exists idx_receipts_user_id on public.receipts(user_id);

-- Credit notes
create table if not exists public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_notes_invoice_id on public.credit_notes(invoice_id);
create index if not exists idx_credit_notes_user_id on public.credit_notes(user_id);

-- =========================
-- DIRECT DEBIT + PAYMENTS
-- =========================
create table if not exists public.dd_mandates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','active','failed','cancelled')),
  mandate_reference text,
  bank_last4 text,
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_dd_mandates_updated_at on public.dd_mandates;
create trigger trg_dd_mandates_updated_at
before update on public.dd_mandates
for each row execute function public.set_updated_at();

create index if not exists idx_dd_mandates_user_id on public.dd_mandates(user_id);
create index if not exists idx_dd_mandates_status on public.dd_mandates(status);

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  provider text,
  status text not null check (status in ('success','failed','pending')),
  amount numeric not null default 0,
  reason text,
  attempted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_attempts_user_id on public.payment_attempts(user_id);
create index if not exists idx_payment_attempts_invoice_id on public.payment_attempts(invoice_id);
create index if not exists idx_payment_attempts_status on public.payment_attempts(status);

-- =========================
-- RLS + POLICIES
-- =========================
alter table public.services enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.receipts enable row level security;
alter table public.credit_notes enable row level security;
alter table public.dd_mandates enable row level security;
alter table public.payment_attempts enable row level security;

-- SERVICES
drop policy if exists services_select_own on public.services;
create policy services_select_own on public.services
for select using (auth.uid() = user_id or has_role(auth.uid(), 'admin'::app_role));

drop policy if exists services_admin_write on public.services;
create policy services_admin_write on public.services
for all using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));

-- INVOICES
drop policy if exists invoices_select_own on public.invoices;
create policy invoices_select_own on public.invoices
for select using (auth.uid() = user_id or has_role(auth.uid(), 'admin'::app_role));

drop policy if exists invoices_admin_write on public.invoices;
create policy invoices_admin_write on public.invoices
for all using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));

-- INVOICE LINES (via parent invoice)
drop policy if exists invoice_lines_select_via_invoice on public.invoice_lines;
create policy invoice_lines_select_via_invoice on public.invoice_lines
for select using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_id
      and (i.user_id = auth.uid() or has_role(auth.uid(), 'admin'::app_role))
  )
);

drop policy if exists invoice_lines_admin_write on public.invoice_lines;
create policy invoice_lines_admin_write on public.invoice_lines
for all using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));

-- RECEIPTS
drop policy if exists receipts_select_own on public.receipts;
create policy receipts_select_own on public.receipts
for select using (auth.uid() = user_id or has_role(auth.uid(), 'admin'::app_role));

drop policy if exists receipts_admin_write on public.receipts;
create policy receipts_admin_write on public.receipts
for all using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));

-- CREDIT NOTES
drop policy if exists credit_notes_select_own on public.credit_notes;
create policy credit_notes_select_own on public.credit_notes
for select using (auth.uid() = user_id or has_role(auth.uid(), 'admin'::app_role));

drop policy if exists credit_notes_admin_write on public.credit_notes;
create policy credit_notes_admin_write on public.credit_notes
for all using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));

-- DD MANDATES
drop policy if exists dd_mandates_select_own on public.dd_mandates;
create policy dd_mandates_select_own on public.dd_mandates
for select using (auth.uid() = user_id or has_role(auth.uid(), 'admin'::app_role));

drop policy if exists dd_mandates_admin_write on public.dd_mandates;
create policy dd_mandates_admin_write on public.dd_mandates
for all using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));

-- PAYMENT ATTEMPTS
drop policy if exists payment_attempts_select_own on public.payment_attempts;
create policy payment_attempts_select_own on public.payment_attempts
for select using (auth.uid() = user_id or has_role(auth.uid(), 'admin'::app_role));

drop policy if exists payment_attempts_admin_write on public.payment_attempts;
create policy payment_attempts_admin_write on public.payment_attempts
for all using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
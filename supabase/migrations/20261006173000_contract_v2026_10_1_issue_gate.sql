-- OCCTA Consumer Contract v2026.10.1 production issuance gate.
-- Effective for all new consumer contract documents from 2026-10-06.
-- Historic accepted documents remain immutable and untouched.
--
-- This migration mirrors the production fail-closed controls: if an old
-- generator is still deployed, it cannot issue a new pre-v2026.10.1 customer
-- Contract Summary or Contract Information Pack.

create or replace function public.enforce_production_contract_version_on_issue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_information_update, false) = false
     and coalesce(new.terms_version, '') <> '2026.10.1' then
    raise exception using
      errcode = 'P0001',
      message = 'contract_version_not_current',
      detail = 'New OCCTA consumer contracts must use terms version 2026.10.1.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_require_production_contract_version_on_issue
  on public.contract_summaries;
create trigger trg_require_production_contract_version_on_issue
before insert on public.contract_summaries
for each row execute function public.enforce_production_contract_version_on_issue();

create or replace function public.enforce_production_cip_version_on_issue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.template_version, '') <> '2026.10.1' then
    raise exception using
      errcode = 'P0001',
      message = 'contract_information_version_not_current',
      detail = 'New OCCTA Contract Information Packs must use template version 2026.10.1.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_require_production_cip_version_on_issue
  on public.contract_information_packs;
create trigger trg_require_production_cip_version_on_issue
before insert on public.contract_information_packs
for each row execute function public.enforce_production_cip_version_on_issue();

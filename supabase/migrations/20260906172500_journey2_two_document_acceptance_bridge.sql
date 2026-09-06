-- Journey 2 production bridge for the two-document contract flow.
--
-- Why this exists:
-- Journey 2 materialises the commercial quote first and the Contract Summary
-- second. The two-document pack generator validates the quote's canonical
-- two_doc snapshot, while the Contract Summary already carries the final ETF,
-- notice-period and cancellation evidence. This bridge copies those immutable
-- contractual facts back to Journey 2 quotes as soon as the CS is issued and
-- asks the existing idempotent pack generator to issue the matching Contract
-- Information PDF. The generated pack is then bound to the exact CS version.
--
-- This preserves the fail-closed acceptance trigger: signing is never allowed
-- without the matching issued Contract Information pack when the two-document
-- feature is enabled.

create or replace function public.journey2_prepare_two_doc_quote_from_cs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _q public.quotes%rowtype;
  _price jsonb;
  _broadband_price numeric;
  _fixed boolean;
  _two_doc jsonb;
  _etf jsonb;
  _enabled boolean := false;
begin
  select * into _q
  from public.quotes
  where id = new.quote_id
    and journey_version = 'v2';

  if not found then
    return new;
  end if;

  select s.price_snapshot into _price
  from public.journey2_live_sessions s
  where s.quote_id = new.quote_id
  order by s.updated_at desc
  limit 1;

  _broadband_price := coalesce(
    nullif(_price->>'monthly_broadband_incl_vat', '')::numeric,
    _q.monthly_gross,
    0
  );

  _fixed := coalesce(new.minimum_term_months, _q.contract_length_months, 0) > 0
    or _q.plan_term = 'price_lock_24';

  _two_doc := jsonb_build_object(
    'broadband', jsonb_build_object(
      'contract_kind', case when _fixed then 'fixed_term' else 'flex_30_rolling' end,
      'minimum_term_months', case when _fixed
        then coalesce(new.minimum_term_months, _q.contract_length_months, 24)
        else 0 end,
      'notice_period_days', coalesce(new.notice_period_days, 30),
      'cancellation_wording', coalesce(
        new.cease_cancellation_charges,
        case when _fixed
          then 'Cancel with the stated notice period. An Early Termination Charge applies only where the accepted agreement says it applies.'
          else 'Cancel with the stated notice period. No Early Termination Charge applies.' end
      ),
      'label', _q.plan_name,
      'monthly_price_incl_vat', _broadband_price
    ),
    'price_change', jsonb_build_object(
      'kind', 'none',
      'wording', 'No scheduled price increase during the minimum term. If we ever need to change a price, we will tell you in writing at least 30 days in advance and you can leave penalty-free.'
    )
  );

  if _fixed then
    _etf := jsonb_build_object(
      'wording', coalesce(
        new.cease_cancellation_charges,
        'If you end the broadband service during the accepted minimum term and no penalty-free exit right applies, an Early Termination Charge is calculated from the remaining recurring broadband charges, less VAT that no longer becomes due and costs OCCTA reasonably saves because the service ends early. It will never exceed the remaining contracted broadband charges.'
      ),
      'calculation_method', coalesce(
        new.etf_policy_snapshot->>'calculation_method',
        'Remaining recurring broadband charges to the end of the accepted minimum term, less VAT no longer due and direct costs OCCTA reasonably saves because the service ends early'
      ),
      'cap_or_formula', coalesce(
        new.etf_policy_snapshot->>'cap_or_formula',
        'Never more than the remaining contracted broadband charges; no double recovery of the same loss'
      ),
      'worked_example', 'Example: if six monthly broadband charges remain when the service ends, the calculation starts with those six broadband charges, removes VAT that no longer becomes due and subtracts costs OCCTA reasonably saves because the service ends early. The charge can never exceed the remaining contracted broadband charges.',
      'vat_treatment', 'The calculation removes VAT that no longer becomes due; any final charge is shown clearly before it is collected.',
      'date_basis', 'From the effective service termination date after the applicable notice period to the end of the accepted minimum term.',
      'based_on_accepted_agreement', true
    );
    _two_doc := _two_doc || jsonb_build_object('broadband_etf', _etf);
  end if;

  update public.quotes
  set final_snapshot = jsonb_set(
        coalesce(final_snapshot, '{}'::jsonb),
        '{two_doc}',
        _two_doc,
        true
      ),
      contract_type = (
        case when _fixed then 'fixed_term' else 'flex_30_rolling' end
      )::public.contract_type_enum,
      customer_type_v2 = 'residential_consumer'::public.customer_type_enum,
      minimum_term_months = case when _fixed
        then coalesce(new.minimum_term_months, _q.contract_length_months, 24)
        else 0 end,
      notice_period_days = coalesce(new.notice_period_days, 30),
      etf_policy_snapshot = case when _fixed
        then coalesce(new.etf_policy_snapshot, _etf)
        else null end,
      price_change_snapshot = _two_doc->'price_change'
  where id = new.quote_id;

  select coalesce(two_document_contract_flow_enabled, false)
  into _enabled
  from public.platform_settings
  where singleton = true;

  if _enabled and not exists (
    select 1
    from public.contract_information_packs p
    where p.quote_id = new.quote_id
      and p.document_status <> 'superseded'::public.document_status_enum
  ) then
    perform net.http_post(
      url := 'https://oexgjmuvgdndizsufipe.supabase.co/functions/v1/generate-contract-information-pack',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('quote_id', new.quote_id)
    );
  end if;

  return new;
end;
$$;

create or replace function public.journey2_link_generated_contract_information_pack()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _cs_id uuid;
begin
  if new.contract_summary_id is not null then
    return new;
  end if;

  select cs.id into _cs_id
  from public.contract_summaries cs
  join public.quotes q on q.id = cs.quote_id
  where cs.quote_id = new.quote_id
    and q.journey_version = 'v2'
    and cs.status <> 'superseded'::public.contract_summary_status_kind
  order by cs.version desc, cs.created_at desc
  limit 1;

  if _cs_id is not null then
    new.contract_summary_id := _cs_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_journey2_prepare_two_doc_quote_from_cs
  on public.contract_summaries;
create trigger trg_journey2_prepare_two_doc_quote_from_cs
after insert or update of etf_policy_snapshot, minimum_term_months, notice_period_days
on public.contract_summaries
for each row
execute function public.journey2_prepare_two_doc_quote_from_cs();

drop trigger if exists trg_journey2_link_generated_contract_information_pack
  on public.contract_information_packs;
create trigger trg_journey2_link_generated_contract_information_pack
before insert on public.contract_information_packs
for each row
execute function public.journey2_link_generated_contract_information_pack();

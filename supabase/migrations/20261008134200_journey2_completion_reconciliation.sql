-- Journey 2 completion reconciliation
-- Ensures the operational Journey 2 session cannot remain on review/error
-- after the canonical order journey has already completed.
-- Does not alter accepted contract evidence.

create or replace function public.sync_completed_order_journey_to_journey2_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_order_id uuid;
  v_customer_id uuid;
  v_acceptance_id uuid;
  v_payment_method_id uuid;
begin
  if new.status::text <> 'completed'
     or new.current_step <> 'complete'
     or new.order_id is null then
    return new;
  end if;

  select o.guest_order_id, o.customer_id
    into v_guest_order_id, v_customer_id
    from public.orders o
   where o.id = new.order_id;

  select ca.id
    into v_acceptance_id
    from public.contract_acceptances ca
   where ca.contract_summary_id = new.contract_summary_id
   order by ca.accepted_at asc
   limit 1;

  select pm.id
    into v_payment_method_id
    from public.payment_methods pm
   where pm.journey_id = new.id
     and pm.active = true
   order by pm.created_at desc
   limit 1;

  update public.customer_journey_sessions s
     set status = 'completed',
         current_step = 'complete',
         last_completed_step = 'review',
         completed_at = coalesce(s.completed_at, new.completed_at, now()),
         submitted_at = coalesce(s.submitted_at, new.submitted_at, now()),
         last_activity_at = now(),
         order_id = new.order_id,
         guest_order_id = coalesce(s.guest_order_id, v_guest_order_id),
         customer_id = coalesce(s.customer_id, v_customer_id, new.customer_id),
         contract_summary_id = coalesce(s.contract_summary_id, new.contract_summary_id),
         contract_acceptance_id = coalesce(s.contract_acceptance_id, new.contract_acceptance_id, v_acceptance_id),
         payment_method_id = coalesce(s.payment_method_id, v_payment_method_id),
         last_error = null,
         updated_at = now()
   where s.order_journey_id = new.id
     and s.status not in ('cancelled','expired');

  return new;
end;
$$;

drop trigger if exists trg_sync_completed_journey2_session on public.order_journeys;

create trigger trg_sync_completed_journey2_session
after insert or update of status, current_step, order_id, completed_at, submitted_at
on public.order_journeys
for each row
execute function public.sync_completed_order_journey_to_journey2_session();

-- Forward-only operational reconciliation.
-- Never resurrect cancelled/expired sessions and never modifies contract evidence.
update public.order_journeys j
   set status = j.status
  from public.customer_journey_sessions s
 where s.order_journey_id = j.id
   and j.status = 'completed'
   and j.current_step = 'complete'
   and j.order_id is not null
   and s.status not in ('cancelled','expired')
   and (
     s.status <> 'completed'
     or s.current_step <> 'complete'
     or s.order_id is distinct from j.order_id
   );

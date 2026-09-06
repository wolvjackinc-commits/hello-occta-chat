-- Fresh-schema reconciliation from read-only Lovable Cloud pg_catalog inspection
-- on 2026-09-06. These definitions exist live but were absent from Git/history.
-- This new replay version precedes the existing August permission revocations;
-- it is not an original applied migration version. Do not replay it on production.
BEGIN;
SET LOCAL search_path = public, extensions;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS source_analytics_id uuid;

CREATE OR REPLACE FUNCTION public.block_new_worldpay_receipts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.method is not null and lower(new.method) like 'worldpay%' then
    raise exception 'worldpay_retired';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.block_retired_card_payment_requests()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op='INSERT' and new.type='card_payment' then
    raise exception 'card_payments_disabled_worldpay_retired';
  end if;

  if tg_op='UPDATE' and old.type='card_payment' then
    if new.type is distinct from old.type
       or new.status is distinct from old.status
       or new.amount is distinct from old.amount
       or new.invoice_id is distinct from old.invoice_id
       or new.user_id is distinct from old.user_id
       or new.provider is distinct from old.provider
       or new.provider_reference is distinct from old.provider_reference
       or new.provider_checkout_url is distinct from old.provider_checkout_url
       or new.provider_session_id is distinct from old.provider_session_id
       or new.provider_payment_id is distinct from old.provider_payment_id
       or new.paid_at is distinct from old.paid_at
       or new.failed_at is distinct from old.failed_at
       or new.webhook_verified is distinct from old.webhook_verified then
      raise exception 'card_payment_history_is_read_only_worldpay_retired';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.chat_handoff_reason(p_text text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare
  v text := lower(regexp_replace(coalesce(p_text, ''), '[[:space:]]+', ' ', 'g'));
begin
  if v = '' then return null; end if;

  if v ~ '(speak|talk|chat|connect|transfer|pass|put)[[:space:]]+(me[[:space:]]+)?(to|with)[[:space:]]+(a[[:space:]]+)?(human|person|advisor|agent|representative|someone)'
     or v ~ '(human|live)[[:space:]]+(support|advisor|agent|chat)'
     or v ~ 'real[[:space:]]+person'
     or v ~ 'call[[:space:]]+me'
     or v ~ 'someone[[:space:]]+(from|at)[[:space:]]+occta'
  then
    return 'requested_human';
  end if;

  if v ~ '(send|email|share|provide|give|need|want|request|download|see|view|get)[^.!?]{0,80}(my[[:space:]]+)?(agreement|contract summary|signed contract|signed agreement|service agreement|terms and conditions|contract copy)'
     or v ~ '(copy|pdf)[^.!?]{0,40}(agreement|contract|terms)'
     or v ~ '(my|the)[[:space:]]+(signed[[:space:]]+)?(agreement|contract|contract summary)'
  then
    return 'agreement_or_contract_request';
  end if;

  if v ~ '(raise|open|create|start|submit)[^.!?]{0,30}(support[[:space:]]+)?(ticket|case)'
  then
    return 'support_ticket_requested';
  end if;

  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.dedupe_chat_message_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.source_analytics_id is null
     and new.role in ('user','assistant')
     and nullif(btrim(coalesce(new.content,'')), '') is not null
     and exists (
       select 1
       from public.chat_messages m
       where m.conversation_id = new.conversation_id
         and m.role = new.role
         and m.content = new.content
         and m.created_at between coalesce(new.created_at, now()) - interval '15 seconds'
                              and coalesce(new.created_at, now()) + interval '15 seconds'
     )
  then
    return null;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mirror_chat_analytics_to_live_chat()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_conv_id uuid;
  v_name text;
  v_email text;
  v_reason text;
begin
  if nullif(btrim(new.session_id), '') is null then
    return new;
  end if;

  if new.user_id is not null then
    select p.full_name, p.email
      into v_name, v_email
    from public.profiles p
    where p.id = new.user_id;
  end if;

  insert into public.chat_conversations(
    session_id, user_id, customer_name, customer_email,
    status, summary, last_message_at, created_at, updated_at
  ) values (
    new.session_id,
    new.user_id,
    v_name,
    v_email,
    'ai',
    case when new.message_type = 'user' then left(new.message_content, 2000) else 'Bot conversation' end,
    new.created_at,
    new.created_at,
    now()
  )
  on conflict (session_id) do update set
    user_id = coalesce(public.chat_conversations.user_id, excluded.user_id),
    customer_name = coalesce(public.chat_conversations.customer_name, excluded.customer_name),
    customer_email = coalesce(public.chat_conversations.customer_email, excluded.customer_email),
    last_message_at = greatest(public.chat_conversations.last_message_at, excluded.last_message_at),
    updated_at = now()
  returning id into v_conv_id;

  if not exists (
    select 1 from public.chat_messages where source_analytics_id = new.id
  ) then
    insert into public.chat_messages(
      conversation_id, role, content, attachments, created_at, source_analytics_id
    ) values (
      v_conv_id,
      case when new.message_type = 'user' then 'user' else 'assistant' end,
      new.message_content,
      '[]'::jsonb,
      new.created_at,
      new.id
    );
  end if;

  if new.message_type = 'user' then
    v_reason := public.chat_handoff_reason(new.message_content);

    update public.chat_conversations
       set summary = left(new.message_content, 2000),
           last_message_at = greatest(last_message_at, new.created_at),
           status = case
             when v_reason is not null and status <> 'live' then 'awaiting_human'
             else status
           end,
           handoff_reason = case
             when v_reason is not null then v_reason
             else handoff_reason
           end,
           updated_at = now()
     where id = v_conv_id;
  end if;

  return new;
end;
$function$;

CREATE TRIGGER trg_block_retired_card_payment_requests BEFORE INSERT OR UPDATE ON public.payment_requests FOR EACH ROW EXECUTE FUNCTION block_retired_card_payment_requests();
CREATE TRIGGER trg_block_new_worldpay_receipts BEFORE INSERT ON public.receipts FOR EACH ROW EXECUTE FUNCTION block_new_worldpay_receipts();
CREATE TRIGGER trg_dedupe_chat_message_insert BEFORE INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION dedupe_chat_message_insert();
CREATE TRIGGER trg_mirror_chat_analytics_to_live_chat AFTER INSERT ON public.chat_analytics FOR EACH ROW EXECUTE FUNCTION mirror_chat_analytics_to_live_chat();
CREATE UNIQUE INDEX chat_messages_source_analytics_uidx ON public.chat_messages USING btree (source_analytics_id) WHERE (source_analytics_id IS NOT NULL);
COMMIT;

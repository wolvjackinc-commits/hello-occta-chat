delete from public.chat_conversations where session_id like 'smoke-log-test%';
do $$
begin
  begin
    alter publication supabase_realtime add table public.chat_conversations;
  exception when duplicate_object then null;
  end;
end $$;
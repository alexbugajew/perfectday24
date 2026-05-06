begin;

alter table public.user_plan_group_chat_messages
  add column if not exists message_type text not null default 'user';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_plan_group_chat_messages_message_type_check'
  ) then
    alter table public.user_plan_group_chat_messages
      add constraint user_plan_group_chat_messages_message_type_check
      check (message_type in ('user', 'system'));
  end if;
end $$;

commit;

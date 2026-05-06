alter table public.user_plan_group_chat_members
add column if not exists last_read_at timestamptz not null default now();

create or replace function public.group_chat_unread_overview(p_user_id uuid default auth.uid())
returns table (
  chat_id uuid,
  unread_count bigint,
  last_message_at timestamptz,
  last_message_preview text,
  last_message_type text,
  last_sender_user_id uuid
)
language sql
security definer
set search_path = public
as $$
  with membership as (
    select
      m.chat_id,
      m.last_read_at
    from public.user_plan_group_chat_members m
    where m.member_user_id = p_user_id
  )
  select
    membership.chat_id,
    coalesce(unread.unread_count, 0) as unread_count,
    latest.created_at as last_message_at,
    latest.body as last_message_preview,
    latest.message_type as last_message_type,
    latest.sender_user_id as last_sender_user_id
  from membership
  left join lateral (
    select
      msg.created_at,
      msg.body,
      msg.message_type,
      msg.sender_user_id
    from public.user_plan_group_chat_messages msg
    where msg.chat_id = membership.chat_id
    order by msg.created_at desc
    limit 1
  ) latest on true
  left join lateral (
    select count(*) as unread_count
    from public.user_plan_group_chat_messages msg
    where msg.chat_id = membership.chat_id
      and msg.created_at > membership.last_read_at
      and coalesce(msg.sender_user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> p_user_id
  ) unread on true;
$$;

revoke all on function public.group_chat_unread_overview(uuid) from public;
grant execute on function public.group_chat_unread_overview(uuid) to authenticated;

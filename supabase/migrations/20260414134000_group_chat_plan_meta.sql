begin;

create or replace function public.group_chat_plan_meta(p_chat_id uuid)
returns table (
  plan_id uuid,
  title text,
  share_token text,
  final_group_status_label text,
  pinned_variant_label text
)
language sql
security definer
set search_path = public
as $pd24$
  select
    p.id as plan_id,
    p.title,
    p.share_token,
    p.filters ->> 'finalGroupStatusLabel' as final_group_status_label,
    p.filters ->> 'pinnedVariantLabel' as pinned_variant_label
  from public.user_plan_group_chats c
  join public.plans p
    on p.id = c.plan_id
  where c.id = p_chat_id
    and exists (
      select 1
      from public.user_plan_group_chat_members m
      where m.chat_id = c.id
        and m.member_user_id = auth.uid()
    )
  limit 1;
$pd24$;

revoke all on function public.group_chat_plan_meta(uuid) from public;
grant execute on function public.group_chat_plan_meta(uuid) to authenticated;

commit;

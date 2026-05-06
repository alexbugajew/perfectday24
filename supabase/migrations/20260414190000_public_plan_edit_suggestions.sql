create table if not exists public.user_public_plan_edit_suggestions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  author_label text not null,
  message text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid references auth.users(id) on delete set null
);

create index if not exists user_public_plan_edit_suggestions_plan_idx
  on public.user_public_plan_edit_suggestions (plan_id, created_at desc);

alter table public.user_public_plan_edit_suggestions enable row level security;

drop policy if exists user_public_plan_edit_suggestions_owner_select on public.user_public_plan_edit_suggestions;
create policy user_public_plan_edit_suggestions_owner_select
on public.user_public_plan_edit_suggestions
for select
to authenticated
using (
  exists (
    select 1
    from public.plans p
    where p.id = user_public_plan_edit_suggestions.plan_id
      and p.user_id = auth.uid()
  )
);

create or replace function public.public_plan_edit_suggestions_by_token(p_token text)
returns table (
  id uuid,
  author_label text,
  message text,
  created_at timestamptz,
  resolved_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.author_label,
    s.message,
    s.created_at,
    s.resolved_at
  from public.user_public_plan_edit_suggestions s
  join public.plans p
    on p.id = s.plan_id
  where p.share_token = p_token
  order by s.created_at desc;
$$;

revoke all on function public.public_plan_edit_suggestions_by_token(text) from public;
grant execute on function public.public_plan_edit_suggestions_by_token(text) to anon, authenticated;

create or replace function public.create_public_plan_edit_suggestion(
  p_token text,
  p_author_label text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_chat_id uuid;
  v_suggestion_id uuid;
  v_author text := nullif(trim(coalesce(p_author_label, '')), '');
  v_message text := nullif(trim(coalesce(p_message, '')), '');
begin
  if v_author is null then
    raise exception 'author_label_required';
  end if;

  if v_message is null then
    raise exception 'message_required';
  end if;

  select id
  into v_plan_id
  from public.plans
  where share_token = p_token
  limit 1;

  if v_plan_id is null then
    raise exception 'plan_not_found';
  end if;

  insert into public.user_public_plan_edit_suggestions (
    plan_id,
    author_label,
    message
  )
  values (
    v_plan_id,
    v_author,
    v_message
  )
  returning id into v_suggestion_id;

  select c.id
  into v_chat_id
  from public.user_plan_group_chats c
  where c.plan_id = v_plan_id
  limit 1;

  if v_chat_id is not null then
    insert into public.user_plan_group_chat_messages (
      chat_id,
      sender_user_id,
      message_type,
      body
    )
    values (
      v_chat_id,
      null,
      'system',
      v_author || ' hat einen Aenderungswunsch geteilt: ' || v_message
    );

    update public.user_plan_group_chats
    set
      last_message_at = now(),
      updated_at = now()
    where id = v_chat_id;
  end if;

  return v_suggestion_id;
end;
$$;

revoke all on function public.create_public_plan_edit_suggestion(text, text, text) from public;
grant execute on function public.create_public_plan_edit_suggestion(text, text, text) to anon, authenticated;

create or replace function public.plan_edit_suggestions_for_owner(p_plan_id uuid)
returns table (
  id uuid,
  author_label text,
  message text,
  created_at timestamptz,
  resolved_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.author_label,
    s.message,
    s.created_at,
    s.resolved_at
  from public.user_public_plan_edit_suggestions s
  join public.plans p
    on p.id = s.plan_id
  where s.plan_id = p_plan_id
    and p.user_id = auth.uid()
  order by s.created_at desc;
$$;

revoke all on function public.plan_edit_suggestions_for_owner(uuid) from public;
grant execute on function public.plan_edit_suggestions_for_owner(uuid) to authenticated;

create or replace function public.resolve_plan_edit_suggestion(p_suggestion_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_author text;
  v_message text;
  v_chat_id uuid;
begin
  select s.plan_id, s.author_label, s.message
  into v_plan_id, v_author, v_message
  from public.user_public_plan_edit_suggestions s
  join public.plans p
    on p.id = s.plan_id
  where s.id = p_suggestion_id
    and p.user_id = auth.uid()
    and s.resolved_at is null
  limit 1;

  if v_plan_id is null then
    return false;
  end if;

  update public.user_public_plan_edit_suggestions
  set
    resolved_at = now(),
    resolved_by_user_id = auth.uid()
  where id = p_suggestion_id
    and resolved_at is null;

  select c.id
  into v_chat_id
  from public.user_plan_group_chats c
  where c.plan_id = v_plan_id
  limit 1;

  if v_chat_id is not null then
    insert into public.user_plan_group_chat_messages (
      chat_id,
      sender_user_id,
      message_type,
      body
    )
    values (
      v_chat_id,
      auth.uid(),
      'system',
      'Aenderungswunsch von ' || coalesce(v_author, 'der Gruppe') || ' wurde aufgenommen: ' || coalesce(v_message, '')
    );

    update public.user_plan_group_chats
    set
      last_message_at = now(),
      updated_at = now()
    where id = v_chat_id;
  end if;

  return true;
end;
$$;

revoke all on function public.resolve_plan_edit_suggestion(uuid) from public;
grant execute on function public.resolve_plan_edit_suggestion(uuid) to authenticated;

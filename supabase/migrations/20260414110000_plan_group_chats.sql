begin;

create table if not exists public.user_plan_group_chats (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create unique index if not exists user_plan_group_chats_plan_key
  on public.user_plan_group_chats (plan_id);

create table if not exists public.user_plan_group_chat_members (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.user_plan_group_chats(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists user_plan_group_chat_members_key
  on public.user_plan_group_chat_members (chat_id, member_user_id);

create table if not exists public.user_plan_group_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.user_plan_group_chats(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

drop trigger if exists user_plan_group_chats_set_updated_at on public.user_plan_group_chats;
create trigger user_plan_group_chats_set_updated_at
before update on public.user_plan_group_chats
for each row
execute function public.pd24_set_updated_at();

alter table public.user_plan_group_chats enable row level security;
alter table public.user_plan_group_chat_members enable row level security;
alter table public.user_plan_group_chat_messages enable row level security;

drop policy if exists user_plan_group_chats_select_member on public.user_plan_group_chats;
create policy user_plan_group_chats_select_member
on public.user_plan_group_chats
for select
to authenticated
using (
  exists (
    select 1
    from public.user_plan_group_chat_members m
    where m.chat_id = id
      and m.member_user_id = auth.uid()
  )
);

drop policy if exists user_plan_group_chats_insert_owner on public.user_plan_group_chats;
create policy user_plan_group_chats_insert_owner
on public.user_plan_group_chats
for insert
to authenticated
with check (auth.uid() = owner_user_id);

drop policy if exists user_plan_group_chats_update_member on public.user_plan_group_chats;
create policy user_plan_group_chats_update_member
on public.user_plan_group_chats
for update
to authenticated
using (
  exists (
    select 1
    from public.user_plan_group_chat_members m
    where m.chat_id = id
      and m.member_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.user_plan_group_chat_members m
    where m.chat_id = id
      and m.member_user_id = auth.uid()
  )
);

drop policy if exists user_plan_group_chat_members_select_member on public.user_plan_group_chat_members;
create policy user_plan_group_chat_members_select_member
on public.user_plan_group_chat_members
for select
to authenticated
using (
  exists (
    select 1
    from public.user_plan_group_chat_members self
    where self.chat_id = chat_id
      and self.member_user_id = auth.uid()
  )
);

drop policy if exists user_plan_group_chat_members_insert_owner on public.user_plan_group_chat_members;
create policy user_plan_group_chat_members_insert_owner
on public.user_plan_group_chat_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_plan_group_chats c
    where c.id = chat_id
      and c.owner_user_id = auth.uid()
  )
);

drop policy if exists user_plan_group_chat_members_delete_owner on public.user_plan_group_chat_members;
create policy user_plan_group_chat_members_delete_owner
on public.user_plan_group_chat_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_plan_group_chats c
    where c.id = chat_id
      and c.owner_user_id = auth.uid()
  )
);

drop policy if exists user_plan_group_chat_messages_select_member on public.user_plan_group_chat_messages;
create policy user_plan_group_chat_messages_select_member
on public.user_plan_group_chat_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.user_plan_group_chat_members m
    where m.chat_id = chat_id
      and m.member_user_id = auth.uid()
  )
);

drop policy if exists user_plan_group_chat_messages_insert_member on public.user_plan_group_chat_messages;
create policy user_plan_group_chat_messages_insert_member
on public.user_plan_group_chat_messages
for insert
to authenticated
with check (
  auth.uid() = sender_user_id
  and exists (
    select 1
    from public.user_plan_group_chat_members m
    where m.chat_id = chat_id
      and m.member_user_id = auth.uid()
  )
);

commit;

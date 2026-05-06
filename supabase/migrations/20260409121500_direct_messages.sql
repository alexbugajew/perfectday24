create table if not exists public.user_direct_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references auth.users(id) on delete cascade,
  user_b_id uuid not null references auth.users(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  smaller_user_id uuid generated always as (least(user_a_id, user_b_id)) stored,
  larger_user_id uuid generated always as (greatest(user_a_id, user_b_id)) stored,
  constraint user_direct_conversations_not_same check (user_a_id <> user_b_id)
);

create unique index if not exists user_direct_conversations_pair_key
  on public.user_direct_conversations (smaller_user_id, larger_user_id);

create table if not exists public.user_direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.user_direct_conversations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.user_direct_conversations enable row level security;
alter table public.user_direct_messages enable row level security;

drop policy if exists user_direct_conversations_select_member on public.user_direct_conversations;
create policy user_direct_conversations_select_member
on public.user_direct_conversations
for select
to authenticated
using (auth.uid() = user_a_id or auth.uid() = user_b_id);

drop policy if exists user_direct_conversations_insert_member on public.user_direct_conversations;
create policy user_direct_conversations_insert_member
on public.user_direct_conversations
for insert
to authenticated
with check (
  auth.uid() = created_by_user_id
  and (auth.uid() = user_a_id or auth.uid() = user_b_id)
);

drop policy if exists user_direct_conversations_update_member on public.user_direct_conversations;
create policy user_direct_conversations_update_member
on public.user_direct_conversations
for update
to authenticated
using (auth.uid() = user_a_id or auth.uid() = user_b_id)
with check (auth.uid() = user_a_id or auth.uid() = user_b_id);

drop policy if exists user_direct_messages_select_member on public.user_direct_messages;
create policy user_direct_messages_select_member
on public.user_direct_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.user_direct_conversations c
    where c.id = conversation_id
      and (auth.uid() = c.user_a_id or auth.uid() = c.user_b_id)
  )
);

drop policy if exists user_direct_messages_insert_sender on public.user_direct_messages;
create policy user_direct_messages_insert_sender
on public.user_direct_messages
for insert
to authenticated
with check (
  auth.uid() = sender_user_id
  and exists (
    select 1
    from public.user_direct_conversations c
    where c.id = conversation_id
      and (auth.uid() = c.user_a_id or auth.uid() = c.user_b_id)
  )
);

create table if not exists public.user_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  addressee_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  smaller_user_id uuid generated always as (least(requester_user_id, addressee_user_id)) stored,
  larger_user_id uuid generated always as (greatest(requester_user_id, addressee_user_id)) stored,
  constraint user_friendships_not_same check (requester_user_id <> addressee_user_id)
);

create unique index if not exists user_friendships_pair_key
  on public.user_friendships (smaller_user_id, larger_user_id);

alter table public.user_friendships enable row level security;

drop policy if exists user_friendships_select_own on public.user_friendships;
create policy user_friendships_select_own
on public.user_friendships
for select
to authenticated
using (auth.uid() = requester_user_id or auth.uid() = addressee_user_id);

drop policy if exists user_friendships_insert_own on public.user_friendships;
create policy user_friendships_insert_own
on public.user_friendships
for insert
to authenticated
with check (auth.uid() = requester_user_id or auth.uid() = addressee_user_id);

drop policy if exists user_friendships_delete_own on public.user_friendships;
create policy user_friendships_delete_own
on public.user_friendships
for delete
to authenticated
using (auth.uid() = requester_user_id or auth.uid() = addressee_user_id);

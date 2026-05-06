create table if not exists public.user_groups (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.user_groups(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists user_group_members_group_member_key
  on public.user_group_members (group_id, member_user_id);

alter table public.user_groups enable row level security;
alter table public.user_group_members enable row level security;

drop policy if exists user_groups_select_own on public.user_groups;
create policy user_groups_select_own
on public.user_groups
for select
to authenticated
using (auth.uid() = owner_user_id);

drop policy if exists user_groups_insert_own on public.user_groups;
create policy user_groups_insert_own
on public.user_groups
for insert
to authenticated
with check (auth.uid() = owner_user_id);

drop policy if exists user_groups_update_own on public.user_groups;
create policy user_groups_update_own
on public.user_groups
for update
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

drop policy if exists user_groups_delete_own on public.user_groups;
create policy user_groups_delete_own
on public.user_groups
for delete
to authenticated
using (auth.uid() = owner_user_id);

drop policy if exists user_group_members_select_own_groups on public.user_group_members;
create policy user_group_members_select_own_groups
on public.user_group_members
for select
to authenticated
using (
  exists (
    select 1
    from public.user_groups g
    where g.id = group_id
      and g.owner_user_id = auth.uid()
  )
);

drop policy if exists user_group_members_insert_own_groups on public.user_group_members;
create policy user_group_members_insert_own_groups
on public.user_group_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_groups g
    where g.id = group_id
      and g.owner_user_id = auth.uid()
  )
);

drop policy if exists user_group_members_delete_own_groups on public.user_group_members;
create policy user_group_members_delete_own_groups
on public.user_group_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_groups g
    where g.id = group_id
      and g.owner_user_id = auth.uid()
  )
);

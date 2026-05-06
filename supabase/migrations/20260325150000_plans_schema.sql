begin;

create extension if not exists pgcrypto;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  filters jsonb not null default '{}'::jsonb,
  radius_km double precision not null default 10,
  effective_radius_km double precision,
  sort_mode text not null default 'match',
  active_level text,
  slots jsonb not null default '[]'::jsonb,
  share_token text unique,
  ai_description text,
  updated_at timestamptz not null default now(),
  constraint plans_sort_mode_check check (sort_mode in ('match', 'distance'))
);

create index if not exists plans_user_id_created_at_idx
  on public.plans (user_id, created_at desc);

create index if not exists plans_share_token_idx
  on public.plans (share_token)
  where share_token is not null;

create or replace function public.pd24_set_updated_at()
returns trigger
language plpgsql
as $pd24$
begin
  new.updated_at = now();
  return new;
end;
$pd24$;

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
before update on public.plans
for each row
execute function public.pd24_set_updated_at();

alter table public.plans enable row level security;

drop policy if exists "plans_select_own" on public.plans;
create policy "plans_select_own"
on public.plans
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "plans_insert_own" on public.plans;
create policy "plans_insert_own"
on public.plans
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "plans_update_own" on public.plans;
create policy "plans_update_own"
on public.plans
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "plans_delete_own" on public.plans;
create policy "plans_delete_own"
on public.plans
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.public_plan_by_token(p_token text)
returns table (
  id uuid,
  title text,
  created_at timestamptz,
  filters jsonb,
  radius_km double precision,
  effective_radius_km double precision,
  sort_mode text,
  active_level text,
  slots jsonb,
  share_token text,
  ai_description text
)
language sql
security definer
set search_path = public
as $pd24$
  select
    p.id,
    p.title,
    p.created_at,
    p.filters,
    p.radius_km,
    p.effective_radius_km,
    p.sort_mode,
    p.active_level,
    p.slots,
    p.share_token,
    p.ai_description
  from public.plans p
  where p.share_token = p_token
  limit 1;
$pd24$;

revoke all on function public.public_plan_by_token(text) from public;
grant execute on function public.public_plan_by_token(text) to anon, authenticated;

commit;

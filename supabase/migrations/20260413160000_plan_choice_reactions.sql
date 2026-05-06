begin;

create table if not exists public.plan_choice_reactions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  voter_label text not null,
  voter_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_choice_reactions_unique_voter unique (plan_id, voter_key)
);

create index if not exists plan_choice_reactions_plan_idx
  on public.plan_choice_reactions (plan_id, created_at asc);

drop trigger if exists plan_choice_reactions_set_updated_at on public.plan_choice_reactions;
create trigger plan_choice_reactions_set_updated_at
before update on public.plan_choice_reactions
for each row
execute function public.pd24_set_updated_at();

alter table public.plan_choice_reactions enable row level security;

create or replace function public.public_plan_choice_reactions_by_token(p_token text)
returns table (
  voter_label text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $pd24$
  select
    r.voter_label,
    r.created_at
  from public.plan_choice_reactions r
  join public.plans p
    on p.id = r.plan_id
  where p.share_token = p_token
  order by r.created_at asc;
$pd24$;

revoke all on function public.public_plan_choice_reactions_by_token(text) from public;
grant execute on function public.public_plan_choice_reactions_by_token(text) to anon, authenticated;

create or replace function public.toggle_public_plan_choice_reaction(
  p_token text,
  p_voter_label text
)
returns table (
  confirmed boolean,
  total_count integer
)
language plpgsql
security definer
set search_path = public
as $pd24$
declare
  v_plan_id uuid;
  v_voter_label text;
  v_voter_key text;
  v_existing boolean;
begin
  select id
    into v_plan_id
  from public.plans
  where share_token = p_token
  limit 1;

  if v_plan_id is null then
    raise exception 'Plan mit Share-Token nicht gefunden';
  end if;

  v_voter_label := btrim(coalesce(p_voter_label, ''));
  v_voter_key := lower(v_voter_label);

  if v_voter_key = '' then
    raise exception 'Name fehlt';
  end if;

  select exists(
    select 1
    from public.plan_choice_reactions
    where plan_id = v_plan_id
      and voter_key = v_voter_key
  )
    into v_existing;

  if v_existing then
    delete from public.plan_choice_reactions
    where plan_id = v_plan_id
      and voter_key = v_voter_key;

    return query
    select false, count(*)::integer
    from public.plan_choice_reactions
    where plan_id = v_plan_id;
  end if;

  insert into public.plan_choice_reactions (
    plan_id,
    voter_label,
    voter_key
  ) values (
    v_plan_id,
    v_voter_label,
    v_voter_key
  );

  return query
  select true, count(*)::integer
  from public.plan_choice_reactions
  where plan_id = v_plan_id;
end;
$pd24$;

revoke all on function public.toggle_public_plan_choice_reaction(text, text) from public;
grant execute on function public.toggle_public_plan_choice_reaction(text, text) to anon, authenticated;

commit;

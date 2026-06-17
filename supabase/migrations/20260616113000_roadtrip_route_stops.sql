begin;

create extension if not exists pgcrypto;

create table if not exists public.roadtrip_route_stops (
  id uuid primary key default gen_random_uuid(),
  roadtrip_route_id uuid not null references public.roadtrip_routes (id) on delete cascade,
  stop_order integer not null,
  city_slug text null references public.cities (slug) on delete set null,
  city_label text not null,
  lat double precision null,
  lng double precision null,
  nights integer not null default 1,
  creator_route_id uuid null references public.user_routes (id) on delete set null,
  creator_route_slug text null,
  creator_route_title text null,
  plan_summary text null,
  planned_stops jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roadtrip_route_stops_order_positive check (stop_order > 0),
  constraint roadtrip_route_stops_nights_positive check (nights > 0),
  constraint roadtrip_route_stops_route_order_unique unique (roadtrip_route_id, stop_order)
);

drop trigger if exists roadtrip_route_stops_set_updated_at on public.roadtrip_route_stops;
create trigger roadtrip_route_stops_set_updated_at
before update on public.roadtrip_route_stops
for each row
execute function public.pd24_set_updated_at();

create index if not exists roadtrip_route_stops_route_order_idx
  on public.roadtrip_route_stops (roadtrip_route_id, stop_order);

create index if not exists roadtrip_route_stops_city_idx
  on public.roadtrip_route_stops (city_slug, stop_order);

create index if not exists roadtrip_route_stops_creator_route_idx
  on public.roadtrip_route_stops (creator_route_id)
  where creator_route_id is not null;

alter table public.roadtrip_route_stops enable row level security;

drop policy if exists "roadtrip_route_stops_select_public_or_own" on public.roadtrip_route_stops;
create policy "roadtrip_route_stops_select_public_or_own"
  on public.roadtrip_route_stops for select to anon, authenticated
  using (
    exists (
      select 1
      from public.roadtrip_routes rr
      where rr.id = roadtrip_route_id
        and (
          rr.visibility in ('public', 'link_only')
          or rr.author_user_id = auth.uid()
        )
    )
  );

drop policy if exists "roadtrip_route_stops_insert_own" on public.roadtrip_route_stops;
create policy "roadtrip_route_stops_insert_own"
  on public.roadtrip_route_stops for insert to authenticated
  with check (
    exists (
      select 1
      from public.roadtrip_routes rr
      where rr.id = roadtrip_route_id
        and rr.author_user_id = auth.uid()
    )
  );

drop policy if exists "roadtrip_route_stops_update_own" on public.roadtrip_route_stops;
create policy "roadtrip_route_stops_update_own"
  on public.roadtrip_route_stops for update to authenticated
  using (
    exists (
      select 1
      from public.roadtrip_routes rr
      where rr.id = roadtrip_route_id
        and rr.author_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.roadtrip_routes rr
      where rr.id = roadtrip_route_id
        and rr.author_user_id = auth.uid()
    )
  );

drop policy if exists "roadtrip_route_stops_delete_own" on public.roadtrip_route_stops;
create policy "roadtrip_route_stops_delete_own"
  on public.roadtrip_route_stops for delete to authenticated
  using (
    exists (
      select 1
      from public.roadtrip_routes rr
      where rr.id = roadtrip_route_id
        and rr.author_user_id = auth.uid()
    )
  );

create or replace function public.pd24_sync_roadtrip_route_stops_from_json(target_route_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $pd24$
declare
  route_row public.roadtrip_routes%rowtype;
begin
  select *
  into route_row
  from public.roadtrip_routes
  where id = target_route_id;

  if not found then
    return;
  end if;

  delete from public.roadtrip_route_stops
  where roadtrip_route_id = route_row.id;

  insert into public.roadtrip_route_stops (
    roadtrip_route_id,
    stop_order,
    city_slug,
    city_label,
    lat,
    lng,
    nights,
    creator_route_id,
    creator_route_slug,
    creator_route_title,
    plan_summary,
    planned_stops,
    meta
  )
  select
    route_row.id as roadtrip_route_id,
    item.ordinality::integer as stop_order,
    case
      when exists (
        select 1
        from public.cities c
        where c.slug = nullif(item.stop ->> 'citySlug', '')
      )
        then nullif(item.stop ->> 'citySlug', '')
      else null
    end as city_slug,
    coalesce(nullif(item.stop ->> 'cityLabel', ''), 'Stop ' || item.ordinality::text) as city_label,
    nullif(item.stop ->> 'lat', '')::double precision as lat,
    nullif(item.stop ->> 'lng', '')::double precision as lng,
    coalesce(nullif(item.stop ->> 'nights', '')::integer, 1) as nights,
    case
      when coalesce(item.stop ->> 'creatorRouteId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and exists (
          select 1
          from public.user_routes ur
          where ur.id = (item.stop ->> 'creatorRouteId')::uuid
        )
        then (item.stop ->> 'creatorRouteId')::uuid
      else null
    end as creator_route_id,
    nullif(item.stop ->> 'creatorRouteSlug', '') as creator_route_slug,
    nullif(item.stop ->> 'creatorRouteTitle', '') as creator_route_title,
    nullif(item.stop ->> 'planSummary', '') as plan_summary,
    case
      when jsonb_typeof(item.stop -> 'plannedStops') = 'array' then item.stop -> 'plannedStops'
      else '[]'::jsonb
    end as planned_stops,
    item.stop - 'citySlug' - 'cityLabel' - 'lat' - 'lng' - 'nights'
      - 'creatorRouteId' - 'creatorRouteSlug' - 'creatorRouteTitle'
      - 'planSummary' - 'plannedStops' as meta
  from jsonb_array_elements(route_row.stops) with ordinality as item(stop, ordinality);
end;
$pd24$;

revoke all on function public.pd24_sync_roadtrip_route_stops_from_json(uuid) from public;

create or replace function public.pd24_sync_roadtrip_route_stops_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $pd24$
begin
  perform public.pd24_sync_roadtrip_route_stops_from_json(new.id);
  return new;
end;
$pd24$;

revoke all on function public.pd24_sync_roadtrip_route_stops_trigger() from public;

drop trigger if exists roadtrip_routes_sync_stops_json on public.roadtrip_routes;
create trigger roadtrip_routes_sync_stops_json
after insert or update of stops on public.roadtrip_routes
for each row
execute function public.pd24_sync_roadtrip_route_stops_trigger();

select public.pd24_sync_roadtrip_route_stops_from_json(rr.id)
from public.roadtrip_routes rr;

commit;

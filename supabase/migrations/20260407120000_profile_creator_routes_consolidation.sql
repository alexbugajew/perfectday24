begin;

create extension if not exists pgcrypto;

create or replace function public.pd24_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

update public.creator_profiles
set username = lower(
  regexp_replace(
    coalesce(nullif(username, ''), nullif(display_name, ''), 'user-' || left(replace(user_id::text, '-', ''), 8)),
    '[^a-zA-Z0-9._-]+',
    '-',
    'g'
  )
)
where username is null or btrim(username) = '';

with normalized as (
  select
    id,
    case
      when row_number() over (partition by username order by created_at, id) = 1 then username
      else username || '-' || row_number() over (partition by username order by created_at, id)
    end as unique_username
  from public.creator_profiles
)
update public.creator_profiles cp
set username = normalized.unique_username
from normalized
where cp.id = normalized.id
  and cp.username is distinct from normalized.unique_username;

update public.creator_profiles
set display_name = coalesce(nullif(display_name, ''), nullif(username, ''), 'User ' || left(replace(user_id::text, '-', ''), 6))
where display_name is null or btrim(display_name) = '';

alter table public.creator_profiles
  alter column username set not null,
  alter column display_name set not null,
  alter column creator_type set default 'user',
  alter column route_count set default 0,
  alter column follower_count set default 0,
  alter column following_count set default 0,
  alter column total_likes_received set default 0,
  alter column total_bookmarks_received set default 0;

create or replace function public.refresh_creator_profile_route_count(target_creator_profile_id uuid)
returns void
language plpgsql
as $$
begin
  if target_creator_profile_id is null then
    return;
  end if;

  update public.creator_profiles cp
  set
    route_count = coalesce((
      select count(*)
      from public.user_routes ur
      where ur.creator_profile_id = target_creator_profile_id
    ), 0),
    updated_at = now()
  where cp.id = target_creator_profile_id;
end;
$$;

create or replace function public.refresh_creator_profile_like_count(target_creator_profile_id uuid)
returns void
language plpgsql
as $$
begin
  if target_creator_profile_id is null then
    return;
  end if;

  update public.creator_profiles cp
  set
    total_likes_received = coalesce((
      select sum(coalesce(ur.like_count, 0))
      from public.user_routes ur
      where ur.creator_profile_id = target_creator_profile_id
    ), 0),
    updated_at = now()
  where cp.id = target_creator_profile_id;
end;
$$;

create or replace function public.refresh_creator_profile_bookmark_count(target_creator_profile_id uuid)
returns void
language plpgsql
as $$
begin
  if target_creator_profile_id is null then
    return;
  end if;

  update public.creator_profiles cp
  set
    total_bookmarks_received = coalesce((
      select sum(coalesce(ur.bookmark_count, 0))
      from public.user_routes ur
      where ur.creator_profile_id = target_creator_profile_id
    ), 0),
    updated_at = now()
  where cp.id = target_creator_profile_id;
end;
$$;

create or replace function public.refresh_user_route_stop_stats(target_route_id uuid)
returns void
language plpgsql
as $$
begin
  if target_route_id is null then
    return;
  end if;

  update public.user_routes ur
  set
    stop_count = coalesce((
      select count(*)
      from public.user_route_stops urs
      where urs.route_id = target_route_id
    ), 0),
    required_stop_count = coalesce((
      select count(*)
      from public.user_route_stops urs
      where urs.route_id = target_route_id
        and urs.is_required = true
    ), 0),
    photo_count = coalesce((
      select count(*)
      from public.user_route_stops urs
      where urs.route_id = target_route_id
        and urs.photo_url is not null
        and btrim(urs.photo_url) <> ''
    ), 0),
    updated_at = now()
  where ur.id = target_route_id;
end;
$$;

create or replace function public.pd24_sync_creator_profile_metrics()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_creator_profile_route_count(old.creator_profile_id);
    perform public.refresh_creator_profile_like_count(old.creator_profile_id);
    perform public.refresh_creator_profile_bookmark_count(old.creator_profile_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.creator_profile_id is distinct from new.creator_profile_id then
      perform public.refresh_creator_profile_route_count(old.creator_profile_id);
      perform public.refresh_creator_profile_like_count(old.creator_profile_id);
      perform public.refresh_creator_profile_bookmark_count(old.creator_profile_id);
    end if;

    perform public.refresh_creator_profile_route_count(new.creator_profile_id);
    perform public.refresh_creator_profile_like_count(new.creator_profile_id);
    perform public.refresh_creator_profile_bookmark_count(new.creator_profile_id);
    return new;
  end if;

  perform public.refresh_creator_profile_route_count(new.creator_profile_id);
  perform public.refresh_creator_profile_like_count(new.creator_profile_id);
  perform public.refresh_creator_profile_bookmark_count(new.creator_profile_id);
  return new;
end;
$$;

create or replace function public.pd24_sync_user_route_stop_stats()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_user_route_stop_stats(old.route_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.route_id is distinct from new.route_id then
      perform public.refresh_user_route_stop_stats(old.route_id);
    end if;

    perform public.refresh_user_route_stop_stats(new.route_id);
    return new;
  end if;

  perform public.refresh_user_route_stop_stats(new.route_id);
  return new;
end;
$$;

drop trigger if exists pd24_user_routes_refresh_creator_profile_route_count on public.user_routes;
drop trigger if exists pd24_user_routes_refresh_creator_profile_engagement on public.user_routes;
drop trigger if exists pd24_user_routes_refresh_creator_profile_metrics on public.user_routes;
create trigger pd24_user_routes_refresh_creator_profile_metrics
after insert or update or delete on public.user_routes
for each row
execute function public.pd24_sync_creator_profile_metrics();

drop trigger if exists pd24_user_route_stops_refresh_stats on public.user_route_stops;
create trigger pd24_user_route_stops_refresh_stats
after insert or update or delete on public.user_route_stops
for each row
execute function public.pd24_sync_user_route_stop_stats();

update public.creator_profiles cp
set
  route_count = coalesce(metrics.route_count, 0),
  total_likes_received = coalesce(metrics.total_likes_received, 0),
  total_bookmarks_received = coalesce(metrics.total_bookmarks_received, 0),
  updated_at = now()
from (
  select
    cp_inner.id,
    count(ur.id)::integer as route_count,
    coalesce(sum(coalesce(ur.like_count, 0)), 0)::integer as total_likes_received,
    coalesce(sum(coalesce(ur.bookmark_count, 0)), 0)::integer as total_bookmarks_received
  from public.creator_profiles cp_inner
  left join public.user_routes ur on ur.creator_profile_id = cp_inner.id
  group by cp_inner.id
) as metrics
where cp.id = metrics.id;

update public.user_routes ur
set
  stop_count = coalesce(stats.stop_count, 0),
  required_stop_count = coalesce(stats.required_stop_count, 0),
  photo_count = coalesce(stats.photo_count, 0),
  updated_at = now()
from (
  select
    ur_inner.id,
    count(urs.id)::integer as stop_count,
    count(*) filter (where urs.is_required = true)::integer as required_stop_count,
    count(*) filter (
      where urs.photo_url is not null
        and btrim(urs.photo_url) <> ''
    )::integer as photo_count
  from public.user_routes ur_inner
  left join public.user_route_stops urs on urs.route_id = ur_inner.id
  group by ur_inner.id
) as stats
where ur.id = stats.id;

commit;

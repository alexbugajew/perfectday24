begin;

create table if not exists public.user_route_likes (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.user_routes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_route_likes_route_user_unique unique (route_id, user_id)
);

create table if not exists public.user_route_bookmarks (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.user_routes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_route_bookmarks_route_user_unique unique (route_id, user_id)
);

create table if not exists public.user_route_ratings (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.user_routes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating integer not null,
  review_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_route_ratings_route_user_unique unique (route_id, user_id),
  constraint user_route_ratings_rating_check check (rating between 1 and 5)
);

drop trigger if exists user_route_ratings_set_updated_at on public.user_route_ratings;
create trigger user_route_ratings_set_updated_at
before update on public.user_route_ratings
for each row
execute function public.pd24_set_updated_at();

create index if not exists user_route_likes_route_idx
  on public.user_route_likes (route_id, created_at desc);

create index if not exists user_route_likes_user_idx
  on public.user_route_likes (user_id, created_at desc);

create index if not exists user_route_bookmarks_route_idx
  on public.user_route_bookmarks (route_id, created_at desc);

create index if not exists user_route_bookmarks_user_idx
  on public.user_route_bookmarks (user_id, created_at desc);

create index if not exists user_route_ratings_route_idx
  on public.user_route_ratings (route_id, created_at desc);

create index if not exists user_route_ratings_user_idx
  on public.user_route_ratings (user_id, created_at desc);

alter table public.user_route_likes enable row level security;
alter table public.user_route_bookmarks enable row level security;
alter table public.user_route_ratings enable row level security;

drop policy if exists "user_route_likes_select_public_or_own" on public.user_route_likes;
create policy "user_route_likes_select_public_or_own"
on public.user_route_likes
for select
to anon, authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.user_routes r
    where r.id = route_id
      and r.visibility in ('public', 'unlisted')
  )
);

drop policy if exists "user_route_likes_insert_own" on public.user_route_likes;
create policy "user_route_likes_insert_own"
on public.user_route_likes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "user_route_likes_delete_own" on public.user_route_likes;
create policy "user_route_likes_delete_own"
on public.user_route_likes
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "user_route_bookmarks_select_public_or_own" on public.user_route_bookmarks;
create policy "user_route_bookmarks_select_public_or_own"
on public.user_route_bookmarks
for select
to anon, authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.user_routes r
    where r.id = route_id
      and r.visibility in ('public', 'unlisted')
  )
);

drop policy if exists "user_route_bookmarks_insert_own" on public.user_route_bookmarks;
create policy "user_route_bookmarks_insert_own"
on public.user_route_bookmarks
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "user_route_bookmarks_delete_own" on public.user_route_bookmarks;
create policy "user_route_bookmarks_delete_own"
on public.user_route_bookmarks
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "user_route_ratings_select_public_or_own" on public.user_route_ratings;
create policy "user_route_ratings_select_public_or_own"
on public.user_route_ratings
for select
to anon, authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.user_routes r
    where r.id = route_id
      and r.visibility in ('public', 'unlisted')
  )
);

drop policy if exists "user_route_ratings_insert_own" on public.user_route_ratings;
create policy "user_route_ratings_insert_own"
on public.user_route_ratings
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "user_route_ratings_update_own" on public.user_route_ratings;
create policy "user_route_ratings_update_own"
on public.user_route_ratings
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_route_ratings_delete_own" on public.user_route_ratings;
create policy "user_route_ratings_delete_own"
on public.user_route_ratings
for delete
to authenticated
using (user_id = auth.uid());

drop function if exists public.refresh_user_route_like_count(uuid);
create function public.refresh_user_route_like_count(target_route_id uuid)
returns void
language plpgsql
as $$
begin
  if target_route_id is null then
    return;
  end if;

  update public.user_routes ur
  set
    like_count = coalesce((
      select count(*)
      from public.user_route_likes url
      where url.route_id = target_route_id
    ), 0),
    updated_at = now()
  where ur.id = target_route_id;
end;
$$;

drop function if exists public.refresh_user_route_bookmark_count(uuid);
create function public.refresh_user_route_bookmark_count(target_route_id uuid)
returns void
language plpgsql
as $$
begin
  if target_route_id is null then
    return;
  end if;

  update public.user_routes ur
  set
    bookmark_count = coalesce((
      select count(*)
      from public.user_route_bookmarks urb
      where urb.route_id = target_route_id
    ), 0),
    updated_at = now()
  where ur.id = target_route_id;
end;
$$;

drop function if exists public.refresh_user_route_rating_stats(uuid);
create function public.refresh_user_route_rating_stats(target_route_id uuid)
returns void
language plpgsql
as $$
begin
  if target_route_id is null then
    return;
  end if;

  update public.user_routes ur
  set
    rating_count = coalesce(stats.rating_count, 0),
    avg_rating = coalesce(stats.avg_rating, 0),
    updated_at = now()
  from (
    select
      route_id,
      count(*)::integer as rating_count,
      round(avg(rating)::numeric, 2)::double precision as avg_rating
    from public.user_route_ratings
    where route_id = target_route_id
    group by route_id
  ) as stats
  where ur.id = target_route_id;

  update public.user_routes ur
  set
    rating_count = 0,
    avg_rating = 0,
    updated_at = now()
  where ur.id = target_route_id
    and not exists (
      select 1
      from public.user_route_ratings urr
      where urr.route_id = target_route_id
    );
end;
$$;

create or replace function public.pd24_sync_user_route_like_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_user_route_like_count(old.route_id);
    return old;
  end if;

  perform public.refresh_user_route_like_count(new.route_id);
  return new;
end;
$$;

create or replace function public.pd24_sync_user_route_bookmark_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_user_route_bookmark_count(old.route_id);
    return old;
  end if;

  perform public.refresh_user_route_bookmark_count(new.route_id);
  return new;
end;
$$;

create or replace function public.pd24_sync_user_route_rating_stats()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_user_route_rating_stats(old.route_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.route_id is distinct from new.route_id then
      perform public.refresh_user_route_rating_stats(old.route_id);
    end if;

    perform public.refresh_user_route_rating_stats(new.route_id);
    return new;
  end if;

  perform public.refresh_user_route_rating_stats(new.route_id);
  return new;
end;
$$;

drop trigger if exists pd24_user_route_likes_refresh_count on public.user_route_likes;
create trigger pd24_user_route_likes_refresh_count
after insert or delete on public.user_route_likes
for each row
execute function public.pd24_sync_user_route_like_count();

drop trigger if exists pd24_user_route_bookmarks_refresh_count on public.user_route_bookmarks;
create trigger pd24_user_route_bookmarks_refresh_count
after insert or delete on public.user_route_bookmarks
for each row
execute function public.pd24_sync_user_route_bookmark_count();

drop trigger if exists pd24_user_route_ratings_refresh_stats on public.user_route_ratings;
create trigger pd24_user_route_ratings_refresh_stats
after insert or update or delete on public.user_route_ratings
for each row
execute function public.pd24_sync_user_route_rating_stats();

update public.user_routes ur
set like_count = coalesce(stats.like_count, 0)
from (
  select route_id, count(*)::integer as like_count
  from public.user_route_likes
  group by route_id
) as stats
where ur.id = stats.route_id;

update public.user_routes
set like_count = 0
where id not in (select distinct route_id from public.user_route_likes);

update public.user_routes ur
set bookmark_count = coalesce(stats.bookmark_count, 0)
from (
  select route_id, count(*)::integer as bookmark_count
  from public.user_route_bookmarks
  group by route_id
) as stats
where ur.id = stats.route_id;

update public.user_routes
set bookmark_count = 0
where id not in (select distinct route_id from public.user_route_bookmarks);

update public.user_routes ur
set
  rating_count = coalesce(stats.rating_count, 0),
  avg_rating = coalesce(stats.avg_rating, 0)
from (
  select
    route_id,
    count(*)::integer as rating_count,
    round(avg(rating)::numeric, 2)::double precision as avg_rating
  from public.user_route_ratings
  group by route_id
) as stats
where ur.id = stats.route_id;

update public.user_routes
set
  rating_count = 0,
  avg_rating = 0
where id not in (select distinct route_id from public.user_route_ratings);

commit;

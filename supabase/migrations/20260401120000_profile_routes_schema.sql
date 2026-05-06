begin;

create extension if not exists pgcrypto;

create or replace function public.pd24_set_updated_at()
returns trigger
language plpgsql
as $pd24$
begin
  new.updated_at = now();
  return new;
end;
$pd24$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  interests jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.pd24_set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
on public.profiles
for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  cover_image_url text,
  website_url text,
  instagram_url text,
  tiktok_url text,
  youtube_url text,
  home_city_slug text,
  creator_type text not null default 'user',
  is_verified boolean not null default false,
  is_featured boolean not null default false,
  route_count integer not null default 0,
  follower_count integer not null default 0,
  following_count integer not null default 0,
  total_likes_received integer not null default 0,
  total_bookmarks_received integer not null default 0,
  tags jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_profiles_creator_type_check
    check (creator_type in ('user', 'creator', 'influencer', 'brand', 'editorial'))
);

drop trigger if exists creator_profiles_set_updated_at on public.creator_profiles;
create trigger creator_profiles_set_updated_at
before update on public.creator_profiles
for each row
execute function public.pd24_set_updated_at();

create index if not exists creator_profiles_username_idx
  on public.creator_profiles (username);

create index if not exists creator_profiles_user_id_idx
  on public.creator_profiles (user_id);

alter table public.creator_profiles enable row level security;

drop policy if exists "creator_profiles_select_public" on public.creator_profiles;
create policy "creator_profiles_select_public"
on public.creator_profiles
for select
to anon, authenticated
using (true);

drop policy if exists "creator_profiles_insert_own" on public.creator_profiles;
create policy "creator_profiles_insert_own"
on public.creator_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "creator_profiles_update_own" on public.creator_profiles;
create policy "creator_profiles_update_own"
on public.creator_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "creator_profiles_delete_own" on public.creator_profiles;
create policy "creator_profiles_delete_own"
on public.creator_profiles
for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.user_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  creator_profile_id uuid references public.creator_profiles (id) on delete set null,
  city_slug text,
  title text not null,
  slug text unique,
  description text,
  cover_image_url text,
  start_label text,
  start_type text,
  start_lat double precision,
  start_lng double precision,
  visibility text not null default 'private',
  creator_type text not null default 'user',
  is_featured boolean not null default false,
  avg_rating double precision not null default 0,
  rating_count integer not null default 0,
  bookmark_count integer not null default 0,
  like_count integer not null default 0,
  stop_count integer not null default 0,
  required_stop_count integer not null default 0,
  photo_count integer not null default 0,
  view_count integer not null default 0,
  quality_score double precision,
  trending_score double precision,
  ranking_score double precision,
  tags jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_routes_visibility_check
    check (visibility in ('private', 'unlisted', 'public')),
  constraint user_routes_creator_type_check
    check (creator_type in ('user', 'creator', 'influencer', 'brand', 'editorial'))
);

drop trigger if exists user_routes_set_updated_at on public.user_routes;
create trigger user_routes_set_updated_at
before update on public.user_routes
for each row
execute function public.pd24_set_updated_at();

create index if not exists user_routes_user_id_idx
  on public.user_routes (user_id, updated_at desc);

create index if not exists user_routes_creator_profile_id_idx
  on public.user_routes (creator_profile_id, updated_at desc);

create index if not exists user_routes_slug_idx
  on public.user_routes (slug)
  where slug is not null;

create index if not exists user_routes_visibility_idx
  on public.user_routes (visibility, updated_at desc);

alter table public.user_routes enable row level security;

drop policy if exists "user_routes_select_public_or_own" on public.user_routes;
create policy "user_routes_select_public_or_own"
on public.user_routes
for select
to anon, authenticated
using (
  visibility in ('public', 'unlisted')
  or auth.uid() = user_id
);

drop policy if exists "user_routes_insert_own" on public.user_routes;
create policy "user_routes_insert_own"
on public.user_routes
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_routes_update_own" on public.user_routes;
create policy "user_routes_update_own"
on public.user_routes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_routes_delete_own" on public.user_routes;
create policy "user_routes_delete_own"
on public.user_routes
for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.user_route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.user_routes (id) on delete cascade,
  stop_order integer not null,
  location_id text,
  title text,
  note text,
  external_url text,
  is_required boolean not null default false,
  duration_min integer,
  lat double precision,
  lng double precision,
  photo_url text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_route_stops_order_positive check (stop_order > 0),
  constraint user_route_stops_route_order_unique unique (route_id, stop_order)
);

drop trigger if exists user_route_stops_set_updated_at on public.user_route_stops;
create trigger user_route_stops_set_updated_at
before update on public.user_route_stops
for each row
execute function public.pd24_set_updated_at();

create index if not exists user_route_stops_route_order_idx
  on public.user_route_stops (route_id, stop_order);

alter table public.user_route_stops enable row level security;

drop policy if exists "user_route_stops_select_public_or_own" on public.user_route_stops;
create policy "user_route_stops_select_public_or_own"
on public.user_route_stops
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.user_routes r
    where r.id = route_id
      and (
        r.visibility in ('public', 'unlisted')
        or r.user_id = auth.uid()
      )
  )
);

drop policy if exists "user_route_stops_insert_own" on public.user_route_stops;
create policy "user_route_stops_insert_own"
on public.user_route_stops
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_routes r
    where r.id = route_id
      and r.user_id = auth.uid()
  )
);

drop policy if exists "user_route_stops_update_own" on public.user_route_stops;
create policy "user_route_stops_update_own"
on public.user_route_stops
for update
to authenticated
using (
  exists (
    select 1
    from public.user_routes r
    where r.id = route_id
      and r.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.user_routes r
    where r.id = route_id
      and r.user_id = auth.uid()
  )
);

drop policy if exists "user_route_stops_delete_own" on public.user_route_stops;
create policy "user_route_stops_delete_own"
on public.user_route_stops
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_routes r
    where r.id = route_id
      and r.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "avatars_read_public" on storage.objects;
create policy "avatars_read_public"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;

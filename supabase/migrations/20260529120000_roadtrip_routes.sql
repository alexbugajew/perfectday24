-- Migration: roadtrip_routes
-- Speichert mehrtägige Roadtrip-Routen (stadtübergreifend).
-- Jede Route hat eine Abfolge von Städten (stops als JSONB), ist
-- date-agnostisch und kann von anderen Nutzern als Vorlage übernommen werden.
-- Sichtbar in /roadtrip/routes und in der Entdecken-Seite (/explore).

begin;

create extension if not exists pgcrypto;

-- ── Table ─────────────────────────────────────────────────────────────────────

create table if not exists public.roadtrip_routes (
  id               uuid        primary key default gen_random_uuid(),
  slug             text        unique not null,
  title            text        not null,
  description      text,
  cover_image_url  text,

  -- Author (nullable: anonymous routes permitted)
  author_user_id   uuid        references auth.users (id) on delete set null,
  author_name      text,

  -- Visibility
  -- 'public'     → erscheint in /explore und /roadtrip/routes
  -- 'link_only'  → nur via share_token abrufbar, kein öffentliches Listing
  -- 'private'    → nur für den Ersteller sichtbar (benötigt auth)
  visibility       text        not null default 'link_only'
                   constraint roadtrip_routes_visibility_check
                   check (visibility in ('public', 'link_only', 'private')),

  is_featured      boolean     not null default false,

  -- Share token — immer gesetzt; wird für Link-Sharing genutzt
  share_token      text        unique not null
                   default encode(gen_random_bytes(12), 'base64url'),

  -- Routing meta
  tags             text[]      not null default '{}',
  total_nights     integer     not null default 0,
  country_codes    text[]      not null default '{}',
  occasion         text        not null default 'tourism',
  budget           text        not null default 'medium',

  -- Stops: Array von { citySlug, cityLabel, lat, lng, nights, planSummary? }
  -- Date-agnostisch — Datum wird bei Verwendung durch den Nutzer festgelegt.
  stops            jsonb       not null default '[]'::jsonb,

  -- Engagement
  view_count       integer     not null default 0,
  clone_count      integer     not null default 0,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── Updated-at trigger ────────────────────────────────────────────────────────

drop trigger if exists roadtrip_routes_set_updated_at on public.roadtrip_routes;
create trigger roadtrip_routes_set_updated_at
before update on public.roadtrip_routes
for each row
execute function public.pd24_set_updated_at();

-- ── Indices ───────────────────────────────────────────────────────────────────

create index if not exists roadtrip_routes_slug_idx
  on public.roadtrip_routes (slug);

create index if not exists roadtrip_routes_share_token_idx
  on public.roadtrip_routes (share_token);

create index if not exists roadtrip_routes_public_idx
  on public.roadtrip_routes (visibility, created_at desc)
  where visibility = 'public';

create index if not exists roadtrip_routes_author_idx
  on public.roadtrip_routes (author_user_id)
  where author_user_id is not null;

-- ── Row-Level Security ────────────────────────────────────────────────────────

alter table public.roadtrip_routes enable row level security;

-- Public routes: anyone can read
drop policy if exists "roadtrip_routes_select_public" on public.roadtrip_routes;
create policy "roadtrip_routes_select_public"
  on public.roadtrip_routes
  for select
  to anon, authenticated
  using (visibility = 'public');

-- Link-only routes: anyone can read (access is gated at app level by knowing the token/slug)
drop policy if exists "roadtrip_routes_select_link_only" on public.roadtrip_routes;
create policy "roadtrip_routes_select_link_only"
  on public.roadtrip_routes
  for select
  to anon, authenticated
  using (visibility = 'link_only');

-- Private routes: only the author can read
drop policy if exists "roadtrip_routes_select_own_private" on public.roadtrip_routes;
create policy "roadtrip_routes_select_own_private"
  on public.roadtrip_routes
  for select
  to authenticated
  using (visibility = 'private' and auth.uid() = author_user_id);

-- Insert: authenticated users can create their own routes
drop policy if exists "roadtrip_routes_insert_own" on public.roadtrip_routes;
create policy "roadtrip_routes_insert_own"
  on public.roadtrip_routes
  for insert
  to authenticated
  with check (auth.uid() = author_user_id or author_user_id is null);

-- Anonymous insert: allow anon (guest) users to save routes
drop policy if exists "roadtrip_routes_insert_anon" on public.roadtrip_routes;
create policy "roadtrip_routes_insert_anon"
  on public.roadtrip_routes
  for insert
  to anon
  with check (author_user_id is null);

-- Update: only by author
drop policy if exists "roadtrip_routes_update_own" on public.roadtrip_routes;
create policy "roadtrip_routes_update_own"
  on public.roadtrip_routes
  for update
  to authenticated
  using (auth.uid() = author_user_id)
  with check (auth.uid() = author_user_id);

-- Delete: only by author
drop policy if exists "roadtrip_routes_delete_own" on public.roadtrip_routes;
create policy "roadtrip_routes_delete_own"
  on public.roadtrip_routes
  for delete
  to authenticated
  using (auth.uid() = author_user_id);

-- ── Helper function: increment view/clone counts ───────────────────────────────
-- Called from API route with service-role key to bypass RLS for stat updates.

create or replace function public.roadtrip_routes_increment_views(route_id uuid)
returns void
language sql
security definer
as $$
  update public.roadtrip_routes
  set view_count = view_count + 1
  where id = route_id;
$$;

create or replace function public.roadtrip_routes_increment_clones(route_id uuid)
returns void
language sql
security definer
as $$
  update public.roadtrip_routes
  set clone_count = clone_count + 1
  where id = route_id;
$$;

commit;

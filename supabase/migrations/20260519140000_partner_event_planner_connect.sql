-- ── Partner ↔ Event Planner: Connect the two worlds ──────────────────────────
--
-- 1. service_providers: city_slug (scalar) → city_slugs (array)
-- 2. GIN index for array containment queries
-- 3. event_vendors_view: denormalised join for lightweight SELECT queries
-- 4. event_vendor_requests: fallback when no vendor found for a need/city
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add city_slugs array column
alter table public.service_providers
  add column if not exists city_slugs text[] not null default '{}';

-- 2. Backfill from existing city_slug
update public.service_providers
  set city_slugs = array[city_slug]
  where city_slug is not null
    and city_slugs = '{}';

-- 3. Index for .contains() queries (array @> array)
create index if not exists service_providers_city_slugs_gin_idx
  on public.service_providers using gin(city_slugs);

-- ── event_vendors_view ────────────────────────────────────────────────────────
-- Combines service_providers with the linked partner_profile metadata.
-- Read-only; access is governed by RLS on the underlying tables.

create or replace view public.event_vendors_view as
  select
    sp.id,
    sp.slug,
    sp.name,
    sp.service_type,
    sp.city_slug,
    sp.city_slugs,
    sp.description,
    sp.website_url,
    sp.base_price_cents,
    sp.price_unit        as sp_price_unit,
    sp.is_verified,
    sp.status,
    sp.partner_profile_id,
    pp.media_urls,
    pp.service_category_slugs,
    pp.booking_type,
    pp.booking_url,
    pp.contact_email     as pp_contact_email,
    pp.operating_cities,
    pp.billing_status,
    pp.visibility_tier
  from public.service_providers sp
  left join public.partner_profiles pp
    on pp.id = sp.partner_profile_id;

-- Grant explicit read so anon + authenticated can query the view
grant select on public.event_vendors_view to anon, authenticated;

-- ── event_vendor_requests ─────────────────────────────────────────────────────
-- Stores "no vendor found in my city" contact requests from event planners.

create table if not exists public.event_vendor_requests (
  id              uuid        primary key default gen_random_uuid(),
  event_plan_id   uuid        references public.event_plans(id) on delete set null,
  city_slug       text,
  need_slug       text,
  requester_name  text,
  requester_email text        not null,
  message         text,
  status          text        not null default 'new'
    constraint event_vendor_requests_status_check
      check (status in ('new', 'forwarded', 'closed')),
  created_at      timestamptz not null default now()
);

create index if not exists event_vendor_requests_plan_idx
  on public.event_vendor_requests (event_plan_id, created_at desc);

create index if not exists event_vendor_requests_city_need_idx
  on public.event_vendor_requests (city_slug, need_slug);

alter table public.event_vendor_requests enable row level security;

-- Anyone (including anon) can submit a request
drop policy if exists "event_vendor_requests_insert_any" on public.event_vendor_requests;
create policy "event_vendor_requests_insert_any"
  on public.event_vendor_requests for insert to anon, authenticated
  with check (true);

-- Authenticated users can read their own requests (via plan ownership)
drop policy if exists "event_vendor_requests_select_own" on public.event_vendor_requests;
create policy "event_vendor_requests_select_own"
  on public.event_vendor_requests for select to authenticated
  using (
    event_plan_id is null
    or event_plan_id in (
      select id from public.event_plans where user_id = auth.uid()
    )
  );

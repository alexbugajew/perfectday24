-- ── Partner Impressions ────────────────────────────────────────────────────────
-- Tracks when a partner's service appears in event plan provider listings.

create table if not exists public.partner_impressions (
  id          uuid        primary key default gen_random_uuid(),
  partner_id  uuid        not null references public.partner_profiles(id) on delete cascade,
  plan_id     uuid        references public.event_plans(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists partner_impressions_partner_created_idx
  on public.partner_impressions (partner_id, created_at desc);

alter table public.partner_impressions enable row level security;

drop policy if exists "partner_impressions_select_own" on public.partner_impressions;
create policy "partner_impressions_select_own"
  on public.partner_impressions for select to authenticated
  using (public.pd24_is_partner_member(partner_id));

-- ── Partner Clicks ─────────────────────────────────────────────────────────────
-- Tracks when a user clicks a partner affiliate link.

create table if not exists public.partner_clicks (
  id                uuid        primary key default gen_random_uuid(),
  partner_id        uuid        not null references public.partner_profiles(id) on delete cascade,
  affiliate_link_id uuid,       -- soft reference to affiliate_links(id) — no FK to avoid migration-order issues
  created_at        timestamptz not null default now()
);

create index if not exists partner_clicks_partner_created_idx
  on public.partner_clicks (partner_id, created_at desc);

alter table public.partner_clicks enable row level security;

drop policy if exists "partner_clicks_select_own" on public.partner_clicks;
create policy "partner_clicks_select_own"
  on public.partner_clicks for select to authenticated
  using (public.pd24_is_partner_member(partner_id));

-- ── Service Providers: Partner Ownership ──────────────────────────────────────
-- Links a service provider entry to the partner that owns/manages it.

alter table public.service_providers
  add column if not exists partner_profile_id uuid
    references public.partner_profiles(id) on delete set null;

create index if not exists service_providers_partner_idx
  on public.service_providers (partner_profile_id, status);

-- ── Event Bookings: Partner Read Access ───────────────────────────────────────
-- Allows partner members to read bookings for their service providers.

drop policy if exists "event_bookings_select_provider_partner" on public.event_bookings;
create policy "event_bookings_select_provider_partner"
  on public.event_bookings for select to authenticated
  using (
    exists (
      select 1
      from public.service_providers sp
      where sp.id = event_bookings.service_provider_id
        and sp.partner_profile_id is not null
        and public.pd24_is_partner_member(sp.partner_profile_id)
    )
  );

-- ── Event Bookings: Partner Update Access ─────────────────────────────────────
-- Allows partner owners/admins to update booking status (confirm / decline).

drop policy if exists "event_bookings_update_provider_partner" on public.event_bookings;
create policy "event_bookings_update_provider_partner"
  on public.event_bookings for update to authenticated
  using (
    exists (
      select 1
      from public.service_providers sp
      where sp.id = event_bookings.service_provider_id
        and sp.partner_profile_id is not null
        and public.pd24_is_partner_admin(sp.partner_profile_id)
    )
  );

-- ── Partner Profile: Self-Service Update ──────────────────────────────────────
-- Allows partner owners/admins to update their own profile fields.

drop policy if exists "partner_profiles_update_self_service" on public.partner_profiles;
create policy "partner_profiles_update_self_service"
  on public.partner_profiles for update to authenticated
  using (public.pd24_is_partner_admin(id))
  with check (public.pd24_is_partner_admin(id));

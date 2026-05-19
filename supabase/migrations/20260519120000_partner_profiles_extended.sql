-- ── Partner Profiles: Extended Self-Service Columns ──────────────────────────
-- Adds type-specific metadata, media, service categories, operating cities,
-- booking workflow, and opening hours for the self-service partner onboarding.

alter table public.partner_profiles
  add column if not exists partner_type_slug text not null default 'gastronomy',
  add column if not exists type_data          jsonb not null default '{}',
  add column if not exists media_urls         text[] not null default '{}',
  add column if not exists service_category_slugs text[] not null default '{}',
  add column if not exists operating_cities   text[] not null default '{}',
  add column if not exists booking_type       text not null default 'request',
  add column if not exists opening_hours      jsonb not null default '{}';

-- ── Constraints ───────────────────────────────────────────────────────────────

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'partner_profiles_partner_type_slug_check'
      and conrelid = 'public.partner_profiles'::regclass
  ) then
    alter table public.partner_profiles
      add constraint partner_profiles_partner_type_slug_check
        check (partner_type_slug in (
          'gastronomy', 'venue', 'experience', 'accommodation',
          'city_tourism', 'event_vendor', 'corporate', 'travel_agency', 'other'
        ));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'partner_profiles_booking_type_check'
      and conrelid = 'public.partner_profiles'::regclass
  ) then
    alter table public.partner_profiles
      add constraint partner_profiles_booking_type_check
        check (booking_type in ('request', 'direct', 'external', 'none'));
  end if;
end $$;

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists partner_profiles_type_slug_idx
  on public.partner_profiles (partner_type_slug, status);

-- ── RLS: Allow anon/authenticated to read active partner profiles ─────────────

drop policy if exists "partner_profiles_select_public" on public.partner_profiles;
create policy "partner_profiles_select_public"
  on public.partner_profiles for select to anon, authenticated
  using (status = 'active');

-- ── RLS: Partner members can read their own profile regardless of status ──────

drop policy if exists "partner_profiles_select_own_member" on public.partner_profiles;
create policy "partner_profiles_select_own_member"
  on public.partner_profiles for select to authenticated
  using (public.pd24_is_partner_member(id));

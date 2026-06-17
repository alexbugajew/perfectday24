begin;

create extension if not exists pgcrypto;

create table if not exists public.route_media (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.user_routes (id) on delete cascade,
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  role text not null default 'gallery',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_media_role_check
    check (role in ('cover', 'gallery', 'hero', 'thumbnail')),
  constraint route_media_unique unique (route_id, asset_id, role)
);

drop trigger if exists route_media_set_updated_at on public.route_media;
create trigger route_media_set_updated_at
before update on public.route_media
for each row
execute function public.pd24_set_updated_at();

create index if not exists route_media_route_idx
  on public.route_media (route_id, role, is_primary desc, sort_order);

create unique index if not exists route_media_primary_role_unique
  on public.route_media (route_id, role)
  where is_primary = true;

alter table public.route_media enable row level security;

drop policy if exists "route_media_select_public_or_own" on public.route_media;
create policy "route_media_select_public_or_own"
  on public.route_media for select to anon, authenticated
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

drop policy if exists "route_media_insert_own" on public.route_media;
create policy "route_media_insert_own"
  on public.route_media for insert to authenticated
  with check (
    exists (
      select 1
      from public.user_routes r
      join public.media_assets ma on ma.id = asset_id
      where r.id = route_id
        and r.user_id = auth.uid()
        and (
          ma.owner_user_id = auth.uid()
          or public.pd24_is_app_admin()
        )
    )
  );

drop policy if exists "route_media_update_own" on public.route_media;
create policy "route_media_update_own"
  on public.route_media for update to authenticated
  using (
    exists (
      select 1
      from public.user_routes r
      where r.id = route_id
        and (r.user_id = auth.uid() or public.pd24_is_app_admin())
    )
  )
  with check (
    exists (
      select 1
      from public.user_routes r
      where r.id = route_id
        and (r.user_id = auth.uid() or public.pd24_is_app_admin())
    )
  );

drop policy if exists "route_media_delete_own" on public.route_media;
create policy "route_media_delete_own"
  on public.route_media for delete to authenticated
  using (
    exists (
      select 1
      from public.user_routes r
      where r.id = route_id
        and (r.user_id = auth.uid() or public.pd24_is_app_admin())
    )
  );

create table if not exists public.route_stop_media (
  id uuid primary key default gen_random_uuid(),
  route_stop_id uuid not null references public.user_route_stops (id) on delete cascade,
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  role text not null default 'gallery',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_stop_media_role_check
    check (role in ('primary', 'gallery', 'thumbnail')),
  constraint route_stop_media_unique unique (route_stop_id, asset_id, role)
);

drop trigger if exists route_stop_media_set_updated_at on public.route_stop_media;
create trigger route_stop_media_set_updated_at
before update on public.route_stop_media
for each row
execute function public.pd24_set_updated_at();

create index if not exists route_stop_media_stop_idx
  on public.route_stop_media (route_stop_id, role, is_primary desc, sort_order);

create unique index if not exists route_stop_media_primary_role_unique
  on public.route_stop_media (route_stop_id, role)
  where is_primary = true;

alter table public.route_stop_media enable row level security;

drop policy if exists "route_stop_media_select_public_or_own" on public.route_stop_media;
create policy "route_stop_media_select_public_or_own"
  on public.route_stop_media for select to anon, authenticated
  using (
    exists (
      select 1
      from public.user_route_stops rs
      join public.user_routes r on r.id = rs.route_id
      where rs.id = route_stop_id
        and (
          r.visibility in ('public', 'unlisted')
          or r.user_id = auth.uid()
        )
    )
  );

drop policy if exists "route_stop_media_insert_own" on public.route_stop_media;
create policy "route_stop_media_insert_own"
  on public.route_stop_media for insert to authenticated
  with check (
    exists (
      select 1
      from public.user_route_stops rs
      join public.user_routes r on r.id = rs.route_id
      join public.media_assets ma on ma.id = asset_id
      where rs.id = route_stop_id
        and r.user_id = auth.uid()
        and (
          ma.owner_user_id = auth.uid()
          or public.pd24_is_app_admin()
        )
    )
  );

drop policy if exists "route_stop_media_update_own" on public.route_stop_media;
create policy "route_stop_media_update_own"
  on public.route_stop_media for update to authenticated
  using (
    exists (
      select 1
      from public.user_route_stops rs
      join public.user_routes r on r.id = rs.route_id
      where rs.id = route_stop_id
        and (r.user_id = auth.uid() or public.pd24_is_app_admin())
    )
  )
  with check (
    exists (
      select 1
      from public.user_route_stops rs
      join public.user_routes r on r.id = rs.route_id
      where rs.id = route_stop_id
        and (r.user_id = auth.uid() or public.pd24_is_app_admin())
    )
  );

drop policy if exists "route_stop_media_delete_own" on public.route_stop_media;
create policy "route_stop_media_delete_own"
  on public.route_stop_media for delete to authenticated
  using (
    exists (
      select 1
      from public.user_route_stops rs
      join public.user_routes r on r.id = rs.route_id
      where rs.id = route_stop_id
        and (r.user_id = auth.uid() or public.pd24_is_app_admin())
    )
  );

create table if not exists public.roadtrip_media (
  id uuid primary key default gen_random_uuid(),
  roadtrip_route_id uuid not null references public.roadtrip_routes (id) on delete cascade,
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  role text not null default 'gallery',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roadtrip_media_role_check
    check (role in ('cover', 'gallery', 'hero', 'thumbnail')),
  constraint roadtrip_media_unique unique (roadtrip_route_id, asset_id, role)
);

drop trigger if exists roadtrip_media_set_updated_at on public.roadtrip_media;
create trigger roadtrip_media_set_updated_at
before update on public.roadtrip_media
for each row
execute function public.pd24_set_updated_at();

create index if not exists roadtrip_media_route_idx
  on public.roadtrip_media (roadtrip_route_id, role, is_primary desc, sort_order);

create unique index if not exists roadtrip_media_primary_role_unique
  on public.roadtrip_media (roadtrip_route_id, role)
  where is_primary = true;

alter table public.roadtrip_media enable row level security;

drop policy if exists "roadtrip_media_select_public_or_own" on public.roadtrip_media;
create policy "roadtrip_media_select_public_or_own"
  on public.roadtrip_media for select to anon, authenticated
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

drop policy if exists "roadtrip_media_insert_own" on public.roadtrip_media;
create policy "roadtrip_media_insert_own"
  on public.roadtrip_media for insert to authenticated
  with check (
    exists (
      select 1
      from public.roadtrip_routes rr
      join public.media_assets ma on ma.id = asset_id
      where rr.id = roadtrip_route_id
        and (rr.author_user_id = auth.uid() or public.pd24_is_app_admin())
        and (
          ma.owner_user_id = auth.uid()
          or public.pd24_is_app_admin()
        )
    )
  );

drop policy if exists "roadtrip_media_update_own" on public.roadtrip_media;
create policy "roadtrip_media_update_own"
  on public.roadtrip_media for update to authenticated
  using (
    exists (
      select 1
      from public.roadtrip_routes rr
      where rr.id = roadtrip_route_id
        and (rr.author_user_id = auth.uid() or public.pd24_is_app_admin())
    )
  )
  with check (
    exists (
      select 1
      from public.roadtrip_routes rr
      where rr.id = roadtrip_route_id
        and (rr.author_user_id = auth.uid() or public.pd24_is_app_admin())
    )
  );

drop policy if exists "roadtrip_media_delete_own" on public.roadtrip_media;
create policy "roadtrip_media_delete_own"
  on public.roadtrip_media for delete to authenticated
  using (
    exists (
      select 1
      from public.roadtrip_routes rr
      where rr.id = roadtrip_route_id
        and (rr.author_user_id = auth.uid() or public.pd24_is_app_admin())
    )
  );

create table if not exists public.roadtrip_stop_media (
  id uuid primary key default gen_random_uuid(),
  roadtrip_stop_id uuid not null references public.roadtrip_route_stops (id) on delete cascade,
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  role text not null default 'gallery',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roadtrip_stop_media_role_check
    check (role in ('primary', 'gallery', 'thumbnail')),
  constraint roadtrip_stop_media_unique unique (roadtrip_stop_id, asset_id, role)
);

drop trigger if exists roadtrip_stop_media_set_updated_at on public.roadtrip_stop_media;
create trigger roadtrip_stop_media_set_updated_at
before update on public.roadtrip_stop_media
for each row
execute function public.pd24_set_updated_at();

create index if not exists roadtrip_stop_media_stop_idx
  on public.roadtrip_stop_media (roadtrip_stop_id, role, is_primary desc, sort_order);

create unique index if not exists roadtrip_stop_media_primary_role_unique
  on public.roadtrip_stop_media (roadtrip_stop_id, role)
  where is_primary = true;

alter table public.roadtrip_stop_media enable row level security;

drop policy if exists "roadtrip_stop_media_select_public_or_own" on public.roadtrip_stop_media;
create policy "roadtrip_stop_media_select_public_or_own"
  on public.roadtrip_stop_media for select to anon, authenticated
  using (
    exists (
      select 1
      from public.roadtrip_route_stops rs
      join public.roadtrip_routes rr on rr.id = rs.roadtrip_route_id
      where rs.id = roadtrip_stop_id
        and (
          rr.visibility in ('public', 'link_only')
          or rr.author_user_id = auth.uid()
        )
    )
  );

drop policy if exists "roadtrip_stop_media_insert_own" on public.roadtrip_stop_media;
create policy "roadtrip_stop_media_insert_own"
  on public.roadtrip_stop_media for insert to authenticated
  with check (
    exists (
      select 1
      from public.roadtrip_route_stops rs
      join public.roadtrip_routes rr on rr.id = rs.roadtrip_route_id
      join public.media_assets ma on ma.id = asset_id
      where rs.id = roadtrip_stop_id
        and (rr.author_user_id = auth.uid() or public.pd24_is_app_admin())
        and (
          ma.owner_user_id = auth.uid()
          or public.pd24_is_app_admin()
        )
    )
  );

drop policy if exists "roadtrip_stop_media_update_own" on public.roadtrip_stop_media;
create policy "roadtrip_stop_media_update_own"
  on public.roadtrip_stop_media for update to authenticated
  using (
    exists (
      select 1
      from public.roadtrip_route_stops rs
      join public.roadtrip_routes rr on rr.id = rs.roadtrip_route_id
      where rs.id = roadtrip_stop_id
        and (rr.author_user_id = auth.uid() or public.pd24_is_app_admin())
    )
  )
  with check (
    exists (
      select 1
      from public.roadtrip_route_stops rs
      join public.roadtrip_routes rr on rr.id = rs.roadtrip_route_id
      where rs.id = roadtrip_stop_id
        and (rr.author_user_id = auth.uid() or public.pd24_is_app_admin())
    )
  );

drop policy if exists "roadtrip_stop_media_delete_own" on public.roadtrip_stop_media;
create policy "roadtrip_stop_media_delete_own"
  on public.roadtrip_stop_media for delete to authenticated
  using (
    exists (
      select 1
      from public.roadtrip_route_stops rs
      join public.roadtrip_routes rr on rr.id = rs.roadtrip_route_id
      where rs.id = roadtrip_stop_id
        and (rr.author_user_id = auth.uid() or public.pd24_is_app_admin())
    )
  );

create table if not exists public.event_plan_media (
  id uuid primary key default gen_random_uuid(),
  event_plan_id uuid not null references public.event_plans (id) on delete cascade,
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  role text not null default 'gallery',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_plan_media_role_check
    check (role in ('cover', 'mood', 'gallery', 'recap')),
  constraint event_plan_media_unique unique (event_plan_id, asset_id, role)
);

drop trigger if exists event_plan_media_set_updated_at on public.event_plan_media;
create trigger event_plan_media_set_updated_at
before update on public.event_plan_media
for each row
execute function public.pd24_set_updated_at();

create index if not exists event_plan_media_plan_idx
  on public.event_plan_media (event_plan_id, role, is_primary desc, sort_order);

create unique index if not exists event_plan_media_primary_role_unique
  on public.event_plan_media (event_plan_id, role)
  where is_primary = true;

alter table public.event_plan_media enable row level security;

drop policy if exists "event_plan_media_select_own" on public.event_plan_media;
create policy "event_plan_media_select_own"
  on public.event_plan_media for select to authenticated
  using (
    exists (
      select 1
      from public.event_plans ep
      where ep.id = event_plan_id
        and (ep.user_id = auth.uid() or public.pd24_is_app_admin())
    )
  );

drop policy if exists "event_plan_media_insert_own" on public.event_plan_media;
create policy "event_plan_media_insert_own"
  on public.event_plan_media for insert to authenticated
  with check (
    exists (
      select 1
      from public.event_plans ep
      join public.media_assets ma on ma.id = asset_id
      where ep.id = event_plan_id
        and (ep.user_id = auth.uid() or public.pd24_is_app_admin())
        and (
          ma.owner_user_id = auth.uid()
          or public.pd24_is_app_admin()
        )
    )
  );

drop policy if exists "event_plan_media_update_own" on public.event_plan_media;
create policy "event_plan_media_update_own"
  on public.event_plan_media for update to authenticated
  using (
    exists (
      select 1
      from public.event_plans ep
      where ep.id = event_plan_id
        and (ep.user_id = auth.uid() or public.pd24_is_app_admin())
    )
  )
  with check (
    exists (
      select 1
      from public.event_plans ep
      where ep.id = event_plan_id
        and (ep.user_id = auth.uid() or public.pd24_is_app_admin())
    )
  );

drop policy if exists "event_plan_media_delete_own" on public.event_plan_media;
create policy "event_plan_media_delete_own"
  on public.event_plan_media for delete to authenticated
  using (
    exists (
      select 1
      from public.event_plans ep
      where ep.id = event_plan_id
        and (ep.user_id = auth.uid() or public.pd24_is_app_admin())
    )
  );

create table if not exists public.partner_profile_media (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null references public.partner_profiles (id) on delete cascade,
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  role text not null default 'gallery',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_profile_media_role_check
    check (role in ('logo', 'cover', 'gallery', 'hero', 'thumbnail')),
  constraint partner_profile_media_unique unique (partner_profile_id, asset_id, role)
);

drop trigger if exists partner_profile_media_set_updated_at on public.partner_profile_media;
create trigger partner_profile_media_set_updated_at
before update on public.partner_profile_media
for each row
execute function public.pd24_set_updated_at();

create index if not exists partner_profile_media_partner_idx
  on public.partner_profile_media (partner_profile_id, role, is_primary desc, sort_order);

create unique index if not exists partner_profile_media_primary_role_unique
  on public.partner_profile_media (partner_profile_id, role)
  where is_primary = true;

alter table public.partner_profile_media enable row level security;

drop policy if exists "partner_profile_media_select_public_or_member" on public.partner_profile_media;
create policy "partner_profile_media_select_public_or_member"
  on public.partner_profile_media for select to anon, authenticated
  using (
    exists (
      select 1
      from public.partner_profiles pp
      where pp.id = partner_profile_id
        and (
          pp.status = 'active'
          or public.pd24_is_partner_member(pp.id)
          or public.pd24_is_app_admin()
        )
    )
  );

drop policy if exists "partner_profile_media_insert_admin" on public.partner_profile_media;
create policy "partner_profile_media_insert_admin"
  on public.partner_profile_media for insert to authenticated
  with check (
    exists (
      select 1
      from public.media_assets ma
      where ma.id = asset_id
        and public.pd24_is_partner_admin(partner_profile_id)
        and (
          ma.partner_profile_id = partner_profile_id
          or ma.owner_user_id = auth.uid()
          or public.pd24_is_app_admin()
        )
    )
  );

drop policy if exists "partner_profile_media_update_admin" on public.partner_profile_media;
create policy "partner_profile_media_update_admin"
  on public.partner_profile_media for update to authenticated
  using (
    public.pd24_is_partner_admin(partner_profile_id)
    or public.pd24_is_app_admin()
  )
  with check (
    public.pd24_is_partner_admin(partner_profile_id)
    or public.pd24_is_app_admin()
  );

drop policy if exists "partner_profile_media_delete_admin" on public.partner_profile_media;
create policy "partner_profile_media_delete_admin"
  on public.partner_profile_media for delete to authenticated
  using (
    public.pd24_is_partner_admin(partner_profile_id)
    or public.pd24_is_app_admin()
  );

create table if not exists public.service_provider_media (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.service_providers (id) on delete cascade,
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  role text not null default 'gallery',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_provider_media_role_check
    check (role in ('cover', 'gallery', 'package', 'thumbnail')),
  constraint service_provider_media_unique unique (provider_id, asset_id, role)
);

drop trigger if exists service_provider_media_set_updated_at on public.service_provider_media;
create trigger service_provider_media_set_updated_at
before update on public.service_provider_media
for each row
execute function public.pd24_set_updated_at();

create index if not exists service_provider_media_provider_idx
  on public.service_provider_media (provider_id, role, is_primary desc, sort_order);

create unique index if not exists service_provider_media_primary_role_unique
  on public.service_provider_media (provider_id, role)
  where is_primary = true;

alter table public.service_provider_media enable row level security;

drop policy if exists "service_provider_media_select_public_or_member" on public.service_provider_media;
create policy "service_provider_media_select_public_or_member"
  on public.service_provider_media for select to anon, authenticated
  using (
    exists (
      select 1
      from public.service_providers sp
      where sp.id = provider_id
        and (
          sp.status = 'active'
          or (
            sp.partner_profile_id is not null
            and public.pd24_is_partner_member(sp.partner_profile_id)
          )
          or public.pd24_is_app_admin()
        )
    )
  );

drop policy if exists "service_provider_media_insert_admin" on public.service_provider_media;
create policy "service_provider_media_insert_admin"
  on public.service_provider_media for insert to authenticated
  with check (
    exists (
      select 1
      from public.service_providers sp
      join public.media_assets ma on ma.id = asset_id
      where sp.id = provider_id
        and (
          public.pd24_is_app_admin()
          or (
            sp.partner_profile_id is not null
            and public.pd24_is_partner_admin(sp.partner_profile_id)
          )
        )
        and (
          ma.owner_user_id = auth.uid()
          or ma.partner_profile_id = sp.partner_profile_id
          or public.pd24_is_app_admin()
        )
    )
  );

drop policy if exists "service_provider_media_update_admin" on public.service_provider_media;
create policy "service_provider_media_update_admin"
  on public.service_provider_media for update to authenticated
  using (
    exists (
      select 1
      from public.service_providers sp
      where sp.id = provider_id
        and (
          public.pd24_is_app_admin()
          or (
            sp.partner_profile_id is not null
            and public.pd24_is_partner_admin(sp.partner_profile_id)
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.service_providers sp
      where sp.id = provider_id
        and (
          public.pd24_is_app_admin()
          or (
            sp.partner_profile_id is not null
            and public.pd24_is_partner_admin(sp.partner_profile_id)
          )
        )
    )
  );

drop policy if exists "service_provider_media_delete_admin" on public.service_provider_media;
create policy "service_provider_media_delete_admin"
  on public.service_provider_media for delete to authenticated
  using (
    exists (
      select 1
      from public.service_providers sp
      where sp.id = provider_id
        and (
          public.pd24_is_app_admin()
          or (
            sp.partner_profile_id is not null
            and public.pd24_is_partner_admin(sp.partner_profile_id)
          )
        )
    )
  );

commit;

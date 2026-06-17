begin;

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-media',
  'user-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "user_media_read_public" on storage.objects;
create policy "user_media_read_public"
  on storage.objects for select to public
  using (bucket_id = 'user-media');

drop policy if exists "user_media_insert_own" on storage.objects;
create policy "user_media_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'user-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user_media_update_own" on storage.objects;
create policy "user_media_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'user-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'user-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user_media_delete_own" on storage.objects;
create policy "user_media_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'user-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create or replace function public.pd24_is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $pd24$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_admin = true
  );
$pd24$;

revoke all on function public.pd24_is_app_admin() from public;
grant execute on function public.pd24_is_app_admin() to anon, authenticated;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid null references auth.users (id) on delete set null,
  partner_profile_id uuid null references public.partner_profiles (id) on delete set null,
  source_type text not null default 'user',
  bucket_id text not null,
  storage_path text not null,
  public_url text not null,
  mime_type text null,
  file_size_bytes integer null,
  width integer null,
  height integer null,
  alt_text text null,
  caption text null,
  credit_name text null,
  moderation_status text not null default 'submitted',
  rights_status text not null default 'pending',
  visibility text not null default 'public',
  consent_version text null,
  consent_confirmed_at timestamptz null,
  duplicate_hash text null,
  blurhash text null,
  dominant_color text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_assets_source_type_check
    check (source_type in ('user', 'partner', 'creator', 'editorial', 'imported', 'system')),
  constraint media_assets_moderation_status_check
    check (moderation_status in ('draft', 'submitted', 'approved', 'rejected', 'featured')),
  constraint media_assets_rights_status_check
    check (rights_status in ('pending', 'confirmed', 'licensed', 'rejected')),
  constraint media_assets_visibility_check
    check (visibility in ('private', 'unlisted', 'public')),
  constraint media_assets_bucket_path_unique unique (bucket_id, storage_path)
);

drop trigger if exists media_assets_set_updated_at on public.media_assets;
create trigger media_assets_set_updated_at
before update on public.media_assets
for each row
execute function public.pd24_set_updated_at();

create index if not exists media_assets_owner_idx
  on public.media_assets (owner_user_id, created_at desc);

create index if not exists media_assets_partner_idx
  on public.media_assets (partner_profile_id, created_at desc);

create index if not exists media_assets_status_idx
  on public.media_assets (moderation_status, visibility, created_at desc);

create index if not exists media_assets_source_idx
  on public.media_assets (source_type, created_at desc);

alter table public.media_assets enable row level security;

drop policy if exists "media_assets_select_public" on public.media_assets;
create policy "media_assets_select_public"
  on public.media_assets for select to anon, authenticated
  using (
    moderation_status in ('approved', 'featured')
    and visibility = 'public'
  );

drop policy if exists "media_assets_select_own_or_partner_or_admin" on public.media_assets;
create policy "media_assets_select_own_or_partner_or_admin"
  on public.media_assets for select to authenticated
  using (
    owner_user_id = auth.uid()
    or (partner_profile_id is not null and public.pd24_is_partner_member(partner_profile_id))
    or public.pd24_is_app_admin()
  );

drop policy if exists "media_assets_insert_own_or_partner" on public.media_assets;
create policy "media_assets_insert_own_or_partner"
  on public.media_assets for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and (
      partner_profile_id is null
      or public.pd24_is_partner_member(partner_profile_id)
    )
  );

drop policy if exists "media_assets_update_own_or_partner_or_admin" on public.media_assets;
create policy "media_assets_update_own_or_partner_or_admin"
  on public.media_assets for update to authenticated
  using (
    owner_user_id = auth.uid()
    or (partner_profile_id is not null and public.pd24_is_partner_member(partner_profile_id))
    or public.pd24_is_app_admin()
  )
  with check (
    owner_user_id = auth.uid()
    or (partner_profile_id is not null and public.pd24_is_partner_member(partner_profile_id))
    or public.pd24_is_app_admin()
  );

drop policy if exists "media_assets_delete_own_or_partner_or_admin" on public.media_assets;
create policy "media_assets_delete_own_or_partner_or_admin"
  on public.media_assets for delete to authenticated
  using (
    owner_user_id = auth.uid()
    or (partner_profile_id is not null and public.pd24_is_partner_member(partner_profile_id))
    or public.pd24_is_app_admin()
  );

create table if not exists public.media_moderation_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  acted_by_user_id uuid null references auth.users (id) on delete set null,
  action text not null,
  note text null,
  created_at timestamptz not null default now(),
  constraint media_moderation_events_action_check
    check (action in ('submitted', 'approved', 'rejected', 'featured', 'unfeatured', 'rights_confirmed'))
);

create index if not exists media_moderation_events_asset_idx
  on public.media_moderation_events (asset_id, created_at desc);

alter table public.media_moderation_events enable row level security;

drop policy if exists "media_moderation_events_select_own_or_admin" on public.media_moderation_events;
create policy "media_moderation_events_select_own_or_admin"
  on public.media_moderation_events for select to authenticated
  using (
    public.pd24_is_app_admin()
    or exists (
      select 1
      from public.media_assets ma
      where ma.id = asset_id
        and (
          ma.owner_user_id = auth.uid()
          or (ma.partner_profile_id is not null and public.pd24_is_partner_member(ma.partner_profile_id))
        )
    )
  );

drop policy if exists "media_moderation_events_insert_admin" on public.media_moderation_events;
create policy "media_moderation_events_insert_admin"
  on public.media_moderation_events for insert to authenticated
  with check (public.pd24_is_app_admin());

create table if not exists public.media_reports (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  reported_by_user_id uuid null references auth.users (id) on delete set null,
  reason text not null,
  note text null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_reports_reason_check
    check (reason in ('copyright', 'irrelevant', 'offensive', 'duplicate', 'privacy', 'other')),
  constraint media_reports_status_check
    check (status in ('open', 'reviewing', 'resolved', 'dismissed'))
);

drop trigger if exists media_reports_set_updated_at on public.media_reports;
create trigger media_reports_set_updated_at
before update on public.media_reports
for each row
execute function public.pd24_set_updated_at();

create index if not exists media_reports_asset_idx
  on public.media_reports (asset_id, status, created_at desc);

alter table public.media_reports enable row level security;

drop policy if exists "media_reports_select_admin" on public.media_reports;
create policy "media_reports_select_admin"
  on public.media_reports for select to authenticated
  using (public.pd24_is_app_admin());

drop policy if exists "media_reports_insert_authenticated" on public.media_reports;
create policy "media_reports_insert_authenticated"
  on public.media_reports for insert to authenticated
  with check (reported_by_user_id = auth.uid() or reported_by_user_id is null);

drop policy if exists "media_reports_update_admin" on public.media_reports;
create policy "media_reports_update_admin"
  on public.media_reports for update to authenticated
  using (public.pd24_is_app_admin())
  with check (public.pd24_is_app_admin());

create table if not exists public.media_reactions (
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reaction text not null default 'like',
  created_at timestamptz not null default now(),
  constraint media_reactions_reaction_check
    check (reaction in ('like')),
  primary key (asset_id, user_id, reaction)
);

create index if not exists media_reactions_user_idx
  on public.media_reactions (user_id, created_at desc);

alter table public.media_reactions enable row level security;

drop policy if exists "media_reactions_select_public" on public.media_reactions;
create policy "media_reactions_select_public"
  on public.media_reactions for select to anon, authenticated
  using (true);

drop policy if exists "media_reactions_insert_own" on public.media_reactions;
create policy "media_reactions_insert_own"
  on public.media_reactions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "media_reactions_delete_own" on public.media_reactions;
create policy "media_reactions_delete_own"
  on public.media_reactions for delete to authenticated
  using (user_id = auth.uid());

commit;

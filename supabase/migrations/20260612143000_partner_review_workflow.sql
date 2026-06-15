alter table public.partner_profiles
  add column if not exists review_status text not null default 'draft',
  add column if not exists review_notes text,
  add column if not exists review_submitted_at timestamptz,
  add column if not exists review_reviewed_at timestamptz,
  add column if not exists published_at timestamptz;

alter table public.partner_profiles
  drop constraint if exists partner_profiles_review_status_check;

alter table public.partner_profiles
  add constraint partner_profiles_review_status_check
  check (review_status in ('draft', 'submitted', 'in_review', 'changes_requested', 'approved', 'published'));

alter table public.service_providers
  add column if not exists review_status text not null default 'draft',
  add column if not exists review_notes text,
  add column if not exists review_submitted_at timestamptz,
  add column if not exists review_reviewed_at timestamptz,
  add column if not exists published_at timestamptz;

alter table public.service_providers
  drop constraint if exists service_providers_review_status_check;

alter table public.service_providers
  add constraint service_providers_review_status_check
  check (review_status in ('draft', 'submitted', 'in_review', 'changes_requested', 'approved', 'published'));

alter table public.partner_campaigns
  add column if not exists review_status text not null default 'draft',
  add column if not exists review_notes text,
  add column if not exists review_submitted_at timestamptz,
  add column if not exists review_reviewed_at timestamptz,
  add column if not exists published_at timestamptz;

alter table public.partner_campaigns
  drop constraint if exists partner_campaigns_review_status_check;

alter table public.partner_campaigns
  add constraint partner_campaigns_review_status_check
  check (review_status in ('draft', 'submitted', 'in_review', 'changes_requested', 'approved', 'published'));

alter table public.affiliate_links
  add column if not exists review_status text not null default 'draft',
  add column if not exists review_notes text,
  add column if not exists review_submitted_at timestamptz,
  add column if not exists review_reviewed_at timestamptz,
  add column if not exists published_at timestamptz;

alter table public.affiliate_links
  drop constraint if exists affiliate_links_review_status_check;

alter table public.affiliate_links
  add constraint affiliate_links_review_status_check
  check (review_status in ('draft', 'submitted', 'in_review', 'changes_requested', 'approved', 'published'));

create index if not exists partner_profiles_review_status_idx
  on public.partner_profiles (review_status, updated_at desc);

create index if not exists service_providers_review_status_idx
  on public.service_providers (partner_profile_id, review_status, updated_at desc);

create index if not exists partner_campaigns_review_status_idx
  on public.partner_campaigns (partner_profile_id, review_status, updated_at desc);

create index if not exists affiliate_links_review_status_idx
  on public.affiliate_links (partner_profile_id, review_status, updated_at desc);

drop policy if exists "service_providers_select_partner_member" on public.service_providers;

create policy "service_providers_select_partner_member"
  on public.service_providers
  for select
  to authenticated
  using (
    partner_profile_id is not null
    and public.pd24_is_partner_member(partner_profile_id)
  );

drop policy if exists "provider_packages_select_partner_member" on public.provider_packages;

create policy "provider_packages_select_partner_member"
  on public.provider_packages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.service_providers sp
      where sp.id = provider_packages.provider_id
        and sp.partner_profile_id is not null
        and public.pd24_is_partner_member(sp.partner_profile_id)
    )
  );

update public.partner_profiles
set
  review_status = case
    when published_at is not null then 'published'
    when status = 'active' then 'published'
    else 'draft'
  end,
  published_at = case
    when published_at is not null then published_at
    when status = 'active' then coalesce(published_at, updated_at, created_at)
    else published_at
  end
where review_status = 'draft';

update public.service_providers
set
  review_status = case
    when published_at is not null then 'published'
    when status = 'active' then 'published'
    else 'draft'
  end,
  published_at = case
    when published_at is not null then published_at
    when status = 'active' then coalesce(published_at, updated_at, created_at)
    else published_at
  end
where review_status = 'draft';

update public.partner_campaigns
set
  review_status = case
    when published_at is not null then 'published'
    when status in ('scheduled', 'active', 'paused', 'completed') then 'published'
    else 'draft'
  end,
  published_at = case
    when published_at is not null then published_at
    when status in ('scheduled', 'active', 'paused', 'completed') then coalesce(published_at, updated_at, created_at)
    else published_at
  end
where review_status = 'draft';

update public.affiliate_links
set
  review_status = case
    when published_at is not null then 'published'
    when is_active then 'published'
    else 'draft'
  end,
  published_at = case
    when published_at is not null then published_at
    when is_active then coalesce(published_at, updated_at, created_at)
    else published_at
  end
where review_status = 'draft';

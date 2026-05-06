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

create table if not exists public.entitlement_catalog (
  entitlement_key text primary key,
  layer text not null default 'consumer',
  description text not null,
  default_state text not null default 'off',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entitlement_catalog_layer_check check (
    layer in ('consumer', 'creator', 'partner', 'strategic')
  ),
  constraint entitlement_catalog_default_state_check check (
    default_state in ('off', 'beta', 'active')
  )
);

drop trigger if exists entitlement_catalog_set_updated_at on public.entitlement_catalog;
create trigger entitlement_catalog_set_updated_at
before update on public.entitlement_catalog
for each row
execute function public.pd24_set_updated_at();

create table if not exists public.partner_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid null references auth.users (id) on delete set null,
  partner_type text not null default 'other',
  display_name text not null,
  slug text not null unique,
  legal_name text null,
  website_url text null,
  booking_url text null,
  contact_email text null,
  contact_phone text null,
  primary_city_slug text null references public.cities (slug) on delete set null,
  country_code text null,
  status text not null default 'draft',
  billing_status text not null default 'inactive',
  visibility_tier text not null default 'organic',
  is_self_service_enabled boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_profiles_partner_type_check check (
    partner_type in (
      'restaurant',
      'venue',
      'organizer',
      'ticketing',
      'experience',
      'tourism',
      'publisher',
      'brand',
      'creator_agency',
      'other'
    )
  ),
  constraint partner_profiles_status_check check (
    status in ('draft', 'active', 'paused', 'archived')
  ),
  constraint partner_profiles_billing_status_check check (
    billing_status in ('inactive', 'manual', 'trial', 'active', 'past_due', 'cancelled')
  ),
  constraint partner_profiles_visibility_tier_check check (
    visibility_tier in ('organic', 'featured', 'partner_basic', 'partner_pro', 'city_pro_plus', 'strategic')
  )
);

drop trigger if exists partner_profiles_set_updated_at on public.partner_profiles;
create trigger partner_profiles_set_updated_at
before update on public.partner_profiles
for each row
execute function public.pd24_set_updated_at();

create index if not exists partner_profiles_owner_idx
  on public.partner_profiles (owner_user_id, updated_at desc);

create index if not exists partner_profiles_city_status_idx
  on public.partner_profiles (primary_city_slug, status, updated_at desc);

create index if not exists partner_profiles_type_status_idx
  on public.partner_profiles (partner_type, status, updated_at desc);

create table if not exists public.partner_memberships (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null references public.partner_profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'viewer',
  status text not null default 'active',
  invited_by_user_id uuid null references auth.users (id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_memberships_partner_user_unique unique (partner_profile_id, user_id),
  constraint partner_memberships_role_check check (
    role in ('owner', 'admin', 'editor', 'analyst', 'viewer')
  ),
  constraint partner_memberships_status_check check (
    status in ('active', 'invited', 'disabled')
  )
);

drop trigger if exists partner_memberships_set_updated_at on public.partner_memberships;
create trigger partner_memberships_set_updated_at
before update on public.partner_memberships
for each row
execute function public.pd24_set_updated_at();

create index if not exists partner_memberships_partner_idx
  on public.partner_memberships (partner_profile_id, status, updated_at desc);

create index if not exists partner_memberships_user_idx
  on public.partner_memberships (user_id, status, updated_at desc);

create or replace function public.pd24_is_partner_member(target_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $pd24$
  select exists (
    select 1
    from public.partner_memberships pm
    where pm.partner_profile_id = target_partner_id
      and pm.user_id = auth.uid()
      and pm.status = 'active'
  );
$pd24$;

create or replace function public.pd24_is_partner_admin(target_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $pd24$
  select exists (
    select 1
    from public.partner_profiles pp
    where pp.id = target_partner_id
      and pp.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.partner_memberships pm
    where pm.partner_profile_id = target_partner_id
      and pm.user_id = auth.uid()
      and pm.status = 'active'
      and pm.role in ('owner', 'admin')
  );
$pd24$;

revoke all on function public.pd24_is_partner_member(uuid) from public;
revoke all on function public.pd24_is_partner_admin(uuid) from public;
grant execute on function public.pd24_is_partner_member(uuid) to anon, authenticated;
grant execute on function public.pd24_is_partner_admin(uuid) to anon, authenticated;

create or replace function public.pd24_sync_partner_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $pd24$
begin
  if new.owner_user_id is null then
    return new;
  end if;

  insert into public.partner_memberships (
    partner_profile_id,
    user_id,
    role,
    status,
    invited_by_user_id,
    meta
  )
  values (
    new.id,
    new.owner_user_id,
    'owner',
    'active',
    new.owner_user_id,
    jsonb_build_object('source', 'owner_sync')
  )
  on conflict (partner_profile_id, user_id) do update
  set
    role = 'owner',
    status = 'active',
    invited_by_user_id = excluded.invited_by_user_id,
    updated_at = now();

  return new;
end;
$pd24$;

drop trigger if exists partner_profiles_sync_owner_membership on public.partner_profiles;
create trigger partner_profiles_sync_owner_membership
after insert or update of owner_user_id on public.partner_profiles
for each row
execute function public.pd24_sync_partner_owner_membership();

create table if not exists public.partner_locations (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null references public.partner_profiles (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  relationship_type text not null default 'secondary',
  visibility_boost numeric(6,2) not null default 1,
  is_primary boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_locations_partner_location_unique unique (partner_profile_id, location_id),
  constraint partner_locations_relationship_type_check check (
    relationship_type in ('primary', 'secondary', 'campaign_only', 'inventory')
  )
);

drop trigger if exists partner_locations_set_updated_at on public.partner_locations;
create trigger partner_locations_set_updated_at
before update on public.partner_locations
for each row
execute function public.pd24_set_updated_at();

create index if not exists partner_locations_partner_idx
  on public.partner_locations (partner_profile_id, is_primary desc, updated_at desc);

create index if not exists partner_locations_location_idx
  on public.partner_locations (location_id, updated_at desc);

create table if not exists public.partner_products (
  id uuid primary key default gen_random_uuid(),
  product_key text not null unique,
  display_name text not null,
  revenue_layer text not null,
  horizon text not null,
  billing_model text not null,
  target_type text not null,
  linked_entitlement_key text null references public.entitlement_catalog (entitlement_key) on delete set null,
  status text not null default 'draft',
  price_anchor_min numeric(10,2) null,
  price_anchor_max numeric(10,2) null,
  currency text null default 'EUR',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_products_revenue_layer_check check (
    revenue_layer in ('transaction', 'visibility', 'recurring', 'consumer', 'strategic')
  ),
  constraint partner_products_horizon_check check (
    horizon in ('short_term', 'medium_term', 'later', 'long_term')
  ),
  constraint partner_products_billing_model_check check (
    billing_model in (
      'cpa',
      'cps',
      'cpl',
      'cpc',
      'fixed_monthly',
      'fixed_weekly',
      'campaign',
      'license',
      'hybrid',
      'entitlement'
    )
  ),
  constraint partner_products_target_type_check check (
    target_type in (
      'event',
      'experience',
      'restaurant',
      'tourism',
      'venue',
      'creator',
      'brand',
      'city',
      'publisher',
      'consumer',
      'partner',
      'other'
    )
  ),
  constraint partner_products_status_check check (
    status in ('draft', 'active', 'retired')
  )
);

drop trigger if exists partner_products_set_updated_at on public.partner_products;
create trigger partner_products_set_updated_at
before update on public.partner_products
for each row
execute function public.pd24_set_updated_at();

create index if not exists partner_products_layer_horizon_idx
  on public.partner_products (revenue_layer, horizon, status);

create table if not exists public.partner_campaigns (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null references public.partner_profiles (id) on delete cascade,
  product_id uuid null references public.partner_products (id) on delete set null,
  name text not null,
  campaign_type text not null,
  status text not null default 'draft',
  city_slug text null references public.cities (slug) on delete set null,
  target_route_id uuid null references public.user_routes (id) on delete set null,
  target_location_id uuid null references public.locations (id) on delete set null,
  target_event_id uuid null references public.planner_events (id) on delete set null,
  target_creator_profile_id uuid null references public.creator_profiles (id) on delete set null,
  starts_at timestamptz null,
  ends_at timestamptz null,
  budget_amount numeric(12,2) null,
  budget_currency text null default 'EUR',
  bid_amount numeric(12,2) null,
  cta_label text null,
  cta_url text null,
  creative_meta jsonb not null default '{}'::jsonb,
  targeting jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_campaigns_campaign_type_check check (
    campaign_type in (
      'featured_event',
      'featured_location',
      'sponsored_placement',
      'city_spotlight',
      'creator_distribution',
      'white_label',
      'insights'
    )
  ),
  constraint partner_campaigns_status_check check (
    status in ('draft', 'scheduled', 'active', 'paused', 'completed', 'archived')
  )
);

drop trigger if exists partner_campaigns_set_updated_at on public.partner_campaigns;
create trigger partner_campaigns_set_updated_at
before update on public.partner_campaigns
for each row
execute function public.pd24_set_updated_at();

create index if not exists partner_campaigns_partner_status_idx
  on public.partner_campaigns (partner_profile_id, status, updated_at desc);

create index if not exists partner_campaigns_city_status_idx
  on public.partner_campaigns (city_slug, status, starts_at);

create table if not exists public.sponsored_slots (
  id uuid primary key default gen_random_uuid(),
  slot_key text not null unique,
  surface text not null,
  slot_type text not null,
  city_slug text null references public.cities (slug) on delete set null,
  max_positions integer not null default 1,
  ranking_mode text not null default 'separate',
  disclosure_label text not null default 'Featured',
  status text not null default 'inactive',
  requires_relevance_match boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sponsored_slots_surface_check check (
    surface in (
      'planner',
      'explore',
      'route_detail',
      'location_detail',
      'event_detail',
      'shared_plan',
      'creator_profile',
      'city_spotlight'
    )
  ),
  constraint sponsored_slots_slot_type_check check (
    slot_type in (
      'featured_event',
      'featured_location',
      'sponsored_placement',
      'city_spotlight',
      'creator_distribution'
    )
  ),
  constraint sponsored_slots_ranking_mode_check check (
    ranking_mode in ('separate', 'blended', 'manual')
  ),
  constraint sponsored_slots_status_check check (
    status in ('draft', 'active', 'inactive', 'archived')
  ),
  constraint sponsored_slots_max_positions_check check (max_positions > 0)
);

drop trigger if exists sponsored_slots_set_updated_at on public.sponsored_slots;
create trigger sponsored_slots_set_updated_at
before update on public.sponsored_slots
for each row
execute function public.pd24_set_updated_at();

create index if not exists sponsored_slots_surface_city_status_idx
  on public.sponsored_slots (surface, city_slug, status);

create table if not exists public.partner_slot_assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.partner_campaigns (id) on delete cascade,
  slot_id uuid not null references public.sponsored_slots (id) on delete cascade,
  priority integer not null default 100,
  weight numeric(10,2) not null default 1,
  starts_at timestamptz null,
  ends_at timestamptz null,
  status text not null default 'draft',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_slot_assignments_campaign_slot_unique unique (campaign_id, slot_id),
  constraint partner_slot_assignments_status_check check (
    status in ('draft', 'scheduled', 'active', 'paused', 'completed', 'archived')
  )
);

drop trigger if exists partner_slot_assignments_set_updated_at on public.partner_slot_assignments;
create trigger partner_slot_assignments_set_updated_at
before update on public.partner_slot_assignments
for each row
execute function public.pd24_set_updated_at();

create index if not exists partner_slot_assignments_slot_status_idx
  on public.partner_slot_assignments (slot_id, status, starts_at);

create table if not exists public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid null references public.partner_profiles (id) on delete set null,
  product_id uuid null references public.partner_products (id) on delete set null,
  location_id uuid null references public.locations (id) on delete set null,
  planner_event_id uuid null references public.planner_events (id) on delete set null,
  route_id uuid null references public.user_routes (id) on delete set null,
  link_scope text not null default 'global',
  provider_name text not null,
  destination_url text not null,
  deep_link_url text null,
  tracking_template text null,
  program_code text null,
  commission_model text not null default 'cps',
  is_active boolean not null default false,
  priority integer not null default 100,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_links_link_scope_check check (
    link_scope in ('global', 'location', 'event', 'route', 'shared_plan')
  ),
  constraint affiliate_links_commission_model_check check (
    commission_model in ('cpa', 'cps', 'cpl', 'hybrid')
  )
);

drop trigger if exists affiliate_links_set_updated_at on public.affiliate_links;
create trigger affiliate_links_set_updated_at
before update on public.affiliate_links
for each row
execute function public.pd24_set_updated_at();

create index if not exists affiliate_links_event_active_idx
  on public.affiliate_links (planner_event_id, is_active, priority);

create index if not exists affiliate_links_location_active_idx
  on public.affiliate_links (location_id, is_active, priority);

create index if not exists affiliate_links_route_active_idx
  on public.affiliate_links (route_id, is_active, priority);

create table if not exists public.attribution_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users (id) on delete set null,
  anonymous_id text null,
  session_id text null,
  plan_id uuid null references public.plans (id) on delete set null,
  route_id uuid null references public.user_routes (id) on delete set null,
  location_id uuid null references public.locations (id) on delete set null,
  planner_event_id uuid null references public.planner_events (id) on delete set null,
  partner_profile_id uuid null references public.partner_profiles (id) on delete set null,
  campaign_id uuid null references public.partner_campaigns (id) on delete set null,
  slot_id uuid null references public.sponsored_slots (id) on delete set null,
  affiliate_link_id uuid null references public.affiliate_links (id) on delete set null,
  creator_profile_id uuid null references public.creator_profiles (id) on delete set null,
  entitlement_key text null references public.entitlement_catalog (entitlement_key) on delete set null,
  city_slug text null references public.cities (slug) on delete set null,
  surface text null,
  event_type text not null,
  revenue_cents integer null,
  currency text null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint attribution_events_event_type_check check (
    event_type in (
      'impression',
      'click',
      'redirect',
      'lead',
      'conversion',
      'plan_intent',
      'plan_save',
      'share_activation',
      'group_confirmation',
      'route_copy',
      'route_view',
      'route_publish',
      'creator_follow'
    )
  ),
  constraint attribution_events_revenue_cents_check check (
    revenue_cents is null or revenue_cents >= 0
  )
);

create index if not exists attribution_events_user_time_idx
  on public.attribution_events (user_id, occurred_at desc);

create index if not exists attribution_events_city_event_time_idx
  on public.attribution_events (city_slug, event_type, occurred_at desc);

create index if not exists attribution_events_partner_time_idx
  on public.attribution_events (partner_profile_id, occurred_at desc);

create index if not exists attribution_events_campaign_time_idx
  on public.attribution_events (campaign_id, occurred_at desc);

create table if not exists public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entitlement_key text not null references public.entitlement_catalog (entitlement_key) on delete cascade,
  source text not null default 'system',
  status text not null default 'inactive',
  starts_at timestamptz not null default now(),
  ends_at timestamptz null,
  granted_by_user_id uuid null references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_entitlements_source_check check (
    source in ('subscription', 'promo', 'referral', 'manual', 'partner', 'system', 'campaign')
  ),
  constraint user_entitlements_status_check check (
    status in ('active', 'inactive', 'expired', 'trial', 'revoked')
  )
);

drop trigger if exists user_entitlements_set_updated_at on public.user_entitlements;
create trigger user_entitlements_set_updated_at
before update on public.user_entitlements
for each row
execute function public.pd24_set_updated_at();

create index if not exists user_entitlements_user_status_idx
  on public.user_entitlements (user_id, status, entitlement_key, starts_at desc);

create table if not exists public.creator_reward_events (
  id uuid primary key default gen_random_uuid(),
  creator_profile_id uuid not null references public.creator_profiles (id) on delete cascade,
  route_id uuid null references public.user_routes (id) on delete set null,
  partner_profile_id uuid null references public.partner_profiles (id) on delete set null,
  campaign_id uuid null references public.partner_campaigns (id) on delete set null,
  city_slug text null references public.cities (slug) on delete set null,
  reward_type text not null,
  source_type text not null,
  source_id text null,
  reward_value numeric(10,2) not null default 0,
  reward_unit text not null default 'credit',
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_reward_events_reward_type_check check (
    reward_type in (
      'distribution_credit',
      'campaign_credit',
      'boost_credit',
      'featured_slot',
      'cash_pending',
      'cash_paid',
      'performance_bonus',
      'referral_bonus'
    )
  ),
  constraint creator_reward_events_source_type_check check (
    source_type in (
      'route_copy',
      'share_activation',
      'plan_activation',
      'affiliate_conversion',
      'partner_campaign',
      'editor_pick',
      'manual'
    )
  ),
  constraint creator_reward_events_reward_unit_check check (
    reward_unit in ('eur', 'credit', 'boost_day', 'featured_slot', 'points')
  ),
  constraint creator_reward_events_status_check check (
    status in ('pending', 'approved', 'paid', 'cancelled')
  )
);

drop trigger if exists creator_reward_events_set_updated_at on public.creator_reward_events;
create trigger creator_reward_events_set_updated_at
before update on public.creator_reward_events
for each row
execute function public.pd24_set_updated_at();

create index if not exists creator_reward_events_creator_status_idx
  on public.creator_reward_events (creator_profile_id, status, created_at desc);

create index if not exists creator_reward_events_city_source_idx
  on public.creator_reward_events (city_slug, source_type, created_at desc);

create table if not exists public.partner_insight_snapshots (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null references public.partner_profiles (id) on delete cascade,
  city_slug text null references public.cities (slug) on delete set null,
  snapshot_type text not null,
  period_start date null,
  period_end date null,
  visibility text not null default 'internal',
  payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint partner_insight_snapshots_type_check check (
    snapshot_type in (
      'campaign_summary',
      'city_demand',
      'content_distribution',
      'conversion_funnel',
      'partner_rollup',
      'custom_export'
    )
  ),
  constraint partner_insight_snapshots_visibility_check check (
    visibility in ('internal', 'partner', 'external')
  )
);

create index if not exists partner_insight_snapshots_partner_period_idx
  on public.partner_insight_snapshots (partner_profile_id, period_start desc, period_end desc);

create table if not exists public.tenant_licenses (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid null references public.partner_profiles (id) on delete set null,
  tenant_name text not null,
  slug text not null unique,
  license_type text not null,
  status text not null default 'draft',
  city_slug text null references public.cities (slug) on delete set null,
  starts_at timestamptz null,
  ends_at timestamptz null,
  billing_interval text null,
  annual_fee numeric(12,2) null,
  currency text null default 'EUR',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_licenses_license_type_check check (
    license_type in ('white_label_city_guide', 'media_widget', 'co_branding', 'api', 'insights')
  ),
  constraint tenant_licenses_status_check check (
    status in ('draft', 'active', 'paused', 'expired', 'archived')
  ),
  constraint tenant_licenses_billing_interval_check check (
    billing_interval is null or billing_interval in ('monthly', 'quarterly', 'annual', 'custom')
  )
);

drop trigger if exists tenant_licenses_set_updated_at on public.tenant_licenses;
create trigger tenant_licenses_set_updated_at
before update on public.tenant_licenses
for each row
execute function public.pd24_set_updated_at();

create index if not exists tenant_licenses_partner_status_idx
  on public.tenant_licenses (partner_profile_id, status, updated_at desc);

create index if not exists tenant_licenses_city_status_idx
  on public.tenant_licenses (city_slug, status, updated_at desc);

alter table public.entitlement_catalog enable row level security;
alter table public.partner_profiles enable row level security;
alter table public.partner_memberships enable row level security;
alter table public.partner_locations enable row level security;
alter table public.partner_products enable row level security;
alter table public.partner_campaigns enable row level security;
alter table public.sponsored_slots enable row level security;
alter table public.partner_slot_assignments enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.attribution_events enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.creator_reward_events enable row level security;
alter table public.partner_insight_snapshots enable row level security;
alter table public.tenant_licenses enable row level security;

drop policy if exists entitlement_catalog_select_public on public.entitlement_catalog;
create policy entitlement_catalog_select_public
on public.entitlement_catalog
for select
to anon, authenticated
using (true);

drop policy if exists partner_products_select_public on public.partner_products;
create policy partner_products_select_public
on public.partner_products
for select
to anon, authenticated
using (true);

drop policy if exists sponsored_slots_select_public on public.sponsored_slots;
create policy sponsored_slots_select_public
on public.sponsored_slots
for select
to anon, authenticated
using (true);

drop policy if exists partner_profiles_select_active_or_member on public.partner_profiles;
create policy partner_profiles_select_active_or_member
on public.partner_profiles
for select
to anon, authenticated
using (
  status in ('active', 'paused')
  or owner_user_id = auth.uid()
  or public.pd24_is_partner_member(id)
);

drop policy if exists partner_profiles_insert_own on public.partner_profiles;
create policy partner_profiles_insert_own
on public.partner_profiles
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists partner_profiles_update_admin on public.partner_profiles;
create policy partner_profiles_update_admin
on public.partner_profiles
for update
to authenticated
using (
  owner_user_id = auth.uid()
  or public.pd24_is_partner_admin(id)
)
with check (
  owner_user_id = auth.uid()
  or public.pd24_is_partner_admin(id)
);

drop policy if exists partner_profiles_delete_admin on public.partner_profiles;
create policy partner_profiles_delete_admin
on public.partner_profiles
for delete
to authenticated
using (
  owner_user_id = auth.uid()
  or public.pd24_is_partner_admin(id)
);

drop policy if exists partner_memberships_select_own_or_admin on public.partner_memberships;
create policy partner_memberships_select_own_or_admin
on public.partner_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.pd24_is_partner_admin(partner_profile_id)
);

drop policy if exists partner_memberships_insert_admin on public.partner_memberships;
create policy partner_memberships_insert_admin
on public.partner_memberships
for insert
to authenticated
with check (public.pd24_is_partner_admin(partner_profile_id));

drop policy if exists partner_memberships_update_admin on public.partner_memberships;
create policy partner_memberships_update_admin
on public.partner_memberships
for update
to authenticated
using (public.pd24_is_partner_admin(partner_profile_id))
with check (public.pd24_is_partner_admin(partner_profile_id));

drop policy if exists partner_memberships_delete_admin on public.partner_memberships;
create policy partner_memberships_delete_admin
on public.partner_memberships
for delete
to authenticated
using (public.pd24_is_partner_admin(partner_profile_id));

drop policy if exists partner_locations_select_active_or_member on public.partner_locations;
create policy partner_locations_select_active_or_member
on public.partner_locations
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.partner_profiles pp
    where pp.id = partner_profile_id
      and pp.status in ('active', 'paused')
  )
  or public.pd24_is_partner_member(partner_profile_id)
);

drop policy if exists partner_locations_insert_admin on public.partner_locations;
create policy partner_locations_insert_admin
on public.partner_locations
for insert
to authenticated
with check (public.pd24_is_partner_admin(partner_profile_id));

drop policy if exists partner_locations_update_admin on public.partner_locations;
create policy partner_locations_update_admin
on public.partner_locations
for update
to authenticated
using (public.pd24_is_partner_admin(partner_profile_id))
with check (public.pd24_is_partner_admin(partner_profile_id));

drop policy if exists partner_locations_delete_admin on public.partner_locations;
create policy partner_locations_delete_admin
on public.partner_locations
for delete
to authenticated
using (public.pd24_is_partner_admin(partner_profile_id));

drop policy if exists partner_campaigns_select_active_or_member on public.partner_campaigns;
create policy partner_campaigns_select_active_or_member
on public.partner_campaigns
for select
to anon, authenticated
using (
  status in ('scheduled', 'active')
  or public.pd24_is_partner_member(partner_profile_id)
);

drop policy if exists partner_campaigns_insert_admin on public.partner_campaigns;
create policy partner_campaigns_insert_admin
on public.partner_campaigns
for insert
to authenticated
with check (public.pd24_is_partner_admin(partner_profile_id));

drop policy if exists partner_campaigns_update_admin on public.partner_campaigns;
create policy partner_campaigns_update_admin
on public.partner_campaigns
for update
to authenticated
using (public.pd24_is_partner_admin(partner_profile_id))
with check (public.pd24_is_partner_admin(partner_profile_id));

drop policy if exists partner_campaigns_delete_admin on public.partner_campaigns;
create policy partner_campaigns_delete_admin
on public.partner_campaigns
for delete
to authenticated
using (public.pd24_is_partner_admin(partner_profile_id));

drop policy if exists partner_slot_assignments_select_active_or_member on public.partner_slot_assignments;
create policy partner_slot_assignments_select_active_or_member
on public.partner_slot_assignments
for select
to anon, authenticated
using (
  status in ('scheduled', 'active')
  or exists (
    select 1
    from public.partner_campaigns pc
    where pc.id = campaign_id
      and public.pd24_is_partner_member(pc.partner_profile_id)
  )
);

drop policy if exists partner_slot_assignments_insert_admin on public.partner_slot_assignments;
create policy partner_slot_assignments_insert_admin
on public.partner_slot_assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.partner_campaigns pc
    where pc.id = campaign_id
      and public.pd24_is_partner_admin(pc.partner_profile_id)
  )
);

drop policy if exists partner_slot_assignments_update_admin on public.partner_slot_assignments;
create policy partner_slot_assignments_update_admin
on public.partner_slot_assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.partner_campaigns pc
    where pc.id = campaign_id
      and public.pd24_is_partner_admin(pc.partner_profile_id)
  )
)
with check (
  exists (
    select 1
    from public.partner_campaigns pc
    where pc.id = campaign_id
      and public.pd24_is_partner_admin(pc.partner_profile_id)
  )
);

drop policy if exists partner_slot_assignments_delete_admin on public.partner_slot_assignments;
create policy partner_slot_assignments_delete_admin
on public.partner_slot_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.partner_campaigns pc
    where pc.id = campaign_id
      and public.pd24_is_partner_admin(pc.partner_profile_id)
  )
);

drop policy if exists affiliate_links_select_active_or_member on public.affiliate_links;
create policy affiliate_links_select_active_or_member
on public.affiliate_links
for select
to anon, authenticated
using (
  is_active = true
  or (partner_profile_id is not null and public.pd24_is_partner_member(partner_profile_id))
);

drop policy if exists affiliate_links_insert_admin on public.affiliate_links;
create policy affiliate_links_insert_admin
on public.affiliate_links
for insert
to authenticated
with check (
  partner_profile_id is null
  or public.pd24_is_partner_admin(partner_profile_id)
);

drop policy if exists affiliate_links_update_admin on public.affiliate_links;
create policy affiliate_links_update_admin
on public.affiliate_links
for update
to authenticated
using (
  partner_profile_id is null
  or public.pd24_is_partner_admin(partner_profile_id)
)
with check (
  partner_profile_id is null
  or public.pd24_is_partner_admin(partner_profile_id)
);

drop policy if exists affiliate_links_delete_admin on public.affiliate_links;
create policy affiliate_links_delete_admin
on public.affiliate_links
for delete
to authenticated
using (
  partner_profile_id is null
  or public.pd24_is_partner_admin(partner_profile_id)
);

drop policy if exists attribution_events_select_own on public.attribution_events;
create policy attribution_events_select_own
on public.attribution_events
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists attribution_events_insert_session on public.attribution_events;
create policy attribution_events_insert_session
on public.attribution_events
for insert
to anon, authenticated
with check (user_id is null or user_id = auth.uid());

drop policy if exists user_entitlements_select_own on public.user_entitlements;
create policy user_entitlements_select_own
on public.user_entitlements
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists creator_reward_events_select_own_creator on public.creator_reward_events;
create policy creator_reward_events_select_own_creator
on public.creator_reward_events
for select
to authenticated
using (
  exists (
    select 1
    from public.creator_profiles cp
    where cp.id = creator_profile_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists partner_insight_snapshots_select_member on public.partner_insight_snapshots;
create policy partner_insight_snapshots_select_member
on public.partner_insight_snapshots
for select
to authenticated
using (public.pd24_is_partner_member(partner_profile_id));

drop policy if exists partner_insight_snapshots_insert_admin on public.partner_insight_snapshots;
create policy partner_insight_snapshots_insert_admin
on public.partner_insight_snapshots
for insert
to authenticated
with check (public.pd24_is_partner_admin(partner_profile_id));

drop policy if exists partner_insight_snapshots_update_admin on public.partner_insight_snapshots;
create policy partner_insight_snapshots_update_admin
on public.partner_insight_snapshots
for update
to authenticated
using (public.pd24_is_partner_admin(partner_profile_id))
with check (public.pd24_is_partner_admin(partner_profile_id));

drop policy if exists partner_insight_snapshots_delete_admin on public.partner_insight_snapshots;
create policy partner_insight_snapshots_delete_admin
on public.partner_insight_snapshots
for delete
to authenticated
using (public.pd24_is_partner_admin(partner_profile_id));

drop policy if exists tenant_licenses_select_member on public.tenant_licenses;
create policy tenant_licenses_select_member
on public.tenant_licenses
for select
to authenticated
using (
  partner_profile_id is not null
  and public.pd24_is_partner_member(partner_profile_id)
);

drop policy if exists tenant_licenses_insert_admin on public.tenant_licenses;
create policy tenant_licenses_insert_admin
on public.tenant_licenses
for insert
to authenticated
with check (
  partner_profile_id is null
  or public.pd24_is_partner_admin(partner_profile_id)
);

drop policy if exists tenant_licenses_update_admin on public.tenant_licenses;
create policy tenant_licenses_update_admin
on public.tenant_licenses
for update
to authenticated
using (
  partner_profile_id is null
  or public.pd24_is_partner_admin(partner_profile_id)
)
with check (
  partner_profile_id is null
  or public.pd24_is_partner_admin(partner_profile_id)
);

drop policy if exists tenant_licenses_delete_admin on public.tenant_licenses;
create policy tenant_licenses_delete_admin
on public.tenant_licenses
for delete
to authenticated
using (
  partner_profile_id is null
  or public.pd24_is_partner_admin(partner_profile_id)
);

insert into public.entitlement_catalog (
  entitlement_key,
  layer,
  description,
  default_state,
  meta
) values
  ('unlimited_saved_plans', 'consumer', 'Spaeteres Power-User-Upgrade fuer unbegrenzte Plan-Speicherung.', 'off', jsonb_build_object('phase', 'later')),
  ('advanced_group_collab', 'consumer', 'Erweiterte Gruppenfunktionen und Kollaboration fuer Power User.', 'off', jsonb_build_object('phase', 'later')),
  ('premium_plan_variants', 'consumer', 'Premium-Varianten und tiefere Plan-Versionierung.', 'off', jsonb_build_object('phase', 'later')),
  ('creator_distribution_tools', 'creator', 'Creator-Distribution und spaetere Reward-/Boost-Mechaniken.', 'off', jsonb_build_object('phase', 'medium_term')),
  ('creator_reward_pool', 'creator', 'Belohnungslogik fuer Creator-Performance und Partnerkampagnen.', 'off', jsonb_build_object('phase', 'medium_term')),
  ('partner_featured_visibility', 'partner', 'Featured-Sichtbarkeit fuer zahlende Partner in begrenzten Slots.', 'off', jsonb_build_object('phase', 'short_term')),
  ('partner_reporting', 'partner', 'Reporting und Kampagnen-Insights fuer Partnerpakete.', 'off', jsonb_build_object('phase', 'medium_term')),
  ('white_label_access', 'strategic', 'White-Label- und Co-Branding-Zugaenge fuer spaetere Lizenzmodelle.', 'off', jsonb_build_object('phase', 'long_term')),
  ('insights_exports', 'strategic', 'Aggregierte Insight-Exporte fuer spaetere Strategic Revenue Produkte.', 'off', jsonb_build_object('phase', 'long_term'))
on conflict (entitlement_key) do update
set
  layer = excluded.layer,
  description = excluded.description,
  default_state = excluded.default_state,
  meta = excluded.meta,
  updated_at = now();

insert into public.partner_products (
  product_key,
  display_name,
  revenue_layer,
  horizon,
  billing_model,
  target_type,
  linked_entitlement_key,
  status,
  price_anchor_min,
  price_anchor_max,
  currency,
  config
) values
  ('affiliate_events', 'Affiliate Events', 'transaction', 'short_term', 'cps', 'event', null, 'draft', 0, 0, 'EUR', jsonb_build_object('notes', 'Tickets und Veranstalter')),
  ('affiliate_experiences', 'Affiliate Experiences', 'transaction', 'short_term', 'cps', 'experience', null, 'draft', 0, 0, 'EUR', jsonb_build_object('notes', 'Booking- und Experience-Partner')),
  ('affiliate_restaurants', 'Affiliate Restaurants', 'transaction', 'short_term', 'cpl', 'restaurant', null, 'draft', 0, 0, 'EUR', jsonb_build_object('notes', 'Reservierungs- und Lead-Partner')),
  ('affiliate_tourism', 'Affiliate Tourism', 'transaction', 'short_term', 'cps', 'tourism', null, 'draft', 0, 0, 'EUR', jsonb_build_object('notes', 'Touren und touristische Angebote')),
  ('featured_event', 'Featured Event', 'visibility', 'short_term', 'fixed_weekly', 'event', 'partner_featured_visibility', 'draft', 49, 249, 'EUR', jsonb_build_object('notes', 'Begrenzte Event-Sichtbarkeit pro Stadt und Woche')),
  ('featured_location', 'Featured Location', 'visibility', 'short_term', 'fixed_monthly', 'venue', 'partner_featured_visibility', 'draft', 99, 399, 'EUR', jsonb_build_object('notes', 'Featured Visibility fuer Restaurants und Venues')),
  ('sponsored_placement', 'Sponsored Placement', 'visibility', 'short_term', 'hybrid', 'partner', 'partner_featured_visibility', 'draft', 0, 0, 'EUR', jsonb_build_object('notes', 'CPC plus Mindestbudget in klar markierten Slots')),
  ('city_spotlight', 'City Spotlight', 'visibility', 'short_term', 'campaign', 'city', null, 'draft', 1500, 10000, 'EUR', jsonb_build_object('notes', 'Saisonale oder kuratierte Themenflaechen')),
  ('partner_basic', 'Partner Basic', 'recurring', 'medium_term', 'fixed_monthly', 'partner', 'partner_reporting', 'draft', 79, 149, 'EUR', jsonb_build_object('notes', 'Profil, CTA, Basis-Insights')),
  ('partner_pro', 'Partner Pro', 'recurring', 'medium_term', 'fixed_monthly', 'partner', 'partner_reporting', 'draft', 249, 499, 'EUR', jsonb_build_object('notes', 'Sichtbarkeit, Kampagnen, Reporting')),
  ('city_pro_plus', 'City Pro+', 'recurring', 'medium_term', 'fixed_monthly', 'partner', 'partner_reporting', 'draft', 750, 2500, 'EUR', jsonb_build_object('notes', 'Mehrere Standorte und saisonale Pushes')),
  ('creator_brand_route_distribution', 'Creator / Brand Route Distribution', 'recurring', 'medium_term', 'campaign', 'creator', 'creator_distribution_tools', 'draft', 0, 0, 'EUR', jsonb_build_object('notes', 'Monetisierte Distribution fuer Creator- und Brand-Routen')),
  ('b2c_premium', 'B2C Premium', 'consumer', 'later', 'entitlement', 'consumer', 'premium_plan_variants', 'draft', 0, 0, 'EUR', jsonb_build_object('notes', 'Selektives Power-User-Upgrade, kein frueher Kern-Paywall')),
  ('white_label_city_guide', 'White-Label City Guide', 'strategic', 'long_term', 'license', 'city', 'white_label_access', 'draft', 15000, 60000, 'EUR', jsonb_build_object('notes', 'Lizenzmodell fuer Staedte und Tourismus')),
  ('media_widget', 'Media Widget / Co-Branding', 'strategic', 'long_term', 'fixed_monthly', 'publisher', 'white_label_access', 'draft', 1000, 5000, 'EUR', jsonb_build_object('notes', 'Medien-Distribution und Co-Branding')),
  ('demand_insights', 'Demand Insights', 'strategic', 'long_term', 'license', 'partner', 'insights_exports', 'draft', 5000, 25000, 'EUR', jsonb_build_object('notes', 'Aggregierte Nachfrage-Insights'))
on conflict (product_key) do update
set
  display_name = excluded.display_name,
  revenue_layer = excluded.revenue_layer,
  horizon = excluded.horizon,
  billing_model = excluded.billing_model,
  target_type = excluded.target_type,
  linked_entitlement_key = excluded.linked_entitlement_key,
  status = excluded.status,
  price_anchor_min = excluded.price_anchor_min,
  price_anchor_max = excluded.price_anchor_max,
  currency = excluded.currency,
  config = excluded.config,
  updated_at = now();

insert into public.sponsored_slots (
  slot_key,
  surface,
  slot_type,
  city_slug,
  max_positions,
  ranking_mode,
  disclosure_label,
  status,
  requires_relevance_match,
  meta
) values
  ('planner_featured_event_module', 'planner', 'featured_event', null, 1, 'separate', 'Featured', 'inactive', true, jsonb_build_object('notes', 'Ein klar markierter Event-Slot in kaufnahen Planner-Momenten')),
  ('planner_featured_location_module', 'planner', 'featured_location', null, 1, 'separate', 'Featured', 'inactive', true, jsonb_build_object('notes', 'Ein klar markierter Location-Slot im Planner')),
  ('explore_featured_events_strip', 'explore', 'featured_event', null, 3, 'separate', 'Featured', 'inactive', true, jsonb_build_object('notes', 'Featured Event Strip auf Explore-Flaechen')),
  ('explore_featured_locations_strip', 'explore', 'featured_location', null, 3, 'separate', 'Featured', 'inactive', true, jsonb_build_object('notes', 'Featured Location Strip auf Explore-Flaechen')),
  ('route_detail_brand_distribution', 'route_detail', 'creator_distribution', null, 1, 'manual', 'Partner Route', 'inactive', true, jsonb_build_object('notes', 'Distribution fuer Brand- oder Creator-Routen')),
  ('location_detail_partner_spotlight', 'location_detail', 'featured_location', null, 1, 'separate', 'Partner Highlight', 'inactive', true, jsonb_build_object('notes', 'Partner-Sichtbarkeit auf Location-Details')),
  ('event_detail_partner_spotlight', 'event_detail', 'featured_event', null, 1, 'separate', 'Partner Highlight', 'inactive', true, jsonb_build_object('notes', 'Partner-Sichtbarkeit auf Event-Details')),
  ('shared_plan_partner_cta', 'shared_plan', 'sponsored_placement', null, 1, 'manual', 'Empfohlen', 'inactive', true, jsonb_build_object('notes', 'Kontextnaher CTA-Slot auf Share-Seiten')),
  ('creator_profile_featured_routes', 'creator_profile', 'creator_distribution', null, 2, 'separate', 'Featured', 'inactive', true, jsonb_build_object('notes', 'Featured Distribution auf Creator-Profilen')),
  ('city_spotlight_seasonal', 'city_spotlight', 'city_spotlight', null, 1, 'manual', 'Spotlight', 'inactive', true, jsonb_build_object('notes', 'Saisonale Themen- oder Stadt-Spotlights'))
on conflict (slot_key) do update
set
  surface = excluded.surface,
  slot_type = excluded.slot_type,
  city_slug = excluded.city_slug,
  max_positions = excluded.max_positions,
  ranking_mode = excluded.ranking_mode,
  disclosure_label = excluded.disclosure_label,
  status = excluded.status,
  requires_relevance_match = excluded.requires_relevance_match,
  meta = excluded.meta,
  updated_at = now();

comment on table public.partner_profiles is
  'Partner-Basis fuer Restaurants, Venues, Veranstalter, Publisher, Brands und spaetere Self-Service-Modelle.';

comment on table public.partner_products is
  'Neutraler Revenue-Katalog fuer Transaction, Visibility, Recurring, Consumer und Strategic Revenue.';

comment on table public.sponsored_slots is
  'Begrenzte und klar markierte Premium-Slots. Standardmaessig inaktiv, um Vertrauen vor Aktivierung zu sichern.';

comment on table public.attribution_events is
  'Attribution- und Conversion-nahe Ereignisse fuer spaetere Monetisierung und Reporting. Kein Preisschild im Kernprodukt notwendig.';

comment on table public.creator_reward_events is
  'Reward-Schicht fuer Creator, zunaechst auch non-cash faehig (Credits, Distribution, Featured-Slots).';

comment on table public.tenant_licenses is
  'Vorbereitung fuer White-Label-, Co-Branding- und spaetere API-/Lizenzmodelle.';

commit;

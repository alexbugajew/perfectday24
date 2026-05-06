begin;

update public.partner_products
set
  status = 'active',
  updated_at = now()
where product_key = 'creator_brand_route_distribution';

update public.sponsored_slots
set
  status = 'active',
  updated_at = now()
where slot_key = 'creator_profile_featured_routes';

update public.partner_profiles
set
  visibility_tier = 'featured',
  meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('internal_creator_profile_pilot', true),
  updated_at = now()
where slug = 'pilot-ticketmaster-de';

update public.partner_slot_assignments
set
  status = 'paused',
  updated_at = now()
where campaign_id in (
  select id
  from public.partner_campaigns
  where name = 'Demo Creator Spotlight München'
);

update public.partner_campaigns
set
  status = 'paused',
  updated_at = now()
where name = 'Demo Creator Spotlight München';

delete from public.partner_slot_assignments
where campaign_id in (
  select id
  from public.partner_campaigns
  where name = 'Internal Featured Creator Profile Pilot: Lexximus Route Spotlight'
);

delete from public.partner_campaigns
where name = 'Internal Featured Creator Profile Pilot: Lexximus Route Spotlight';

with creator_target as (
  select
    cp.id,
    cp.username
  from public.creator_profiles cp
  where cp.username = 'lexximus'
  limit 1
),
route_target as (
  select
    r.id,
    r.slug,
    r.city_slug,
    r.creator_profile_id
  from public.user_routes r
  join creator_target on creator_target.id = r.creator_profile_id
  where r.visibility = 'public'
    and r.slug is not null
  order by r.updated_at desc
  limit 1
)
insert into public.partner_campaigns (
  partner_profile_id,
  product_id,
  name,
  campaign_type,
  status,
  city_slug,
  target_route_id,
  target_creator_profile_id,
  starts_at,
  ends_at,
  budget_amount,
  budget_currency,
  bid_amount,
  cta_label,
  cta_url,
  creative_meta,
  targeting,
  meta
)
select
  (select id from public.partner_profiles where slug = 'pilot-ticketmaster-de'),
  (select id from public.partner_products where product_key = 'creator_brand_route_distribution'),
  'Internal Featured Creator Profile Pilot: Lexximus Route Spotlight',
  'creator_distribution',
  'active',
  route_target.city_slug,
  route_target.id,
  route_target.creator_profile_id,
  now() - interval '1 day',
  now() + interval '30 days',
  129,
  'EUR',
  1.1,
  'Featured Route ansehen',
  '/routes/' || route_target.slug,
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'surface', 'creator_profile',
    'format', 'featured_route_spotlight'
  ),
  jsonb_build_object(
    'citySlug', route_target.city_slug,
    'surface', 'creator_profile',
    'creatorUsername', (select username from creator_target),
    'tags', jsonb_build_array('creator', 'profile', 'route', 'berlin')
  ),
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'rail', 'creator_distribution',
    'slot', 'creator_profile_featured_routes'
  )
from route_target;

insert into public.partner_slot_assignments (
  campaign_id,
  slot_id,
  priority,
  weight,
  starts_at,
  ends_at,
  status,
  meta
)
select
  campaign.id,
  (select id from public.sponsored_slots where slot_key = 'creator_profile_featured_routes'),
  100,
  1.25,
  now() - interval '1 day',
  now() + interval '30 days',
  'active',
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'surface', 'creator_profile'
  )
from public.partner_campaigns campaign
where campaign.name = 'Internal Featured Creator Profile Pilot: Lexximus Route Spotlight'
on conflict (campaign_id, slot_id) do update
set
  priority = excluded.priority,
  weight = excluded.weight,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  status = excluded.status,
  meta = excluded.meta,
  updated_at = now();

commit;

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
where slot_key = 'route_detail_brand_distribution';

update public.partner_profiles
set
  visibility_tier = 'featured',
  meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('internal_route_detail_pilot', true),
  updated_at = now()
where slug = 'pilot-ticketmaster-de';

update public.partner_slot_assignments
set
  status = 'paused',
  updated_at = now()
where campaign_id in (
  select id
  from public.partner_campaigns
  where name = 'Demo Route Distribution Berlin'
);

update public.partner_campaigns
set
  status = 'paused',
  updated_at = now()
where name = 'Demo Route Distribution Berlin';

delete from public.partner_slot_assignments
where campaign_id in (
  select id
  from public.partner_campaigns
  where name = 'Internal Featured Route Detail Pilot: Berlin Creator Route'
);

delete from public.partner_campaigns
where name = 'Internal Featured Route Detail Pilot: Berlin Creator Route';

with route_target as (
  select
    r.id,
    r.slug,
    r.city_slug,
    r.creator_profile_id
  from public.user_routes r
  where r.visibility = 'public'
    and r.city_slug = 'berlin-berlin'
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
  'Internal Featured Route Detail Pilot: Berlin Creator Route',
  'creator_distribution',
  'active',
  route_target.city_slug,
  route_target.id,
  route_target.creator_profile_id,
  now() - interval '1 day',
  now() + interval '30 days',
  149,
  'EUR',
  1.2,
  'Route ansehen',
  '/routes/' || route_target.slug,
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'surface', 'route_detail',
    'format', 'brand_distribution'
  ),
  jsonb_build_object(
    'citySlug', route_target.city_slug,
    'surface', 'route_detail',
    'tags', jsonb_build_array('creator', 'route', 'berlin')
  ),
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'rail', 'creator_distribution',
    'slot', 'route_detail_brand_distribution'
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
  (select id from public.sponsored_slots where slot_key = 'route_detail_brand_distribution'),
  100,
  1.25,
  now() - interval '1 day',
  now() + interval '30 days',
  'active',
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'surface', 'route_detail'
  )
from public.partner_campaigns campaign
where campaign.name = 'Internal Featured Route Detail Pilot: Berlin Creator Route'
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

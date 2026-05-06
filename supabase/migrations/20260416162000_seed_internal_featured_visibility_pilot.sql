begin;

update public.partner_products
set
  status = 'active',
  updated_at = now()
where product_key = 'featured_location';

update public.sponsored_slots
set
  status = 'active',
  updated_at = now()
where slot_key = 'explore_featured_locations_strip';

update public.partner_profiles
set
  visibility_tier = 'featured',
  meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('internal_featured_pilot', true),
  updated_at = now()
where slug = 'pilot-dolcini-berlin';

update public.partner_locations
set
  visibility_boost = 1.35,
  meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('internal_featured_pilot', true),
  updated_at = now()
where partner_profile_id = (
  select id
  from public.partner_profiles
  where slug = 'pilot-dolcini-berlin'
);

update public.partner_slot_assignments
set
  status = 'paused',
  updated_at = now()
where campaign_id in (
  select id
  from public.partner_campaigns
  where name = 'Demo Explore Dinner Hamburg'
);

update public.partner_campaigns
set
  status = 'paused',
  updated_at = now()
where name = 'Demo Explore Dinner Hamburg';

delete from public.partner_slot_assignments
where campaign_id in (
  select id
  from public.partner_campaigns
  where name = 'Internal Featured Explore Pilot: Dolcini Berlin'
);

delete from public.partner_campaigns
where name = 'Internal Featured Explore Pilot: Dolcini Berlin';

insert into public.partner_campaigns (
  partner_profile_id,
  product_id,
  name,
  campaign_type,
  status,
  city_slug,
  target_location_id,
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
values (
  (select id from public.partner_profiles where slug = 'pilot-dolcini-berlin'),
  (select id from public.partner_products where product_key = 'featured_location'),
  'Internal Featured Explore Pilot: Dolcini Berlin',
  'featured_location',
  'active',
  'berlin-berlin',
  (
    select id
    from public.locations
    where city_slug = 'berlin-berlin'
      and name = 'Dolcini'
      and reservation_url = 'https://www.dolcini.berlin/'
    order by updated_at desc nulls last, created_at desc
    limit 1
  ),
  now() - interval '1 day',
  now() + interval '30 days',
  249,
  'EUR',
  1.7,
  'Jetzt reservieren',
  'https://www.dolcini.berlin/',
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'surface', 'explore',
    'format', 'featured_location_strip'
  ),
  jsonb_build_object(
    'citySlug', 'berlin-berlin',
    'surface', 'explore',
    'tags', jsonb_build_array('date', 'dinner', 'berlin')
  ),
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'rail', 'featured_visibility'
  )
);

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
values (
  (
    select id
    from public.partner_campaigns
    where name = 'Internal Featured Explore Pilot: Dolcini Berlin'
  ),
  (
    select id
    from public.sponsored_slots
    where slot_key = 'explore_featured_locations_strip'
  ),
  100,
  1.4,
  now() - interval '1 day',
  now() + interval '30 days',
  'active',
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'surface', 'explore'
  )
)
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

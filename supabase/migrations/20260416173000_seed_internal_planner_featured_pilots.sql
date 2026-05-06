begin;

update public.partner_products
set
  status = 'active',
  updated_at = now()
where product_key in ('featured_event', 'featured_location');

update public.sponsored_slots
set
  status = 'active',
  updated_at = now()
where slot_key in ('planner_featured_event_module', 'planner_featured_location_module');

update public.partner_profiles
set
  visibility_tier = 'featured',
  meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('internal_planner_featured_pilot', true),
  updated_at = now()
where slug in ('pilot-dolcini-berlin', 'pilot-ticketmaster-de');

update public.partner_locations
set
  visibility_boost = greatest(coalesce(visibility_boost, 1), 1.3),
  meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('internal_planner_featured_pilot', true),
  updated_at = now()
where partner_profile_id = (
  select id
  from public.partner_profiles
  where slug = 'pilot-dolcini-berlin'
);

delete from public.partner_slot_assignments
where campaign_id in (
  select id
  from public.partner_campaigns
  where name in (
    'Internal Featured Planner Pilot: Dolcini Berlin',
    'Internal Featured Planner Pilot: Naomi Jon'
  )
);

delete from public.partner_campaigns
where name in (
  'Internal Featured Planner Pilot: Dolcini Berlin',
  'Internal Featured Planner Pilot: Naomi Jon'
);

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
  'Internal Featured Planner Pilot: Dolcini Berlin',
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
  179,
  'EUR',
  1.45,
  'Jetzt reservieren',
  'https://www.dolcini.berlin/',
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'surface', 'planner',
    'format', 'featured_location_module'
  ),
  jsonb_build_object(
    'citySlug', 'berlin-berlin',
    'surface', 'planner',
    'tags', jsonb_build_array('date', 'dinner', 'berlin')
  ),
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'rail', 'featured_visibility',
    'slot', 'planner_featured_location_module'
  )
);

insert into public.partner_campaigns (
  partner_profile_id,
  product_id,
  name,
  campaign_type,
  status,
  city_slug,
  target_event_id,
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
  (select id from public.partner_profiles where slug = 'pilot-ticketmaster-de'),
  (select id from public.partner_products where product_key = 'featured_event'),
  'Internal Featured Planner Pilot: Naomi Jon',
  'featured_event',
  'active',
  'berlin-berlin',
  (
    select id
    from public.planner_events
    where source = 'ticketmaster'
      and city_slug = 'berlin-berlin'
      and title = 'Naomi Jon - Strawberry Tour 2026'
      and ticket_url is not null
    order by start_at asc
    limit 1
  ),
  now() - interval '1 day',
  now() + interval '30 days',
  159,
  'EUR',
  1.4,
  'Jetzt Tickets sichern',
  (
    select ticket_url
    from public.planner_events
    where source = 'ticketmaster'
      and city_slug = 'berlin-berlin'
      and title = 'Naomi Jon - Strawberry Tour 2026'
      and ticket_url is not null
    order by start_at asc
    limit 1
  ),
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'surface', 'planner',
    'format', 'featured_event_module'
  ),
  jsonb_build_object(
    'citySlug', 'berlin-berlin',
    'surface', 'planner',
    'tags', jsonb_build_array('show', 'concert', 'date', 'berlin')
  ),
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'rail', 'featured_visibility',
    'slot', 'planner_featured_event_module'
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
    where name = 'Internal Featured Planner Pilot: Dolcini Berlin'
  ),
  (
    select id
    from public.sponsored_slots
    where slot_key = 'planner_featured_location_module'
  ),
  100,
  1.35,
  now() - interval '1 day',
  now() + interval '30 days',
  'active',
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'surface', 'planner'
  )
),
(
  (
    select id
    from public.partner_campaigns
    where name = 'Internal Featured Planner Pilot: Naomi Jon'
  ),
  (
    select id
    from public.sponsored_slots
    where slot_key = 'planner_featured_event_module'
  ),
  100,
  1.35,
  now() - interval '1 day',
  now() + interval '30 days',
  'active',
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'surface', 'planner'
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

begin;

update public.partner_products
set
  status = 'active',
  updated_at = now()
where product_key = 'featured_event';

update public.sponsored_slots
set
  status = 'active',
  updated_at = now()
where slot_key = 'explore_featured_events_strip';

update public.partner_profiles
set
  visibility_tier = 'featured',
  meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('internal_featured_event_pilot', true),
  updated_at = now()
where slug = 'pilot-ticketmaster-de';

delete from public.partner_slot_assignments
where campaign_id in (
  select id
  from public.partner_campaigns
  where name = 'Internal Featured Explore Pilot: Naomi Jon'
);

delete from public.partner_campaigns
where name = 'Internal Featured Explore Pilot: Naomi Jon';

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
  'Internal Featured Explore Pilot: Naomi Jon',
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
  199,
  'EUR',
  1.6,
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
    'surface', 'explore',
    'format', 'featured_event_strip'
  ),
  jsonb_build_object(
    'citySlug', 'berlin-berlin',
    'surface', 'explore',
    'tags', jsonb_build_array('show', 'concert', 'date', 'berlin')
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
    where name = 'Internal Featured Explore Pilot: Naomi Jon'
  ),
  (
    select id
    from public.sponsored_slots
    where slot_key = 'explore_featured_events_strip'
  ),
  100,
  1.35,
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

begin;

insert into public.partner_profiles (
  slug,
  display_name,
  legal_name,
  partner_type,
  website_url,
  booking_url,
  contact_email,
  primary_city_slug,
  country_code,
  status,
  billing_status,
  visibility_tier,
  is_self_service_enabled,
  meta,
  notes
)
values
  (
    'demo-stage-berlin',
    'Demo Stage Berlin',
    'Demo Stage Berlin GmbH',
    'organizer',
    'https://demo-stage-berlin.example',
    'https://demo-stage-berlin.example/book',
    'hello@demo-stage-berlin.example',
    'berlin-berlin',
    'DE',
    'active',
    'trial',
    'partner_pro',
    true,
    jsonb_build_object('demo', true, 'rail', 'creator_distribution'),
    'Interner Demo-Partner für Route- und Creator-Distribution.'
  ),
  (
    'demo-table-hamburg',
    'Demo Table Hamburg',
    'Demo Table Hamburg GmbH',
    'restaurant',
    'https://demo-table-hamburg.example',
    'https://demo-table-hamburg.example/reserve',
    'booking@demo-table-hamburg.example',
    'hamburg-hamburg',
    'DE',
    'active',
    'trial',
    'partner_pro',
    true,
    jsonb_build_object('demo', true, 'rail', 'featured_location'),
    'Interner Demo-Partner für Explore- und Share-nahe CTA-Tests.'
  ),
  (
    'demo-spotlight-muenchen',
    'Demo Spotlight München',
    'Demo Spotlight München GmbH',
    'brand',
    'https://demo-spotlight-muenchen.example',
    'https://demo-spotlight-muenchen.example/explore',
    'team@demo-spotlight-muenchen.example',
    'muenchen',
    'DE',
    'active',
    'trial',
    'partner_pro',
    true,
    jsonb_build_object('demo', true, 'rail', 'creator_profile_featured_routes'),
    'Interner Demo-Partner für Creator-Profile und kuratierte Distribution.'
  )
on conflict (slug) do update
set
  display_name = excluded.display_name,
  legal_name = excluded.legal_name,
  partner_type = excluded.partner_type,
  website_url = excluded.website_url,
  booking_url = excluded.booking_url,
  contact_email = excluded.contact_email,
  primary_city_slug = excluded.primary_city_slug,
  country_code = excluded.country_code,
  status = excluded.status,
  billing_status = excluded.billing_status,
  visibility_tier = excluded.visibility_tier,
  is_self_service_enabled = excluded.is_self_service_enabled,
  meta = excluded.meta,
  notes = excluded.notes,
  updated_at = now();

update public.partner_products
set
  status = case
    when product_key in (
      'affiliate_events',
      'affiliate_restaurants',
      'featured_location',
      'creator_brand_route_distribution',
      'partner_pro'
    ) then 'active'
    else status
  end,
  updated_at = now()
where product_key in (
  'affiliate_events',
  'affiliate_restaurants',
  'featured_location',
  'creator_brand_route_distribution',
  'partner_pro'
);

update public.sponsored_slots
set
  status = case
    when slot_key in (
      'explore_featured_locations_strip',
      'route_detail_brand_distribution',
      'creator_profile_featured_routes'
    ) then 'active'
    else status
  end,
  updated_at = now()
where slot_key in (
  'explore_featured_locations_strip',
  'route_detail_brand_distribution',
  'creator_profile_featured_routes'
);

insert into public.partner_campaigns (
  partner_profile_id,
  product_id,
  name,
  campaign_type,
  status,
  city_slug,
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
values
  (
    (select id from public.partner_profiles where slug = 'demo-table-hamburg'),
    (select id from public.partner_products where product_key = 'featured_location'),
    'Demo Explore Dinner Hamburg',
    'featured_location',
    'active',
    'hamburg-hamburg',
    now() - interval '1 day',
    now() + interval '30 days',
    390,
    'EUR',
    1.8,
    'Partner ansehen',
    'https://demo-table-hamburg.example/reserve',
    jsonb_build_object('demo', true, 'surface', 'explore'),
    jsonb_build_object('citySlug', 'hamburg-hamburg'),
    jsonb_build_object('demo', true)
  ),
  (
    (select id from public.partner_profiles where slug = 'demo-stage-berlin'),
    (select id from public.partner_products where product_key = 'creator_brand_route_distribution'),
    'Demo Route Distribution Berlin',
    'creator_distribution',
    'active',
    'berlin-berlin',
    now() - interval '1 day',
    now() + interval '30 days',
    520,
    'EUR',
    2.2,
    'Partner-Route öffnen',
    'https://demo-stage-berlin.example/book',
    jsonb_build_object('demo', true, 'surface', 'route_detail'),
    jsonb_build_object('citySlug', 'berlin-berlin'),
    jsonb_build_object('demo', true)
  ),
  (
    (select id from public.partner_profiles where slug = 'demo-spotlight-muenchen'),
    (select id from public.partner_products where product_key = 'creator_brand_route_distribution'),
    'Demo Creator Spotlight München',
    'creator_distribution',
    'active',
    'muenchen',
    now() - interval '1 day',
    now() + interval '30 days',
    460,
    'EUR',
    1.9,
    'Spotlight öffnen',
    'https://demo-spotlight-muenchen.example/explore',
    jsonb_build_object('demo', true, 'surface', 'creator_profile'),
    jsonb_build_object('citySlug', 'muenchen'),
    jsonb_build_object('demo', true)
  )
on conflict do nothing;

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
values
  (
    (select id from public.partner_campaigns where name = 'Demo Explore Dinner Hamburg'),
    (select id from public.sponsored_slots where slot_key = 'explore_featured_locations_strip'),
    10,
    1.2,
    now() - interval '1 day',
    now() + interval '30 days',
    'active',
    jsonb_build_object('demo', true)
  ),
  (
    (select id from public.partner_campaigns where name = 'Demo Route Distribution Berlin'),
    (select id from public.sponsored_slots where slot_key = 'route_detail_brand_distribution'),
    10,
    1.1,
    now() - interval '1 day',
    now() + interval '30 days',
    'active',
    jsonb_build_object('demo', true)
  ),
  (
    (select id from public.partner_campaigns where name = 'Demo Creator Spotlight München'),
    (select id from public.sponsored_slots where slot_key = 'creator_profile_featured_routes'),
    10,
    1.15,
    now() - interval '1 day',
    now() + interval '30 days',
    'active',
    jsonb_build_object('demo', true)
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

insert into public.affiliate_links (
  partner_profile_id,
  product_id,
  link_scope,
  provider_name,
  destination_url,
  deep_link_url,
  program_code,
  commission_model,
  is_active,
  priority,
  meta
)
values
  (
    (select id from public.partner_profiles where slug = 'demo-stage-berlin'),
    (select id from public.partner_products where product_key = 'affiliate_events'),
    'global',
    'Demo Ticket Partner',
    'https://demo-stage-berlin.example/book',
    'https://demo-stage-berlin.example/deeplink/event',
    'demo-events',
    'cps',
    true,
    10,
    jsonb_build_object('demo', true, 'surface', 'planner_event_stop')
  ),
  (
    (select id from public.partner_profiles where slug = 'demo-table-hamburg'),
    (select id from public.partner_products where product_key = 'affiliate_restaurants'),
    'shared_plan',
    'Demo Reserve Partner',
    'https://demo-table-hamburg.example/reserve',
    'https://demo-table-hamburg.example/deeplink/table',
    'demo-restaurant',
    'cpl',
    true,
    10,
    jsonb_build_object('demo', true, 'surface', 'shared_plan_stop')
  ),
  (
    (select id from public.partner_profiles where slug = 'demo-spotlight-muenchen'),
    (select id from public.partner_products where product_key = 'creator_brand_route_distribution'),
    'route',
    'Demo Route Partner',
    'https://demo-spotlight-muenchen.example/explore',
    'https://demo-spotlight-muenchen.example/deeplink/route',
    'demo-route',
    'hybrid',
    true,
    20,
    jsonb_build_object('demo', true, 'surface', 'route_detail_stop')
  )
on conflict do nothing;

commit;

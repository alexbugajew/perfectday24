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
values (
  'pilot-dolcini-berlin',
  'Dolcini Berlin',
  'Dolcini Berlin',
  'restaurant',
  'https://www.dolcini.berlin/',
  'https://www.dolcini.berlin/',
  null,
  'berlin-berlin',
  'DE',
  'active',
  'trial',
  'partner_pro',
  false,
  jsonb_build_object('pilot', true, 'internal_only', true, 'rail', 'affiliate_restaurants'),
  'Interner Pilotdatensatz fuer Restaurant-/Reservierungs-Weiterleitungen im Berliner Date-Flow. Kein oeffentlich kommuniziertes Live-Partnerverhaeltnis.'
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
  status = 'active',
  updated_at = now()
where product_key in ('affiliate_events', 'affiliate_restaurants');

delete from public.affiliate_links
where program_code in (
  'internal_pilot_restaurant',
  'internal_pilot_event',
  'internal_pilot_restaurant_dolcini',
  'internal_pilot_event_naomi_jon'
);

insert into public.partner_locations (
  partner_profile_id,
  location_id,
  relationship_type,
  visibility_boost,
  is_primary,
  meta
)
values (
  (select id from public.partner_profiles where slug = 'pilot-dolcini-berlin'),
  (
    select id
    from public.locations
    where city_slug = 'berlin-berlin'
      and name = 'Dolcini'
      and reservation_url = 'https://www.dolcini.berlin/'
    order by updated_at desc nulls last, created_at desc
    limit 1
  ),
  'primary',
  1.15,
  true,
  jsonb_build_object('pilot', true, 'internal_only', true)
)
on conflict (partner_profile_id, location_id) do update
set
  relationship_type = excluded.relationship_type,
  visibility_boost = excluded.visibility_boost,
  is_primary = excluded.is_primary,
  meta = excluded.meta,
  updated_at = now();

insert into public.affiliate_links (
  partner_profile_id,
  product_id,
  location_id,
  link_scope,
  provider_name,
  destination_url,
  deep_link_url,
  tracking_template,
  program_code,
  commission_model,
  is_active,
  priority,
  meta
)
values (
  (select id from public.partner_profiles where slug = 'pilot-dolcini-berlin'),
  (select id from public.partner_products where product_key = 'affiliate_restaurants'),
  (
    select id
    from public.locations
    where city_slug = 'berlin-berlin'
      and name = 'Dolcini'
      and reservation_url = 'https://www.dolcini.berlin/'
    order by updated_at desc nulls last, created_at desc
    limit 1
  ),
  'location',
  'Dolcini Direkt',
  'https://www.dolcini.berlin/',
  'https://www.dolcini.berlin/',
  null,
  'internal_pilot_restaurant_dolcini',
  'cpl',
  true,
  10,
  jsonb_build_object('pilot', true, 'internal_only', true, 'cta_label', 'Reservierung')
);

insert into public.affiliate_links (
  partner_profile_id,
  product_id,
  planner_event_id,
  link_scope,
  provider_name,
  destination_url,
  deep_link_url,
  tracking_template,
  program_code,
  commission_model,
  is_active,
  priority,
  meta
)
values (
  (select id from public.partner_profiles where slug = 'pilot-ticketmaster-de'),
  (select id from public.partner_products where product_key = 'affiliate_events'),
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
  'event',
  'Ticketmaster',
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
  null,
  'internal_pilot_event_naomi_jon',
  'cps',
  true,
  10,
  jsonb_build_object('pilot', true, 'internal_only', true, 'cta_label', 'Tickets')
);

commit;

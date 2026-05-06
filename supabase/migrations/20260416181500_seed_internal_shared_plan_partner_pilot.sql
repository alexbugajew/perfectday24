begin;

update public.partner_products
set
  status = 'active',
  updated_at = now()
where product_key = 'sponsored_placement';

update public.sponsored_slots
set
  status = 'active',
  updated_at = now()
where slot_key = 'shared_plan_partner_cta';

update public.partner_profiles
set
  visibility_tier = case
    when visibility_tier = 'organic' then 'partner_basic'
    else visibility_tier
  end,
  meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('internal_shared_plan_pilot', true),
  updated_at = now()
where slug = 'pilot-dolcini-berlin';

delete from public.partner_slot_assignments
where campaign_id in (
  select id
  from public.partner_campaigns
  where name = 'Internal Featured Shared Plan Pilot: Dolcini Berlin'
);

delete from public.partner_campaigns
where name = 'Internal Featured Shared Plan Pilot: Dolcini Berlin';

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
  (select id from public.partner_products where product_key = 'sponsored_placement'),
  'Internal Featured Shared Plan Pilot: Dolcini Berlin',
  'sponsored_placement',
  'active',
  'berlin-berlin',
  (
    select id
    from public.locations
    where city_slug = 'berlin-berlin'
      and name = 'Dolcini'
      and reservation_url = 'https://www.dolcini.berlin/'
    order by created_at desc
    limit 1
  ),
  now() - interval '1 day',
  now() + interval '30 days',
  129,
  'EUR',
  1.1,
  'Gemeinsam reservieren',
  'https://www.dolcini.berlin/',
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'surface', 'shared_plan',
    'format', 'partner_cta'
  ),
  jsonb_build_object(
    'citySlug', 'berlin-berlin',
    'surface', 'shared_plan',
    'tags', jsonb_build_array('share', 'date', 'group', 'berlin')
  ),
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'rail', 'visibility',
    'slot', 'shared_plan_partner_cta'
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
    where name = 'Internal Featured Shared Plan Pilot: Dolcini Berlin'
  ),
  (
    select id
    from public.sponsored_slots
    where slot_key = 'shared_plan_partner_cta'
  ),
  100,
  1.25,
  now() - interval '1 day',
  now() + interval '30 days',
  'active',
  jsonb_build_object(
    'pilot', true,
    'internal_only', true,
    'surface', 'shared_plan'
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

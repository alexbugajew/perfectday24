begin;

with route_cover_sources as (
  select
    r.id as route_id,
    r.user_id as owner_user_id,
    case
      when r.creator_profile_id is not null then 'creator'
      else 'user'
    end as source_type,
    r.title as alt_text,
    btrim(r.cover_image_url) as public_url,
    format('route-cover:%s', r.id) as storage_path
  from public.user_routes r
  where r.cover_image_url is not null
    and btrim(r.cover_image_url) <> ''
),
inserted_route_cover_assets as (
  insert into public.media_assets (
    owner_user_id,
    partner_profile_id,
    source_type,
    bucket_id,
    storage_path,
    public_url,
    alt_text,
    moderation_status,
    rights_status,
    visibility,
    meta
  )
  select
    s.owner_user_id,
    null,
    s.source_type,
    'legacy-external',
    s.storage_path,
    s.public_url,
    s.alt_text,
    'approved',
    'confirmed',
    'public',
    jsonb_build_object(
      'migration', '20260616123000_media_backfill_legacy_urls',
      'legacy_field', 'user_routes.cover_image_url'
    )
  from route_cover_sources s
  on conflict (bucket_id, storage_path) do nothing
  returning id
)
insert into public.route_media (
  route_id,
  asset_id,
  role,
  sort_order,
  is_primary
)
select
  s.route_id,
  ma.id,
  'cover',
  0,
  true
from route_cover_sources s
join public.media_assets ma
  on ma.bucket_id = 'legacy-external'
 and ma.storage_path = s.storage_path
on conflict (route_id, asset_id, role) do nothing;

with route_stop_sources as (
  select
    rs.id as route_stop_id,
    r.user_id as owner_user_id,
    case
      when r.creator_profile_id is not null then 'creator'
      else 'user'
    end as source_type,
    coalesce(nullif(btrim(rs.title), ''), r.title) as alt_text,
    btrim(rs.photo_url) as public_url,
    format('route-stop:%s:primary', rs.id) as storage_path
  from public.user_route_stops rs
  join public.user_routes r on r.id = rs.route_id
  where rs.photo_url is not null
    and btrim(rs.photo_url) <> ''
),
inserted_route_stop_assets as (
  insert into public.media_assets (
    owner_user_id,
    partner_profile_id,
    source_type,
    bucket_id,
    storage_path,
    public_url,
    alt_text,
    moderation_status,
    rights_status,
    visibility,
    meta
  )
  select
    s.owner_user_id,
    null,
    s.source_type,
    'legacy-external',
    s.storage_path,
    s.public_url,
    s.alt_text,
    'approved',
    'confirmed',
    'public',
    jsonb_build_object(
      'migration', '20260616123000_media_backfill_legacy_urls',
      'legacy_field', 'user_route_stops.photo_url'
    )
  from route_stop_sources s
  on conflict (bucket_id, storage_path) do nothing
  returning id
)
insert into public.route_stop_media (
  route_stop_id,
  asset_id,
  role,
  sort_order,
  is_primary
)
select
  s.route_stop_id,
  ma.id,
  'primary',
  0,
  true
from route_stop_sources s
join public.media_assets ma
  on ma.bucket_id = 'legacy-external'
 and ma.storage_path = s.storage_path
on conflict (route_stop_id, asset_id, role) do nothing;

with roadtrip_cover_sources as (
  select
    rr.id as roadtrip_route_id,
    rr.author_user_id as owner_user_id,
    'imported' as source_type,
    rr.title as alt_text,
    btrim(rr.cover_image_url) as public_url,
    format('roadtrip-cover:%s', rr.id) as storage_path
  from public.roadtrip_routes rr
  where rr.cover_image_url is not null
    and btrim(rr.cover_image_url) <> ''
),
inserted_roadtrip_cover_assets as (
  insert into public.media_assets (
    owner_user_id,
    partner_profile_id,
    source_type,
    bucket_id,
    storage_path,
    public_url,
    alt_text,
    moderation_status,
    rights_status,
    visibility,
    meta
  )
  select
    s.owner_user_id,
    null,
    s.source_type,
    'legacy-external',
    s.storage_path,
    s.public_url,
    s.alt_text,
    'approved',
    'confirmed',
    'public',
    jsonb_build_object(
      'migration', '20260616123000_media_backfill_legacy_urls',
      'legacy_field', 'roadtrip_routes.cover_image_url'
    )
  from roadtrip_cover_sources s
  on conflict (bucket_id, storage_path) do nothing
  returning id
)
insert into public.roadtrip_media (
  roadtrip_route_id,
  asset_id,
  role,
  sort_order,
  is_primary
)
select
  s.roadtrip_route_id,
  ma.id,
  'cover',
  0,
  true
from roadtrip_cover_sources s
join public.media_assets ma
  on ma.bucket_id = 'legacy-external'
 and ma.storage_path = s.storage_path
on conflict (roadtrip_route_id, asset_id, role) do nothing;

with partner_media_sources as (
  select
    pp.id as partner_profile_id,
    pp.owner_user_id,
    item.ordinality::integer as media_order,
    btrim(item.url) as public_url,
    format('partner-profile:%s:%s', pp.id, item.ordinality::text) as storage_path,
    pp.display_name as alt_text
  from public.partner_profiles pp
  cross join lateral unnest(pp.media_urls) with ordinality as item(url, ordinality)
  where item.url is not null
    and btrim(item.url) <> ''
),
inserted_partner_assets as (
  insert into public.media_assets (
    owner_user_id,
    partner_profile_id,
    source_type,
    bucket_id,
    storage_path,
    public_url,
    alt_text,
    moderation_status,
    rights_status,
    visibility,
    meta
  )
  select
    s.owner_user_id,
    s.partner_profile_id,
    'partner',
    'legacy-external',
    s.storage_path,
    s.public_url,
    s.alt_text,
    'approved',
    'confirmed',
    'public',
    jsonb_build_object(
      'migration', '20260616123000_media_backfill_legacy_urls',
      'legacy_field', 'partner_profiles.media_urls',
      'sort_order', s.media_order
    )
  from partner_media_sources s
  on conflict (bucket_id, storage_path) do nothing
  returning id
)
insert into public.partner_profile_media (
  partner_profile_id,
  asset_id,
  role,
  sort_order,
  is_primary
)
select
  s.partner_profile_id,
  ma.id,
  'gallery',
  greatest(s.media_order - 1, 0),
  s.media_order = 1
from partner_media_sources s
join public.media_assets ma
  on ma.bucket_id = 'legacy-external'
 and ma.storage_path = s.storage_path
on conflict (partner_profile_id, asset_id, role) do nothing;

with first_partner_media as (
  select distinct on (s.partner_profile_id)
    s.partner_profile_id,
    s.storage_path
  from (
    select
      pp.id as partner_profile_id,
      item.ordinality::integer as media_order,
      format('partner-profile:%s:%s', pp.id, item.ordinality::text) as storage_path
    from public.partner_profiles pp
    cross join lateral unnest(pp.media_urls) with ordinality as item(url, ordinality)
    where item.url is not null
      and btrim(item.url) <> ''
  ) s
  order by s.partner_profile_id, s.media_order
)
insert into public.partner_profile_media (
  partner_profile_id,
  asset_id,
  role,
  sort_order,
  is_primary
)
select
  f.partner_profile_id,
  ma.id,
  'cover',
  0,
  true
from first_partner_media f
join public.media_assets ma
  on ma.bucket_id = 'legacy-external'
 and ma.storage_path = f.storage_path
on conflict (partner_profile_id, asset_id, role) do nothing;

commit;

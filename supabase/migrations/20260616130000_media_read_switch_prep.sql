begin;

create or replace function public.pd24_route_effective_cover(target_route_id uuid)
returns table (
  asset_id uuid,
  public_url text,
  source text
)
language sql
stable
set search_path = public
as $pd24$
  with ranked as (
    select
      ma.id as asset_id,
      ma.public_url,
      'route_media_cover_primary'::text as source,
      1 as priority,
      rm.sort_order as secondary
    from public.route_media rm
    join public.media_assets ma on ma.id = rm.asset_id
    where rm.route_id = target_route_id
      and rm.role = 'cover'
      and rm.is_primary = true
      and ma.moderation_status in ('approved', 'featured')

    union all

    select
      ma.id,
      ma.public_url,
      'route_media_cover'::text,
      2,
      rm.sort_order
    from public.route_media rm
    join public.media_assets ma on ma.id = rm.asset_id
    where rm.route_id = target_route_id
      and rm.role = 'cover'
      and ma.moderation_status in ('approved', 'featured')

    union all

    select
      ma.id,
      ma.public_url,
      'route_stop_media_primary'::text,
      3,
      (rs.stop_order * 1000) + rsm.sort_order
    from public.route_stop_media rsm
    join public.user_route_stops rs on rs.id = rsm.route_stop_id
    join public.media_assets ma on ma.id = rsm.asset_id
    where rs.route_id = target_route_id
      and rsm.role = 'primary'
      and ma.moderation_status in ('approved', 'featured')

    union all

    select
      ma.id,
      ma.public_url,
      'route_stop_media_gallery'::text,
      4,
      (rs.stop_order * 1000) + rsm.sort_order
    from public.route_stop_media rsm
    join public.user_route_stops rs on rs.id = rsm.route_stop_id
    join public.media_assets ma on ma.id = rsm.asset_id
    where rs.route_id = target_route_id
      and rsm.role in ('gallery', 'thumbnail')
      and ma.moderation_status in ('approved', 'featured')

    union all

    select
      null::uuid as asset_id,
      r.cover_image_url as public_url,
      'legacy_user_routes_cover_image_url'::text as source,
      99 as priority,
      0 as secondary
    from public.user_routes r
    where r.id = target_route_id
      and r.cover_image_url is not null
      and btrim(r.cover_image_url) <> ''
  )
  select ranked.asset_id, ranked.public_url, ranked.source
  from ranked
  order by ranked.priority, ranked.secondary, ranked.public_url
  limit 1;
$pd24$;

create or replace function public.pd24_roadtrip_effective_cover(target_roadtrip_route_id uuid)
returns table (
  asset_id uuid,
  public_url text,
  source text
)
language sql
stable
set search_path = public
as $pd24$
  with ranked as (
    select
      ma.id as asset_id,
      ma.public_url,
      'roadtrip_media_cover_primary'::text as source,
      1 as priority,
      rm.sort_order as secondary
    from public.roadtrip_media rm
    join public.media_assets ma on ma.id = rm.asset_id
    where rm.roadtrip_route_id = target_roadtrip_route_id
      and rm.role = 'cover'
      and rm.is_primary = true
      and ma.moderation_status in ('approved', 'featured')

    union all

    select
      ma.id,
      ma.public_url,
      'roadtrip_media_cover'::text,
      2,
      rm.sort_order
    from public.roadtrip_media rm
    join public.media_assets ma on ma.id = rm.asset_id
    where rm.roadtrip_route_id = target_roadtrip_route_id
      and rm.role = 'cover'
      and ma.moderation_status in ('approved', 'featured')

    union all

    select
      ma.id,
      ma.public_url,
      'roadtrip_stop_media_primary'::text,
      3,
      (rs.stop_order * 1000) + rsm.sort_order
    from public.roadtrip_stop_media rsm
    join public.roadtrip_route_stops rs on rs.id = rsm.roadtrip_stop_id
    join public.media_assets ma on ma.id = rsm.asset_id
    where rs.roadtrip_route_id = target_roadtrip_route_id
      and rsm.role = 'primary'
      and ma.moderation_status in ('approved', 'featured')

    union all

    select
      ma.id,
      ma.public_url,
      'roadtrip_stop_media_gallery'::text,
      4,
      (rs.stop_order * 1000) + rsm.sort_order
    from public.roadtrip_stop_media rsm
    join public.roadtrip_route_stops rs on rs.id = rsm.roadtrip_stop_id
    join public.media_assets ma on ma.id = rsm.asset_id
    where rs.roadtrip_route_id = target_roadtrip_route_id
      and rsm.role in ('gallery', 'thumbnail')
      and ma.moderation_status in ('approved', 'featured')

    union all

    select
      null::uuid,
      rr.cover_image_url,
      'legacy_roadtrip_routes_cover_image_url'::text,
      99,
      0
    from public.roadtrip_routes rr
    where rr.id = target_roadtrip_route_id
      and rr.cover_image_url is not null
      and btrim(rr.cover_image_url) <> ''
  )
  select ranked.asset_id, ranked.public_url, ranked.source
  from ranked
  order by ranked.priority, ranked.secondary, ranked.public_url
  limit 1;
$pd24$;

create or replace function public.pd24_partner_profile_effective_cover(target_partner_profile_id uuid)
returns table (
  asset_id uuid,
  public_url text,
  source text
)
language sql
stable
set search_path = public
as $pd24$
  with ranked as (
    select
      ma.id as asset_id,
      ma.public_url,
      'partner_profile_media_cover_primary'::text as source,
      1 as priority,
      ppm.sort_order as secondary
    from public.partner_profile_media ppm
    join public.media_assets ma on ma.id = ppm.asset_id
    where ppm.partner_profile_id = target_partner_profile_id
      and ppm.role = 'cover'
      and ppm.is_primary = true
      and ma.moderation_status in ('approved', 'featured')

    union all

    select
      ma.id,
      ma.public_url,
      'partner_profile_media_cover'::text,
      2,
      ppm.sort_order
    from public.partner_profile_media ppm
    join public.media_assets ma on ma.id = ppm.asset_id
    where ppm.partner_profile_id = target_partner_profile_id
      and ppm.role = 'cover'
      and ma.moderation_status in ('approved', 'featured')

    union all

    select
      ma.id,
      ma.public_url,
      'partner_profile_media_gallery'::text,
      3,
      ppm.sort_order
    from public.partner_profile_media ppm
    join public.media_assets ma on ma.id = ppm.asset_id
    where ppm.partner_profile_id = target_partner_profile_id
      and ppm.role in ('gallery', 'hero', 'thumbnail')
      and ma.moderation_status in ('approved', 'featured')

    union all

    select
      null::uuid,
      pp.media_urls[1],
      'legacy_partner_profiles_media_urls'::text,
      99,
      0
    from public.partner_profiles pp
    where pp.id = target_partner_profile_id
      and coalesce(array_length(pp.media_urls, 1), 0) > 0
      and pp.media_urls[1] is not null
      and btrim(pp.media_urls[1]) <> ''
  )
  select ranked.asset_id, ranked.public_url, ranked.source
  from ranked
  order by ranked.priority, ranked.secondary, ranked.public_url
  limit 1;
$pd24$;

create or replace function public.pd24_service_provider_effective_cover(target_provider_id uuid)
returns table (
  asset_id uuid,
  public_url text,
  source text
)
language sql
stable
set search_path = public
as $pd24$
  with ranked as (
    select
      ma.id as asset_id,
      ma.public_url,
      'service_provider_media_cover_primary'::text as source,
      1 as priority,
      spm.sort_order as secondary
    from public.service_provider_media spm
    join public.media_assets ma on ma.id = spm.asset_id
    where spm.provider_id = target_provider_id
      and spm.role = 'cover'
      and spm.is_primary = true
      and ma.moderation_status in ('approved', 'featured')

    union all

    select
      ma.id,
      ma.public_url,
      'service_provider_media_cover'::text,
      2,
      spm.sort_order
    from public.service_provider_media spm
    join public.media_assets ma on ma.id = spm.asset_id
    where spm.provider_id = target_provider_id
      and spm.role = 'cover'
      and ma.moderation_status in ('approved', 'featured')

    union all

    select
      ma.id,
      ma.public_url,
      'service_provider_media_gallery'::text,
      3,
      spm.sort_order
    from public.service_provider_media spm
    join public.media_assets ma on ma.id = spm.asset_id
    where spm.provider_id = target_provider_id
      and spm.role in ('gallery', 'thumbnail', 'package')
      and ma.moderation_status in ('approved', 'featured')

    union all

    select
      ppcm.asset_id,
      ma.public_url,
      'partner_profile_media_fallback'::text,
      4,
      ppcm.sort_order
    from public.service_providers sp
    join public.partner_profile_media ppcm on ppcm.partner_profile_id = sp.partner_profile_id
    join public.media_assets ma on ma.id = ppcm.asset_id
    where sp.id = target_provider_id
      and ppcm.role in ('cover', 'gallery', 'thumbnail')
      and ma.moderation_status in ('approved', 'featured')
  )
  select ranked.asset_id, ranked.public_url, ranked.source
  from ranked
  order by ranked.priority, ranked.secondary, ranked.public_url
  limit 1;
$pd24$;

create or replace function public.pd24_event_plan_effective_cover(target_event_plan_id uuid)
returns table (
  asset_id uuid,
  public_url text,
  source text
)
language sql
stable
set search_path = public
as $pd24$
  with ranked as (
    select
      ma.id as asset_id,
      ma.public_url,
      'event_plan_media_cover_primary'::text as source,
      1 as priority,
      epm.sort_order as secondary
    from public.event_plan_media epm
    join public.media_assets ma on ma.id = epm.asset_id
    where epm.event_plan_id = target_event_plan_id
      and epm.role = 'cover'
      and epm.is_primary = true
      and ma.moderation_status in ('approved', 'featured')

    union all

    select
      ma.id,
      ma.public_url,
      'event_plan_media_cover'::text,
      2,
      epm.sort_order
    from public.event_plan_media epm
    join public.media_assets ma on ma.id = epm.asset_id
    where epm.event_plan_id = target_event_plan_id
      and epm.role in ('cover', 'mood', 'gallery', 'recap')
      and ma.moderation_status in ('approved', 'featured')

    union all

    select
      spm.asset_id,
      ma.public_url,
      'service_provider_media_fallback'::text,
      3,
      spm.sort_order
    from public.event_bookings eb
    join public.service_provider_media spm on spm.provider_id = eb.service_provider_id
    join public.media_assets ma on ma.id = spm.asset_id
    where eb.event_plan_id = target_event_plan_id
      and spm.role in ('cover', 'gallery', 'thumbnail')
      and ma.moderation_status in ('approved', 'featured')
  )
  select ranked.asset_id, ranked.public_url, ranked.source
  from ranked
  order by ranked.priority, ranked.secondary, ranked.public_url
  limit 1;
$pd24$;

grant execute on function public.pd24_route_effective_cover(uuid) to anon, authenticated;
grant execute on function public.pd24_roadtrip_effective_cover(uuid) to anon, authenticated;
grant execute on function public.pd24_partner_profile_effective_cover(uuid) to anon, authenticated;
grant execute on function public.pd24_service_provider_effective_cover(uuid) to anon, authenticated;
grant execute on function public.pd24_event_plan_effective_cover(uuid) to authenticated;

create or replace view public.route_media_resolved
with (security_invoker = true) as
select
  r.id as route_id,
  resolved.asset_id as effective_cover_asset_id,
  resolved.public_url as effective_cover_url,
  resolved.source as effective_cover_source
from public.user_routes r
left join lateral public.pd24_route_effective_cover(r.id) resolved on true;

create or replace view public.roadtrip_media_resolved
with (security_invoker = true) as
select
  rr.id as roadtrip_route_id,
  resolved.asset_id as effective_cover_asset_id,
  resolved.public_url as effective_cover_url,
  resolved.source as effective_cover_source
from public.roadtrip_routes rr
left join lateral public.pd24_roadtrip_effective_cover(rr.id) resolved on true;

create or replace view public.partner_profile_media_resolved
with (security_invoker = true) as
select
  pp.id as partner_profile_id,
  resolved.asset_id as effective_cover_asset_id,
  resolved.public_url as effective_cover_url,
  resolved.source as effective_cover_source
from public.partner_profiles pp
left join lateral public.pd24_partner_profile_effective_cover(pp.id) resolved on true;

create or replace view public.service_provider_media_resolved
with (security_invoker = true) as
select
  sp.id as provider_id,
  resolved.asset_id as effective_cover_asset_id,
  resolved.public_url as effective_cover_url,
  resolved.source as effective_cover_source
from public.service_providers sp
left join lateral public.pd24_service_provider_effective_cover(sp.id) resolved on true;

create or replace view public.event_plan_media_resolved
with (security_invoker = true) as
select
  ep.id as event_plan_id,
  resolved.asset_id as effective_cover_asset_id,
  resolved.public_url as effective_cover_url,
  resolved.source as effective_cover_source
from public.event_plans ep
left join lateral public.pd24_event_plan_effective_cover(ep.id) resolved on true;

grant select on public.route_media_resolved to anon, authenticated;
grant select on public.roadtrip_media_resolved to anon, authenticated;
grant select on public.partner_profile_media_resolved to anon, authenticated;
grant select on public.service_provider_media_resolved to anon, authenticated;
grant select on public.event_plan_media_resolved to authenticated;

commit;

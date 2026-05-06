begin;

alter table public.location_manual_seeds
  add column if not exists published_location_id uuid references public.locations(id) on delete set null,
  add column if not exists publish_status text not null default 'draft',
  add column if not exists published_at timestamptz,
  add column if not exists last_publish_error text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'location_manual_seeds_publish_status_check'
  ) then
    alter table public.location_manual_seeds
      add constraint location_manual_seeds_publish_status_check
      check (publish_status in ('draft', 'published', 'merged', 'error'));
  end if;
end $$;

create index if not exists idx_location_manual_seeds_publish_status
  on public.location_manual_seeds(publish_status);

create index if not exists idx_location_manual_seeds_published_location_id
  on public.location_manual_seeds(published_location_id);

create or replace function public.pd24_seed_match_location(
  p_seed_id uuid,
  p_max_distance_m integer default 250
)
returns table (
  location_id uuid,
  match_kind text,
  distance_m double precision
)
language sql
stable
as $$
  with seed as (
    select *
    from public.location_manual_seeds
    where id = p_seed_id
      and is_active = true
  ),
  exact_name as (
    select
      l.id as location_id,
      'name_type_city'::text as match_kind,
      case
        when s.lat is not null and s.lng is not null and l.lat is not null and l.lng is not null
          then st_distance(
            st_setsrid(st_makepoint(s.lng, s.lat), 4326)::geography,
            st_setsrid(st_makepoint(l.lng, l.lat), 4326)::geography
          )
        else null
      end as distance_m
    from seed s
    join public.locations l
      on l.city_slug = s.city_slug
     and lower(btrim(l.name)) = lower(btrim(s.name))
     and lower(btrim(l.type)) = lower(btrim(s.type))
    where l.is_plannable = true
  ),
  nearby_name as (
    select
      l.id as location_id,
      'name_geo_city'::text as match_kind,
      st_distance(
        st_setsrid(st_makepoint(s.lng, s.lat), 4326)::geography,
        st_setsrid(st_makepoint(l.lng, l.lat), 4326)::geography
      ) as distance_m
    from seed s
    join public.locations l
      on l.city_slug = s.city_slug
     and lower(btrim(l.name)) = lower(btrim(s.name))
    where s.lat is not null
      and s.lng is not null
      and l.lat is not null
      and l.lng is not null
      and l.is_plannable = true
      and st_dwithin(
        st_setsrid(st_makepoint(s.lng, s.lat), 4326)::geography,
        st_setsrid(st_makepoint(l.lng, l.lat), 4326)::geography,
        greatest(p_max_distance_m, 25)
      )
  )
  select *
  from (
    select * from exact_name
    union all
    select * from nearby_name
  ) matches
  order by
    case match_kind
      when 'name_type_city' then 1
      else 2
    end,
    distance_m nulls last
  limit 1;
$$;

create or replace function public.pd24_publish_manual_seed(
  p_seed_id uuid,
  p_max_distance_m integer default 250
)
returns uuid
language plpgsql
as $pd24$
declare
  v_seed public.location_manual_seeds%rowtype;
  v_match record;
  v_location_id uuid;
  v_source_ref jsonb;
begin
  select *
  into v_seed
  from public.location_manual_seeds
  where id = p_seed_id
    and is_active = true;

  if not found then
    raise exception 'Manual seed % not found or inactive', p_seed_id;
  end if;

  select *
  into v_match
  from public.pd24_seed_match_location(p_seed_id, p_max_distance_m);

  v_source_ref := jsonb_build_object(
    'seed_id', v_seed.id,
    'import_batch', v_seed.import_batch,
    'source_primary', v_seed.source_primary,
    'published_at', now()
  );

  if v_match.location_id is not null then
    update public.locations l
    set
      category = coalesce(l.category, v_seed.category::location_category),
      type = coalesce(nullif(l.type, ''), v_seed.type),
      lat = coalesce(l.lat, v_seed.lat),
      lng = coalesce(l.lng, v_seed.lng),
      reservation_url = coalesce(l.reservation_url, v_seed.reservation_url),
      duration_min = coalesce(l.duration_min, v_seed.duration_min),
      tags = public.pd24_unique_text_array(
        coalesce(l.tags, '{}'::text[]) ||
        coalesce(v_seed.subtypes, '{}'::text[]) ||
        coalesce(v_seed.audiences, '{}'::text[]) ||
        coalesce(v_seed.occasions, '{}'::text[]) ||
        case when v_seed.import_batch is not null then array[v_seed.import_batch] else '{}'::text[] end
      ),
      subtypes = public.pd24_unique_text_array(
        coalesce(l.subtypes, '{}'::text[]) ||
        coalesce(v_seed.subtypes, '{}'::text[])
      ),
      audiences = public.pd24_unique_text_array(
        coalesce(l.audiences, '{}'::text[]) ||
        coalesce(v_seed.audiences, '{}'::text[])
      ),
      occasions = public.pd24_unique_text_array(
        coalesce(l.occasions, '{}'::text[]) ||
        coalesce(v_seed.occasions, '{}'::text[])
      ),
      source_primary = coalesce(nullif(l.source_primary, ''), v_seed.source_primary),
      source_refs = coalesce(l.source_refs, '[]'::jsonb) || jsonb_build_array(v_source_ref),
      family_friendly = coalesce(l.family_friendly, false) or v_seed.family_friendly,
      nightlife_fit = coalesce(l.nightlife_fit, false) or v_seed.nightlife_fit,
      manual_boost = greatest(coalesce(l.manual_boost, 0), v_seed.manual_boost),
      data_confidence = greatest(coalesce(l.data_confidence, 0), v_seed.data_confidence),
      energy_level = coalesce(l.energy_level, v_seed.energy_level),
      indoor_outdoor = coalesce(l.indoor_outdoor, v_seed.indoor_outdoor),
      budget = coalesce(l.budget, v_seed.budget),
      is_plannable = true,
      last_enriched_at = now()
    where l.id = v_match.location_id
    returning l.id into v_location_id;

    update public.location_features
    set updated_at = now()
    where location_id = v_location_id
      and feature_key = 'subtype';

    insert into public.location_features (location_id, feature_key, feature_value, confidence, source)
    select
      v_location_id,
      'subtype',
      subtype_value,
      v_seed.data_confidence,
      'manual_seed_publish'
    from unnest(coalesce(v_seed.subtypes, '{}'::text[])) as subtype_value
    on conflict (location_id, feature_key, feature_value) do update set
      confidence = greatest(public.location_features.confidence, excluded.confidence),
      source = excluded.source,
      updated_at = now();

    update public.location_manual_seeds
    set
      published_location_id = v_location_id,
      publish_status = 'merged',
      published_at = now(),
      last_publish_error = null,
      updated_at = now()
    where id = p_seed_id;

    return v_location_id;
  end if;

  insert into public.locations (
    id,
    name,
    type,
    budget,
    category,
    lat,
    lng,
    reservation_url,
    duration_min,
    tags,
    subtypes,
    audiences,
    occasions,
    city_slug,
    source_primary,
    source_refs,
    is_plannable,
    family_friendly,
    quality_score,
    importance_score,
    popularity_score,
    manual_boost,
    data_confidence,
    enrichment_version,
    last_enriched_at,
    energy_level,
    indoor_outdoor,
    nightlife_fit
  )
  values (
    gen_random_uuid(),
    v_seed.name,
    v_seed.type,
    v_seed.budget,
    v_seed.category::location_category,
    v_seed.lat,
    v_seed.lng,
    v_seed.reservation_url,
    v_seed.duration_min,
    public.pd24_unique_text_array(
      coalesce(v_seed.subtypes, '{}'::text[]) ||
      coalesce(v_seed.audiences, '{}'::text[]) ||
      coalesce(v_seed.occasions, '{}'::text[]) ||
      case when v_seed.import_batch is not null then array[v_seed.import_batch] else '{}'::text[] end
    ),
    public.pd24_unique_text_array(v_seed.subtypes),
    public.pd24_unique_text_array(v_seed.audiences),
    public.pd24_unique_text_array(v_seed.occasions),
    v_seed.city_slug,
    v_seed.source_primary,
    jsonb_build_array(v_source_ref),
    true,
    v_seed.family_friendly,
    85,
    70,
    40,
    v_seed.manual_boost,
    v_seed.data_confidence,
    10,
    now(),
    v_seed.energy_level,
    v_seed.indoor_outdoor,
    v_seed.nightlife_fit
  )
  returning id into v_location_id;

  insert into public.location_features (location_id, feature_key, feature_value, confidence, source)
  select
    v_location_id,
    'subtype',
    subtype_value,
    v_seed.data_confidence,
    'manual_seed_publish'
  from unnest(coalesce(v_seed.subtypes, '{}'::text[])) as subtype_value
  on conflict (location_id, feature_key, feature_value) do update set
    confidence = greatest(public.location_features.confidence, excluded.confidence),
    source = excluded.source,
    updated_at = now();

  update public.location_manual_seeds
  set
    published_location_id = v_location_id,
    publish_status = 'published',
    published_at = now(),
    last_publish_error = null,
    updated_at = now()
  where id = p_seed_id;

  return v_location_id;
exception
  when others then
    update public.location_manual_seeds
    set
      publish_status = 'error',
      last_publish_error = left(sqlerrm, 1000),
      updated_at = now()
    where id = p_seed_id;
    raise;
end;
$pd24$;

create or replace function public.pd24_publish_manual_seed_batch(
  p_city_slug text default null,
  p_import_batch text default null,
  p_limit integer default 50,
  p_max_distance_m integer default 250
)
returns table (
  seed_id uuid,
  location_id uuid,
  publish_status text
)
language plpgsql
as $pd24$
declare
  v_seed record;
  v_location_id uuid;
begin
  for v_seed in
    select s.id
    from public.location_manual_seeds s
    where s.is_active = true
      and (p_city_slug is null or s.city_slug = p_city_slug)
      and (p_import_batch is null or s.import_batch = p_import_batch)
      and s.publish_status in ('draft', 'error')
    order by s.city_slug, s.name
    limit greatest(p_limit, 1)
  loop
    begin
      v_location_id := public.pd24_publish_manual_seed(v_seed.id, p_max_distance_m);
    exception
      when others then
        v_location_id := null;
    end;

    return query
    select
      s.id,
      s.published_location_id,
      s.publish_status
    from public.location_manual_seeds s
    where s.id = v_seed.id;
  end loop;
end;
$pd24$;

commit;

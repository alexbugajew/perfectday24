-- opening_hours_raw durchgängig erhalten.
--
-- Bisher: locations.opening_hours_raw existiert, war aber bei 0 / 68.975
-- Locations gesetzt. Grund:
--   1) location_manual_seeds hatte gar keine opening_hours_raw Spalte
--   2) ingest-city-location-seeds.ts liest tags.opening_hours nur für
--      Scoring (+4 manual_boost wenn vorhanden), schreibt es nirgends
--   3) pd24_publish_manual_seed überträgt das Feld nicht von seed → locations
--
-- Folge: lib/planner/scoring.openingPenalty schlägt nie zu, weil
-- isLikelyOpen(openingHoursRaw=null) immer true zurückgibt. Der Planner
-- schlägt nachts geschlossene Restaurants vor.
--
-- Diese Migration:
-- 1) location_manual_seeds.opening_hours_raw hinzufügen
-- 2) pd24_publish_manual_seed um opening_hours_raw erweitern (insert + update)

begin;

alter table public.location_manual_seeds
  add column if not exists opening_hours_raw text;

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
      opening_hours_raw = coalesce(l.opening_hours_raw, v_seed.opening_hours_raw),
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
      budget = coalesce(l.budget, v_seed.budget, 'medium'),
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
    opening_hours_raw,
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
    coalesce(v_seed.budget, 'medium'),
    v_seed.category::location_category,
    v_seed.lat,
    v_seed.lng,
    v_seed.reservation_url,
    v_seed.duration_min,
    v_seed.opening_hours_raw,
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

commit;

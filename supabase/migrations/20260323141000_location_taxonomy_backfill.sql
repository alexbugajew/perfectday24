begin;

create or replace function public.pd24_backfill_location_taxonomy()
returns void
language plpgsql
as $$
begin
  with enriched as (
    select
      id,
      public.pd24_unique_text_array(
        coalesce(subtypes, '{}'::text[]) ||
        case when type = 'park' then array['park'] else '{}'::text[] end ||
        case when type in ('museum') then array['museum'] else '{}'::text[] end ||
        case when type in ('gallery', 'arts_centre') then array['gallery'] else '{}'::text[] end ||
        case when type in ('attraction') then array['landmark'] else '{}'::text[] end ||
        case when type in ('bowling_alley') then array['bowling'] else '{}'::text[] end ||
        case when type in ('miniature_golf') then array['minigolf'] else '{}'::text[] end ||
        case when type in ('nightclub', 'club') then array['nightclub'] else '{}'::text[] end ||
        case when type in ('pub') then array['pub'] else '{}'::text[] end ||
        case when type in ('bar') then array['cocktail_bar'] else '{}'::text[] end ||
        case when type in ('zoo') then array['zoo'] else '{}'::text[] end ||
        case when type in ('water_park') then array['water_park'] else '{}'::text[] end ||
        case when type in ('sauna') then array['thermal_bath'] else '{}'::text[] end ||
        case when type in ('public_bath', 'swimming_pool') then array['swimming_pool'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%promenade%', '%ufer%', '%waterfront%']) then array['promenade'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%viewpoint%', '%lookout%', '%aussicht%', '%panorama%', '%plattform%']) then array['viewpoint'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%rooftop%', '%dachterrasse%']) then array['rooftop', 'rooftop_bar'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%romantic%', '%romantik%', '%rosengarten%', '%sunset%']) then array['romantic_spot'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%botanischer garten%', '%botanical%', '%arboretum%']) then array['botanical_garden'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%climb%', '%kletter%', '%boulder%']) then array['climbing'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%laser tag%', '%lasertag%', '%lasergame%', '%laserstar%']) then array['lasertag'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%escape room%', '%escape%']) then array['escape_room'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%wildpark%', '%tierpark%']) then array['wildpark'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%aquarium%']) then array['aquarium'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%spielplatz%', '%playground%']) then array['playground'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%kindermuseum%', '%children museum%']) then array['children_museum'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%science center%', '%science centre%', '%technikmuseum%', '%planetarium%']) then array['science_center'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%schwim%', '%freibad%', '%hallenbad%']) then array['swimming_pool'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%therme%', '%thermal%', '%spa%']) then array['thermal_bath'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%freizeitpark%', '%theme park%', '%amusement%']) then array['theme_park'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%bauernhof%', '%farm%', '%petting zoo%']) then array['farm_experience'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%pottery%', '%toepfer%', '%töpfer%']) then array['workshop_pottery'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%painting%', '%malen%', '%paint and sip%']) then array['workshop_painting'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%cocktailkurs%', '%cocktail class%', '%mixology%', '%mixen%']) then array['cocktail_workshop'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%paintball%']) then array['paintball'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%gokart%', '%karting%']) then array['gokart'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%wakeboard%']) then array['wakeboard'] else '{}'::text[] end ||
        case when category = 'event' then array['event_social'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%historic%', '%heritage%', '%schloss%', '%castle%', '%kirche%', '%church%']) then array['historic_site'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%altstadt%', '%old town%']) then array['old_town'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%memorial%', '%gedenk%', '%denkmal%']) then array['memorial', 'monument'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%live music%', '%jazz%', '%konzert%']) then array['live_music'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%disco%', '%dancefloor%']) then array['disco'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%afterhour%', '%after hour%']) then array['afterhour'] else '{}'::text[] end ||
        case when public.pd24_location_search_text(name, type, category::text, tags) like any (array['%döner%', '%doener%', '%pizza%', '%late food%', '%24/7%']) then array['late_food'] else '{}'::text[] end
      ) as derived_subtypes
    from public.locations
  )
  update public.locations l
  set
    subtypes = e.derived_subtypes,
    audiences = public.pd24_unique_text_array(
      coalesce(l.audiences, '{}'::text[]) ||
      case when e.derived_subtypes && array['zoo', 'wildpark', 'aquarium', 'playground', 'children_museum', 'science_center', 'swimming_pool', 'thermal_bath', 'theme_park', 'water_park', 'farm_experience'] then array['family'] else '{}'::text[] end ||
      case when e.derived_subtypes && array['bowling', 'minigolf', 'climbing', 'escape_room', 'workshop_pottery', 'workshop_painting', 'cocktail_workshop', 'paintball', 'gokart', 'wakeboard', 'event_social'] then array['friends'] else '{}'::text[] end ||
      case when e.derived_subtypes && array['promenade', 'viewpoint', 'rooftop', 'romantic_spot', 'botanical_garden', 'cocktail_bar', 'gallery', 'thermal_bath'] then array['date'] else '{}'::text[] end ||
      case when e.derived_subtypes && array['landmark', 'historic_site', 'museum', 'gallery', 'old_town', 'monument', 'memorial', 'viewpoint', 'promenade'] then array['tourism'] else '{}'::text[] end ||
      case when e.derived_subtypes && array['cocktail_bar', 'pub', 'rooftop_bar', 'nightclub', 'disco', 'live_music', 'afterhour', 'late_food'] then array['party'] else '{}'::text[] end
    ),
    occasions = public.pd24_unique_text_array(
      coalesce(l.occasions, '{}'::text[]) ||
      case when e.derived_subtypes && array['promenade', 'viewpoint', 'rooftop', 'romantic_spot', 'park', 'botanical_garden', 'bowling', 'minigolf', 'climbing', 'lasertag', 'escape_room', 'thermal_bath', 'gallery', 'cocktail_bar'] then array['date'] else '{}'::text[] end ||
      case when e.derived_subtypes && array['zoo', 'wildpark', 'aquarium', 'playground', 'children_museum', 'science_center', 'swimming_pool', 'thermal_bath', 'theme_park', 'water_park', 'farm_experience', 'park', 'minigolf'] then array['family'] else '{}'::text[] end ||
      case when e.derived_subtypes && array['bowling', 'minigolf', 'climbing', 'lasertag', 'escape_room', 'workshop_pottery', 'workshop_painting', 'cocktail_workshop', 'paintball', 'gokart', 'wakeboard', 'event_social', 'pub', 'cocktail_bar', 'rooftop_bar'] then array['friends'] else '{}'::text[] end ||
      case when e.derived_subtypes && array['landmark', 'historic_site', 'museum', 'gallery', 'viewpoint', 'old_town', 'monument', 'memorial', 'promenade', 'park'] then array['tourism'] else '{}'::text[] end ||
      case when e.derived_subtypes && array['cocktail_bar', 'pub', 'rooftop_bar', 'nightclub', 'disco', 'live_music', 'afterhour', 'late_food'] then array['party'] else '{}'::text[] end
    ),
    family_friendly = (
      coalesce(l.family_friendly, false) or
      e.derived_subtypes && array['zoo', 'wildpark', 'aquarium', 'playground', 'children_museum', 'science_center', 'swimming_pool', 'theme_park', 'water_park', 'farm_experience', 'park', 'minigolf']
    ),
    energy_level = coalesce(
      l.energy_level,
      case
        when e.derived_subtypes && array['afterhour', 'late_food'] then 'late'
        when e.derived_subtypes && array['nightclub', 'disco', 'paintball', 'gokart', 'wakeboard', 'theme_park', 'water_park', 'climbing', 'lasertag'] then 'high'
        when e.derived_subtypes && array['cocktail_bar', 'pub', 'rooftop_bar', 'bowling', 'minigolf', 'zoo', 'wildpark'] then 'medium'
        when e.derived_subtypes && array['viewpoint', 'promenade', 'park', 'gallery', 'museum', 'memorial', 'historic_site', 'children_museum', 'science_center', 'thermal_bath'] then 'low'
        else null
      end
    ),
    indoor_outdoor = coalesce(
      l.indoor_outdoor,
      case
        when e.derived_subtypes && array['park', 'promenade', 'viewpoint', 'zoo', 'wildpark', 'playground', 'theme_park', 'wakeboard', 'farm_experience', 'old_town', 'monument', 'memorial'] then 'outdoor'
        when e.derived_subtypes && array['museum', 'gallery', 'children_museum', 'science_center', 'bowling', 'climbing', 'lasertag', 'escape_room', 'workshop_pottery', 'workshop_painting', 'cocktail_workshop', 'paintball', 'gokart', 'cocktail_bar', 'pub', 'nightclub', 'disco', 'live_music', 'afterhour', 'late_food'] then 'indoor'
        when e.derived_subtypes && array['rooftop', 'rooftop_bar', 'minigolf', 'swimming_pool', 'thermal_bath', 'water_park'] then 'mixed'
        else null
      end
    ),
    source_primary = coalesce(nullif(l.source_primary, ''), 'osm'),
    data_confidence = greatest(
      coalesce(l.data_confidence, 0),
      case
        when e.derived_subtypes && array['zoo', 'museum', 'gallery', 'nightclub', 'bowling', 'minigolf', 'water_park'] then 0.75
        when e.derived_subtypes <> '{}'::text[] then 0.55
        else 0.25
      end
    ),
    last_enriched_at = now(),
    enrichment_version = greatest(coalesce(l.enrichment_version, 0), 1)
  from enriched e
  where l.id = e.id;

  insert into public.location_features (location_id, feature_key, feature_value, confidence, source)
  select
    l.id,
    'subtype',
    subtype_value,
    case
      when subtype_value in ('zoo', 'museum', 'gallery', 'nightclub', 'bowling', 'minigolf', 'water_park') then 0.95
      else 0.75
    end,
    'taxonomy_backfill'
  from public.locations l
  cross join lateral unnest(l.subtypes) as subtype_value
  on conflict (location_id, feature_key, feature_value) do update set
    confidence = greatest(public.location_features.confidence, excluded.confidence),
    source = excluded.source,
    updated_at = now();
end;
$$;

select public.pd24_backfill_location_taxonomy();

commit;

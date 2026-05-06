begin;

create or replace function public.pd24_backfill_berlin_nightlife_v3(
  p_limit integer default 500
)
returns integer
language plpgsql
as $pd24$
declare
  v_rows integer := 0;
begin
  with candidates as (
    select
      id,
      name,
      type,
      category,
      tags,
      subtypes,
      occasions,
      audiences,
      nightlife_fit,
      source_primary,
      source_refs,
      data_confidence
    from public.locations
    where city_slug = 'berlin-berlin'
      and is_plannable = true
      and (
        type in ('bar', 'pub', 'nightclub', 'club', 'biergarten', 'cafe, bar')
        or category::text = 'nightlife'
      )
      and (
        coalesce(cardinality(subtypes), 0) = 0
        or not (
          'cocktail_bar' = any(coalesce(subtypes, '{}'::text[]))
          or 'pub' = any(coalesce(subtypes, '{}'::text[]))
          or 'nightclub' = any(coalesce(subtypes, '{}'::text[]))
          or 'disco' = any(coalesce(subtypes, '{}'::text[]))
          or 'live_music' = any(coalesce(subtypes, '{}'::text[]))
          or 'rooftop_bar' = any(coalesce(subtypes, '{}'::text[]))
        )
      )
    order by
      case
        when type = 'nightclub' then 1
        when type = 'club' then 2
        when type = 'bar' and category::text = 'nightlife' then 3
        when type = 'pub' and category::text = 'nightlife' then 4
        when type = 'biergarten' then 5
        else 6
      end,
      quality_score desc nulls last,
      importance_score desc nulls last,
      id
    limit greatest(p_limit, 1)
  ),
  enriched as (
    select
      id,
      lower(
        concat_ws(
          ' ',
          coalesce(name, ''),
          coalesce(type, ''),
          coalesce(category::text, ''),
          array_to_string(coalesce(tags, '{}'::text[]), ' ')
        )
      ) as text_blob,
      public.pd24_unique_text_array(
        coalesce(subtypes, '{}'::text[]) ||
        case
          when type = 'pub' then array['pub']
          else '{}'::text[]
        end ||
        case
          when type = 'biergarten' then array['pub']
          else '{}'::text[]
        end ||
        case
          when type = 'bar' and category::text = 'nightlife' then array['cocktail_bar']
          else '{}'::text[]
        end ||
        case
          when type in ('nightclub', 'club') then array['nightclub']
          else '{}'::text[]
        end ||
        case
          when lower(coalesce(name, '')) like any (array['%rooftop%', '%dachterrasse%', '%skybar%', '%terrace%']) then array['rooftop', 'rooftop_bar']
          else '{}'::text[]
        end ||
        case
          when lower(coalesce(name, '')) like any (array['%cocktail%', '%mixology%']) then array['cocktail_bar']
          else '{}'::text[]
        end ||
        case
          when lower(coalesce(name, '')) like any (array['%disco%', '%dance%', '%tanz%', '%danceclub%']) then array['disco', 'nightclub']
          else '{}'::text[]
        end ||
        case
          when lower(coalesce(name, '')) like any (array['%jazz%', '%live%', '%music%', '%konzert%', '%concert%']) then array['live_music']
          else '{}'::text[]
        end ||
        case
          when lower(coalesce(name, '')) like any (array['%lounge%']) then array['cocktail_bar']
          else '{}'::text[]
        end
      ) as derived_subtypes
    from candidates
  ),
  updated as (
    update public.locations l
    set
      subtypes = e.derived_subtypes,
      audiences = public.pd24_unique_text_array(
        coalesce(l.audiences, '{}'::text[]) ||
        case
          when e.derived_subtypes && array['cocktail_bar', 'pub', 'rooftop_bar'] then array['date', 'friends', 'party']
          else '{}'::text[]
        end ||
        case
          when e.derived_subtypes && array['nightclub', 'disco', 'live_music'] then array['friends', 'party']
          else '{}'::text[]
        end
      ),
      occasions = public.pd24_unique_text_array(
        coalesce(l.occasions, '{}'::text[]) ||
        case
          when e.derived_subtypes && array['cocktail_bar', 'pub', 'rooftop_bar'] then array['date', 'friends', 'party']
          else '{}'::text[]
        end ||
        case
          when e.derived_subtypes && array['nightclub', 'disco', 'live_music'] then array['friends', 'party']
          else '{}'::text[]
        end
      ),
      nightlife_fit = true,
      source_primary = coalesce(nullif(l.source_primary, ''), 'osm'),
      source_refs = coalesce(l.source_refs, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'source', 'nightlife_backfill_v3',
          'published_at', now()
        )
      ),
      data_confidence = greatest(
        coalesce(l.data_confidence, 0),
        case
          when e.derived_subtypes && array['nightclub', 'disco'] then 0.82
          when e.derived_subtypes && array['cocktail_bar', 'pub', 'live_music', 'rooftop_bar'] then 0.74
          else 0.60
        end
      ),
      last_enriched_at = now(),
      enrichment_version = greatest(coalesce(l.enrichment_version, 0), 3)
    from enriched e
    where l.id = e.id
    returning l.id, l.subtypes
  )
  insert into public.location_features (location_id, feature_key, feature_value, confidence, source)
  select
    u.id,
    'subtype',
    subtype_value,
    case
      when subtype_value in ('nightclub', 'disco') then 0.82
      else 0.74
    end,
    'berlin_nightlife_backfill_v3'
  from updated u
  cross join lateral unnest(u.subtypes) as subtype_value
  where subtype_value in ('cocktail_bar', 'pub', 'nightclub', 'disco', 'live_music', 'rooftop', 'rooftop_bar')
  on conflict (location_id, feature_key, feature_value) do update set
    confidence = greatest(public.location_features.confidence, excluded.confidence),
    source = excluded.source,
    updated_at = now();

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$pd24$;

commit;

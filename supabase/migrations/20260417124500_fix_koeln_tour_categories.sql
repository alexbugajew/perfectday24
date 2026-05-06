begin;

with target_rows as (
  select
    id,
    coalesce(
      (
        select jsonb_agg(value order by value)
        from (
          select distinct
            case
              when subtype = 'seasonal' then 'community'
              else subtype
            end as value
          from jsonb_array_elements_text(coalesce(subtypes, '[]'::jsonb)) as subtype

          union

          select 'guided_tour' as value
        ) deduped
        where value is not null
      ),
      '[]'::jsonb
    ) as next_subtypes
  from public.planner_events
  where source = 'koeln_tourism'
    and category in ('seasonal', 'market')
    and (
      coalesce(title, '') ~* '(panoramafahrt|skyline\\s+tour|timeride|time\\s+ride|nachtwaechtertour|schiffstour)'
      or exists (
        select 1
        from jsonb_array_elements_text(coalesce(tags, '[]'::jsonb)) as tag
        where tag ~* '(panoramafahrt|skyline\\s+tour|timeride|time\\s+ride|nachtwaechtertour|schiffstour)'
      )
    )
)
update public.planner_events events
set
  category = 'community',
  subtypes = target_rows.next_subtypes,
  audiences = '["tourism","friends"]'::jsonb,
  occasions = '["tourism","friends"]'::jsonb,
  updated_at = now()
from target_rows
where events.id = target_rows.id;

commit;

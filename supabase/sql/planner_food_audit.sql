-- Planner food audit for Berlin / Hamburg
-- Run with psql against the transaction pooler.

-- 1. Overall restaurant/cafe/nightlife shape per city
select
  city_slug,
  count(*) filter (where category = 'restaurant') as restaurants,
  count(*) filter (where category = 'cafe') as cafes,
  count(*) filter (where category = 'nightlife') as nightlife,
  count(*) filter (where type = 'restaurant') as type_restaurant,
  count(*) filter (where type = 'cafe') as type_cafe,
  count(*) filter (where type = 'bar') as type_bar,
  count(*) filter (where type = 'pub') as type_pub
from public.locations
where city_slug in ('berlin-berlin', 'hamburg-hamburg')
  and is_plannable = true
group by city_slug
order by city_slug;

-- 2. Sushi / italian keyword coverage in planner search text
with base as (
  select
    city_slug,
    id,
    name,
    type,
    category,
    budget,
    tags,
    subtypes,
    audiences,
    occasions,
    lower(
      concat_ws(
        ' ',
        coalesce(name, ''),
        coalesce(type, ''),
        coalesce(category::text, ''),
        array_to_string(coalesce(tags, '{}'::text[]), ' '),
        array_to_string(coalesce(subtypes, '{}'::text[]), ' '),
        array_to_string(coalesce(audiences, '{}'::text[]), ' '),
        array_to_string(coalesce(occasions, '{}'::text[]), ' ')
      )
    ) as planner_text
  from public.locations
  where city_slug in ('berlin-berlin', 'hamburg-hamburg')
    and is_plannable = true
)
select
  city_slug,
  count(*) filter (where planner_text like '%sushi%') as sushi_hits,
  count(*) filter (where planner_text like '%italien%' or planner_text like '%italian%' or planner_text like '%pizzeria%' or planner_text like '%pizza%' or planner_text like '%pasta%') as italian_hits,
  count(*) filter (where planner_text like '%vegan%') as vegan_hits
from base
group by city_slug
order by city_slug;

-- 3. Sushi / italian by resulting planner category
with base as (
  select
    city_slug,
    name,
    type,
    category,
    budget,
    lower(
      concat_ws(
        ' ',
        coalesce(name, ''),
        coalesce(type, ''),
        coalesce(category::text, ''),
        array_to_string(coalesce(tags, '{}'::text[]), ' '),
        array_to_string(coalesce(subtypes, '{}'::text[]), ' '),
        array_to_string(coalesce(audiences, '{}'::text[]), ' '),
        array_to_string(coalesce(occasions, '{}'::text[]), ' ')
      )
    ) as planner_text
  from public.locations
  where city_slug in ('berlin-berlin', 'hamburg-hamburg')
    and is_plannable = true
)
select
  city_slug,
  category,
  count(*) filter (where planner_text like '%sushi%') as sushi_hits,
  count(*) filter (where planner_text like '%italien%' or planner_text like '%italian%' or planner_text like '%pizzeria%' or planner_text like '%pizza%' or planner_text like '%pasta%') as italian_hits
from base
group by city_slug, category
having
  count(*) filter (where planner_text like '%sushi%') > 0
  or count(*) filter (where planner_text like '%italien%' or planner_text like '%italian%' or planner_text like '%pizzeria%' or planner_text like '%pizza%' or planner_text like '%pasta%') > 0
order by city_slug, category;

-- 4. Top sushi candidates the planner could theoretically see
with base as (
  select
    city_slug,
    id,
    name,
    type,
    category,
    budget,
    rating,
    rating_count,
    quality_score,
    importance_score,
    popularity_score,
    subtypes,
    audiences,
    occasions,
    lower(
      concat_ws(
        ' ',
        coalesce(name, ''),
        coalesce(type, ''),
        coalesce(category::text, ''),
        array_to_string(coalesce(tags, '{}'::text[]), ' '),
        array_to_string(coalesce(subtypes, '{}'::text[]), ' '),
        array_to_string(coalesce(audiences, '{}'::text[]), ' '),
        array_to_string(coalesce(occasions, '{}'::text[]), ' ')
      )
    ) as planner_text
  from public.locations
  where city_slug in ('berlin-berlin', 'hamburg-hamburg')
    and is_plannable = true
)
select
  city_slug,
  name,
  type,
  category,
  budget,
  rating,
  rating_count,
  quality_score,
  importance_score,
  popularity_score,
  subtypes,
  audiences,
  occasions
from base
where planner_text like '%sushi%'
order by
  city_slug,
  quality_score desc nulls last,
  importance_score desc nulls last,
  popularity_score desc nulls last,
  rating desc nulls last,
  rating_count desc nulls last
limit 40;

-- 5. Top italian candidates the planner could theoretically see
with base as (
  select
    city_slug,
    id,
    name,
    type,
    category,
    budget,
    rating,
    rating_count,
    quality_score,
    importance_score,
    popularity_score,
    subtypes,
    audiences,
    occasions,
    lower(
      concat_ws(
        ' ',
        coalesce(name, ''),
        coalesce(type, ''),
        coalesce(category::text, ''),
        array_to_string(coalesce(tags, '{}'::text[]), ' '),
        array_to_string(coalesce(subtypes, '{}'::text[]), ' '),
        array_to_string(coalesce(audiences, '{}'::text[]), ' '),
        array_to_string(coalesce(occasions, '{}'::text[]), ' ')
      )
    ) as planner_text
  from public.locations
  where city_slug in ('berlin-berlin', 'hamburg-hamburg')
    and is_plannable = true
)
select
  city_slug,
  name,
  type,
  category,
  budget,
  rating,
  rating_count,
  quality_score,
  importance_score,
  popularity_score,
  subtypes,
  audiences,
  occasions
from base
where
  planner_text like '%italien%'
  or planner_text like '%italian%'
  or planner_text like '%pizzeria%'
  or planner_text like '%pizza%'
  or planner_text like '%pasta%'
order by
  city_slug,
  quality_score desc nulls last,
  importance_score desc nulls last,
  popularity_score desc nulls last,
  rating desc nulls last,
  rating_count desc nulls last
limit 40;

-- 6. Obvious misclassification candidates: food-looking places not categorized as restaurant/cafe
with base as (
  select
    city_slug,
    name,
    type,
    category,
    budget,
    subtypes,
    audiences,
    occasions,
    lower(
      concat_ws(
        ' ',
        coalesce(name, ''),
        coalesce(type, ''),
        coalesce(category::text, ''),
        array_to_string(coalesce(tags, '{}'::text[]), ' '),
        array_to_string(coalesce(subtypes, '{}'::text[]), ' '),
        array_to_string(coalesce(audiences, '{}'::text[]), ' '),
        array_to_string(coalesce(occasions, '{}'::text[]), ' ')
      )
    ) as planner_text
  from public.locations
  where city_slug in ('berlin-berlin', 'hamburg-hamburg')
    and is_plannable = true
)
select
  city_slug,
  name,
  type,
  category,
  budget,
  subtypes
from base
where
  (
    planner_text like '%sushi%'
    or planner_text like '%italien%'
    or planner_text like '%italian%'
    or planner_text like '%pizzeria%'
    or planner_text like '%pizza%'
    or planner_text like '%pasta%'
  )
  and category not in ('restaurant', 'cafe')
order by city_slug, category, name
limit 60;

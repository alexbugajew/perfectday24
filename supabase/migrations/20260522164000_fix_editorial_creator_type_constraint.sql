-- ============================================================
-- Fix: Extend user_routes_creator_type_check to include 'editorial'
-- and update the editorial routes seeded via apply-editorial-routes.py
-- ============================================================

begin;

-- 1. Update the check constraint on user_routes to include 'editorial'
alter table public.user_routes
  drop constraint if exists user_routes_creator_type_check;

alter table public.user_routes
  add constraint user_routes_creator_type_check
    check (creator_type in ('user', 'creator', 'influencer', 'brand', 'editorial'));

-- 2. Update the editorial routes that were inserted as 'creator' to 'editorial'
--    (only affects routes from the pd24-redaktion creator profile)
update public.user_routes
set creator_type = 'editorial',
    updated_at   = now()
where slug like 'pd24-%'
  and creator_type = 'creator'
  and creator_profile_id in (
    select id from public.creator_profiles
    where username = 'pd24-redaktion'
  );

commit;

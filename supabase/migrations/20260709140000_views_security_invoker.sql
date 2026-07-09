-- Fix `security_definer_view` (Supabase linter, ERROR) for the 5 flagged views.
--
-- A Postgres view with security_invoker = off (the default) runs with the view
-- OWNER's privileges, bypassing the querying user's Row Level Security on the
-- base tables. Setting security_invoker = on makes the view respect the caller's
-- RLS — which is what these views were meant to do all along (see the inline
-- comment on event_vendors_view: "access is governed by RLS on the underlying
-- tables").
--
-- VERIFIED SAFE
-- No application code (.ts/.tsx, client or server) references any of these views
-- by name; service-role callers bypass RLS regardless, so reports/scripts are
-- unaffected. Three views read public base tables (cities, locations,
-- restaurants) and stay readable for anon; the two over restricted bases
-- (service_providers, profiles) simply stop leaking past base RLS. The app's
-- public vendor browsing reads public.service_providers directly, not the view.
--
-- IF EXISTS: three of these views (city_location_stats, v_city_readiness,
-- restaurants_recommended) currently live only in the database, not in a repo
-- migration, so a fresh deploy skips them harmlessly. Idempotent.

begin;

alter view if exists public.city_location_stats     set (security_invoker = on);
alter view if exists public.v_city_readiness         set (security_invoker = on);
alter view if exists public.restaurants_recommended  set (security_invoker = on);
alter view if exists public.event_vendors_view       set (security_invoker = on);
alter view if exists public.premium_users_active     set (security_invoker = on);

commit;

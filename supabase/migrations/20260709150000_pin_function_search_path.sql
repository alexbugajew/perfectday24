-- NACHTRAG 2026-08-26: Wert ist jetzt `public, extensions` statt nur `public`.
-- Der Supabase-Support verlagert PostGIS aus `public` in das `extensions`-Schema
-- (das ist die einzige unterstuetzte Behebung des spatial_ref_sys-Befunds, siehe
-- 20260709170000). Danach findet eine Routine mit search_path=public die
-- st_*-Funktionen nicht mehr und bricht zur Laufzeit. Betroffen laut Support:
-- get_locations_nearby, get_locations_nearby_full, osm_places_raw_osm2pgsql_valid,
-- pd24_refresh_restaurants_from_raw, pd24_seed_match_location — angewandt wurde
-- es auf alle App-Routinen mit search_path=public, als Obermenge.
--
-- Fix `function_search_path_mutable` (Supabase linter, WARN) for every app-owned
-- function/procedure in the public schema. A routine without a fixed search_path
-- resolves unqualified names via the CALLER's search_path — which a SECURITY
-- DEFINER routine can be tricked into using to run attacker-controlled objects.
-- Pinning search_path = public closes that. This also covers the two
-- {anon,authenticated}_security_definer_function_executable warnings' real risk.
--
-- WHY CATALOG-DRIVEN
-- The linter only lists names, not signatures, and several routines are
-- overloaded (st_estimatedextent x3, normalize_tags x2). Iterating pg_proc and
-- using oid::regprocedure yields the exact, fully-qualified signature for each,
-- so overloads are handled and nothing is hand-typed.
--
-- SCOPE / SAFETY
--   * schema public only
--   * functions + procedures (prokind f/p), not aggregates/window funcs
--   * NOT owned by an extension (postgis / pg_trgm are left alone — the correct
--     fix for those is moving the extension out of public; altering extension
--     internals is lost on upgrade and usually not permitted anyway)
--   * skip routines that already pin search_path  ->  idempotent, re-runnable
--   * per-routine errors are caught and logged, never aborting the batch
--
-- VALUE = public (not '' and not pg_temp)
--   '' would require every unqualified reference in the bodies to be schema-
--   qualified (we are not rewriting bodies). public keeps the app tables AND the
--   in-public extensions (pg_trgm.similarity, postgis st_*) these routines call
--   unqualified resolvable; pg_catalog is always searched implicitly so built-ins
--   still resolve; pg_temp is intentionally omitted to reduce definer-hijack
--   surface.

begin;

do $$
declare
  r      record;
  n_done int := 0;
  n_skip int := 0;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (
        select 1 from pg_depend d
        where d.objid = p.oid and d.deptype = 'e'
      )
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
        where c like 'search_path=%'
      )
  loop
    begin
      execute format('alter routine %s set search_path = public, extensions', r.sig);
      n_done := n_done + 1;
    exception when others then
      n_skip := n_skip + 1;
      raise notice 'skip %: %', r.sig, sqlerrm;
    end;
  end loop;
  raise notice 'search_path=public pinned on % routine(s); % skipped', n_done, n_skip;
end $$;

commit;

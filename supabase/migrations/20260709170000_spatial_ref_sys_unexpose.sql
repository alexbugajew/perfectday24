-- Clear the final rls_disabled_in_public ERROR: public.spatial_ref_sys.
--
-- spatial_ref_sys is the PostGIS SRID reference table, OWNED by the PostGIS
-- extension — not by the postgres role. So `ALTER TABLE ... ENABLE ROW LEVEL
-- SECURITY` fails with insufficient_privilege (that is why migration
-- 20260709130000 logged a skip for it). It holds only static, public spatial
-- reference definitions — no user data.
--
-- The lint fires because the table is (a) RLS-disabled and (b) reachable through
-- PostgREST (anon/authenticated hold grants). Since we can't enable RLS, the
-- sanctioned fix is to stop exposing it: revoke the API-role grants. Verified
-- safe — no anon/authenticated code path reads it: no client-side ST_Transform,
-- no rpc('get_locations_nearby') from the browser, and the geo RPCs are
-- SECURITY DEFINER (they run as their owner, which keeps its own access).

begin;

do $$
begin
  -- 1) Preferred: enable RLS (works only if we own the table).
  begin
    execute 'alter table public.spatial_ref_sys enable row level security';
    raise notice 'spatial_ref_sys: RLS enabled';
    return;
  exception when others then
    raise notice 'spatial_ref_sys: enable RLS not permitted (%); revoking API grants instead', sqlerrm;
  end;

  -- 2) Drop it from the PostgREST surface for the API roles.
  begin
    execute 'revoke all on table public.spatial_ref_sys from anon, authenticated';
    raise notice 'spatial_ref_sys: revoked anon/authenticated grants';
  exception when others then
    raise notice 'spatial_ref_sys: revoke anon/authenticated failed (%)', sqlerrm;
  end;

  -- 3) Belt-and-suspenders: PostGIS may have granted SELECT to PUBLIC.
  begin
    execute 'revoke select on table public.spatial_ref_sys from public';
    raise notice 'spatial_ref_sys: revoked PUBLIC select';
  exception when others then
    raise notice 'spatial_ref_sys: revoke PUBLIC not permitted (%); if the lint persists it is a benign PostGIS-ownership edge — accept it or move PostGIS to a dedicated schema', sqlerrm;
  end;
end $$;

commit;

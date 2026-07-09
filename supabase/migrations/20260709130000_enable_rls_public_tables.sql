-- Enable RLS on the 20 PostgREST-exposed public tables flagged by the Supabase
-- linter as `rls_disabled_in_public` (ERROR). Without RLS, anyone holding the
-- public anon key (shipped in the browser bundle) can read AND write every row
-- of these tables. This closes that hole.
--
-- SAFETY MODEL
-- The _pd24_rls_bootstrap helper only acts on a relation when it is a real TABLE
-- (relkind='r') whose RLS is currently OFF. Views and already-protected tables
-- are skipped, so no existing policy is ever broadened. Fully idempotent: a
-- second run is a no-op because RLS is then already on. Per-table errors (e.g.
-- the PostGIS-owned spatial_ref_sys) are caught and logged, never aborting the
-- rest of the migration.
--
-- CLASSIFICATION (verified against the actual query code, not guessed)
--   public_readonly  SELECT for anon+authenticated USING(true); no client writes.
--                    Writes happen only through the service-role (ingest/admin),
--                    which bypasses RLS. Used for public reference/content.
--   user_private     All ops for authenticated, scoped to auth.uid() = <owner>.
--                    No anon access. Used for per-user private rows.
--   admin_internal   RLS on, NO policy: only the service-role (bypass) can touch
--                    it. Used for internal staging / analytics never read by an
--                    RLS-bound client.

begin;

create or replace function public._pd24_rls_bootstrap(
  p_table text,
  p_mode  text,
  p_owner text default null
) returns void
language plpgsql
as $fn$
declare
  v_relkind "char";
  v_rls     boolean;
begin
  select c.relkind, c.relrowsecurity
    into v_relkind, v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = p_table;

  if v_relkind is null then
    raise notice 'skip %: relation not found', p_table; return;
  end if;
  if v_relkind <> 'r' then
    raise notice 'skip %: not a table (relkind=%)', p_table, v_relkind; return;
  end if;
  if v_rls then
    raise notice 'skip %: RLS already enabled (existing policies left intact)', p_table; return;
  end if;

  begin
    execute format('alter table public.%I enable row level security', p_table);

    if p_mode = 'public_readonly' then
      execute format(
        'create policy %I on public.%I for select to anon, authenticated using (true)',
        p_table || '_sel_public', p_table);

    elsif p_mode = 'user_private' then
      if p_owner is null then
        raise exception 'mode user_private requires an owner column (table %)', p_table;
      end if;
      execute format(
        'create policy %I on public.%I for select to authenticated using (auth.uid() = %I)',
        p_table || '_sel_own', p_table, p_owner);
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (auth.uid() = %I)',
        p_table || '_ins_own', p_table, p_owner);
      execute format(
        'create policy %I on public.%I for update to authenticated using (auth.uid() = %I) with check (auth.uid() = %I)',
        p_table || '_upd_own', p_table, p_owner, p_owner);
      execute format(
        'create policy %I on public.%I for delete to authenticated using (auth.uid() = %I)',
        p_table || '_del_own', p_table, p_owner);

    elsif p_mode = 'admin_internal' then
      null; -- RLS enabled, no policy: service-role only.

    else
      raise exception 'unknown mode % (table %)', p_mode, p_table;
    end if;

    raise notice 'applied %: % (owner=%)', p_table, p_mode, coalesce(p_owner, '-');
  exception
    when others then
      -- Do not abort the whole migration for one relation (e.g. extension-owned
      -- spatial_ref_sys where postgres lacks ownership). Log and move on.
      raise notice 'skip %: could not enable RLS - %', p_table, sqlerrm;
  end;
end;
$fn$;

-- Public reference / content: readable by everyone, writable only via service-role.
select public._pd24_rls_bootstrap('cities',                  'public_readonly');
select public._pd24_rls_bootstrap('location_features',       'public_readonly');
select public._pd24_rls_bootstrap('location_subtype_catalog','public_readonly');
select public._pd24_rls_bootstrap('pd24_type_map',           'public_readonly');
select public._pd24_rls_bootstrap('type_mappings',           'public_readonly');
select public._pd24_rls_bootstrap('route_tags_catalog',      'public_readonly');
select public._pd24_rls_bootstrap('creator_rankings',        'public_readonly');
select public._pd24_rls_bootstrap('route_rankings',          'public_readonly');
select public._pd24_rls_bootstrap('restaurants',             'public_readonly');
select public._pd24_rls_bootstrap('route_collections',       'public_readonly');
select public._pd24_rls_bootstrap('route_collection_items',  'public_readonly');
select public._pd24_rls_bootstrap('spatial_ref_sys',         'public_readonly');

-- Per-user private: only the owner (authenticated) can read/write their rows.
select public._pd24_rls_bootstrap('creator_follows',           'user_private', 'follower_user_id');
select public._pd24_rls_bootstrap('creator_profile_bookmarks', 'user_private', 'user_id');
select public._pd24_rls_bootstrap('route_likes',               'user_private', 'user_id');
select public._pd24_rls_bootstrap('route_saves',               'user_private', 'user_id');

-- Internal staging / analytics: no anon or authenticated access (service-role only).
-- Also resolves the sensitive_columns_exposed finding on user_route_views.session_id.
select public._pd24_rls_bootstrap('location_manual_seeds', 'admin_internal');
select public._pd24_rls_bootstrap('location_source_data',  'admin_internal');
select public._pd24_rls_bootstrap('feed_events',           'admin_internal');
select public._pd24_rls_bootstrap('user_route_views',      'admin_internal');

drop function public._pd24_rls_bootstrap(text, text, text);

commit;

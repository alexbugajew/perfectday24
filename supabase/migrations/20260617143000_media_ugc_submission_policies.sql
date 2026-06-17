begin;

drop policy if exists "route_media_insert_contributor_public" on public.route_media;
create policy "route_media_insert_contributor_public"
  on public.route_media for insert to authenticated
  with check (
    role = 'gallery'
    and is_primary = false
    and exists (
      select 1
      from public.user_routes r
      join public.media_assets ma on ma.id = asset_id
      where r.id = route_id
        and r.visibility in ('public', 'unlisted')
        and ma.owner_user_id = auth.uid()
    )
  );

drop policy if exists "route_stop_media_insert_contributor_public" on public.route_stop_media;
create policy "route_stop_media_insert_contributor_public"
  on public.route_stop_media for insert to authenticated
  with check (
    role = 'gallery'
    and is_primary = false
    and exists (
      select 1
      from public.user_route_stops rs
      join public.user_routes r on r.id = rs.route_id
      join public.media_assets ma on ma.id = asset_id
      where rs.id = route_stop_id
        and r.visibility in ('public', 'unlisted')
        and ma.owner_user_id = auth.uid()
    )
  );

drop policy if exists "roadtrip_media_insert_contributor_public" on public.roadtrip_media;
create policy "roadtrip_media_insert_contributor_public"
  on public.roadtrip_media for insert to authenticated
  with check (
    role = 'gallery'
    and is_primary = false
    and exists (
      select 1
      from public.roadtrip_routes rr
      join public.media_assets ma on ma.id = asset_id
      where rr.id = roadtrip_route_id
        and rr.visibility in ('public', 'link_only')
        and ma.owner_user_id = auth.uid()
    )
  );

commit;

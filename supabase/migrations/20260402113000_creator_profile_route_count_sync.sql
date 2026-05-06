begin;

create or replace function public.refresh_creator_profile_route_count(target_creator_profile_id uuid)
returns void
language plpgsql
as $$
begin
  if target_creator_profile_id is null then
    return;
  end if;

  update public.creator_profiles cp
  set
    route_count = (
      select count(*)
      from public.user_routes ur
      where ur.creator_profile_id = target_creator_profile_id
    ),
    updated_at = now()
  where cp.id = target_creator_profile_id;
end;
$$;

create or replace function public.pd24_sync_creator_profile_route_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_creator_profile_route_count(old.creator_profile_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.creator_profile_id is distinct from new.creator_profile_id then
      perform public.refresh_creator_profile_route_count(old.creator_profile_id);
    end if;

    perform public.refresh_creator_profile_route_count(new.creator_profile_id);
    return new;
  end if;

  perform public.refresh_creator_profile_route_count(new.creator_profile_id);
  return new;
end;
$$;

drop trigger if exists pd24_user_routes_refresh_creator_profile_route_count on public.user_routes;
create trigger pd24_user_routes_refresh_creator_profile_route_count
after insert or update or delete on public.user_routes
for each row
execute function public.pd24_sync_creator_profile_route_count();

commit;

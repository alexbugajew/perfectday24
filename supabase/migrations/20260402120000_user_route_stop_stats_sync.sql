begin;

create or replace function public.refresh_user_route_stop_stats(target_route_id uuid)
returns void
language plpgsql
as $$
begin
  if target_route_id is null then
    return;
  end if;

  update public.user_routes ur
  set
    stop_count = coalesce((
      select count(*)
      from public.user_route_stops urs
      where urs.route_id = target_route_id
    ), 0),
    required_stop_count = coalesce((
      select count(*)
      from public.user_route_stops urs
      where urs.route_id = target_route_id
        and urs.is_required = true
    ), 0),
    photo_count = coalesce((
      select count(*)
      from public.user_route_stops urs
      where urs.route_id = target_route_id
        and urs.photo_url is not null
        and btrim(urs.photo_url) <> ''
    ), 0),
    updated_at = now()
  where ur.id = target_route_id;
end;
$$;

create or replace function public.pd24_sync_user_route_stop_stats()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_user_route_stop_stats(old.route_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.route_id is distinct from new.route_id then
      perform public.refresh_user_route_stop_stats(old.route_id);
    end if;

    perform public.refresh_user_route_stop_stats(new.route_id);
    return new;
  end if;

  perform public.refresh_user_route_stop_stats(new.route_id);
  return new;
end;
$$;

drop trigger if exists pd24_user_route_stops_refresh_stats on public.user_route_stops;
create trigger pd24_user_route_stops_refresh_stats
after insert or update or delete on public.user_route_stops
for each row
execute function public.pd24_sync_user_route_stop_stats();

commit;

begin;

create or replace function public.refresh_creator_profile_like_count(target_creator_profile_id uuid)
returns void
language plpgsql
as $$
begin
  if target_creator_profile_id is null then
    return;
  end if;

  update public.creator_profiles cp
  set
    total_likes_received = coalesce((
      select sum(coalesce(ur.like_count, 0))
      from public.user_routes ur
      where ur.creator_profile_id = target_creator_profile_id
    ), 0),
    updated_at = now()
  where cp.id = target_creator_profile_id;
end;
$$;

create or replace function public.refresh_creator_profile_bookmark_count(target_creator_profile_id uuid)
returns void
language plpgsql
as $$
begin
  if target_creator_profile_id is null then
    return;
  end if;

  update public.creator_profiles cp
  set
    total_bookmarks_received = coalesce((
      select sum(coalesce(ur.bookmark_count, 0))
      from public.user_routes ur
      where ur.creator_profile_id = target_creator_profile_id
    ), 0),
    updated_at = now()
  where cp.id = target_creator_profile_id;
end;
$$;

create or replace function public.pd24_sync_creator_profile_engagement()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_creator_profile_like_count(old.creator_profile_id);
    perform public.refresh_creator_profile_bookmark_count(old.creator_profile_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.creator_profile_id is distinct from new.creator_profile_id then
      perform public.refresh_creator_profile_like_count(old.creator_profile_id);
      perform public.refresh_creator_profile_bookmark_count(old.creator_profile_id);
    end if;

    perform public.refresh_creator_profile_like_count(new.creator_profile_id);
    perform public.refresh_creator_profile_bookmark_count(new.creator_profile_id);
    return new;
  end if;

  perform public.refresh_creator_profile_like_count(new.creator_profile_id);
  perform public.refresh_creator_profile_bookmark_count(new.creator_profile_id);
  return new;
end;
$$;

drop trigger if exists pd24_user_routes_refresh_creator_profile_engagement on public.user_routes;
create trigger pd24_user_routes_refresh_creator_profile_engagement
after insert or update or delete on public.user_routes
for each row
execute function public.pd24_sync_creator_profile_engagement();

commit;

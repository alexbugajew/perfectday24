begin;

create or replace function public.toggle_public_plan_choice_reaction(
  p_token text,
  p_voter_label text
)
returns table (
  confirmed boolean,
  total_count integer
)
language plpgsql
security definer
set search_path = public
as $pd24$
declare
  v_plan_id uuid;
  v_voter_label text;
  v_voter_key text;
  v_existing boolean;
  v_total_count integer;
  v_chat_id uuid;
  v_chat_owner_user_id uuid;
  v_choice_label text;
  v_expected_count integer;
  v_majority integer;
begin
  select
    p.id,
    p.filters ->> 'pinnedVariantLabel'
  into
    v_plan_id,
    v_choice_label
  from public.plans p
  where p.share_token = p_token
  limit 1;

  if v_plan_id is null then
    raise exception 'Plan mit Share-Token nicht gefunden';
  end if;

  v_voter_label := btrim(coalesce(p_voter_label, ''));
  v_voter_key := lower(v_voter_label);

  if v_voter_key = '' then
    raise exception 'Name fehlt';
  end if;

  select exists(
    select 1
    from public.plan_choice_reactions
    where plan_id = v_plan_id
      and voter_key = v_voter_key
  )
    into v_existing;

  select
    c.id,
    c.owner_user_id
  into
    v_chat_id,
    v_chat_owner_user_id
  from public.user_plan_group_chats c
  where c.plan_id = v_plan_id
  limit 1;

  if v_existing then
    delete from public.plan_choice_reactions
    where plan_id = v_plan_id
      and voter_key = v_voter_key;

    select count(*)::integer
      into v_total_count
    from public.plan_choice_reactions
    where plan_id = v_plan_id;

    if v_chat_id is not null and v_chat_owner_user_id is not null then
      insert into public.user_plan_group_chat_messages (
        chat_id,
        sender_user_id,
        message_type,
        body
      ) values (
        v_chat_id,
        v_chat_owner_user_id,
        'system',
        v_voter_label || ' hat die Share-Bestaetigung wieder entfernt.'
      );

      update public.user_plan_group_chats
      set last_message_at = now(),
          updated_at = now()
      where id = v_chat_id;
    end if;

    return query
    select false, v_total_count;
    return;
  end if;

  insert into public.plan_choice_reactions (
    plan_id,
    voter_label,
    voter_key
  ) values (
    v_plan_id,
    v_voter_label,
    v_voter_key
  );

  select count(*)::integer
    into v_total_count
  from public.plan_choice_reactions
  where plan_id = v_plan_id;

  select count(distinct lower(btrim(value)))
    into v_expected_count
  from public.plans p
  cross join lateral jsonb_each(coalesce(p.filters -> 'variantVotes', '{}'::jsonb)) as e(key, voters)
  cross join lateral jsonb_array_elements_text(
    case
      when jsonb_typeof(e.voters) = 'array' then e.voters
      else '[]'::jsonb
    end
  ) as voter(value)
  where p.id = v_plan_id
    and btrim(value) <> '';

  if coalesce(v_expected_count, 0) > 0 then
    v_majority := greatest(2, ceil(v_expected_count / 2.0)::integer);
  else
    v_majority := null;
  end if;

  if v_chat_id is not null and v_chat_owner_user_id is not null then
    insert into public.user_plan_group_chat_messages (
      chat_id,
      sender_user_id,
      message_type,
      body
    ) values (
      v_chat_id,
      v_chat_owner_user_id,
      'system',
      v_voter_label || ' hat die gemeinsame Wahl' ||
        case
          when coalesce(v_choice_label, '') <> '' then ' "' || v_choice_label || '"'
          else ''
        end ||
        ' im Share-Link bestaetigt.'
    );

    if v_expected_count is not null and v_total_count = v_expected_count then
      insert into public.user_plan_group_chat_messages (
        chat_id,
        sender_user_id,
        message_type,
        body
      ) values (
        v_chat_id,
        v_chat_owner_user_id,
        'system',
        'Tag ist jetzt abgestimmt.'
      );
    elsif v_majority is not null and v_total_count = v_majority then
      insert into public.user_plan_group_chat_messages (
        chat_id,
        sender_user_id,
        message_type,
        body
      ) values (
        v_chat_id,
        v_chat_owner_user_id,
        'system',
        'Mehrheit fuer die gemeinsame Wahl ueber den Share-Link erreicht.'
      );
    end if;

    update public.user_plan_group_chats
    set last_message_at = now(),
        updated_at = now()
    where id = v_chat_id;
  end if;

  return query
  select true, v_total_count;
end;
$pd24$;

revoke all on function public.toggle_public_plan_choice_reaction(text, text) from public;
grant execute on function public.toggle_public_plan_choice_reaction(text, text) to anon, authenticated;

commit;

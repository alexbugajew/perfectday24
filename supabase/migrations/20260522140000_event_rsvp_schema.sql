begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- event_rsvps  — Gäste-Rückmeldungen auf geteilte Einladungen
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.event_rsvps (
  id             uuid        primary key default gen_random_uuid(),
  event_plan_id  uuid        not null references public.event_plans (id) on delete cascade,
  share_token    text        not null,
  guest_name     text        not null,
  response       text        not null
    constraint event_rsvps_response_check check (response in ('accepted', 'declined')),
  message        text,
  created_at     timestamptz not null default now()
);

create index if not exists event_rsvps_plan_idx
  on public.event_rsvps (event_plan_id, created_at desc);

create index if not exists event_rsvps_token_idx
  on public.event_rsvps (share_token);

alter table public.event_rsvps enable row level security;

-- Gäste (anon) dürfen eintragen
drop policy if exists "event_rsvps_insert_anon" on public.event_rsvps;
create policy "event_rsvps_insert_anon"
  on public.event_rsvps for insert to anon, authenticated
  with check (true);

-- Nur der Plan-Besitzer darf seine RSVPs lesen
drop policy if exists "event_rsvps_select_owner" on public.event_rsvps;
create policy "event_rsvps_select_owner"
  on public.event_rsvps for select to authenticated
  using (
    exists (
      select 1 from public.event_plans ep
      where ep.id = event_plan_id and ep.user_id = auth.uid()
    )
  );

-- ─── RPC: RSVP einreichen (anonym) ──────────────────────────────────────────

create or replace function public.submit_event_rsvp(
  p_token    text,
  p_name     text,
  p_response text,
  p_message  text default null
)
returns text
language plpgsql security definer set search_path = public
as $pd24$
declare
  v_plan_id uuid;
begin
  select id into v_plan_id
  from public.event_plans
  where share_token = p_token
  limit 1;

  if v_plan_id is null then
    return 'error:not_found';
  end if;

  -- Prevent duplicate responses from same name
  if exists (
    select 1 from public.event_rsvps
    where share_token = p_token
      and lower(guest_name) = lower(trim(p_name))
  ) then
    return 'error:duplicate';
  end if;

  insert into public.event_rsvps (event_plan_id, share_token, guest_name, response, message)
  values (v_plan_id, p_token, trim(p_name), p_response, nullif(trim(coalesce(p_message, '')), ''));

  return 'ok';
end;
$pd24$;

revoke all on function public.submit_event_rsvp(text, text, text, text) from public;
grant execute on function public.submit_event_rsvp(text, text, text, text) to anon, authenticated;

-- ─── RPC: RSVPs für Plan-Besitzer lesen ─────────────────────────────────────

create or replace function public.get_plan_rsvps(p_plan_id uuid)
returns table (
  id         uuid,
  guest_name text,
  response   text,
  message    text,
  created_at timestamptz
)
language sql security definer set search_path = public
as $pd24$
  select r.id, r.guest_name, r.response, r.message, r.created_at
  from public.event_rsvps r
  join public.event_plans ep on ep.id = r.event_plan_id
  where r.event_plan_id = p_plan_id
    and ep.user_id = auth.uid()
  order by r.created_at desc;
$pd24$;

revoke all on function public.get_plan_rsvps(uuid) from public;
grant execute on function public.get_plan_rsvps(uuid) to authenticated;

-- ─── host_display_name auf event_plans ──────────────────────────────────────
-- Optionaler Name / Einladungstext den der Gastgeber beim Teilen setzt

alter table public.event_plans
  add column if not exists host_display_name text,
  add column if not exists invite_note       text;

-- ─── Update public_event_plan_by_token to expose new invite fields ───────────

create or replace function public.public_event_plan_by_token(p_token text)
returns table (
  id                 uuid,
  title              text,
  occasion_slug      text,
  city_slug          text,
  event_date         date,
  guest_count        integer,
  selected_needs     text[],
  notes              text,
  share_token        text,
  host_display_name  text,
  invite_note        text,
  created_at         timestamptz
)
language sql security definer set search_path = public
as $pd24$
  select
    ep.id, ep.title, ep.occasion_slug, ep.city_slug,
    ep.event_date, ep.guest_count, ep.selected_needs,
    ep.notes, ep.share_token, ep.host_display_name,
    ep.invite_note, ep.created_at
  from public.event_plans ep
  where ep.share_token = p_token
  limit 1;
$pd24$;

revoke all on function public.public_event_plan_by_token(text) from public;
grant execute on function public.public_event_plan_by_token(text) to anon, authenticated;

commit;

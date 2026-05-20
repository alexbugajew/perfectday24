-- ── Business Dashboard ───────────────────────────────────────────────────────
--
-- Tables: business_members, business_event_participants
-- Security-definer RPCs for public RSVP access (avoids open RLS on anon)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── business_members ─────────────────────────────────────────────────────────

create table if not exists public.business_members (
  id                 uuid        primary key default gen_random_uuid(),
  partner_profile_id uuid        not null references public.partner_profiles(id) on delete cascade,
  name               text        not null,
  email              text,
  role               text        not null default 'member'
    constraint business_members_role_check
      check (role in ('admin', 'manager', 'member')),
  department         text,
  status             text        not null default 'active'
    constraint business_members_status_check
      check (status in ('active', 'inactive')),
  created_at         timestamptz not null default now()
);

create index if not exists business_members_partner_idx
  on public.business_members (partner_profile_id, status);

alter table public.business_members enable row level security;

drop policy if exists "business_members_all_partner" on public.business_members;
create policy "business_members_all_partner"
  on public.business_members for all to authenticated
  using (
    partner_profile_id in (
      select partner_profile_id from public.partner_memberships
      where user_id = auth.uid() and status = 'active'
    )
  )
  with check (
    partner_profile_id in (
      select partner_profile_id from public.partner_memberships
      where user_id = auth.uid() and status = 'active'
    )
  );

-- ── business_event_participants ───────────────────────────────────────────────

create table if not exists public.business_event_participants (
  id                 uuid        primary key default gen_random_uuid(),
  event_plan_id      uuid        not null references public.event_plans(id) on delete cascade,
  member_id          uuid        references public.business_members(id) on delete set null,
  guest_name         text,
  guest_email        text,
  invitation_token   text        not null unique default gen_random_uuid()::text,
  invitation_sent_at timestamptz,
  rsvp_status        text        not null default 'pending'
    constraint business_event_participants_rsvp_check
      check (rsvp_status in ('pending', 'confirmed', 'declined')),
  rsvp_at            timestamptz,
  agenda_viewed_at   timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists business_event_participants_plan_idx
  on public.business_event_participants (event_plan_id, rsvp_status);

create index if not exists business_event_participants_token_idx
  on public.business_event_participants (invitation_token);

alter table public.business_event_participants enable row level security;

drop policy if exists "business_event_participants_all_owner" on public.business_event_participants;
create policy "business_event_participants_all_owner"
  on public.business_event_participants for all to authenticated
  using (
    event_plan_id in (
      select id from public.event_plans where user_id = auth.uid()
    )
  )
  with check (
    event_plan_id in (
      select id from public.event_plans where user_id = auth.uid()
    )
  );

-- ── Security-definer RPCs for public RSVP (no open anon RLS needed) ──────────

create or replace function public.rsvp_participant_by_token(p_token text)
returns table (
  id               uuid,
  event_plan_id    uuid,
  participant_name text,
  guest_email      text,
  invitation_token text,
  rsvp_status      text,
  rsvp_at          timestamptz,
  event_title      text,
  event_date       date,
  city_slug        text,
  occasion_slug    text
)
language sql security definer set search_path = public
as $$
  select
    bep.id,
    bep.event_plan_id,
    coalesce(bm.name, bep.guest_name)   as participant_name,
    coalesce(bm.email, bep.guest_email) as guest_email,
    bep.invitation_token,
    bep.rsvp_status,
    bep.rsvp_at,
    ep.title                            as event_title,
    ep.event_date,
    ep.city_slug,
    ep.occasion_slug
  from public.business_event_participants bep
  join public.event_plans ep on ep.id = bep.event_plan_id
  left join public.business_members bm on bm.id = bep.member_id
  where bep.invitation_token = p_token
  limit 1;
$$;

revoke all on function public.rsvp_participant_by_token(text) from public;
grant execute on function public.rsvp_participant_by_token(text) to anon, authenticated;

create or replace function public.submit_rsvp(p_token text, p_status text)
returns void
language sql security definer set search_path = public
as $$
  update public.business_event_participants
  set
    rsvp_status = p_status,
    rsvp_at     = now()
  where invitation_token = p_token
    and p_status in ('confirmed', 'declined');
$$;

revoke all on function public.submit_rsvp(text, text) from public;
grant execute on function public.submit_rsvp(text, text) to anon, authenticated;

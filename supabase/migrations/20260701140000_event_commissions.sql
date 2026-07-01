-- Event-Provisions-Modul
-- ============================================================================
-- Wenn ein Kunde ein Angebot annimmt (vendor_quotes.status -> 'accepted'),
-- entsteht eine Provisions-Forderung an den Anbieter. Wir tracken sie in
-- event_commissions und lassen einen Trigger den Datensatz automatisch
-- anlegen bzw. bei Stornierung stornieren.

begin;

-- Optional pro Partner-Profile eine Custom-Rate.
alter table public.partner_profiles
  add column if not exists commission_rate_bps integer;

-- Default-Rate zentral konfigurierbar (Basis: 1000 bps = 10%).
create or replace function public.pd24_default_commission_rate_bps()
returns integer language sql immutable as $pd24$
  select 1000;
$pd24$;

create table if not exists public.event_commissions (
  id                    uuid primary key default gen_random_uuid(),
  quote_id              uuid not null unique references public.vendor_quotes (id) on delete cascade,
  inquiry_id            uuid references public.event_inquiries (id) on delete set null,
  provider_id           uuid references public.service_providers (id) on delete set null,
  partner_profile_id    uuid references public.partner_profiles (id) on delete set null,
  need_slug             text,
  city_slug             text,
  event_date            date,
  base_amount_cents     integer not null check (base_amount_cents >= 0),
  rate_bps              integer not null check (rate_bps >= 0 and rate_bps <= 5000),
  commission_cents      integer not null check (commission_cents >= 0),
  status                text not null default 'earned'
    constraint event_commissions_status_check check (
      status in ('earned', 'invoiced', 'paid', 'waived', 'cancelled')
    ),
  earned_at             timestamptz not null default now(),
  invoiced_at           timestamptz,
  paid_at               timestamptz,
  cancelled_at          timestamptz,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists event_commissions_set_updated_at on public.event_commissions;
create trigger event_commissions_set_updated_at
  before update on public.event_commissions
  for each row execute function public.pd24_set_updated_at();

create index if not exists event_commissions_status_idx
  on public.event_commissions (status, earned_at desc);

create index if not exists event_commissions_partner_idx
  on public.event_commissions (partner_profile_id, status);

create index if not exists event_commissions_provider_idx
  on public.event_commissions (provider_id, earned_at desc);

alter table public.event_commissions enable row level security;

-- Partner sieht seine eigenen Commission-Zeilen readonly (fuer Dashboard-Anzeige).
drop policy if exists "event_commissions_select_partner" on public.event_commissions;
create policy "event_commissions_select_partner"
  on public.event_commissions for select to authenticated
  using (
    partner_profile_id in (
      select partner_profile_id from public.partner_memberships
      where user_id = auth.uid() and status = 'active'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger-Funktion: reagiert auf UPDATE von vendor_quotes.status
-- - Wenn NEW.status = 'accepted' UND OLD.status != 'accepted' → insert commission
-- - Wenn NEW.status = 'cancelled' und commission existiert → status='cancelled'
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.pd24_handle_quote_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $pd24$
declare
  v_rate_bps        integer;
  v_partner_id      uuid;
  v_inquiry         public.event_inquiries%rowtype;
  v_amount          integer;
begin
  if new.status = 'accepted' and (old.status is null or old.status <> 'accepted') then
    if coalesce(new.price_cents, 0) <= 0 then
      -- Kein Preis, keine Provision. Wird ggf. nachtraeglich manuell erfasst.
      return new;
    end if;

    -- Partner-Profile via service_providers ableiten (falls verknuepft).
    select sp.partner_profile_id into v_partner_id
    from public.service_providers sp
    where sp.id = new.provider_id;

    -- Rate: pro-Partner Override falls gesetzt, sonst Default.
    if v_partner_id is not null then
      select pp.commission_rate_bps into v_rate_bps
      from public.partner_profiles pp
      where pp.id = v_partner_id;
    end if;
    v_rate_bps := coalesce(v_rate_bps, public.pd24_default_commission_rate_bps());

    select * into v_inquiry from public.event_inquiries where id = new.inquiry_id;

    v_amount := new.price_cents;

    insert into public.event_commissions (
      quote_id, inquiry_id, provider_id, partner_profile_id,
      need_slug, city_slug, event_date,
      base_amount_cents, rate_bps, commission_cents,
      status, earned_at
    ) values (
      new.id, new.inquiry_id, new.provider_id, v_partner_id,
      new.need_slug, v_inquiry.city_slug, v_inquiry.event_date,
      v_amount, v_rate_bps, (v_amount * v_rate_bps) / 10000,
      'earned', now()
    )
    on conflict (quote_id) do nothing;
  end if;

  if new.status in ('rejected', 'expired') and old.status = 'accepted' then
    update public.event_commissions
    set status = 'cancelled', cancelled_at = now()
    where quote_id = new.id and status in ('earned', 'invoiced');
  end if;

  return new;
end;
$pd24$;

drop trigger if exists vendor_quotes_commission_trigger on public.vendor_quotes;
create trigger vendor_quotes_commission_trigger
  after update of status on public.vendor_quotes
  for each row execute function public.pd24_handle_quote_status_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: Bereits akzeptierte Quotes bekommen ihre Commission nachtraeglich.
-- Idempotent via unique(quote_id).
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.event_commissions (
  quote_id, inquiry_id, provider_id, partner_profile_id,
  need_slug, city_slug, event_date,
  base_amount_cents, rate_bps, commission_cents,
  status, earned_at
)
select
  vq.id,
  vq.inquiry_id,
  vq.provider_id,
  sp.partner_profile_id,
  vq.need_slug,
  ei.city_slug,
  ei.event_date,
  coalesce(vq.price_cents, 0),
  coalesce(pp.commission_rate_bps, public.pd24_default_commission_rate_bps()),
  (coalesce(vq.price_cents, 0) * coalesce(pp.commission_rate_bps, public.pd24_default_commission_rate_bps())) / 10000,
  'earned',
  coalesce(vq.accepted_at, vq.updated_at)
from public.vendor_quotes vq
join public.event_inquiries ei on ei.id = vq.inquiry_id
left join public.service_providers sp on sp.id = vq.provider_id
left join public.partner_profiles pp on pp.id = sp.partner_profile_id
where vq.status = 'accepted'
  and coalesce(vq.price_cents, 0) > 0
on conflict (quote_id) do nothing;

commit;

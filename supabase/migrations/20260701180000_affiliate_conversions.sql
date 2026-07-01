-- Affiliate-Conversion-Tracking
-- ============================================================================
-- Schliesst die Loop: Klick → Netzwerk-Postback → Conversion in unserem System.
--
-- Ablauf:
-- 1. User klickt Affiliate-Link → /api/monetization/redirect generiert click_id
--    und schreibt sie in attribution_events.metadata.click_id + haengt sie an
--    die Ziel-URL (netzwerk-spezifisches Param: awc/epi/label)
-- 2. User bucht/kauft beim Netzwerk-Partner
-- 3. Netzwerk pingt unseren Postback-Endpoint mit click_id + Auftragswert
-- 4. Wir speichern die Conversion und verknuepfen sie mit der urspruenglichen
--    attribution_events-Zeile via click_id

begin;

-- Affiliate-Netzwerk-Kennung pro Link (default: 'other', gesetzt von Admin).
alter table public.affiliate_links
  add column if not exists network text not null default 'other'
  check (network in ('awin', 'tradedoubler', 'booking', 'direct', 'other'));

create table if not exists public.affiliate_conversions (
  id                    uuid primary key default gen_random_uuid(),
  click_id              text not null,             -- unser eigener Tracking-Identifier
  network               text not null
    constraint affiliate_conversions_network_check check (
      network in ('awin', 'tradedoubler', 'booking', 'direct', 'other')
    ),
  affiliate_link_id     uuid references public.affiliate_links (id) on delete set null,
  partner_profile_id    uuid references public.partner_profiles (id) on delete set null,

  -- Netzwerk-Referenzen fuer Reconciliation
  network_click_ref     text,                       -- ID des Netzwerks fuer den Klick
  network_order_id      text,                       -- Order-ID beim Netzwerk

  gross_amount_cents    integer,                    -- Auftragswert brutto
  commission_cents      integer,                    -- unsere Provision (falls im Postback)
  currency              text default 'EUR',

  status                text not null default 'pending'
    constraint affiliate_conversions_status_check check (
      status in ('pending', 'approved', 'rejected', 'cancelled')
    ),

  -- Zusatz-Signale vom Netzwerk (User-Agent, IP-Hash, referrer etc.)
  raw_payload           jsonb not null default '{}'::jsonb,

  received_at           timestamptz not null default now(),
  approved_at           timestamptz,
  rejected_at           timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists affiliate_conversions_set_updated_at on public.affiliate_conversions;
create trigger affiliate_conversions_set_updated_at
  before update on public.affiliate_conversions
  for each row execute function public.pd24_set_updated_at();

-- Index fuer Reconciliation
create index if not exists affiliate_conversions_click_idx
  on public.affiliate_conversions (click_id);
create index if not exists affiliate_conversions_network_status_idx
  on public.affiliate_conversions (network, status, received_at desc);
create index if not exists affiliate_conversions_partner_idx
  on public.affiliate_conversions (partner_profile_id, status);

-- Duplikat-Schutz: gleiche click_id + network_order_id soll nur einmal existieren.
-- (Netzwerke pingen manchmal doppelt bei Approval-Wechsel.)
create unique index if not exists affiliate_conversions_dedup_idx
  on public.affiliate_conversions (click_id, coalesce(network_order_id, ''))
  where network_order_id is not null;

alter table public.affiliate_conversions enable row level security;

-- Partner sieht seine eigenen Conversions readonly.
drop policy if exists "affiliate_conversions_select_partner" on public.affiliate_conversions;
create policy "affiliate_conversions_select_partner"
  on public.affiliate_conversions for select to authenticated
  using (
    partner_profile_id in (
      select partner_profile_id from public.partner_memberships
      where user_id = auth.uid() and status = 'active'
    )
  );

-- ─── Auto-Netzwerk-Detection aus destination_url ────────────────────────────
-- Wenn Admin die network-Spalte noch nicht explizit gesetzt hat, leiten wir
-- aus der Domain ab. Wird nur bei INSERT/UPDATE auf destination_url getriggert.
create or replace function public.pd24_detect_affiliate_network()
returns trigger
language plpgsql
as $pd24$
declare
  v_host text;
begin
  if new.network is not null and new.network <> 'other' then
    return new;
  end if;

  begin
    v_host := lower(split_part(regexp_replace(new.destination_url, '^https?://', ''), '/', 1));
  exception when others then
    v_host := null;
  end;

  if v_host is null then return new; end if;

  if v_host like '%.awin1.com' or v_host like 'awin1.com' or v_host like '%.awin.com' then
    new.network := 'awin';
  elsif v_host like '%tradedoubler.com' or v_host like '%tradedoubler.co%' then
    new.network := 'tradedoubler';
  elsif v_host like '%booking.com' then
    new.network := 'booking';
  end if;

  return new;
end;
$pd24$;

drop trigger if exists affiliate_links_detect_network on public.affiliate_links;
create trigger affiliate_links_detect_network
  before insert or update of destination_url on public.affiliate_links
  for each row execute function public.pd24_detect_affiliate_network();

-- Backfill fuer bestehende Zeilen
update public.affiliate_links
  set network = case
    when destination_url ~* 'awin1\.com|awin\.com' then 'awin'
    when destination_url ~* 'tradedoubler\.co' then 'tradedoubler'
    when destination_url ~* 'booking\.com' then 'booking'
    else network
  end
  where network = 'other';

commit;

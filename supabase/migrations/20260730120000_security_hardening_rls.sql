-- Security-Hardening RLS — 2026-07-30
-- ============================================================================
-- Behebt zwei Funde aus docs/security-audit-2026-07-30.md:
--
--   Fund 6  Moderations-Bypass fuer Community-Fotos: Der Client konnte
--           moderation_status selbst setzen bzw. nachtraeglich aendern. Damit
--           liess sich beliebiges Bildmaterial an der Moderation vorbei auf
--           oeffentliche Routen- und Event-Seiten bringen; ein Auto-Safety-Hold
--           liess sich auf demselben Weg zuruecksetzen.
--
--   Fund 17 Vier location_*-Tabellen ohne aktiviertes Row Level Security.
--
-- Zur Einordnung: Die oeffentliche Lese-Policy verlangt
-- moderation_status in ('approved','featured') UND visibility = 'public'.
-- Sicherheitsrelevant ist deshalb allein moderation_status — visibility bleibt
-- frei waehlbar (Default der Spalte ist ohnehin 'public'), sonst wuerden
-- legitime Uploads scheitern.
--
-- HINWEIS zur Anwendung: In diesem Projekt weicht die Live-DB von den
-- Repo-Migrationen ab (Schema-Drift). Diese Datei ist idempotent geschrieben,
-- sollte aber vor dem Ausrollen gegen den Live-Zustand geprueft werden:
--
--   select tablename, rowsecurity from pg_tables where schemaname = 'public';
--   select polname, tablename from pg_policies where schemaname = 'public';

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fund 6: media_assets — Moderationsfeld gegen Selbstvergabe schuetzen
-- ─────────────────────────────────────────────────────────────────────────────

-- Neue Uploads starten immer als 'submitted' (oder 'draft').
-- Admins duerfen direkt freigeben; die Service-Role umgeht RLS ohnehin.
drop policy if exists "media_assets_insert_own_or_partner" on public.media_assets;
create policy "media_assets_insert_own_or_partner"
  on public.media_assets for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and (
      partner_profile_id is null
      or public.pd24_is_partner_member(partner_profile_id)
    )
    and (
      public.pd24_is_app_admin()
      or moderation_status in ('draft', 'submitted')
    )
  );

-- Trigger, der Owner-Updates von den Moderationsfeldern fernhaelt.
-- Eine WITH-CHECK-Policy kann "dieses Feld darf sich nicht aendern" nicht
-- ausdruecken, weil ihr der alte Zeilenwert nicht zur Verfuegung steht.
create or replace function public.pd24_guard_media_asset_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Der Guard gilt nur fuer Anfragen aus dem Browser. PostgREST setzt die Rolle
  -- aus dem JWT, also 'anon' oder 'authenticated'. Alles andere (service_role,
  -- postgres, Migrations-/Wartungsverbindungen) darf durch — sonst liesse sich
  -- eine Moderation auch per SQL-Editor nicht mehr korrigieren.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  -- App-Admins duerfen moderieren.
  if public.pd24_is_app_admin() then
    return new;
  end if;

  -- Fuer alle anderen bleibt die Moderationsentscheidung unveraendert ...
  if new.moderation_status is distinct from old.moderation_status then
    new.moderation_status := old.moderation_status;
  end if;

  -- ... und der Eigentuemer laesst sich nicht umschreiben.
  if new.owner_user_id is distinct from old.owner_user_id then
    new.owner_user_id := old.owner_user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists media_assets_guard_moderation on public.media_assets;
create trigger media_assets_guard_moderation
  before update on public.media_assets
  for each row execute function public.pd24_guard_media_asset_moderation();

-- ─────────────────────────────────────────────────────────────────────────────
-- Zusatzfund: affiliate_conversions — fehlendes Unique-Constraint
-- ─────────────────────────────────────────────────────────────────────────────
-- Beim Verifizieren des Postback-Fixes aufgefallen: Die Route macht
--   .upsert(..., { onConflict: "click_id,network_order_id" })
-- aber ein passendes Unique-Constraint existiert nirgends. Postgres antwortet
-- daher mit 42P10 ("no unique or exclusion constraint matching the ON CONFLICT
-- specification") und es wurde NIE eine Conversion geschrieben.
--
-- NULLS NOT DISTINCT (PG15+) sorgt dafuer, dass auch Zeilen ohne
-- network_order_id dedupliziert werden. Fuer aeltere Server gibt es einen
-- Fallback auf ein normales Unique-Index-Verhalten.

do $$
begin
  if exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'affiliate_conversions'
  ) then
    if not exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and tablename = 'affiliate_conversions'
        and indexname = 'affiliate_conversions_click_order_key'
    ) then
      begin
        execute 'create unique index affiliate_conversions_click_order_key '
             || 'on public.affiliate_conversions (click_id, network_order_id) '
             || 'nulls not distinct';
      exception when syntax_error or feature_not_supported then
        -- PG < 15: ohne NULLS NOT DISTINCT anlegen.
        execute 'create unique index affiliate_conversions_click_order_key '
             || 'on public.affiliate_conversions (click_id, network_order_id)';
      end;
    end if;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fund 17: RLS fuer die vier location_*-Tabellen
-- ─────────────────────────────────────────────────────────────────────────────
-- Referenz-/Rohdaten zu Orten: lesend oeffentlich, schreibend ausschliesslich
-- ueber die Service-Role (Importer/Skripte), die RLS umgeht. Es wird daher
-- bewusst keine Insert-/Update-Policy angelegt.

do $$
declare
  target_table text;
begin
  for target_table in
    select unnest(array[
      'location_features',
      'location_manual_seeds',
      'location_source_data',
      'location_subtype_catalog'
    ])
  loop
    if exists (
      select 1 from pg_tables
      where schemaname = 'public' and tablename = target_table
    ) then
      execute format('alter table public.%I enable row level security', target_table);

      execute format(
        'drop policy if exists %I on public.%I',
        target_table || '_select_public',
        target_table
      );
      execute format(
        'create policy %I on public.%I for select to anon, authenticated using (true)',
        target_table || '_select_public',
        target_table
      );
    end if;
  end loop;
end;
$$;

commit;

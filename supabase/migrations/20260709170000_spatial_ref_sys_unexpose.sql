-- rls_disabled_in_public (ERROR) auf public.spatial_ref_sys.
--
-- STATUS 2026-08-31: BEHOBEN — aber nicht durch diese Datei.
-- Der Supabase-Support hat die PostGIS-Extension nach `extensions` verlagert.
-- Damit liegt spatial_ref_sys nicht mehr in `public`, ist ueber die Data API
-- nicht mehr erreichbar und faellt aus dem Geltungsbereich von Lint 0013.
-- Verifiziert: postgis -> extensions, GET /rest/v1/spatial_ref_sys -> PGRST205,
-- extensions.spatial_ref_sys haelt 8500 SRIDs, st_srid() funktioniert.
-- Voraussetzung dafuer war 20260709150000 (search_path um `extensions`
-- erweitert), sonst haetten die st_*-Aufrufe der App-Routinen ins Leere gezeigt.
--
-- Diese Datei bleibt als Dokumentation der Sackgasse erhalten: die do-Bloecke
-- unten sind seither wirkungslose No-ops (die Tabelle ist nicht mehr in public),
-- die Analyse daruntern erklaert, warum der naheliegende Fix nie funktionieren
-- konnte. Wer sie loeschen will, sollte vorher den Abschnitt zur REVOKE-Falle
-- gelesen haben.
--
-- Die urspruengliche Fassung dieser Datei nahm an, ein `revoke` als `postgres`
-- wuerde die anon/authenticated-Grants entfernen. Live verifiziert am
-- 2026-08-25: das stimmt nicht.
--
--   Owner der Tabelle : supabase_admin (PostGIS-Extension)
--   Grantor der Rechte: supabase_admin
--   postgres ist NICHT Mitglied von supabase_admin
--
-- `REVOKE` entfernt nur, was die ausfuehrende Rolle selbst gewaehrt hat. Wird
-- sie von einer anderen Rolle ausgefuehrt, ist sie ein No-op MIT ERFOLGSSTATUS
-- (nur eine Notice, keine exception) — deshalb lief die alte Fassung gruen
-- durch, ohne irgendetwas zu bewirken. Auch `set role supabase_privileged_role`
-- aendert daran nichts (getestet).
--
-- TATSAECHLICHER IST-ZUSTAND (per REST mit dem oeffentlichen anon-Key geprueft):
--   GET /rest/v1/spatial_ref_sys -> HTTP 200
--   anon und authenticated haben SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
--   REFERENCES, TRIGGER. Ein TRUNCATE legt saemtliche PostGIS-Operationen und
--   damit die Geo-Suche lahm. Keine Nutzerdaten betroffen; die Tabelle laesst
--   sich aus jeder PostGIS-Installation wiederherstellen.
--
-- LOESUNG: Nur der Supabase-Support kann das. Ticket-Inhalt:
--   REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated;
--   ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
--
-- Diese Migration bricht bewusst NICHT ab, damit `db push` weiter durchlaeuft.
-- Sie versucht den Fix (falls die Rechtelage sich einmal aendert) und gibt
-- danach eine WARNING aus, solange das Problem besteht.

begin;

do $$
declare
  v_offen int;
begin
  begin
    execute 'alter table public.spatial_ref_sys enable row level security';
    raise notice 'spatial_ref_sys: RLS aktiviert';
  exception when others then
    null; -- erwartet: insufficient_privilege
  end;

  begin
    execute 'revoke all on table public.spatial_ref_sys from anon, authenticated';
  exception when others then
    null;
  end;

  -- Wirkung pruefen, statt Erfolg anzunehmen.
  select count(*) into v_offen
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name  = 'spatial_ref_sys'
    and grantee in ('anon', 'authenticated');

  if v_offen > 0 then
    raise warning
      'spatial_ref_sys: % Grants fuer anon/authenticated weiterhin offen - ueber PostgREST schreibbar. Nur per Supabase-Support behebbar (siehe Kopf dieser Datei).',
      v_offen;
  else
    raise notice 'spatial_ref_sys: keine anon/authenticated-Grants mehr offen';
  end if;
end $$;

commit;

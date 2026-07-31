-- Titelbild für die Gast-Einladung (/events/agenda/[token]).
-- Der Gastgeber kann im "Einladung teilen"-Dialog ein Foto hochladen; die
-- Einladungskarte zeigt es als gerahmtes Bild unter dem Hero.
--
-- WICHTIG (Schema-Drift-Workflow): manuell im Supabase-SQL-Editor ausführen.
-- Das Frontend ist tolerant — solange diese Migration nicht läuft, blendet der
-- Share-Dialog den Upload einfach aus (Probe-Query auf die Spalte).

alter table public.event_plans
  add column if not exists cover_image_url text;

-- RPC um cover_image_url erweitern. Der Live-Stand der Funktion enthält
-- bereits host_display_name + invite_note (nur in der Live-DB, nicht in
-- 20260518110000_event_planner_schema.sql) — hier mit abgebildet, damit
-- drop+create nichts verliert.
drop function if exists public.public_event_plan_by_token(text);
create function public.public_event_plan_by_token(p_token text)
returns table (
  id                uuid,
  title             text,
  occasion_slug     text,
  city_slug         text,
  event_date        date,
  guest_count       integer,
  selected_needs    text[],
  notes             text,
  share_token       text,
  host_display_name text,
  invite_note       text,
  cover_image_url   text,
  created_at        timestamptz
)
language sql security definer set search_path = public
as $pd24$
  select
    ep.id, ep.title, ep.occasion_slug, ep.city_slug,
    ep.event_date, ep.guest_count, ep.selected_needs,
    ep.notes, ep.share_token, ep.host_display_name,
    ep.invite_note, ep.cover_image_url, ep.created_at
  from public.event_plans ep
  where ep.share_token = p_token
  limit 1;
$pd24$;

revoke all on function public.public_event_plan_by_token(text) from public;
grant execute on function public.public_event_plan_by_token(text) to anon, authenticated;

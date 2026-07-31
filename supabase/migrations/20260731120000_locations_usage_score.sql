-- KI-Qualitäts-Loop Stufe 2: gedämpftes Nutzungssignal pro Location
-- ============================================================================
-- Wird vom nächtlichen Aggregations-Job (scripts/aggregate-usage-scores.ts)
-- aus ai_plan_applied- und plan_save-Events befüllt (90-Tage-Fenster,
-- Mindestschwelle, Log-Skala, Cap 40) und fließt mit halbem Gewicht ins
-- Planner-Quality-Scoring (lib/planner/scoring.ts) ein.
-- Der Planner-Select und der Job haben Drift-Guards: Bis diese Migration
-- angewandt ist, läuft alles unverändert ohne das Signal weiter.

alter table public.locations
  add column if not exists usage_score numeric not null default 0;

comment on column public.locations.usage_score is
  'Gedämpftes Nutzungssignal aus Plan-Auswahlen (KI + Standard), nächtlich aggregiert. 0 = kein/zu wenig Signal.';

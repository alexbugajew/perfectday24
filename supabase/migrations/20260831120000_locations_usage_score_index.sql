-- Usage-Aggregation: Teilindex gegen Statement-Timeout
-- ============================================================================
-- Der nächtliche Job (aggregate-usage-scores) liest "locations where
-- usage_score > 0" — ohne Index ein Full-Scan über 470k+ Zeilen, der seit
-- 30.08. am 8s-Statement-Timeout scheiterte (Cron rot, keine Daten verloren:
-- es qualifizieren sich noch keine Zeilen). Der Teilindex ist winzig, weil
-- er nur Locations mit Nutzungssignal enthält.

create index if not exists locations_usage_score_positive_idx
  on public.locations (id)
  where usage_score > 0;

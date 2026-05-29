-- Migration: status-Spalte für Roadtrip-Routen
-- Ermöglicht das Markieren einer Route als "aktiv" (laufender Roadtrip im Profil)
-- Status-Übergänge: draft → active → completed

ALTER TABLE public.roadtrip_routes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed'));

-- Index für "Aktiver Roadtrip eines Nutzers" Query
CREATE INDEX IF NOT EXISTS idx_roadtrip_routes_author_status
  ON public.roadtrip_routes (author_user_id, status)
  WHERE author_user_id IS NOT NULL;

-- Kommentar
COMMENT ON COLUMN public.roadtrip_routes.status IS
  'draft = gespeichert/geteilt; active = laufender Roadtrip im Profil; completed = abgeschlossen';

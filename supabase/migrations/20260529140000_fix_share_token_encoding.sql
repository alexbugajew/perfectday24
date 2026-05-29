-- Fix: share_token DEFAULT verwendet 'base64url' — PostgreSQL kennt nur 'base64', 'hex', 'escape'.
-- Wir wechseln auf hex (24 Zeichen, URL-sicher ohne Sonderzeichen).

ALTER TABLE public.roadtrip_routes
  ALTER COLUMN share_token
    SET DEFAULT encode(gen_random_bytes(12), 'hex');

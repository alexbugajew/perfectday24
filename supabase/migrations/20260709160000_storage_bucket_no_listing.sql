-- Fix `public_bucket_allows_listing` (Supabase linter, WARN) for the 3 public
-- buckets (avatars, user-media, partner-media).
--
-- A public bucket serves objects through the RLS-free /storage/v1/object/public/
-- URL, so the broad "*_read_public" SELECT policy on storage.objects is only
-- enabling object LISTING — which lets a client enumerate every file in the
-- bucket. Verified the app never needs it: no .list() calls anywhere, and all
-- three buckets are displayed via getPublicUrl (profile avatars, community
-- photos, partner media). Uploads use separate INSERT policies, unaffected.
--
-- Dropping these SELECT policies stops enumeration without breaking display or
-- upload. If the postgres role lacks privilege on storage.objects, drop them via
-- Dashboard > Storage > Policies instead.

begin;

do $$
begin
  drop policy if exists "avatars_read_public"       on storage.objects;
  drop policy if exists "user_media_read_public"    on storage.objects;
  drop policy if exists "partner_media_read_public" on storage.objects;
exception
  when insufficient_privilege then
    raise notice 'insufficient privilege on storage.objects; drop the *_read_public SELECT policies via Dashboard > Storage > Policies';
end $$;

commit;

-- ── Partner Media: Storage Bucket + RLS ──────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'partner-media',
  'partner-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Public read (thumbnails in partner listings)
drop policy if exists "partner_media_read_public" on storage.objects;
create policy "partner_media_read_public"
  on storage.objects for select to public
  using (bucket_id = 'partner-media');

-- Authenticated users can upload into their own folder (folder = user-id)
drop policy if exists "partner_media_insert_own" on storage.objects;
create policy "partner_media_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'partner-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete their own files
drop policy if exists "partner_media_delete_own" on storage.objects;
create policy "partner_media_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'partner-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

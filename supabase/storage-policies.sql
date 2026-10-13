-- Makes the trip-documents bucket private and limits files to members of the trip.
-- Run once in the Supabase SQL editor. The app already requests signed links, so nothing else changes.
-- Files are stored as "<trip_id>/<document_id>_<file name>".
--
-- Adjust the membership check if your trips table stores its owner differently.

update storage.buckets set public = false where id = 'trip-documents';

drop policy if exists "trip members read documents" on storage.objects;
drop policy if exists "trip members upload documents" on storage.objects;
drop policy if exists "trip members delete documents" on storage.objects;

create policy "trip members read documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trip-documents'
    and exists (
      select 1 from public.trip_members m
      where m.trip_id::text = (storage.foldername(name))[1]
        and m.user_id = auth.uid()
    )
  );

create policy "trip members upload documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trip-documents'
    and exists (
      select 1 from public.trip_members m
      where m.trip_id::text = (storage.foldername(name))[1]
        and m.user_id = auth.uid()
    )
  );

create policy "trip members delete documents" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'trip-documents'
    and exists (
      select 1 from public.trip_members m
      where m.trip_id::text = (storage.foldername(name))[1]
        and m.user_id = auth.uid()
    )
  );

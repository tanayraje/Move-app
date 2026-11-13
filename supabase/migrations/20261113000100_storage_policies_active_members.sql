-- NOT YET APPLIED. Review, then run once in the Supabase SQL editor.
-- Replaces supabase/storage-policies.sql. Two changes from that file:
--   1. Only ACTIVE members count, so a removed or pending member loses the files too.
--   2. The trip owner is allowed even if they have no trip_members row.
-- Assumes trip_members.status and trips.owner_id exist (the app already reads both).
-- Files are stored as "<trip_id>/<document_id>_<file name>".

update storage.buckets set public = false where id = 'trip-documents';

create or replace function public.can_access_trip_files(p_trip_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from trip_members m
    where m.trip_id::text = p_trip_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  ) or exists (
    select 1 from trips t
    where t.id::text = p_trip_id
      and t.owner_id = auth.uid()
  );
$$;
revoke all on function public.can_access_trip_files(text) from public, anon;
grant execute on function public.can_access_trip_files(text) to authenticated;

drop policy if exists "trip members read documents" on storage.objects;
drop policy if exists "trip members upload documents" on storage.objects;
drop policy if exists "trip members delete documents" on storage.objects;

create policy "trip members read documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'trip-documents' and public.can_access_trip_files((storage.foldername(name))[1]));

create policy "trip members upload documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'trip-documents' and public.can_access_trip_files((storage.foldername(name))[1]));

create policy "trip members delete documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'trip-documents' and public.can_access_trip_files((storage.foldername(name))[1]));

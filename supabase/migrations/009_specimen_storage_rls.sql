-- Backup collection uploads to storage.objects. 008 only added UPDATE, so INSERT
-- was blocked by RLS ("new row violates row-level security").
-- Safe to re-run. Object keys: {auth.uid()}/{fileHash}.ext

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'specimens',
  'specimens',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "own specimen objects insert" on storage.objects;
drop policy if exists "own specimen objects select" on storage.objects;
drop policy if exists "own specimen objects update" on storage.objects;
drop policy if exists "own specimen objects delete" on storage.objects;
drop policy if exists "own specimen objects" on storage.objects;

create policy "own specimen objects"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'specimens'
  and coalesce((storage.foldername(name))[1], split_part(name, '/', 1)) = auth.uid()::text
)
with check (
  bucket_id = 'specimens'
  and coalesce((storage.foldername(name))[1], split_part(name, '/', 1)) = auth.uid()::text
);

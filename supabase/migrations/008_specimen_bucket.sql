-- Private bucket for cropped screenshot originals.
-- Object keys: {auth.uid()}/{fileHash}.jpg (see src/lib/specimenStorage.ts)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'specimens',
  'specimens',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "own specimen objects update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'specimens'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'specimens'
  and split_part(name, '/', 1) = auth.uid()::text
);

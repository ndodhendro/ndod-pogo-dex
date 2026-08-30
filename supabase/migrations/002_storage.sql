-- Private bucket `specimens` must already exist (dashboard).
-- Folders are object-key prefixes created on upload: {auth.uid()}/{imageId}.ext

create policy "own specimen objects insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'specimens'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "own specimen objects select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'specimens'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "own specimen objects delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'specimens'
  and split_part(name, '/', 1) = auth.uid()::text
);

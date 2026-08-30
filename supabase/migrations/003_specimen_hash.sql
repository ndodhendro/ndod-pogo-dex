-- Metadata backup: file hash for gallery restore. Photos stay on-device.
-- Run after 001_init.sql.

alter table public.specimens
  alter column image_path drop not null;

alter table public.specimens
  add column if not exists file_hash text;

create unique index if not exists specimens_user_file_hash
  on public.specimens (user_id, file_hash)
  where file_hash is not null;

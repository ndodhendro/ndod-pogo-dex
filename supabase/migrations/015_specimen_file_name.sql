-- Original screenshot basename with extension (e.g. Screenshot_20260916-103000.png).

alter table public.specimens add column if not exists file_name text;

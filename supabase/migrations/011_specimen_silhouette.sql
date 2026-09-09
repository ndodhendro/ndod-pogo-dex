-- Seen-but-not-caught screenshots. Not a tag; never a green cover.

alter table public.specimens add column if not exists silhouette boolean not null default false;
